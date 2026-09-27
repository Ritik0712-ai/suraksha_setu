import C from "../../config/constants.js";
import { schemesApi } from "../../api/endpoints.js";
import { cachedList, cacheList, isNetworkError } from "./cache.js";

// S-14's scheme list query, shared by the page and the route loader. The loader starts the
// request while the page's code is still downloading, so the list isn't fetched only after the
// screen appears (doc 06 task 8.3 — Schemes LCP). The list is public; saved state loads separately.

/** Client-side filter, used for the offline copy (same rules as the API: names + tags). */
export function filterOffline(list, { category, q }) {
  const words = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((s) => {
    if (category && !s.categories.includes(category)) return false;
    const hay = [s.name.hi, s.name.en, s.benefitShort.hi, s.benefitShort.en]
      .join(" ")
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Reads the filters from the URL the same way the page does. */
export function listParams(searchParams) {
  const raw = searchParams.get("category");
  return {
    category: C.schemeCategories.includes(raw) ? raw : "",
    q: searchParams.get("q") ?? "",
  };
}

export const schemesListQuery = ({ category, q }) => ({
  queryKey: ["schemes", category, q],
  queryFn: async () => {
    try {
      const items = await schemesApi.list({
        ...(category ? { category } : {}),
        ...(q ? { q } : {}),
      });
      if (!category && !q) cacheList(items);
      return { items, offline: false };
    } catch (err) {
      const cached = cachedList();
      if (isNetworkError(err) && cached)
        return { items: filterOffline(cached, { category, q }), offline: true };
      throw err;
    }
  },
});
