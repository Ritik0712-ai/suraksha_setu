import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, apiErr, citizen, http, loggedInAs, server } from "./server.js";
import { dispatchSocketEvent } from "../lib/socket.js";

// Device features are stubbed: we check which links would open instead of leaving the page.
vi.mock("../lib/device.js", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    openExternal: vi.fn(),
    vibrate: vi.fn(),
    keepScreenOn: vi.fn(async () => () => {}),
  };
});
const device = await import("../lib/device.js");

const HERE = { latitude: 23.2005, longitude: 77.0805, accuracy: 12 };

function mockGeo(mode = "ok") {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok, fail) =>
        mode === "ok" ? ok({ coords: HERE }) : fail({ code: mode === "denied" ? 1 : 3 }),
    },
  });
}

const sosView = (over = {}) => ({
  id: "s1",
  status: "ACTIVE",
  triggeredAt: new Date().toISOString(),
  lastUpdateAt: new Date().toISOString(),
  locationSource: "gps",
  approximate: false,
  lastLocation: { lat: 23.2005, lng: 77.0805 },
  lastAccuracyM: 12,
  trackUrl: "https://app.test/track/abc",
  smsRecipients: ["+919811111111", "+919822222222"],
  smsBody: "Sunita Devi को मदद चाहिए! लाइव लोकेशन: https://app.test/track/abc",
  contacts: [
    { name: "Maa", relation: "mother", phone: "+919811111111", emailed: true },
    { name: "Bhaiya", relation: "brother", phone: "+919822222222", emailed: false },
  ],
  emailTargets: 1,
  emailedCount: 1,
  acknowledgedBy: null,
  acknowledgedAt: null,
  resolvedAt: null,
  closeOutcome: null,
  existing: false,
  ...over,
});

/** A backend for /sos: records POST bodies, serves the SOS, and applies acknowledge/resolve. */
function sosBackend(initial = {}) {
  const state = { view: sosView(initial), posts: [], resolved: 0 };
  server.use(
    http.post("*/api/v1/sos", async ({ request }) => {
      state.posts.push(await request.json());
      return HttpResponse.json({ data: state.view }, { status: 201 });
    }),
    http.get("*/api/v1/sos/s1", () => HttpResponse.json({ data: state.view })),
    http.post("*/api/v1/sos/s1/resolve", () => {
      state.resolved += 1;
      state.view = { ...state.view, status: "RESOLVED_SAFE", resolvedAt: new Date().toISOString() };
      return HttpResponse.json({ data: state.view });
    }),
    http.post("*/api/v1/sos/s1/location", () => HttpResponse.json({ data: { ok: true } })),
  );
  return state;
}

beforeEach(() => {
  vi.mocked(device.openExternal).mockClear();
  mockGeo("ok");
});
afterEach(() => vi.useRealTimers());

