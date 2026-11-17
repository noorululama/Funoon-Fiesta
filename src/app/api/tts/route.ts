import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Male host voice for every device, using Azure AI Speech (official API).
 * Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (for example, "centralindia")
 * in the server environment. Browser voices are not used as a fallback because
 * their gender cannot be reliably determined.
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

// Keyless fallback so the host always has a voice when Azure Speech is not configured.
function splitForFallback(text: string, max = 180): string[] {
  const parts: string[] = [];
  let rest = text.replace(/\s+/g, " ").trim();
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf(". ", max), rest.lastIndexOf("? ", max), rest.lastIndexOf("! ", max), rest.lastIndexOf(", ", max), rest.lastIndexOf(" ", max));
    if (cut < 40) cut = max;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function fallbackSpeech(text: string): Promise<Response> {
  const lang = /[ഀ-ൿ]/.test(text) ? "ml" : "en";
  const chunks: Uint8Array[] = [];
  for (const part of splitForFallback(text)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(part)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`Fallback voice responded ${res.status}`);
      chunks.push(new Uint8Array(await res.arrayBuffer()));
    } finally {
      clearTimeout(timer);
    }
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return new Response(out as BodyInit, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
}

export async function POST(req: Request) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    try {
      const body = (await req.json()) as { text?: unknown };
      const clean = typeof body.text === "string" ? body.text.trim() : "";
      if (!clean) return NextResponse.json({ error: "Text is required" }, { status: 400 });
      if (clean.length > MAX_CHARS) return NextResponse.json({ error: `Text must be ${MAX_CHARS} characters or fewer.` }, { status: 413 });
      return await fallbackSpeech(clean);
    } catch (error) {
      console.error("TTS fallback error:", error);
      return NextResponse.json({ error: "Voice unavailable" }, { status: 502 });
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(region)) {
    return NextResponse.json({ error: "Speech region configuration is invalid." }, { status: 500 });
  }

  try {
    let parsedBody: unknown;
    try {
      parsedBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Send valid text for voice playback." }, { status: 400 });
    }
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: "Send valid text for voice playback." }, { status: 400 });
    }
    const body = parsedBody as { text?: unknown };
    if (typeof body.text !== "string") {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }
    const clean = body.text.trim();
    if (!clean) return NextResponse.json({ error: "Text is required" }, { status: 400 });
    if (clean.length > MAX_CHARS) {
      return NextResponse.json({ error: `Text must be ${MAX_CHARS} characters or fewer.` }, { status: 413 });
    }

    const isMl = /[ഀ-ൿ]/.test(clean);
    const voice = isMl ? VOICES.ml : VOICES.en;
    const cacheKey = `${voice}|${clean}`;

    let audio = audioCache.get(cacheKey);
    if (!audio) {
      const lang = isMl ? "ml-IN" : "en-IN";
      const ssml =
        `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${voice}'>` +
        `<prosody rate='+6%'>${escapeXml(clean)}</prosody></voice></speak>`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "funoon-fiesta",
          },
          body: ssml,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
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
