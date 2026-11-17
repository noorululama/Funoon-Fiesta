import { connectDB } from "@/lib/db";
import { AiSettingsModel } from "@/lib/models";

export function isQuotaError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return /\b429\b|quota|RESOURCE_EXHAUSTED|rate.?limit|too many requests/i.test(msg);
}

let limitActiveCache: boolean | null = null; // avoids a database write on every successful reply
let lastOkWrite = 0;

/** Called when every model failed because the key's quota is used up. */
export async function recordAiLimitHit(detail?: string) {
  try {
    await connectDB();
    await AiSettingsModel.findOneAndUpdate(
      { key: "ai" },
      {
        $set: { limitActive: true, limitHitAt: new Date(), limitMessage: (detail ?? "").slice(0, 300) },
        $inc: { limitHits: 1 },
      },
      { upsert: true },
    );
    limitActiveCache = true;
  } catch {}
}

/** Called after a successful answer: clears the limit flag. */
export async function recordAiSuccess() {
  const now = Date.now();
  if (limitActiveCache === false && now - lastOkWrite < 5 * 60_000) return;
  try {
    await connectDB();
    await AiSettingsModel.findOneAndUpdate(
      { key: "ai" },
      { $set: { limitActive: false, lastOkAt: new Date() } },
      { upsert: true },
    );
    limitActiveCache = false;
    lastOkWrite = now;
  } catch {}
}

export async function clearAiLimit() {
  limitActiveCache = null;
  try {
    await connectDB();
    await AiSettingsModel.findOneAndUpdate({ key: "ai" }, { $set: { limitActive: false } }, { upsert: true });
  } catch {}
}

export interface AiStatus {
  limitActive: boolean;
  limitHitAt: string | null;
  limitHits: number;
  lastOkAt: string | null;
  message: string;
}

export async function getAiStatus(): Promise<AiStatus> {
  try {
    await connectDB();
    const d = await AiSettingsModel.findOne({ key: "ai" }).lean();
    return {
      limitActive: !!d?.limitActive,
      limitHitAt: d?.limitHitAt ? new Date(d.limitHitAt).toISOString() : null,
      limitHits: d?.limitHits ?? 0,
      lastOkAt: d?.lastOkAt ? new Date(d.lastOkAt).toISOString() : null,
      message: d?.limitMessage ?? "",
    };
  } catch {
    return { limitActive: false, limitHitAt: null, limitHits: 0, lastOkAt: null, message: "" };
  }
}
