import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://movienexus-backend:8000/api";
const ADMIN_KEY = process.env.ADMIN_API_KEY || "";
const READ_KEY = process.env.READ_API_KEY || "";

const ADMIN_PREFIXES = ["/admin", "/import", "/plex", "/export", "/backfill"];

function getApiKey(path: string): string {
  return ADMIN_PREFIXES.some((p) => path.startsWith(p)) ? ADMIN_KEY : READ_KEY;
}

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  // Validate auth: JWT session OR bypass cookie (no bcryptjs/Prisma imports)
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const bypassToken = process.env.ADMIN_BYPASS_TOKEN || "";
  const bypassCookie = req.cookies.get("nexus_bypass")?.value || "";
  const hasBypass = bypassToken && bypassCookie === bypassToken;
  if (!token && !hasBypass) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const apiPath = "/" + path.join("/");
  const apiKey = getApiKey(apiPath);
  const url = new URL(`${BACKEND_URL}${apiPath}`);

  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }

  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const fetchInit: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    fetchInit.body = await req.text();
  }

  const res = await fetch(url.toString(), fetchInit);
  const data = await res.text();

  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
