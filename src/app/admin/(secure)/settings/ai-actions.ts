"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { connectDB } from "@/lib/db";
import { AiSettingsModel } from "@/lib/models";
import { isAdminAuthenticated } from "@/lib/auth";
import { clearAiLimit } from "@/lib/ai-status";
import { getGeminiApiKey, getGeminiKeyStatus, invalidateGeminiKeyCache } from "@/lib/ai-key";

type Result = { ok: boolean; message: string };

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) throw new Error("Not authorised");
}

async function checkKey(key: string): Promise<Result> {
  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-flash-lite-latest" });
    await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
      generationConfig: { maxOutputTokens: 8 },
    });
    return { ok: true, message: "Key works." };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
      return { ok: true, message: "Key is valid, but its quota is currently used up (429)." };
    }
    if (/API key|API_KEY_INVALID|permission|401|403/i.test(msg)) {
      return { ok: false, message: "Google rejected this key. Check it and try again." };
    }
    return { ok: false, message: "Could not verify the key right now. Try again." };
  }
}

export async function fetchAiKeyStatus() {
  await requireAdmin();
  return await getGeminiKeyStatus();
}

export async function saveGeminiKeyAction(formData: FormData): Promise<Result> {
  try {
    await requireAdmin();
    const key = String(formData.get("geminiKey") ?? "").trim();
    if (key.length < 20 || /\s/.test(key)) {
      return { ok: false, message: "That doesn't look like a valid API key." };
    }
    const verdict = await checkKey(key);
    if (!verdict.ok) return verdict;

    await connectDB();
    await AiSettingsModel.findOneAndUpdate(
      { key: "ai" },
      { $set: { geminiApiKey: key } },
      { upsert: true },
    );
    invalidateGeminiKeyCache();
    await clearAiLimit();
    return { ok: true, message: `Saved. ${verdict.message} The assistant uses it right away.` };
  } catch {
    return { ok: false, message: "Could not save the key." };
  }
}

export async function clearGeminiKeyAction(): Promise<Result> {
  try {
    await requireAdmin();
    await connectDB();
    await AiSettingsModel.findOneAndUpdate({ key: "ai" }, { $set: { geminiApiKey: "" } }, { upsert: true });
    invalidateGeminiKeyCache();
    return { ok: true, message: "Saved key removed. The assistant falls back to the server's GEMINI_API_KEY." };
  } catch {
    return { ok: false, message: "Could not remove the key." };
  }
}

export async function testCurrentKeyAction(): Promise<Result> {
  try {
    await requireAdmin();
    const key = await getGeminiApiKey();
    if (!key) return { ok: false, message: "No key is configured." };
    return await checkKey(key);
  } catch {
    return { ok: false, message: "Could not test the key." };
  }
}
