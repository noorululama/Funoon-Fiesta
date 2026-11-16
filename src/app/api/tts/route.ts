import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Male host voice for every device, using Azure AI Speech (official API).
 * Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. "centralindia") in .env.
 * Without them this route answers 501 and the chatbot falls back to the
 * best male voice the browser offers.
 */

const MAX_CHARS = 700;
const CACHE_LIMIT = 120;
const VOICES = { ml: "ml-IN-MidhunNeural", en: "en-IN-PrabhatNeural" } as const;
// Repeated lines (greetings, common answers) come back instantly.
const audioCache = new Map<string, Uint8Array>();

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: Request) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    return NextResponse.json({ error: "Server voice is not configured" }, { status: 501 });
  }

  try {
    const { text } = (await req.json()) as { text?: string };
    const clean = (text ?? "").trim().slice(0, MAX_CHARS);
    if (!clean) return NextResponse.json({ error: "Text is required" }, { status: 400 });

    const isMl = /[ഀ-ൿ]/.test(clean);
    const voice = isMl ? VOICES.ml : VOICES.en;
    const cacheKey = `${voice}|${clean}`;

    let audio = audioCache.get(cacheKey);
    if (!audio) {
      const lang = isMl ? "ml-IN" : "en-IN";
      const ssml =
        `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${voice}'>` +
        `<prosody rate='+6%'>${escapeXml(clean)}</prosody></voice></speak>`;

      const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "funoon-fiesta",
        },
        body: ssml,
      });
      if (!res.ok) throw new Error(`Azure Speech responded ${res.status}`);

      audio = new Uint8Array(await res.arrayBuffer());
      if (audioCache.size >= CACHE_LIMIT) {
        const oldest = audioCache.keys().next().value;
        if (oldest !== undefined) audioCache.delete(oldest);
      }
      audioCache.set(cacheKey, audio);
    }

    return new Response(audio as BodyInit, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: "Voice unavailable" }, { status: 502 });
  }
}
