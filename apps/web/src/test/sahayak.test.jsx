import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, apiErr, citizen, http, loggedInAs, server } from "./server.js";
import { blocks } from "../features/sahayak/markdownBlocks.js";
import { letterLanguage, letterText, recipientLines } from "../features/sahayak/letter.js";

const LETTER = {
  to: "श्रीमान सरपंच/सचिव महोदय, ग्राम पंचायत महोदिया, जनपद पंचायत सीहोर",
  subject: "हैंडपंप की मरम्मत हेतु आवेदन",
  body: "निवेदन है कि हमारे मोहल्ले का हैंडपंप तीन हफ़्ते से खराब है।",
  applicantName: "रमेश कुमार",
  place: "महोदिया",
  date: "27/09/2026",
  mobile: "9876543210",
};

const msg = (over) => ({
  id: `m${Math.random().toString(36).slice(2, 8)}`,
  role: "assistant",
  text: "ठीक है",
  intent: "answer",
  cards: [],
  letter: null,
  letterEdited: null,
  createdAt: "2026-09-27T04:00:00Z",
  ...over,
});

/** In-memory Sahayak backend. `reply(body)` decides the next answer or error. */
function backend({ sessions = [], reply } = {}) {
  const state = { sessions: [...sessions], sent: [], started: [], saved: [] };
  const find = (id) => state.sessions.find((s) => s.id === id);
  server.use(
    http.get("*/api/v1/chat/sessions", () => HttpResponse.json({ data: state.sessions })),
    http.post("*/api/v1/chat/sessions", async ({ request }) => {
      const body = await request.json();
      state.started.push(body);
      const s = {
        id: `s${state.sessions.length + 1}`,
        mode: body.mode,
        letterType: body.letterType ?? null,
        schemeId: body.schemeId ?? null,
        title: body.mode === "letter" ? "पंचायत को पत्र" : "नई बातचीत",
        messageCount: 0,
        lastMessageAt: "2026-09-27T04:00:00Z",
        remainingToday: 30,
        messages:
          body.mode === "letter"
            ? [
                msg({
                  text: "आवेदक का पूरा नाम बताइए।",
                  intent: "need_info",
                  chips: ["सुनीता देवी"],
                }),
              ]
            : [],
      };
      state.sessions.unshift(s);
      return HttpResponse.json({ data: s }, { status: 201 });
    }),
    http.get("*/api/v1/chat/sessions/:id", ({ params }) =>
      find(params.id)
        ? HttpResponse.json({ data: find(params.id) })
        : apiErr(404, "NOT_FOUND", "बातचीत नहीं मिली।"),
    ),
    http.post("*/api/v1/chat/sessions/:id/messages", async ({ params, request }) => {
      const body = await request.json();
      state.sent.push(body);
      const out = reply ? reply(body) : { reply: msg({ text: "यह रहा **जवाब**" }) };
      if (out.error) return out.error;
      const s = find(params.id);
      const userMessage = msg({ role: "user", text: body.text, intent: null });
      s.messages = [...s.messages, userMessage, out.reply];
      s.remainingToday = out.remainingToday ?? 29;
      return HttpResponse.json({
        data: { session: s, userMessage, reply: out.reply, remainingToday: s.remainingToday },
      });
    }),
    http.put("*/api/v1/chat/sessions/:id/messages/:mid/letter", async ({ params, request }) => {
      const body = await request.json();
      state.saved.push(body);
      const m = find(params.id).messages.find((x) => x.id === params.mid);
      m.letterEdited = body;
      return HttpResponse.json({ data: m });
    }),
    http.delete("*/api/v1/chat/sessions/:id", ({ params }) => {
      state.sessions = state.sessions.filter((s) => s.id !== params.id);
      return HttpResponse.json({ data: { deleted: true } });
    }),
  );
  return state;
}

beforeEach(() => loggedInAs(citizen()));

