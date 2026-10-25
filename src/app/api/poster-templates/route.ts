import { NextResponse } from "next/server";
import { getActivePosterTemplates } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await getActivePosterTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch active poster templates:", error);
    return NextResponse.json({ error: "Failed to fetch poster templates" }, { status: 500 });
  }
}
