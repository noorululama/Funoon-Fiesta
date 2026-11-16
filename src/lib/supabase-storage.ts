import "server-only";

import { createClient } from "@supabase/supabase-js";

const POSTER_TEMPLATE_BUCKET = process.env.SUPABASE_POSTER_BUCKET?.trim() || "poster-templates";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseStorageAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseAdmin;
}

export function getPosterTemplateBucket() {
  return POSTER_TEMPLATE_BUCKET;
}

export function getPosterTemplateObjectPath(fileUrl: string): string | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;

  try {
    const assetUrl = new URL(fileUrl);
    const projectUrl = new URL(supabaseUrl);
    const publicObjectPrefix = `/storage/v1/object/public/${POSTER_TEMPLATE_BUCKET}/`;

    if (assetUrl.origin !== projectUrl.origin || !assetUrl.pathname.startsWith(publicObjectPrefix)) {
      return null;
    }

    const objectPath = decodeURIComponent(assetUrl.pathname.slice(publicObjectPrefix.length));
    if (!objectPath || objectPath.split("/").some((part) => part === "..")) return null;

    return objectPath;
  } catch {
    return null;
  }
}
