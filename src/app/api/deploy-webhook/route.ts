import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_PORT = process.env.DEPLOY_WEBHOOK_PORT || "11414";
const TARGET_URL = `http://127.0.0.1:${WEBHOOK_PORT}/deploy-webhook`;

export async function GET(req: NextRequest) {
  try {
    const targetWithQuery = `${TARGET_URL}${req.nextUrl.search}`;
    const res = await fetch(targetWithQuery, {
      method: "GET",
      headers: {
        "x-deploy-token": req.headers.get("x-deploy-token") || "",
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Webhook service unavailable", details: error?.message },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers: Record<string, string> = {
      "content-type": req.headers.get("content-type") || "application/json",
    };

    const signature = req.headers.get("x-hub-signature-256");
    if (signature) headers["x-hub-signature-256"] = signature;

    const event = req.headers.get("x-github-event");
    if (event) headers["x-github-event"] = event;

    const token = req.headers.get("x-deploy-token");
    if (token) headers["x-deploy-token"] = token;

    const res = await fetch(TARGET_URL, {
      method: "POST",
      headers,
      body,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to forward deploy webhook", details: error?.message },
      { status: 502 }
    );
  }
}
