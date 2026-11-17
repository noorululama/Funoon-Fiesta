import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { getFestDataForAI } from "@/lib/chatbot-service";
import { NextResponse } from "next/server";
import { getGeminiApiKey } from "@/lib/ai-key";
import { isQuotaError, recordAiLimitHit, recordAiSuccess } from "@/lib/ai-status";

const ALL_MODELS = [
    "gemini-3.8-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash"
];
const MAX_MESSAGE_CHARS = 1200;
const MAX_HISTORY_MESSAGES = 12;
// Remember which model answered last so a broken/slow one is not retried first on every request.
let preferredModel: string | null = null;
const FIRST_CHUNK_TIMEOUT_MS = 4500;

class FirstChunkTimeout extends Error {}

type StreamChunk = { text: () => string };
type ChatRole = "user" | "assistant";
type RawHistoryMessage = { role?: unknown; content?: unknown };

function sanitizeHistory(value: unknown): Content[] {
    if (!Array.isArray(value)) return [];

    const candidates = (value as RawHistoryMessage[])
        .slice(-MAX_HISTORY_MESSAGES * 2)
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const role = item.role;
            const content = typeof item.content === "string" ? item.content.trim().slice(0, MAX_MESSAGE_CHARS) : "";
            if ((role !== "user" && role !== "assistant") || !content) return null;
            return { role: role as ChatRole, content };
        })
        .filter((item): item is { role: ChatRole; content: string } => item !== null);

    const normalized: Content[] = [];
    let expected: ChatRole = "user";
    for (const item of candidates) {
        if (item.role !== expected) continue;
        normalized.push({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.content }],
        });
        expected = item.role === "user" ? "assistant" : "user";
    }

    // Gemini chat history starts with a user turn, ends with a model turn, and must be turn-paired.
    while (normalized[0]?.role === "model") normalized.shift();
    if (normalized[normalized.length - 1]?.role === "user") normalized.pop();
    let recent = normalized.slice(-MAX_HISTORY_MESSAGES);
    while (recent[0]?.role === "model") recent = recent.slice(1);
    return recent;
}

async function openStream(
    genAI: GoogleGenerativeAI,
    modelName: string,
    systemInstruction: string,
    history: Content[],
    message: string,
    maxOutputTokens: number,
) {
    const attempt = async (noThinking: boolean) => {
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction,
            generationConfig: {
                temperature: 0.25,
                maxOutputTokens,
                // Spot answers do not need long "thinking": turning it off cuts the wait before the first word.
                ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
        });
        const chat = model.startChat({ history });
        // The request itself can hang before any stream exists, so the whole start-up is time-boxed.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new FirstChunkTimeout("first chunk timeout")), FIRST_CHUNK_TIMEOUT_MS + 3500);
        });
        const started = (async () => {
            const result = await chat.sendMessageStream(message);
            const iterator = result.stream[Symbol.asyncIterator]() as AsyncIterator<StreamChunk>;
            const first = await iterator.next();
            return { iterator, first };
        })();
        started.catch(() => {});
        let iterator: AsyncIterator<StreamChunk>;
        let first: IteratorResult<StreamChunk>;
        try {
            ({ iterator, first } = await Promise.race([started, deadline]));
        } finally {
            clearTimeout(timer);
        }
        if (first.done || !first.value) throw new Error("empty stream");
        return { iterator, first: first.value as StreamChunk };
    };
    try {
        return await attempt(true);
    } catch (err) {
        if (err instanceof FirstChunkTimeout) throw err;
        // The model may reject the thinking setting: retry once in plain mode.
        return await attempt(false);
    }
}

