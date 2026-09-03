import { NextRequest, NextResponse } from "next/server";

function getClerkFrontendApi(): string {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!publishableKey) return "firm-slug-85.clerk.accounts.dev";

  try {
    const rawKey = publishableKey.replace(/^pk_(test|live)_/, "");
    const decoded = Buffer.from(rawKey, "base64").toString("utf-8");
    return decoded.replace(/\$$/, "");
  } catch {
    return "firm-slug-85.clerk.accounts.dev";
  }
}

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetHost = getClerkFrontendApi();
  const subPath = path ? path.join("/") : "";
  const search = req.nextUrl.search;
  const targetUrl = `https://${targetHost}/${subPath}${search}`;

  const headers = new Headers(req.headers);
  headers.set("host", targetHost);
  headers.delete("content-length");

  try {
    const body =
      req.method !== "GET" && req.method !== "HEAD"
        ? await req.arrayBuffer()
        : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Clerk proxy error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to proxy Clerk request" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
