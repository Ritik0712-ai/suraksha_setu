import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, apiErr, citizen, http, loggedInAs, server } from "./server.js";
import { STORAGE_KEYS, writeJSON } from "../lib/storage.js";
import { activeQuestions, cleanAnswers } from "../features/schemes/questions.js";

const L = (en, hi) => ({ en, hi });
const card = (over = {}) => ({
  id: "s1",
  slug: "laadli-behna-yojana",
  name: L("Laadli Behna Yojana", "लाड़ली बहना योजना"),
  benefitShort: L("Monthly help for women", "महिलाओं को हर महीने सहायता"),
  categories: ["women"],
  level: "state",
  state: "MP",
  ...over,
});
const kisan = card({
  id: "s2",
  slug: "pm-kisan",
  name: L("PM-KISAN", "पीएम किसान"),
  benefitShort: L("Yearly income support", "किसानों को सालाना सहायता"),
  categories: ["farmers"],
  level: "central",
});
const detail = (over = {}) => ({
  ...card(),
  summary: L("Monthly help", "हर महीने आर्थिक सहायता"),
  benefits: [L("A monthly amount", "हर महीने राशि")],
  eligibilityText: [L("Women in MP", "मध्य प्रदेश की महिला")],
  documents: [
    { key: "aadhaar", label: L("Aadhaar card", "आधार कार्ड"), icon: "badge" },
    { key: "samagra_id", label: L("Samagra ID", "समग्र आईडी"), icon: null },
  ],
  howToApply: [L("Apply at the GP", "ग्राम पंचायत में आवेदन करें")],
  whereToApply: [L("Gram Panchayat office", "ग्राम पंचायत कार्यालय")],
  officialUrl: "https://cmladlibahna.mp.gov.in",
  sourceName: "MP Govt. — Laadli Behna portal",
  helpline: null,
  lastVerifiedAt: new Date().toISOString(),
  version: 1,
  saved: null,
  ...over,
});

function schemesBackend({ list = [card(), kisan], one = detail() } = {}) {
  const state = { listed: [], saved: [], puts: [] };
  server.use(
    http.get("*/api/v1/schemes", ({ request }) => {
      const u = new URL(request.url);
      state.listed.push(Object.fromEntries(u.searchParams));
      const cat = u.searchParams.get("category");
      const q = u.searchParams.get("q");
      let items = list;
      if (cat) items = items.filter((s) => s.categories.includes(cat));
      if (q)
        items = items.filter((s) =>
          `${s.name.en} ${s.name.hi}`.toLowerCase().includes(q.toLowerCase()),
        );
      return HttpResponse.json({ data: items });
    }),
    http.get("*/api/v1/schemes/:slug", ({ params }) =>
      params.slug === one.slug
        ? HttpResponse.json({ data: one })
        : apiErr(404, "NOT_FOUND", "यह योजना उपलब्ध नहीं है।"),
    ),
    http.get("*/api/v1/users/me/saved-schemes", () => HttpResponse.json({ data: state.saved })),
    http.put("*/api/v1/users/me/saved-schemes/:id", async ({ params, request }) => {
      const body = await request.json();
      state.puts.push({ id: params.id, body });
      if (!state.saved.some((s) => s.id === params.id))
        state.saved.push({
          ...card({ id: params.id }),
          documentsTotal: 2,
          documentsReady: 0,
          checkedDocuments: [],
          updated: false,
        });
      return HttpResponse.json({
        data: { schemeId: params.id, checkedDocuments: body.checkedDocuments ?? [] },
      });
    }),
    http.delete("*/api/v1/users/me/saved-schemes/:id", ({ params }) => {
      state.saved = state.saved.filter((s) => s.id !== params.id);
      return HttpResponse.json({ data: { removed: true } });
    }),
    http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: [] })),
  );
  return state;
}

