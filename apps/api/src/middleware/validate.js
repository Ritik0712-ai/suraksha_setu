import { AppError } from "../lib/errors.js";

// Zod issue → the { field, issue } shape of docs/02 §7.1. Custom refinements put their issue
// code in `message` (e.g. "invalid_phone", "only_digits").
function toIssue(i) {
  if (i.code === "invalid_type" && i.received === "undefined") return "required";
  if (i.code === "too_small") return "too_short";
  if (i.code === "too_big") return "too_long";
  if (i.code === "custom") return i.message;
  return "invalid";
}

/** validate({ body, query, params }) — replaces each part with the parsed (normalised) value. */
export function validate(schemas) {
  return (req, _res, next) => {
    const details = [];
    for (const part of ["params", "query", "body"]) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) {
        if (part === "query") req.validatedQuery = result.data;
        else req[part] = result.data;
      } else {
        for (const i of result.error.issues)
          details.push({ field: i.path.join(".") || part, issue: toIssue(i) });
      }
    }
    if (details.length) return next(new AppError("VALIDATION_ERROR", "validation", details));
    next();
  };
}