export async function POST(req: Request) {
    try {
        let parsedBody: unknown;
        try {
            parsedBody = await req.json();
        } catch {
            return NextResponse.json({ error: "Please send a valid question." }, { status: 400 });
        }
        if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
            return NextResponse.json({ error: "Please send a valid question." }, { status: 400 });
        }
        const body = parsedBody as { message?: unknown; mode?: unknown; history?: unknown };

        const message = typeof body.message === "string" ? body.message.trim() : "";
        const mode = body.mode === undefined ? "chat" : body.mode;
        if (!message) {
            return NextResponse.json({ error: "Type a question before sending it." }, { status: 400 });
        }
        if (message.length > MAX_MESSAGE_CHARS) {
            return NextResponse.json({ error: `Keep each question under ${MAX_MESSAGE_CHARS} characters.` }, { status: 400 });
        }
        if (mode !== "chat" && mode !== "character") {
            return NextResponse.json({ error: "Choose a valid assistant mode." }, { status: 400 });
        }

        const history = sanitizeHistory(body.history);
        const apiKey = await getGeminiApiKey();
        if (!apiKey) {
            return NextResponse.json(
                { error: "The AI assistant has no API key yet. Add one in Admin > Settings > AI Assistant or set GEMINI_API_KEY on the server." },
                { status: 500 }
            );
        }

        // Use earlier user questions to resolve follow-ups such as "what about that team?" and
        // to find a participant when their name was mentioned in the previous turn.
        const contextQuery = [
            ...history.filter((item) => item.role === "user").map((item) => item.parts.map((part) => "text" in part ? part.text : "").join(" ")),
            message,
        ].join(" ").slice(-MAX_MESSAGE_CHARS * 4);
        const festData = await getFestDataForAI(false, contextQuery);
        const isCharacterMode = mode === "character";

        const systemInstruction = `You are the ${isCharacterMode ? "spoken Malayalam AI host" : "helpful AI assistant"} for Funoon Fiesta 2026.

CURRENT FESTIVAL RECORDS (the source of truth):
${festData}

HOW TO ANSWER:
- Answer the user's actual question directly. Do not repeat greetings or introduce yourself unless asked.
- Use the conversation history only to understand follow-up references. Current festival records take priority over anything an earlier reply said.
- Use only the festival records above for festival facts. Never guess scores, winners, dates, rules, or participant details. If something is missing, say it is not available in the published records.
- If the question is genuinely unclear, ask one short clarifying question instead of guessing.
- If a request is outside the festival, briefly say you can help with Funoon Fiesta information and invite a festival question.
- Never reveal passwords, private credentials, internal IDs, or administrative tokens.
- Keep the tone warm, respectful, and natural.
${isCharacterMode
    ? `SPOKEN HOST STYLE:
- Reply in simple, conversational Malayalam, even when the user asks in English or Manglish.
- Keep it to one to three short sentences, suitable for a live male voice.
- Do not use markdown, emoji, headings, or decorative symbols.`
    : `TEXT CHAT STYLE:
- Reply in the same language as the user's latest message. If the user uses Manglish, use simple Malayalam.
- Keep the answer concise but complete. Use a short list when it makes several facts easier to scan.
- Use Markdown only when it improves readability; do not add unnecessary headings.`}`;

        const genAI = new GoogleGenerativeAI(apiKey);
        const candidateModels = preferredModel
            ? [preferredModel, ...ALL_MODELS.filter((m) => m !== preferredModel)]
            : ALL_MODELS;
        const maxOutputTokens = isCharacterMode ? 180 : 650;

        let selected: { iterator: AsyncIterator<StreamChunk>; first: StreamChunk } | null = null;
        let lastStreamError: unknown = null;
        let sawQuotaError = false;

        // Stream every answer (spoken and written) so the first words show up in about a second.
        for (const modelName of candidateModels) {
            try {
                selected = await openStream(genAI, modelName, systemInstruction, history, message, maxOutputTokens);
                preferredModel = modelName;
                break;
            } catch (err) {
                lastStreamError = err;
                if (isQuotaError(err)) sawQuotaError = true;
                console.warn(`Streaming model ${modelName} failed, attempting fallback...`);
            }
        }

        if (!selected) {
            if (sawQuotaError) {
                void recordAiLimitHit(String((lastStreamError as any)?.message ?? ""));
                return NextResponse.json(
                    { error: "The AI assistant has reached its usage limit. Please try again in a little while." },
                    { status: 429 },
                );
            }
            throw lastStreamError || new Error("No model returned a stream response");
        }

        void recordAiSuccess();
        const { iterator, first: initialChunk } = selected;
        const encoder = new TextEncoder();
        const responseBody = new ReadableStream<Uint8Array>({
            async start(controller) {
                const enqueueText = (chunk: StreamChunk) => {
                    const text = chunk.text();
                    if (text) controller.enqueue(encoder.encode(text));
                };

                try {
                    enqueueText(initialChunk);
                    while (true) {
                        const next = await iterator.next();
                        if (next.done) break;
                        if (next.value) enqueueText(next.value);
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
            cancel() {
                void iterator.return?.();
            },
        });

        return new Response(responseBody, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (error) {
        console.error("Chatbot Error:", error);
        return NextResponse.json(
            { error: "The assistant could not complete that reply. Please try again." },
            { status: 500 }
        );
    }
}