describe("S-14 schemes list", () => {
  it("lists schemes, filters by category and searches (debounced, in the URL)", async () => {
    const backend = schemesBackend();
    const { router } = renderApp("/schemes");
    expect(await screen.findByText("लाड़ली बहना योजना")).toBeInTheDocument();
    expect(screen.getByText("पीएम किसान")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "अभी जाँचें" })).toHaveAttribute(
      "href",
      "/schemes/check",
    );

    await userEvent.click(screen.getByRole("radio", { name: /किसान/ }));
    await waitFor(() => expect(screen.queryByText("लाड़ली बहना योजना")).not.toBeInTheDocument());
    expect(router.state.location.search).toBe("?category=farmers");

    await userEvent.click(screen.getByRole("radio", { name: "सभी" }));
    await userEvent.type(screen.getByLabelText("योजना खोजें"), "बहना");
    await waitFor(() =>
      expect(router.state.location.search).toBe("?q=%E0%A4%AC%E0%A4%B9%E0%A4%A8%E0%A4%BE"),
    );
    await waitFor(() => expect(screen.queryByText("पीएम किसान")).not.toBeInTheDocument());
    expect(backend.listed.at(-1)).toEqual({ q: "बहना" });
  });

  it("shows the empty-search message with Ask Sahayak", async () => {
    schemesBackend();
    renderApp("/schemes?q=tractor");
    expect(await screen.findByText(/“tractor” से कोई योजना नहीं मिली/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "सहायक से पूछें" })).toHaveAttribute(
      "href",
      "/sahayak?q=tractor",
    );
  });

  it("guests are sent to log in to save; citizens toggle bookmarks", async () => {
    schemesBackend();
    const { router } = renderApp("/schemes");
    await userEvent.click(
      await screen.findByRole("button", { name: "सेव करें: लाड़ली बहना योजना" }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?next=%2Fschemes");
  });

  it("citizen saves and removes a scheme", async () => {
    loggedInAs(citizen());
    const backend = schemesBackend();
    renderApp("/schemes");
    await userEvent.click(
      await screen.findByRole("button", { name: "सेव करें: लाड़ली बहना योजना" }),
    );
    expect(await screen.findByText("मेरी योजनाओं में सेव हो गई")).toBeInTheDocument();
    expect(backend.puts[0].id).toBe("s1");
    expect(
      await screen.findByRole("button", { name: "सेव है: लाड़ली बहना योजना" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("offline: shows the cached list with a note", async () => {
    writeJSON(STORAGE_KEYS.schemesList, [kisan]);
    server.use(http.get("*/api/v1/schemes", () => HttpResponse.error()));
    renderApp("/schemes");
    expect(await screen.findByText("पीएम किसान")).toBeInTheDocument();
    expect(screen.getByText(/आप ऑफ़लाइन हैं/)).toBeInTheDocument();
  });
});

describe("S-15 scheme detail", () => {
  it("shows the trust line, sections, disclaimer and official link", async () => {
    schemesBackend();
    renderApp("/schemes/laadli-behna-yojana");
    expect(
      await screen.findByRole("heading", { name: "लाड़ली बहना योजना", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /MP Govt\. — Laadli Behna portal/ })).toHaveAttribute(
      "href",
      "https://cmladlibahna.mp.gov.in",
    );
    for (const h of [
      "क्या मिलेगा",
      "कौन आवेदन कर सकता है",
      "ज़रूरी दस्तावेज़",
      "आवेदन कैसे करें",
      "कहाँ जाएँ",
    ])
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    expect(screen.getByText("आधार कार्ड")).toBeInTheDocument();
    expect(screen.getByText("अंतिम पात्रता सरकारी कार्यालय तय करेगा।")).toBeInTheDocument();
    expect(screen.queryByText(/पुरानी हो सकती है/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "क्या मैं पात्र हूँ? जाँचें" })).toHaveAttribute(
      "href",
      "/schemes/check",
    );
  });

  it("warns when the verification is older than 90 days", async () => {
    schemesBackend({ one: detail({ lastVerifiedAt: "2025-01-01T00:00:00Z" }) });
    renderApp("/schemes/laadli-behna-yojana");
    expect(
      await screen.findByText("यह जानकारी पुरानी हो सकती है। कृपया कार्यालय में पुष्टि करें।"),
    ).toBeInTheDocument();
  });

  it("saved citizens tick documents (saved on the server)", async () => {
    loggedInAs(citizen());
    const backend = schemesBackend({ one: detail({ saved: { checkedDocuments: ["aadhaar"] } }) });
    renderApp("/schemes/laadli-behna-yojana");
    expect(await screen.findByText("दस्तावेज़ तैयार: 2 में से 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "समग्र आईडी" }));
    await waitFor(() =>
      expect(backend.puts.at(-1).body.checkedDocuments.sort()).toEqual(["aadhaar", "samagra_id"]),
    );
  });

  it("404 → not available + All schemes", async () => {
    schemesBackend();
    renderApp("/schemes/unknown");
    expect(
      await screen.findByRole("heading", { name: "यह योजना उपलब्ध नहीं है।" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "सभी योजनाएं" })).toHaveAttribute("href", "/schemes");
  });

  it("offline: uses the copy of a scheme viewed before", async () => {
    writeJSON(STORAGE_KEYS.schemesViewed, [detail()]);
    server.use(http.get("*/api/v1/schemes/:slug", () => HttpResponse.error()));
    renderApp("/schemes/laadli-behna-yojana");
    expect(
      await screen.findByRole("heading", { name: "लाड़ली बहना योजना", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/आप ऑफ़लाइन हैं/)).toBeInTheDocument();
  });
});

describe("S-16 / S-17 eligibility", () => {
  it("asks one question per screen with skip logic, then shows grouped results", async () => {
    let sent = null;
    server.use(
      http.post("*/api/v1/schemes/eligibility", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          data: {
            results: [
              { ...card(), schemeId: "s1", result: "likely", reasons: [] },
              {
                ...kisan,
                schemeId: "s2",
                result: "no",
                reasons: [L("For farmers", "यह योजना किसानों के लिए है")],
              },
            ],
            counts: { likely: 1, maybe: 0, no: 1 },
          },
        });
      }),
      http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: [] })),
    );
    renderApp("/schemes/check");
    expect(await screen.findByText(/आपके जवाब सेव नहीं होते/)).toBeInTheDocument();
    const pick = async (name) => userEvent.click(await screen.findByRole("radio", { name }));
    await pick("मेरे लिए");
    expect(screen.getByRole("heading", { name: "लिंग" })).toBeInTheDocument();
    await pick("महिला");
    await pick("21–40");
    // Women 21–60 get the marital-status question.
    expect(await screen.findByRole("heading", { name: "वैवाहिक स्थिति" })).toBeInTheDocument();
    await pick("विवाहित");
    await pick("गृहिणी");
    await pick("पता नहीं");
    await pick("नहीं बताना चाहते");
    await pick("BPL / अंत्योदय");
    await pick("नहीं");
    await userEvent.click(await screen.findByRole("button", { name: "मेरी योजनाएं देखें" }));

    expect(await screen.findByText("आपके लिए 1 योजनाएं मिलीं")).toBeInTheDocument();
    expect(sent).toEqual({
      answers: {
        forWhom: "self",
        gender: "female",
        ageBand: "21_40",
        maritalStatus: "married",
        occupation: "homemaker",
        incomeBand: "dont_know",
        socialCategory: "undisclosed",
        rationCard: "bpl_antyodaya",
        disability: "no",
      },
    });
    expect(screen.getByRole("heading", { name: "शायद पात्र (1)" })).toBeInTheDocument();
    // "Not eligible" starts collapsed; open it to see the reason.
    await userEvent.click(screen.getByRole("button", { name: /पात्र नहीं \(1\)/ }));
    expect(await screen.findByText("यह योजना किसानों के लिए है")).toBeVisible();
    expect(screen.getByRole("link", { name: "जवाब बदलें" })).toHaveAttribute(
      "href",
      "/schemes/check",
    );
  });

  it("results without answers point to the checker", async () => {
    renderApp("/schemes/check/results");
    expect(
      await screen.findByRole("heading", { name: "पहले कुछ सवालों के जवाब दें।" }),
    ).toBeInTheDocument();
  });

  it("question logic: gender from the profile, marital status only for women 21–60", () => {
    expect(activeQuestions({ forWhom: "self" }, "female")).not.toContain("gender");
    expect(activeQuestions({ forWhom: "family_member" }, "female")).toContain("gender");
    expect(activeQuestions({ gender: "female", ageBand: "gt_60" })).not.toContain("maritalStatus");
    expect(
      cleanAnswers({ forWhom: "self", maritalStatus: "married", ageBand: "gt_60" }, "female"),
    ).toEqual({
      forWhom: "self",
      ageBand: "gt_60",
      gender: "female",
    });
  });
});

describe("S-18 my schemes", () => {
  it("lists saved schemes with document progress and removes one", async () => {
    loggedInAs(citizen());
    const backend = schemesBackend();
    backend.saved.push({
      ...card(),
      documentsTotal: 5,
      documentsReady: 3,
      checkedDocuments: [],
      updated: true,
    });
    renderApp("/my-schemes");
    expect(await screen.findByText("दस्तावेज़ तैयार: 5 में से 3")).toBeInTheDocument();
    expect(screen.getByText("बदली गई")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "हटाएँ: लाड़ली बहना योजना" }));
    expect(await screen.findByText(/कोई योजना सेव नहीं है/)).toBeInTheDocument();
    expect(screen.queryByText("दस्तावेज़ तैयार: 5 में से 3")).not.toBeInTheDocument();
  });
});