describe("S-24 Sahayak home", () => {
  it("shows the greeting, start chips and recent chats", async () => {
    backend({
      sessions: [
        {
          id: "s9",
          title: "PM kisan kab aayega",
          lastMessageAt: "2026-09-20T10:00:00Z",
          messages: [],
        },
      ],
    });
    renderApp("/sahayak");
    expect(await screen.findByText(/मैं सहायक हूँ/)).toBeInTheDocument();
    for (const label of [
      "मुझे कौन-सी योजना मिल सकती है?",
      "पंचायत को पत्र लिखें",
      "आपातकालीन नंबर",
    ])
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(await screen.findByText("PM kisan kab aayega")).toBeInTheDocument();
    expect(screen.getByText(/सहायक से गलती हो सकती है/)).toBeInTheDocument();
  });

  it("a letter chip starts a letter session with Sahayak's first question", async () => {
    const state = backend();
    const { router } = renderApp("/sahayak");
    await userEvent.click(await screen.findByRole("button", { name: "पंचायत को पत्र लिखें" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sahayak/s1"));
    expect(state.started[0]).toEqual({ mode: "letter", letterType: "panchayat_complaint" });
    expect(await screen.findByText("आवेदक का पूरा नाम बताइए।")).toBeInTheDocument();
    // quick reply chip sends the profile name
    await userEvent.click(screen.getByRole("button", { name: "सुनीता देवी" }));
    await waitFor(() =>
      expect(state.sent[0]).toEqual({ text: "सुनीता देवी", skipEmergencyCheck: false }),
    );
  });

  it("a typed question starts a general chat and sends it", async () => {
    const state = backend();
    renderApp("/sahayak");
    await userEvent.type(
      await screen.findByLabelText("अपना सवाल लिखें…"),
      "Ayushman card kaise banega?",
    );
    await userEvent.click(screen.getByRole("button", { name: "भेजें" }));
    expect(await screen.findByText("जवाब", { selector: "strong" })).toBeInTheDocument();
    expect(state.started[0]).toEqual({ mode: "general" });
    expect(state.sent[0].text).toBe("Ayushman card kaise banega?");
  });

  it("the emergency chip opens the emergency screen without a chat", async () => {
    const state = backend();
    const { router } = renderApp("/sahayak");
    await userEvent.click(await screen.findByRole("button", { name: "आपातकालीन नंबर" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/emergency"));
    expect(state.started).toHaveLength(0);
  });

  it("prefills the question from ?q=", async () => {
    backend();
    renderApp("/sahayak?q=PM%20kisan");
    expect(await screen.findByLabelText("अपना सवाल लिखें…")).toHaveValue("PM kisan");
  });
});

/** Waits until the chat has loaded (the input is disabled until then), then returns it. */
async function chatInput() {
  await screen.findByRole("heading", { level: 1, name: "नई बातचीत" });
  return screen.getByLabelText("अपना सवाल लिखें…");
}

describe("S-25 Chat", () => {
  const session = (over = {}) => ({
    id: "s1",
    mode: "general",
    title: "नई बातचीत",
    messageCount: 0,
    lastMessageAt: "2026-09-27T04:00:00Z",
    remainingToday: 30,
    messages: [],
    ...over,
  });

  it("shows the emergency card instantly for 'bachao', and 'not in danger' resends", async () => {
    let release;
    const gate = new Promise((ok) => (release = ok));
    const state = backend({
      sessions: [session()],
      reply: (body) =>
        body.skipEmergencyCheck
          ? { reply: msg({ text: "बीमा योजना की जानकारी" }) }
          : { reply: msg({ role: "notice", intent: "emergency", text: "क्या आप खतरे में हैं?" }) },
    });
    server.use(
      http.post("*/api/v1/chat/sessions/:id/messages", async ({ request }) => {
        const body = await request.clone().json();
        if (!body.skipEmergencyCheck) await gate;
        return undefined; // fall through to backend()
      }),
    );
    renderApp("/sahayak/s1");
    await userEvent.type(await chatInput(), "bachao{Enter}");
    // before the server answers
    const card = await screen.findByRole("alert");
    expect(within(card).getByText("क्या आप खतरे में हैं?")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /SOS/ })).toHaveAttribute("href", "/sos");
    expect(within(card).getByRole("link", { name: "112 पर कॉल करें" })).toHaveAttribute(
      "href",
      "tel:112",
    );
    release();
    await userEvent.click(
      await screen.findByRole("button", { name: /नहीं, मैं खतरे में नहीं हूँ/ }),
    );
    expect(await screen.findByText("बीमा योजना की जानकारी")).toBeInTheDocument();
    expect(state.sent.at(-1)).toEqual({ text: "bachao", skipEmergencyCheck: true });
  });

  it("renders scheme cards and the letter card", async () => {
    backend({
      sessions: [
        session({
          messages: [
            msg({ role: "user", text: "kisan yojana", intent: null }),
            msg({
              text: "ये योजना देखें:\n- पहला\n- दूसरा",
              cards: [
                {
                  slug: "pm-kisan",
                  name: { hi: "पीएम किसान", en: "PM-KISAN" },
                  benefitShort: { hi: "सालाना सहायता", en: "Yearly help" },
                },
              ],
            }),
            msg({ id: "mL", intent: "letter_ready", text: "आपका पत्र तैयार है।", letter: LETTER }),
          ],
        }),
      ],
    });
    renderApp("/sahayak/s1");
    expect(await screen.findByText("पीएम किसान")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /देखें: पीएम किसान/ })).toHaveAttribute(
      "href",
      "/schemes/pm-kisan",
    );
    expect(screen.getByText("पहला").tagName).toBe("LI");
    expect(screen.getByRole("link", { name: "पत्र देखें" })).toHaveAttribute(
      "href",
      "/sahayak/s1/letter/mL",
    );
  });

  it("timeout → 'Couldn't get a reply' + Retry resends the same text", async () => {
    let fail = true;
    const state = backend({
      sessions: [session()],
      reply: () =>
        fail
          ? {
              error: apiErr(503, "AI_UNAVAILABLE", "जवाब नहीं आ सका।", [
                { field: "reason", issue: "failed" },
              ]),
            }
          : { reply: msg({ text: "अब जवाब आया" }) },
    });
    renderApp("/sahayak/s1");
    await userEvent.type(await chatInput(), "PM kisan{Enter}");
    expect(await screen.findByText("जवाब नहीं आ सका")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "फिर से कोशिश करें" }));
    expect(await screen.findByText("अब जवाब आया")).toBeInTheDocument();
    expect(state.sent.map((s) => s.text)).toEqual(["PM kisan", "PM kisan"]);
    expect(screen.getAllByText("PM kisan")).toHaveLength(1); // not duplicated
  });

  it("AI down → resting message with Browse schemes", async () => {
    backend({
      sessions: [session()],
      reply: () => ({
        error: apiErr(503, "AI_UNAVAILABLE", "…", [{ field: "reason", issue: "resting" }]),
      }),
    });
    renderApp("/sahayak/s1");
    await userEvent.type(await chatInput(), "hello{Enter}");
    expect(await screen.findByText(/सहायक अभी आराम कर रहा है/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "योजनाएँ देखें" })).toHaveAttribute("href", "/schemes");
  });

  it("daily limit → info bubble and the input is disabled; counter when ≤ 5 left", async () => {
    backend({
      sessions: [session({ remainingToday: 3 })],
      reply: () => ({ error: apiErr(429, "RATE_LIMITED", "आज की सीमा पूरी हो गई।") }),
    });
    renderApp("/sahayak/s1");
    expect(await screen.findByText("आज 3 संदेश बचे हैं")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("अपना सवाल लिखें…"), "hello{Enter}");
    expect(await screen.findByText(/आज की सीमा पूरी हो गई/)).toBeInTheDocument();
    expect(screen.getByLabelText("अपना सवाल लिखें…")).toBeDisabled();
  });

  it("delete chat asks first, then goes back to Sahayak home", async () => {
    const state = backend({ sessions: [session()] });
    const { router } = renderApp("/sahayak/s1");
    await userEvent.click(await screen.findByRole("button", { name: "बातचीत के विकल्प" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "बातचीत हटाएँ" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "बातचीत हटाएँ" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sahayak"));
    expect(state.sessions).toHaveLength(0);
  });

  it("unknown chat → not available", async () => {
    backend();
    renderApp("/sahayak/nope");
    expect(await screen.findByText("यह बातचीत उपलब्ध नहीं है।")).toBeInTheDocument();
  });
});

describe("S-26 Letter preview", () => {
  const withLetter = () =>
    backend({
      sessions: [
        {
          id: "s1",
          mode: "letter",
          title: "पंचायत को पत्र",
          remainingToday: 20,
          messages: [msg({ id: "mL", intent: "letter_ready", text: "तैयार", letter: LETTER })],
        },
      ],
    });

  it("lays out the formal letter in its own language and prints", async () => {
    withLetter();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderApp("/sahayak/s1/letter/mL");
    expect(await screen.findByText("सेवा में,")).toBeInTheDocument();
    expect(screen.getByText("ग्राम पंचायत महोदिया")).toBeInTheDocument();
    expect(screen.getByText(/विषय: हैंडपंप की मरम्मत हेतु आवेदन/)).toBeInTheDocument();
    expect(screen.getByText("प्रार्थी")).toBeInTheDocument();
    expect(screen.getByText("दिनांक: 27/09/2026")).toBeInTheDocument();
    expect(screen.getByText(/सहायक से लिखा गया/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp पर भेजें" }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/\?text=/,
    );
    await userEvent.click(screen.getByRole("button", { name: "प्रिंट / PDF सहेजें" }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it("edit saves the user's version", async () => {
    const state = withLetter();
    renderApp("/sahayak/s1/letter/mL");
    await userEvent.click(await screen.findByRole("button", { name: "बदलें" }));
    const subject = screen.getByLabelText("विषय");
    await userEvent.clear(subject);
    await userEvent.type(subject, "नया विषय");
    await userEvent.click(screen.getByRole("button", { name: "बदलाव सहेजें" }));
    expect(await screen.findByText(/विषय: नया विषय/)).toBeInTheDocument();
    expect(state.saved[0]).toMatchObject({
      subject: "नया विषय",
      place: "महोदिया",
      mobile: "9876543210",
    });
  });

  it("missing letter → not available", async () => {
    withLetter();
    renderApp("/sahayak/s1/letter/nope");
    expect(await screen.findByText("यह पत्र उपलब्ध नहीं है।")).toBeInTheDocument();
  });
});

describe("helpers", () => {
  it("markdown blocks: paragraphs and lists", () => {
    expect(blocks("a\nb\n\n- x\n- y\n1. z")).toEqual([
      { type: "p", lines: ["a", "b"] },
      { type: "ul", lines: ["x", "y"] },
      { type: "ol", lines: ["z"] },
    ]);
  });

  it("letter language, recipient lines and plain text", () => {
    expect(letterLanguage(LETTER)).toBe("hi");
    expect(letterLanguage({ subject: "Application", body: "Sir" })).toBe("en");
    expect(recipientLines("A, B,C")).toEqual(["A", "B", "C"]);
    const text = letterText({
      ...LETTER,
      subject: "Application for handpump",
      body: "Please repair it.",
    });
    expect(text.split("\n")[0]).toBe("To,");
    expect(text).toContain("Mobile: 9876543210");
  });
});
