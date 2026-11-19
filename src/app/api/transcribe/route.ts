import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getGeminiApiKey } from "@/lib/ai-key";

export const runtime = "nodejs";

/**
 * Speech-to-text for phones whose browser cannot do it (iPhone Safari, iOS
 * Chrome, home-screen app). Receives a 16 kHz mono WAV and returns { text }.
 */
const MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3.8-flash"];
const MAX_BYTES = 2_500_000; // ~75s of 16 kHz audio
const TIMEOUT_MS = 12_000;

export async function POST(req: Request) {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return NextResponse.json({ error: "Voice input is not configured." }, { status: 503 });

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "Recording too long." }, { status: 413 });
  if (buf.length < 8_000) return NextResponse.json({ text: "" }); // under ~0.25s: nothing said

  // Skip silent recordings (the model may invent words for silence).
  let peak = 0;
  for (let i = 44; i + 1 < buf.length; i += 2) peak = Math.max(peak, Math.abs(buf.readInt16LE(i)));
  if (peak < 600) return NextResponse.json({ text: "" });

  const lang = req.headers.get("x-voice-lang") === "ml" ? "ml" : "en";
  const prompt =
    "Transcribe this short voice recording. It may contain only noise or silence. " +
    (lang === "ml"
      ? "The speaker most likely uses Malayalam, possibly mixed with English. Write Malayalam in Malayalam script and English words in English. "
      : "The speaker most likely uses English (Indian accent), possibly mixed with Malayalam. ") +
    "Return only the exact words spoken, with no quotes, labels or explanation. If there is no clear human speech, return exactly NO_SPEECH.";

  const genAI = new GoogleGenerativeAI(apiKey);
  const audio = { inlineData: { mimeType: "audio/wav", data: buf.toString("base64") } };

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0 } });
      const result = await Promise.race([
        model.generateContent([audio, { text: prompt }]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
      ]);
      const text = result.response
        .text()
        .trim()
        .replace(/^["'“”]+|["'“”]+$/g, "")
        .trim();
      if (/^NO_SPEECH\.?$/i.test(text)) return NextResponse.json({ text: "" });
      return NextResponse.json({ text: text.slice(0, 1200) });
    } catch (e) {
      console.error(`[transcribe] ${modelName} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ error: "Could not understand the audio." }, { status: 502 });
}
