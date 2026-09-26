import { Fragment } from "react";
import { Box, Link, Typography } from "@mui/material";
import { blocks } from "./markdownBlocks.js";

// Tiny, safe markdown for Sahayak replies (docs/02 SEC-16): **bold**, [text](https://…) links,
// "- " / "* " / "1. " lists and paragraphs. Everything else is plain text. It builds React
// elements only — no HTML string is ever inserted.

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;

function inline(text) {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link)
      return (
        <Link key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </Link>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ text }) {
  return (
    <Box sx={{ "& > * + *": { mt: 1 } }}>
      {blocks(text).map((b, i) =>
        b.type === "p" ? (
          <Typography key={i} sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
            {inline(b.lines.join("\n"))}
          </Typography>
        ) : (
          <Box key={i} component={b.type} sx={{ m: 0, pl: 3, "& li + li": { mt: 0.5 } }}>
            {b.lines.map((l, j) => (
              <Typography component="li" key={j} sx={{ overflowWrap: "anywhere" }}>
                {inline(l)}
              </Typography>
            ))}
          </Box>
        ),
      )}
    </Box>
  );
}
