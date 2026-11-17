import { connectDB } from "@/lib/db";
import { AiSettingsModel } from "@/lib/models";

/**
 * The Gemini key can be changed from Admin → Settings → AI Assistant.
 * A key saved there wins; otherwise the GEMINI_API_KEY environment variable is used.
 */
let cache: { value: string | null; at: number } | null = null;
const TTL_MS = 30_000;

export function invalidateGeminiKeyCache() {
  cache = null;
}

async function readSavedKey(): Promise<string | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: string | null = null;
  try {
    await connectDB();
    const doc = await AiSettingsModel.findOne({ key: "ai" }).lean();
    value = doc?.geminiApiKey?.trim() || null;
  } catch {
    value = null; // database unavailable: fall back to the env key
  }
  cache = { value, at: Date.now() };
  return value;
}

export async function getGeminiApiKey(): Promise<string | null> {
  return (await readSavedKey()) || process.env.GEMINI_API_KEY?.trim() || null;
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

export async function getGeminiKeyStatus(): Promise<{ source: "admin" | "env" | "none"; masked: string }> {
  const saved = await readSavedKey();
  if (saved) return { source: "admin", masked: maskKey(saved) };
  const env = process.env.GEMINI_API_KEY?.trim();
  if (env) return { source: "env", masked: maskKey(env) };
  return { source: "none", masked: "" };
}
