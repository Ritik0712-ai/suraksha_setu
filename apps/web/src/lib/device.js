// Thin wrappers over device features so they can be stubbed in tests and never throw.

/** Opens sms:, tel:, wa.me … links. */
export function openExternal(href) {
  window.location.href = href;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

/** sms: link with several recipients and a pre-filled body (iOS wants "&body=", others "?"). */
export function smsHref(recipients, body) {
  return `sms:${recipients.join(",")}${isIOS() ? "&" : "?"}body=${encodeURIComponent(body)}`;
}

export const whatsappHref = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

/** Keeps the screen on while the SOS screen is open (docs/03 S-07). Returns a release fn. */
export async function keepScreenOn() {
  try {
    const lock = await navigator.wakeLock?.request("screen");
    return () => lock?.release().catch(() => {});
  } catch {
    return () => {};
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
