// Block splitter for the tiny Sahayak markdown (see Markdown.jsx).

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;

/** Splits text into blocks: { type: "p" | "ul" | "ol", lines } */
export function blocks(text) {
  const out = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trimEnd();
    const type = BULLET.test(line) ? "ul" : NUMBER.test(line) ? "ol" : line.trim() ? "p" : null;
    if (!type) {
      out.push(null);
      continue;
    }
    const content = line.replace(type === "ul" ? BULLET : type === "ol" ? NUMBER : /^/, "");
    const last = out.at(-1);
    if (last && last.type === type && type !== "p") last.lines.push(content);
    else if (last && last.type === "p" && type === "p") last.lines.push(content);
    else out.push({ type, lines: [content] });
  }
  return out.filter(Boolean);
}
