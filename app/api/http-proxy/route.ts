import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url, method, headers, body } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    // Block private/internal IPs
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.") ||
        hostname === "[::1]"
      ) {
        return NextResponse.json({ error: "Adresses locales non autorisées" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "URL invalide" }, { status: 400 });
    }

    const outHeaders: Record<string, string> = { ...(headers || {}) };
    // Always send a User-Agent — many APIs (Wikipedia, GitHub…) rate-limit or block without one
    if (!outHeaders["User-Agent"] && !outHeaders["user-agent"]) {
      outHeaders["User-Agent"] = "FreeGTM/1.0 (https://cold-to-cash.com)";
    }

    const fetchOpts: RequestInit = {
      method: method || "GET",
      headers: outHeaders,
    };

    if (method === "POST" && body) {
      fetchOpts.body = body;
      if (!headers?.["Content-Type"]) {
        (fetchOpts.headers as Record<string, string>)["Content-Type"] = "application/json";
      }
    }

    const res = await fetch(url, fetchOpts);
    const contentType = res.headers.get("content-type") || "";

    let data: unknown;
    const rawText = await res.text();
    if (!rawText) {
      data = "";
    } else if (contentType.includes("application/json")) {
      try { data = JSON.parse(rawText); } catch { data = rawText; }
    } else {
      data = rawText;
    }

    if (!res.ok) {
      const retryAfter = res.headers.get("retry-after");
      return NextResponse.json(
        { error: `Erreur ${res.status}`, status: res.status, data, ...(retryAfter ? { retryAfter } : {}) },
        { status: res.status },
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
