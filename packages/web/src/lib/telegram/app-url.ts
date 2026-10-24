/**
 * Dashboard base URL for Telegram deep links (same env as Next.js public URL).
 */
export function getTelegramAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Telegram rejects localhost / loopback hosts for inline keyboard `url` buttons
 * ("Wrong HTTP URL"). Plain text links in messages still work.
 */
export function isTelegramInlineButtonUrlAllowed(absoluteUrl: string): boolean {
  try {
    const u = new URL(absoluteUrl);
    const proto = u.protocol.toLowerCase();
    if (proto !== "http:" && proto !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (host === "127.0.0.1" || host.startsWith("127.")) return false;
    if (host === "::1" || host === "[::1]") return false;
    const v4inV6 = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (v4inV6?.[1]?.startsWith("127.")) return false;
    return true;
  } catch {
    return false;
  }
}
