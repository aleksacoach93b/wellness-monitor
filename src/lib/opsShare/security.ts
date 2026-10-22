import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";

export const SHARE_COOKIE = "wm_ops_viewer";
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const shareHash = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const newShareToken = () => randomBytes(32).toString("base64url");
export const shareHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
export function cookieOptions(token: string, maxAge = 4 * 3600) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: `/api/live-ops-share/${token}`,
    maxAge,
  };
}
/** Trust the deployment proxy, not a client-submitted IP in a JSON body. */
export function viewerMeta(request: NextRequest, tabletHint = false) {
  const headers = request.headers;
  const rawIp = process.env.VERCEL
    ? headers.get("x-vercel-forwarded-for") || headers.get("x-forwarded-for")
    : process.env.NODE_ENV !== "production"
      ? headers.get("x-forwarded-for")
      : null;
  const first = rawIp?.split(",")[0].trim() || "";
  const ip = isIP(first) ? first.toLowerCase() : "Unavailable";
  const userAgent = (headers.get("user-agent") || "Unknown").slice(0, 500);
  const ua = userAgent.toLowerCase();
  const platform =
    /ipad/.test(ua) || (tabletHint && /macintosh/.test(ua))
      ? "iPadOS"
      : /iphone|ipod/.test(ua)
        ? "iOS"
        : /android/.test(ua)
          ? "Android"
          : /windows/.test(ua)
            ? "Windows"
            : /macintosh|mac os/.test(ua)
              ? "macOS"
              : /linux/.test(ua)
                ? "Linux"
                : "Unknown";
  const device =
    platform === "iPadOS" || (/android/.test(ua) && !/mobile/.test(ua))
      ? "Tablet"
      : /iphone|ipod|android.*mobile/.test(ua)
        ? "Phone"
        : /windows|macintosh|linux/.test(ua)
          ? "Computer"
          : "Unknown";
  const browser = /edg[a-z]*\//.test(ua)
    ? "Edge"
    : /samsungbrowser\//.test(ua)
      ? "Samsung Internet"
      : /firefox|fxios/.test(ua)
        ? "Firefox"
        : /chrome|crios/.test(ua)
          ? "Chrome"
          : /safari/.test(ua)
            ? "Safari"
            : "Unknown";
  return { ip, userAgent, device, platform, browser };
}
/** Browser mutations must carry an Origin matching the external host/protocol. */
export function shareSameOrigin(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    const protocol = process.env.VERCEL
      ? "https:"
      : new URL(request.url).protocol;
    return (
      source.host === request.headers.get("host") &&
      source.protocol === protocol
    );
  } catch {
    return false;
  }
}
export function safeResource(request: NextRequest, action: string) {
  const query = new URLSearchParams();
  for (const key of ["surveyId", "playerId", "date", "from", "to", "month"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value.slice(0, 120));
  }
  return (action + (query.size ? "?" + query : "")).slice(0, 800);
}

/** Bound the actual stream as well as Content-Length (which may be absent). */
export async function shareJson(
  request: NextRequest,
  limit: number,
): Promise<{ oversized: boolean; value: unknown }> {
  if (Number(request.headers.get("content-length") || 0) > limit)
    return { oversized: true, value: null };
  if (!request.body) return { oversized: false, value: null };
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        return { oversized: true, value: null };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return {
        oversized: false,
        value: JSON.parse(new TextDecoder().decode(bytes)),
      };
    } catch {
      return { oversized: false, value: null };
    }
  } finally {
    reader.releaseLock();
  }
}