describe("S-06 SOS trigger", () => {
  it("cancel during the countdown sends nothing", async () => {
    loggedInAs(citizen({ emergencyContactCount: 2 }));
    const backend = sosBackend();
    renderApp("/sos");
    await userEvent.click(await screen.findByRole("button", { name: "SOS" }));
    expect(await screen.findByRole("timer")).toHaveTextContent("5");
    await userEvent.click(screen.getByRole("button", { name: "रद्द करें" }));
    expect(await screen.findByText("SOS रद्द")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 300));
    expect(backend.posts).toEqual([]);
  });

  it("'Send now' posts the GPS fix, opens S-07 and then the SMS app with every contact", async () => {
    loggedInAs(citizen({ emergencyContactCount: 2 }));
    const backend = sosBackend();
    const { router } = renderApp("/sos");
    await userEvent.click(await screen.findByRole("button", { name: "SOS" }));
    await userEvent.click(screen.getByRole("button", { name: "अभी भेजें" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/sos/s1"));
    expect(backend.posts).toEqual([{ lat: 23.2005, lng: 77.0805, accuracyM: 12, source: "gps" }]);
    expect(await screen.findByRole("heading", { name: "SOS चालू है" })).toBeInTheDocument();
    await waitFor(() => expect(device.openExternal).toHaveBeenCalled());
    const href = vi.mocked(device.openExternal).mock.calls[0][0];
    expect(href).toMatch(/^sms:\+919811111111,\+919822222222\?body=/);
    expect(decodeURIComponent(href)).toContain("https://app.test/track/abc");
  });

  it("if the SMS app doesn't open by itself, a big 'Send SMS' button opens it with one tap", async () => {
    loggedInAs(citizen());
    sosBackend();
    renderApp("/sos");
    await userEvent.click(await screen.findByRole("button", { name: "SOS" }));
    await userEvent.click(screen.getByRole("button", { name: "अभी भेजें" }));
    // jsdom never hides the page, so after 2 s the app knows the SMS app didn't open.
    const button = await screen.findByRole(
      "button",
      { name: "संपर्कों को SMS भेजें" },
      { timeout: 4000 },
    );
    vi.mocked(device.openExternal).mockClear();
    await userEvent.click(button);
    expect(vi.mocked(device.openExternal).mock.calls[0][0]).toMatch(
      /^sms:\+919811111111,\+919822222222\?body=/,
    );
  });

  it("sends automatically when the countdown reaches 0", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    loggedInAs(citizen());
    const backend = sosBackend();
    const { router } = renderApp("/sos");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole("button", { name: "SOS" }));
    await act(async () => vi.advanceTimersByTime(5200));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sos/s1"));
    expect(backend.posts).toHaveLength(1);
  });

  it("with location permission off, sends the home village and says so", async () => {
    mockGeo("denied");
    loggedInAs(citizen());
    const backend = sosBackend({ locationSource: "village", approximate: true });
    renderApp("/sos");
    await userEvent.click(await screen.findByRole("button", { name: "SOS" }));
    await userEvent.click(screen.getByRole("button", { name: "अभी भेजें" }));
    expect(await screen.findByText(/लोकेशन की अनुमति बंद है/)).toBeInTheDocument();
    expect(backend.posts).toEqual([{ source: "village" }]);
    expect(screen.getByText("अनुमानित लोकेशन भेजी गई")).toBeInTheDocument();
  });

  it("when GPS fails, falls back to the last fix from this session (source last_known)", async () => {
    sessionStorage.setItem(
      "ss_last_location",
      JSON.stringify({ lat: 23.21, lng: 77.09, accuracyM: 30, at: Date.now() }),
    );
    mockGeo("timeout");
    loggedInAs(citizen());
    const backend = sosBackend();
    renderApp("/sos");
    await userEvent.click(await screen.findByRole("button", { name: "SOS" }));
    await userEvent.click(screen.getByRole("button", { name: "अभी भेजें" }));
    await waitFor(() =>
      expect(backend.posts).toEqual([
        { lat: 23.21, lng: 77.09, accuracyM: 30, source: "last_known" },
      ]),
    );
  });

  it("if the API is unreachable, opens the SMS app with cached contacts and goes offline", async () => {
    loggedInAs(citizen());
    server.use(http.post("*/api/v1/sos", () => HttpResponse.error()));
    localStorage.setItem(
      "ss_contacts",
      JSON.stringify([{ id: "c1", name: "Maa", relation: "mother", phone: "+919811111111" }]),
    );
    // The contacts cache refetch would overwrite the stored list; keep it.
    server.use(
      http.get("*/api/v1/users/me/contacts", () =>
        HttpResponse.json({
          data: [{ id: "c1", name: "Maa", relation: "mother", phone: "+919811111111" }],
        }),
      ),
    );
    const { router } = renderApp("/sos");
    await userEvent.click(await screen.findByRole("button", { name: "SOS" }));
    await userEvent.click(screen.getByRole("button", { name: "अभी भेजें" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/sos/offline"));
    expect(await screen.findByText("अधिकारी को सूचना बाकी — फिर कोशिश होगी")).toBeInTheDocument();
    await waitFor(() => expect(device.openExternal).toHaveBeenCalled());
    const body = decodeURIComponent(vi.mocked(device.openExternal).mock.calls[0][0]);
    expect(body).toMatch(
      /^sms:\+919811111111\?body=Sunita Devi को मदद चाहिए! मेरी लोकेशन: https:\/\/maps\.google\.com\/\?q=23\.200500,77\.080500/,
    );
  });

  it("opened while the server is down, a known citizen still gets the full SOS and it recovers", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem("ss_profile", JSON.stringify({ name: "Sunita Devi", role: "citizen" }));
    localStorage.setItem(
      "ss_contacts",
      JSON.stringify([{ id: "c1", name: "Maa", relation: "mother", phone: "+919811111111" }]),
    );
    server.use(
      http.post("*/api/v1/auth/refresh", () => HttpResponse.error()),
      http.post("*/api/v1/sos", () => HttpResponse.error()),
    );
    const { router } = renderApp("/sos");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Not the guest screen: the SOS button is there.
    await user.click(await screen.findByRole("button", { name: "SOS" }));
    await user.click(screen.getByRole("button", { name: "अभी भेजें" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sos/offline"));
    await waitFor(() => expect(device.openExternal).toHaveBeenCalled());
    expect(decodeURIComponent(vi.mocked(device.openExternal).mock.calls[0][0])).toContain(
      "sms:+919811111111?body=Sunita Devi को मदद चाहिए!",
    );

    // The server comes back: the next retry restores the session, then creates the SOS.
    loggedInAs(citizen());
    const backend = sosBackend();
    const seen = [];
    router.subscribe((st) => seen.push(st.location.pathname));
    await act(async () => vi.advanceTimersByTime(10_500));
    await new Promise((r) => setTimeout(r, 500));
    console.log("NAV", JSON.stringify(seen));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sos/s1"));
    expect(backend.posts[0]).toMatchObject({ source: "gps", createdVia: "offline_retry" });
  });

  it("guests can call 112 and share their location, and are told to log in", async () => {
    renderApp("/sos");
    expect(await screen.findByRole("link", { name: "112 पर कॉल करें" })).toHaveAttribute(
      "href",
      "tel:112",
    );
    expect(await screen.findByText(/आपकी लोकेशन: 23.20050, 77.08050/)).toBeInTheDocument();
    expect(
      screen.getByText("परिवार को अपने-आप अलर्ट भेजने के लिए लॉग इन करें।"),
    ).toBeInTheDocument();
  });
});

describe("S-07 SOS active → S-08", () => {
  it("shows the checklist, updates when the authority acknowledges, and 'I am safe' ends it", async () => {
    loggedInAs(citizen());
    const backend = sosBackend();
    const { router } = renderApp("/sos/s1");
    expect(await screen.findByText("अधिकारी को सूचना दी गई")).toBeInTheDocument();
    expect(screen.getByText("1 संपर्क को ईमेल भेजा गया")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Maa को कॉल करें" })).toHaveAttribute(
      "href",
      "tel:+919811111111",
    );

    backend.view = {
      ...backend.view,
      status: "ACKNOWLEDGED",
      acknowledgedBy: { name: "Mr Verma" },
    };
    act(() => dispatchSocketEvent("sos:acknowledged", { id: "s1", officerName: "Mr Verma" }));
    expect(await screen.findByText("Mr Verma ने देख लिया")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "मैं सुरक्षित हूँ" }));
    const dialog = await screen.findByRole("dialog", { name: "क्या अब आप सुरक्षित हैं?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "हाँ, मैं सुरक्षित हूँ" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sos/s1/done"));
    expect(backend.resolved).toBe(1);

    // S-08: Bhaiya only got the SMS, so offer a "safe" SMS to him (Maa gets the email).
    expect(await screen.findByText("आप सुरक्षित हैं — अच्छा हुआ 🙏")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "SMS भेजें" }));
    const href = vi.mocked(device.openExternal).mock.calls.at(-1)[0];
    expect(href).toMatch(/^sms:\+919822222222\?body=/);
    expect(decodeURIComponent(href)).toContain("मैं अब सुरक्षित हूँ। — Sunita Devi");
  });

  it("asks 'are you safe?' when the authority closes the SOS", async () => {
    loggedInAs(citizen());
    sosBackend();
    renderApp("/sos/s1");
    await screen.findByText("अधिकारी को सूचना दी गई");
    act(() => dispatchSocketEvent("sos:updated", { id: "s1", status: "RESOLVED_BY_AUTHORITY" }));
    expect(
      await screen.findByRole("dialog", { name: "अधिकारी ने यह SOS बंद कर दिया है" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "नहीं, मुझे अभी भी मदद चाहिए" })).toBeInTheDocument();
  });

  it("with no contacts, says so and links to add some", async () => {
    loggedInAs(citizen());
    sosBackend({ smsRecipients: [], contacts: [], emailTargets: 0, emailedCount: 0 });
    renderApp("/sos/s1");
    expect(await screen.findByText("अलर्ट भेजने के लिए कोई संपर्क नहीं है।")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "संपर्क जोड़ें" })).toHaveAttribute(
      "href",
      "/profile/contacts",
    );
  });

  it("an ended or unknown SOS sends the user home", async () => {
    loggedInAs(citizen());
    server.use(http.get("*/api/v1/sos/nope", () => apiErr(404, "NOT_FOUND", "नहीं मिला।")));
    const { router } = renderApp("/sos/nope");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(await screen.findByText("यह SOS खत्म हो गया है।")).toBeInTheDocument();
  });

  it("home shows a banner while the user's SOS is active", async () => {
    loggedInAs(citizen({ emergencyContactCount: 1 }));
    server.use(
      http.get("*/api/v1/sos/mine", () =>
        HttpResponse.json({ data: [{ id: "s1", status: "ACTIVE" }] }),
      ),
    );
    renderApp("/");
    expect(await screen.findByText("आपका SOS चालू है")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "खोलें" })).toHaveAttribute("href", "/sos/s1");
  });
});

