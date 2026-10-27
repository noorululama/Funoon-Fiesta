import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFestDataForAI } from "@/lib/chatbot-service";
import { NextResponse } from "next/server";

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
        const festData = await getFestDataForAI();

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
        const candidateModels = [
            "gemini-flash-lite-latest",
            "gemini-flash-latest",
            "gemini-2.5-flash-lite"
        ];

        let text = "";
        let lastError: unknown = null;

        for (const modelName of candidateModels) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        temperature: 0.25,
                        maxOutputTokens: isCharacterMode ? 220 : 650,
                    }
                });
                const result = await model.generateContent(systemPrompt);
                text = result.response.text();
                if (text) break;
            } catch (err) {
                lastError = err;
                console.warn(`Model ${modelName} failed, attempting fallback...`);
            }
        }

        if (!text) {
            throw lastError || new Error("All AI models failed to respond");
        }

        return NextResponse.json({ response: text });
    } catch (error) {
        console.error("Chatbot Error:", error);
        return NextResponse.json(
            { error: "Failed to process request. Please try again." },
            { status: 500 }
        );
    }
}


