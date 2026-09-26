/** First 3 octets of an IPv4 address (or first 3 groups of IPv6) — never the full IP (docs/05 §5.2). */
export function ipPrefix(ip) {
  if (!ip) return undefined;
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.split(".").slice(0, 3).join(".");
  return ip.split(":").slice(0, 3).join(":");
}

export const userAgent = (req) => String(req.headers["user-agent"] || "").slice(0, 200);