describe("S-30 public tracking page", () => {
  const track = (data, status = 200) =>
    server.use(
      http.get("*/api/v1/track/:token", () =>
        status === 200 ? HttpResponse.json({ data }) : apiErr(status, "NOT_FOUND", "x"),
      ),
    );

  it("shows who needs help and where, with 112 and directions — no phone numbers", async () => {
    track({
      firstName: "Pooja",
      status: "ACTIVE",
      lastLocation: { lat: 23.2005, lng: 77.0805 },
      lastAccuracyM: 12,
      approximate: false,
      updatedAt: new Date().toISOString(),
      trail: [],
    });
    renderApp("/track/abcdefghijklmnopqrstuvwxyz");
    expect(await screen.findByRole("heading", { name: "Pooja को मदद चाहिए" })).toBeInTheDocument();
    // Online: a free OpenStreetMap map (no key needed), plus the Google Maps link.
    expect(screen.getByRole("region", { name: "मैप" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "112 पर कॉल करें" })).toHaveAttribute(
      "href",
      "tel:112",
    );
    expect(
      screen.getAllByRole("link", { name: "Google Maps में खोलें" })[0].getAttribute("href"),
    ).toContain("23.200500,77.080500");
  });

  it("shows the safe state after she ends the SOS, and 'expired' for a dead link", async () => {
    track({ firstName: "Pooja", status: "RESOLVED_SAFE", resolvedAt: new Date().toISOString() });
    const { unmount } = renderApp("/track/abcdefghijklmnopqrstuvwxyz");
    expect(await screen.findByText("Pooja ने बताया कि वे सुरक्षित हैं")).toBeInTheDocument();
    unmount();
    track(null, 404);
    renderApp("/track/zyxwvutsrqponmlkjihgfedcba");
    expect(await screen.findByText("यह लिंक समाप्त हो गया है।")).toBeInTheDocument();
  });
});

describe("S-09 fake call", () => {
  it("rings, answers, shows a running timer and ends back home", async () => {
    const { router } = renderApp("/fake-call");
    await userEvent.click(await screen.findByRole("radio", { name: "पापा" }));
    expect(screen.getByRole("textbox", { name: "कॉल करने वाले का नाम" })).toHaveValue("पापा");
    await userEvent.click(screen.getByRole("button", { name: "शुरू करें" }));
    const ringing = await screen.findByRole("dialog");
    expect(within(ringing).getByText("पापा")).toBeInTheDocument();
    expect(device.vibrate).toHaveBeenCalled();
    await userEvent.click(within(ringing).getByRole("button", { name: "उठाएं" }));
    expect(await screen.findByRole("timer")).toHaveTextContent("00:00");
    await userEvent.click(screen.getByRole("button", { name: "कॉल काटें" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("declining goes back to the setup screen", async () => {
    renderApp("/fake-call");
    await userEvent.click(await screen.findByRole("button", { name: "शुरू करें" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "काटें" }),
    );
    expect(await screen.findByRole("button", { name: "शुरू करें" })).toBeInTheDocument();
  });
});
