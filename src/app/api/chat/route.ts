import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFestDataForAI } from "@/lib/chatbot-service";
import { NextResponse } from "next/server";

const ALL_MODELS = [
    "gemini-3.8-flash",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash"
];
// Remember which model answered last so a broken/slow one is not retried first on every request.
let preferredModel: string | null = null;
const FIRST_CHUNK_TIMEOUT_MS = 4500;

class FirstChunkTimeout extends Error {}

type StreamChunk = { text: () => string };

async function openStream(genAI: GoogleGenerativeAI, modelName: string, prompt: string, maxOutputTokens: number) {
    const attempt = async (noThinking: boolean) => {
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.25,
                maxOutputTokens,
                // Spot answers do not need long "thinking": turning it off cuts the wait before the first word.
                ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
        });
        const result = await model.generateContentStream(prompt);
        const iterator = result.stream[Symbol.asyncIterator]() as AsyncIterator<StreamChunk>;
        const first = await Promise.race([
            iterator.next(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new FirstChunkTimeout("first chunk timeout")), FIRST_CHUNK_TIMEOUT_MS)),
        ]);
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
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "Gemini API key not configured" },
                { status: 500 }
            );
        }

        const { message, mode = "chat" } = await req.json();
        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        // Fetch the latest data from the database
        const festData = await getFestDataForAI(false, String(message));

        const isCharacterMode = mode === "character";

        const systemPrompt = `
You are the official ${isCharacterMode ? "3D Live AI Character Host" : "AI Assistant"} for "Funoon Fiesta 2026".

FESTIVAL DATABASE CONTEXT:
${festData}

${isCharacterMode ? `
CHARACTER PERSONA & LANGUAGE REQUIREMENTS (AI CHARACTER HOST):
1. **Simple, Clear Conversational Malayalam (ലളിതമായ സംസാരശൈലി)**:
   - Speak in simple, clear, and natural everyday Malayalam (ലളിതമായ സംസാര ഭാഷ) so anyone can easily understand.
   - Strictly avoid overly heavy, literary, or archaic Malayalam terms (കഠിനമായ പുസ്തക ഭാഷ ഒഴിവാക്കുക).
   - Use short, crisp sentences with proper commas and full stops so the male voice speaks with perfect clarity, natural pauses, and distinct pronunciation.
   - Do NOT use markdown stars (**), hashes (#), emojis, or symbols, as this is converted directly into spoken audio.
2. **Concise Spoken Voice (2 to 4 Sentences Maximum)**:
   - You are a live 3D male stage presenter delivering quick spot announcements.
   - Keep answers immediate, engaging, and brief (2 to 4 sentences).
   - If asked for programs or categories, summarize the main highlights briefly (e.g. mention General, Category A, B, C and 2-3 popular events) and invite them to check the Chat section for complete directories.
   - Even if the user asks in English or Manglish, reply in simple Malayalam.
` : `
ASSISTANT PERSONA & LANGUAGE REQUIREMENTS (AI CHAT):
1. **Multilingual & Spot Accuracy**:
   - Detect the language of the user's query and respond in the same language (Malayalam for Malayalam/Manglish, English for English).
   - Format responses clearly with concise markdown bullet points and bold highlights.
   - Give spot-on, instant, direct answers without unnecessary introductory filler.
`}

CRITICAL INSTRUCTION - DIRECT ANSWERS ONLY (NO REPETITIVE INTRODUCTIONS):
- **NEVER include repetitive introductory greetings, welcomes, or festival preambles** (e.g., do NOT start with "Welcome to Funoon Fiesta...", "Under the inspiring theme of Shathakam Saakshi...", "അസ്സലാമു അലൈക്കും... ഫുനൂൻ ഫിയസ്റ്റയിലേക്ക് സ്വാഗതം...", or other generic festival intro filler).
- **Answer the user's specific question DIRECTLY and IMMEDIATELY from the very first sentence**.
- Only explain festival history or theme if the user explicitly asks "What is Funoon Fiesta?" or "Tell me about the festival".
- Provide the exact facts, points, standings, or answers without boilerplate chatter.

GENERAL GUIDELINES:
1. **Accuracy**: Answer strictly based on the provided "FESTIVAL DATABASE CONTEXT". If an event result or detail is not yet published in the context, state directly that it has not been published yet. Do not invent or hallucinate results.
2. **Privacy**: Never disclose internal IDs, passwords, or administrative tokens.

User Query: ${message}
`;

        const genAI = new GoogleGenerativeAI(apiKey);
        const candidateModels = preferredModel
            ? [preferredModel, ...ALL_MODELS.filter((m) => m !== preferredModel)]
            : ALL_MODELS;
        const maxOutputTokens = isCharacterMode ? 180 : 650;

        let selected: { iterator: AsyncIterator<StreamChunk>; first: StreamChunk } | null = null;
        let lastStreamError: unknown = null;

        // Stream every answer (spoken and written) so the first words show up in about a second.
        for (const modelName of candidateModels) {
            try {
                selected = await openStream(genAI, modelName, systemPrompt, maxOutputTokens);
                preferredModel = modelName;
                break;
            } catch (err) {
                lastStreamError = err;
                console.warn(`Streaming model ${modelName} failed, attempting fallback...`);
            }
        }

        if (!selected) {
            throw lastStreamError || new Error("No model returned a stream response");
        }

        const { iterator, first: initialChunk } = selected;
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
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

        return new Response(body, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (error) {
        console.error("Chatbot Error:", error);
        return NextResponse.json(
            { error: "Failed to process request. Please try again." },
            { status: 500 }
        );
    }
}


