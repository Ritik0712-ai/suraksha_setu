import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, apiErr, citizen, http, loggedInAs, server } from "./server.js";
import { dispatchSocketEvent } from "../lib/socket.js";
import { buildComplaintBody, buildSteps } from "../features/complaints/complaintUtils.js";

// jsdom (under Vitest) can't send FormData with a File over XHR, so the multipart upload goes as
// JSON to the same mocked endpoint; everything else uses the real client.
vi.mock("../api/endpoints.js", async (importOriginal) => {
  const real = await importOriginal();
  const { api } = await import("../api/client.js");
  return {
    ...real,
    complaintsApi: {
      ...real.complaintsApi,
      classify: (file) =>
        api.post("/complaints/classify", { name: file.name }).then((r) => r.data.data),
    },
  };
});

// Compression needs a real canvas; the tests check what gets sent, not the pixels.
vi.mock("../lib/photo.js", async (importOriginal) => ({
  ...(await importOriginal()),
  compressPhoto: vi.fn(async (file) => file),
}));

const HERE = { latitude: 23.2005, longitude: 77.0805, accuracy: 14 };
function mockGeo(mode = "ok") {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok, fail) =>
        mode === "ok" ? ok({ coords: HERE }) : fail({ code: mode === "denied" ? 1 : 3 }),
    },
  });
}

const photo = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], "p.jpg", { type: "image/jpeg" });
const SUGGESTION = {
  category: "water_supply",
  confidence: 0.91,
  top3: [{ category: "water_supply", confidence: 0.91 }],
  modelVersion: "civic_cnn_v1",
};
const PHED = { id: "d2", name: { en: "PHED Sehore", hi: "पीएचई सीहोर" } };
const MAHODIYA = { en: "Mahodiya", hi: "महोदिया" };

const detail = (over = {}) => ({
  id: "c1",
  complaintNo: "SS-2026-000123",
  category: "water_supply",
  categorySource: "ai_accepted",
  status: "SUBMITTED",
  imageUrl: "https://res.cloudinary.com/demo/c1.jpg",
  landmark: "प्राथमिक स्कूल के पास",
  village: MAHODIYA,
  department: PHED,
  description: "हैंडपंप 3 हफ्ते से खराब है",
  location: { lat: 23.2005, lng: 77.0805 },
  locationAccuracyM: 14,
  onBehalfOf: null,
  statusChangedAt: "2026-10-02T09:30:00Z",
  resolutionImageUrl: null,
  rejection: null,
  reopenCount: 0,
  resolvedAt: null,
  canReopen: false,
  reopenUntil: null,
  createdAt: "2026-10-02T09:30:00Z",
  updatedAt: "2026-10-02T09:30:00Z",
  timeline: [
    {
      type: "created",
      fromStatus: null,
      toStatus: "SUBMITTED",
      text: null,
      visibility: "public",
      actorRole: "citizen",
      at: "2026-10-02T09:30:00Z",
    },
  ],
  ...over,
});

/** Backend for the wizard: records classify calls and create bodies. */
function wizardBackend({ suggestion = SUGGESTION, classifyStatus = 201, createError } = {}) {
  const state = { classified: 0, created: [], warmups: 0 };
  server.use(
    http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: [] })),
    http.get("*/api/v1/complaints/classify/warmup", () => {
      state.warmups += 1;
      return HttpResponse.json({ data: { ai: "up" } });
    }),
    http.post("*/api/v1/complaints/classify", () => {
      state.classified += 1;
      if (classifyStatus !== 201) return apiErr(classifyStatus, "INTERNAL", "Couldn't upload");
      return HttpResponse.json(
        {
          data: {
            uploadId: "up1",
            imageUrl: "https://res.cloudinary.com/demo/up1.jpg",
            suggestion,
          },
        },
        { status: 201 },
      );
    }),
    http.get("*/api/v1/complaints/route-preview", ({ request }) => {
      const cat = new URL(request.url).searchParams.get("category");
      const department =
        cat === "water_supply"
          ? PHED
          : { id: "d1", name: { en: "Gram Panchayat Mahodiya", hi: "ग्राम पंचायत महोदिया" } };
      return HttpResponse.json({ data: { department, village: { id: "v1", name: MAHODIYA } } });
    }),
    http.post("*/api/v1/complaints", async ({ request }) => {
      const body = await request.json();
      state.created.push(body);
      if (createError) return createError();
      return HttpResponse.json({ data: detail({ category: body.category }) }, { status: 201 });
    }),
    http.get("*/api/v1/complaints/c1", () => HttpResponse.json({ data: detail() })),
  );
  return state;
}

const next = () => userEvent.click(screen.getByRole("button", { name: "आगे" }));

beforeEach(() => {
  mockGeo("ok");
  // jsdom has no object URLs for File previews.
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("S-10 new complaint wizard", () => {
  it("photo → AI suggestion accepted → location → review → submit → S-11 → S-13", async () => {
    loggedInAs(citizen());
    const backend = wizardBackend();
    const { router } = renderApp("/complaints/new");
    expect(await screen.findByText("चरण 1 / 4")).toBeInTheDocument();
    await waitFor(() => expect(backend.warmups).toBe(1));

    await userEvent.upload(screen.getByTestId("camera-input"), photo());
    expect(screen.getByRole("img", { name: "आपकी फ़ोटो" })).toBeInTheDocument();
    await next();

    // Step 2: AI card with the confidence label.
    expect(await screen.findByText("AI के अनुसार: पानी / हैंडपंप")).toBeInTheDocument();
    expect(screen.getByText("पक्का")).toBeInTheDocument();
    expect(backend.classified).toBe(1);
    await userEvent.click(screen.getByRole("button", { name: "हाँ, सही है" }));

    // Step 3: GPS fix, landmark, description.
    expect(await screen.findByText("लोकेशन मिल गई (±14 मी.)")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("पास की पहचान (वैकल्पिक)"), "स्कूल के पास");
    await userEvent.type(
      screen.getByLabelText("समस्या के बारे में लिखें (वैकल्पिक)"),
      "हैंडपंप खराब",
    );
    await next();

    // Step 4: summary + department preview.
    expect(await screen.findByText("पीएचई सीहोर")).toBeInTheDocument();
    expect(screen.getByText("स्कूल के पास")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "शिकायत भेजें" }));

    expect(await screen.findByText("शिकायत दर्ज हो गई!")).toBeInTheDocument();
    expect(screen.getByText("SS-2026-000123")).toBeInTheDocument();
    expect(backend.created[0]).toEqual({
      category: "water_supply",
      uploadId: "up1",
      location: { lat: 23.2005, lng: 77.0805, accuracyM: 14 },
      landmark: "स्कूल के पास",
      description: "हैंडपंप खराब",
    });
    expect(router.state.location.pathname).toBe("/complaints/new/success");

    await userEvent.click(screen.getByRole("link", { name: "शिकायत देखें" }));
    expect(await screen.findByRole("heading", { name: "SS-2026-000123" })).toBeInTheDocument();
  });

  it("shows the 7 category tiles when the AI has no suggestion, with Next disabled until one is picked", async () => {
    loggedInAs(citizen());
    wizardBackend({ suggestion: null });
    renderApp("/complaints/new");
    await userEvent.upload(await screen.findByTestId("gallery-input"), photo());
    await next();
    const group = await screen.findByRole("radiogroup", { name: "श्रेणी चुनें" });
    expect(within(group).getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "आगे" })).toBeDisabled();
    await userEvent.click(within(group).getByRole("radio", { name: /स्ट्रीट लाइट/ }));
    expect(screen.getByRole("button", { name: "आगे" })).toBeEnabled();
  });

  it("doesn't badge a low-confidence guess", async () => {
    loggedInAs(citizen());
    wizardBackend({ suggestion: { ...SUGGESTION, category: "other", confidence: 0.2 } });
    renderApp("/complaints/new");
    await userEvent.upload(await screen.findByTestId("camera-input"), photo());
    await next();
    await screen.findByRole("radiogroup");
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI के अनुसार/)).not.toBeInTheDocument();
  });

  it("badges the AI tile after 'Choose another', and a low-confidence suggestion goes straight to the grid", async () => {
    loggedInAs(citizen());
    wizardBackend({ suggestion: { ...SUGGESTION, confidence: 0.7 } });
    renderApp("/complaints/new");
    await userEvent.upload(await screen.findByTestId("camera-input"), photo());
    await next();
    expect(await screen.findByText("शायद")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "दूसरा चुनें" }));
    const tile = screen.getByRole("radio", { name: /पानी \/ हैंडपंप/ });
    expect(within(tile).getByText("AI")).toBeInTheDocument();
  });

  it("works without a photo and with location denied (village is used)", async () => {
    mockGeo("denied");
    loggedInAs(citizen());
    const backend = wizardBackend();
    renderApp("/complaints/new");
    await userEvent.click(await screen.findByRole("button", { name: "बिना फ़ोटो के शिकायत करें" }));
    await userEvent.click(await screen.findByRole("radio", { name: /कचरा/ }));
    await next();
    expect(await screen.findByText(/आपकी लोकेशन नहीं मिली/)).toBeInTheDocument();
    await next();
    expect(await screen.findByText("आपका गाँव (लोकेशन नहीं दी गई)")).toBeInTheDocument();
    expect(screen.getByText("कोई फ़ोटो नहीं")).toBeInTheDocument();
    expect(await screen.findByText("ग्राम पंचायत महोदिया")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "शिकायत भेजें" }));
    await screen.findByText("शिकायत दर्ज हो गई!");
    expect(backend.created[0]).toEqual({ category: "garbage" });
    expect(backend.classified).toBe(0);
  });

  it("offers Retry or Continue without photo when the upload fails", async () => {
    loggedInAs(citizen());
    const backend = wizardBackend({ classifyStatus: 500 });
    renderApp("/complaints/new");
    await userEvent.upload(await screen.findByTestId("camera-input"), photo());
    await next();
    expect(await screen.findByText("फ़ोटो अपलोड नहीं हो सकी।")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "फिर से कोशिश करें" }));
    await waitFor(() => expect(backend.classified).toBe(2));
    await userEvent.click(await screen.findByRole("button", { name: "बिना फ़ोटो के आगे बढ़ें" }));
    expect(await screen.findByRole("radiogroup")).toBeInTheDocument();
  });

  it("saves the complaint on the phone without internet and sends it when the internet is back", async () => {
    loggedInAs(citizen());
    const backend = wizardBackend();
    let offline = true;
    server.use(
      http.post("*/api/v1/complaints/classify", () => {
        if (offline) return HttpResponse.error();
        backend.classified += 1;
        return HttpResponse.json(
          { data: { uploadId: "up9", imageUrl: "https://x/up9.jpg", suggestion: null } },
          { status: 201 },
        );
      }),
      http.post("*/api/v1/complaints", async ({ request }) => {
        if (offline) return HttpResponse.error();
        backend.created.push(await request.json());
        return HttpResponse.json({ data: detail({ category: "garbage" }) }, { status: 201 });
      }),
      http.get("*/api/v1/complaints/mine", () =>
        HttpResponse.json({ data: { items: [], nextPage: null } }),
      ),
    );
    renderApp("/complaints/new");
    await userEvent.upload(await screen.findByTestId("camera-input"), photo());
    await next();
    // No internet: the photo stays on the phone and the citizen picks the category.
    await userEvent.click(await screen.findByRole("radio", { name: /कचरा/ }));
    await next();
    await next();
    expect(
      await screen.findByText(/इंटरनेट नहीं है। शिकायत आपके फ़ोन में सेव होगी/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "शिकायत भेजें" }));
    expect(await screen.findByText("शिकायत फ़ोन में सेव हो गई")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "भेजी जाने वाली शिकायतें देखें" }));
    expect(await screen.findByText("भेजी जानी हैं (1)")).toBeInTheDocument();
    const send = await screen.findByRole("button", { name: "अभी भेजें" });
    await waitFor(() => expect(send).toBeEnabled());

    offline = false;
    await userEvent.click(send);
    expect(
      await screen.findByText("सेव की गई शिकायत भेज दी गई: SS-2026-000123"),
    ).toBeInTheDocument();
    expect(backend.created).toHaveLength(1);
    expect(backend.created[0]).toMatchObject({ category: "garbage", uploadId: "up9" });
    await waitFor(() => expect(screen.queryByText("भेजी जानी हैं (1)")).not.toBeInTheDocument());
  });

  it("offers 'me too' on the same problem nearby instead of a duplicate complaint", async () => {
    loggedInAs(citizen());
    const backend = wizardBackend();
    const supported = [];
    server.use(
      http.get("*/api/v1/complaints/nearby", ({ request }) => {
        const p = new URL(request.url).searchParams;
        expect(p.get("category")).toBe("garbage");
        return HttpResponse.json({
          data: [
            {
              id: "c7",
              complaintNo: "SS-2026-000077",
              category: "garbage",
              status: "VERIFIED",
              landmark: "हनुमान मंदिर के पास",
              distanceM: 120,
              supporterCount: 2,
              supportedByMe: false,
              createdAt: "2026-10-01T09:00:00Z",
            },
          ],
        });
      }),
      http.post("*/api/v1/complaints/c7/support", () => {
        supported.push("c7");
        return HttpResponse.json({ data: { id: "c7", supporterCount: 3, supportedByMe: true } });
      }),
      http.get("*/api/v1/complaints/mine", () =>
        HttpResponse.json({ data: { items: [], nextPage: null } }),
      ),
    );
    renderApp("/complaints/new");
    await userEvent.click(await screen.findByRole("button", { name: "बिना फ़ोटो के शिकायत करें" }));
    await userEvent.click(await screen.findByRole("radio", { name: /कचरा/ }));
    await next();
    await next();
    expect(await screen.findByText("यह समस्या पास में पहले से दर्ज है?")).toBeInTheDocument();
    expect(screen.getByText("हनुमान मंदिर के पास")).toBeInTheDocument();
    expect(screen.getByText("2 और लोगों की यही समस्या है")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "मेरी भी यही समस्या है" }));
    expect(await screen.findByText("3 और लोगों की यही समस्या है")).toBeInTheDocument();
    expect(supported).toEqual(["c7"]);
    await userEvent.click(screen.getByRole("button", { name: "ठीक है, हो गया" }));
    expect(await screen.findByRole("heading", { name: "मेरी शिकायतें" })).toBeInTheDocument();
    expect(backend.created).toEqual([]);
  });

  it("refuses a file that isn't an image", async () => {
    loggedInAs(citizen());
    wizardBackend();
    renderApp("/complaints/new");
    const input = await screen.findByTestId("gallery-input");
    fireEvent.change(input, {
      target: { files: [new File(["hi"], "a.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByText("कृपया एक फ़ोटो चुनें।")).toBeInTheDocument();
  });

  it("validates 'filing for someone else'", async () => {
    loggedInAs(citizen());
    const backend = wizardBackend();
    renderApp("/complaints/new");
    await userEvent.click(await screen.findByRole("button", { name: "बिना फ़ोटो के शिकायत करें" }));
    await userEvent.click(await screen.findByRole("radio", { name: /कचरा/ }));
    await next();
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "किसी और के लिए शिकायत कर रहे हैं?" }),
    );
    await next();
    expect(await screen.findByText("यह भरना ज़रूरी है।")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/उनका नाम/), "Ramesh Kumar");
    await userEvent.type(screen.getByLabelText("उनका मोबाइल (वैकल्पिक)"), "98111 22233");
    await next();
    await userEvent.click(await screen.findByRole("button", { name: "शिकायत भेजें" }));
    await screen.findByText("शिकायत दर्ज हो गई!");
    expect(backend.created[0].onBehalfOf).toEqual({ name: "Ramesh Kumar", phone: "+919811122233" });
  });

  it("asks before discarding a started complaint", async () => {
    loggedInAs(citizen());
    wizardBackend();
    const { router } = renderApp("/complaints/new");
    await userEvent.upload(await screen.findByTestId("camera-input"), photo());
    await userEvent.click(screen.getByRole("button", { name: "वापस" }));
    expect(await screen.findByText("यह शिकायत छोड़ दें?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "भरना जारी रखें" }));
    expect(router.state.location.pathname).toBe("/complaints/new");
    await userEvent.click(screen.getByRole("button", { name: "वापस" }));
    await userEvent.click(await screen.findByRole("button", { name: "छोड़ दें" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("shows the daily-limit message and keeps the data", async () => {
    loggedInAs(citizen());
    wizardBackend({
      createError: () =>
        apiErr(429, "RATE_LIMITED", "आज की 10 शिकायतों की सीमा पूरी हो गई। कल फिर कोशिश करें।"),
    });
    renderApp("/complaints/new");
    await userEvent.click(await screen.findByRole("button", { name: "बिना फ़ोटो के शिकायत करें" }));
    await userEvent.click(await screen.findByRole("radio", { name: /कचरा/ }));
    await next();
    await next();
    await userEvent.click(await screen.findByRole("button", { name: "शिकायत भेजें" }));
    expect(await screen.findByText(/10 शिकायतों की सीमा/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "शिकायत भेजें" })).toBeEnabled();
  });
});

describe("S-11 / S-12 my complaints", () => {
  it("S-11 without state redirects to the list", async () => {
    loggedInAs(citizen());
    server.use(
      http.get("*/api/v1/complaints/mine", () =>
        HttpResponse.json({ data: { items: [], nextPage: null } }),
      ),
    );
    const { router } = renderApp("/complaints/new/success");
    await waitFor(() => expect(router.state.location.pathname).toBe("/complaints"));
  });

  it("lists complaints with status chips, filters and the empty states", async () => {
    loggedInAs(citizen());
    const asked = [];
    server.use(
      http.get("*/api/v1/complaints/mine", ({ request }) => {
        const status = new URL(request.url).searchParams.get("status");
        asked.push(status);
        const items =
          status === "rejected"
            ? []
            : [
                detail(),
                detail({
                  id: "c2",
                  complaintNo: "SS-2026-000124",
                  status: "RESOLVED",
                  category: "garbage",
                  imageUrl: null,
                }),
              ];
        return HttpResponse.json({ data: { items, nextPage: null } });
      }),
    );
    const { router } = renderApp("/complaints");
    expect(await screen.findByRole("heading", { name: "मेरी शिकायतें" })).toBeInTheDocument();
    expect(await screen.findByText(/SS-2026-000123/)).toBeInTheDocument();
    expect(screen.getByText("हल हो गई")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /नई शिकायत/ })).toHaveAttribute(
      "href",
      "/complaints/new",
    );

    await userEvent.click(screen.getByRole("radio", { name: "अस्वीकार" }));
    expect(await screen.findByText("इस स्थिति की कोई शिकायत नहीं है।")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?status=rejected");
    expect(asked).toEqual([null, "rejected"]);
  });

  it("shows the first-time empty state with a Report button", async () => {
    loggedInAs(citizen());
    server.use(
      http.get("*/api/v1/complaints/mine", () =>
        HttpResponse.json({ data: { items: [], nextPage: null } }),
      ),
    );
    renderApp("/complaints");
    expect(await screen.findByText("अभी तक कोई शिकायत नहीं")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "शिकायत करें" })).toHaveAttribute(
      "href",
      "/complaints/new",
    );
  });

  it("loads the next page", async () => {
    loggedInAs(citizen());
    server.use(
      http.get("*/api/v1/complaints/mine", ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({
          data:
            page === 1
              ? { items: [detail()], nextPage: 2 }
              : { items: [detail({ id: "c9", complaintNo: "SS-2026-000999" })], nextPage: null },
        });
      }),
    );
    renderApp("/complaints");
    await screen.findByText(/SS-2026-000123/);
    await userEvent.click(screen.getByRole("button", { name: "आगे" }));
    expect(await screen.findByText(/SS-2026-000999/)).toBeInTheDocument();
  });
});

describe("S-13 complaint detail", () => {
  it("shows the timeline with public notes, details and share", async () => {
    loggedInAs(citizen());
    server.use(
      http.get("*/api/v1/complaints/c1", () =>
        HttpResponse.json({
          data: detail({
            status: "ASSIGNED",
            timeline: [
              ...detail().timeline,
              {
                type: "status_change",
                fromStatus: "SUBMITTED",
                toStatus: "VERIFIED",
                text: null,
                visibility: "public",
                actorRole: "authority",
                at: "2026-10-03T06:10:00Z",
              },
              {
                type: "assigned",
                fromStatus: "VERIFIED",
                toStatus: "ASSIGNED",
                text: "PHED को भेजा गया",
                visibility: "public",
                actorRole: "authority",
                at: "2026-10-03T06:12:00Z",
              },
            ],
          }),
        }),
      ),
    );
    renderApp("/complaints/c1");
    expect(await screen.findByRole("heading", { name: "SS-2026-000123" })).toBeInTheDocument();
    expect(screen.getByText("PHED को भेजा गया")).toBeInTheDocument();
    expect(screen.getByText("पीएचई सीहोर")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /पानी \/ हैंडपंप की फ़ोटो/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "मैप में खोलें" })).toHaveAttribute(
      "href",
      "https://maps.google.com/?q=23.200500,77.080500",
    );
    expect(screen.queryByRole("button", { name: /दोबारा खोलें/ })).not.toBeInTheDocument();
  });

  it("reopens a resolved complaint with a reason of 10+ characters", async () => {
    loggedInAs(citizen());
    let reopenBody = null;
    server.use(
      http.get("*/api/v1/complaints/c1", () =>
        HttpResponse.json({
          data: detail({
            status: "RESOLVED",
            resolvedAt: new Date().toISOString(),
            canReopen: true,
          }),
        }),
      ),
      http.post("*/api/v1/complaints/c1/reopen", async ({ request }) => {
        reopenBody = await request.json();
        return HttpResponse.json({
          data: detail({
            status: "ASSIGNED",
            reopenCount: 1,
            timeline: [
              ...detail().timeline,
              {
                type: "reopened",
                fromStatus: "RESOLVED",
                toStatus: "ASSIGNED",
                text: reopenBody.reason,
                visibility: "public",
                actorRole: "citizen",
                at: new Date().toISOString(),
              },
            ],
          }),
        });
      }),
    );
    renderApp("/complaints/c1");
    await userEvent.click(
      await screen.findByRole("button", { name: "समस्या अभी भी है? दोबारा खोलें" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("अब भी क्या ख़राब है?"), "abhi");
    await userEvent.click(within(dialog).getByRole("button", { name: "दोबारा खोलें" }));
    expect(reopenBody).toBeNull();
    await userEvent.type(within(dialog).getByLabelText("अब भी क्या ख़राब है?"), " bhi kharab hai");
    await userEvent.click(within(dialog).getByRole("button", { name: "दोबारा खोलें" }));
    await waitFor(() => expect(reopenBody).toEqual({ reason: "abhi bhi kharab hai" }));
    expect(await screen.findByText("शिकायत दोबारा खोली गई")).toBeInTheDocument();
    expect(await screen.findAllByText("सौंपी गई")).not.toHaveLength(0);
  });

  it("after 7 days suggests a new complaint instead", async () => {
    loggedInAs(citizen());
    server.use(
      http.get("*/api/v1/complaints/c1", () =>
        HttpResponse.json({
          data: detail({ status: "RESOLVED", resolvedAt: "2026-01-01T00:00:00Z" }),
        }),
      ),
    );
    renderApp("/complaints/c1");
    expect(await screen.findByText("दोबारा बताने के लिए नई शिकायत दर्ज करें।")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "नई शिकायत" })).toHaveAttribute(
      "href",
      "/complaints/new",
    );
  });

  it("shows the rejection reason as a red final step", async () => {
    loggedInAs(citizen());
    server.use(
      http.get("*/api/v1/complaints/c1", () =>
        HttpResponse.json({
          data: detail({
            status: "REJECTED",
            rejection: { code: "duplicate", text: null },
            timeline: [
              ...detail().timeline,
              {
                type: "status_change",
                fromStatus: "SUBMITTED",
                toStatus: "REJECTED",
                text: null,
                visibility: "public",
                actorRole: "authority",
                at: "2026-10-03T06:10:00Z",
              },
            ],
          }),
        }),
      ),
    );
    renderApp("/complaints/c1");
    expect(await screen.findByText("कारण: पहले ही दर्ज है")).toBeInTheDocument();
  });

  it("refetches and toasts on complaint:updated", async () => {
    loggedInAs(citizen());
    let status = "SUBMITTED";
    server.use(
      http.get("*/api/v1/complaints/c1", () => HttpResponse.json({ data: detail({ status }) })),
    );
    renderApp("/complaints/c1");
    await screen.findByRole("heading", { name: "SS-2026-000123" });
    status = "IN_PROGRESS";
    act(() => dispatchSocketEvent("complaint:updated", { id: "other" }));
    act(() => dispatchSocketEvent("complaint:updated", { id: "c1", status }));
    expect(await screen.findByText("स्थिति बदली")).toBeInTheDocument();
    expect((await screen.findAllByText("काम चल रहा है")).length).toBeGreaterThan(0);
  });

  it("shows 'not found' for a 404", async () => {
    loggedInAs(citizen());
    server.use(
      http.get("*/api/v1/complaints/zz", () => apiErr(404, "NOT_FOUND", "शिकायत नहीं मिली।")),
    );
    renderApp("/complaints/zz");
    expect(await screen.findByRole("heading", { name: "शिकायत नहीं मिली" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "मेरी शिकायतें" })).toHaveAttribute(
      "href",
      "/complaints",
    );
  });
});

describe("complaint helpers", () => {
  it("buildSteps: statuses in order, notes on the step they belong to, reopen", () => {
    const { steps, active } = buildSteps(
      detail({
        status: "ASSIGNED",
        timeline: [
          ...detail().timeline,
          { type: "status_change", toStatus: "VERIFIED", at: "2026-10-03T00:00:00Z" },
          { type: "assigned", toStatus: "ASSIGNED", text: "PHED", at: "2026-10-03T01:00:00Z" },
          { type: "status_change", toStatus: "IN_PROGRESS", at: "2026-10-04T00:00:00Z" },
          {
            type: "status_change",
            toStatus: "RESOLVED",
            text: "Fixed",
            at: "2026-10-05T00:00:00Z",
          },
          {
            type: "reopened",
            toStatus: "ASSIGNED",
            text: "Still broken",
            at: "2026-10-06T00:00:00Z",
          },
        ],
      }),
    );
    expect(steps.map((s) => s.status)).toEqual([
      "SUBMITTED",
      "VERIFIED",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
    ]);
    expect(active).toBe(2);
    expect(steps[2].notes.map((n) => n.text)).toEqual(["PHED", "Still broken"]);
    expect(steps[2].at).toBe("2026-10-06T00:00:00Z");
  });

  it("buildSteps: rejected after verification ends with REJECTED", () => {
    const { steps, active } = buildSteps(
      detail({
        status: "REJECTED",
        timeline: [
          ...detail().timeline,
          { type: "status_change", toStatus: "VERIFIED", at: "2026-10-03T00:00:00Z" },
          { type: "status_change", toStatus: "REJECTED", at: "2026-10-04T00:00:00Z" },
        ],
      }),
    );
    expect(steps.map((s) => s.status)).toEqual(["SUBMITTED", "VERIFIED", "REJECTED"]);
    expect(active).toBe(2);
  });

  it("buildComplaintBody trims text and drops empty fields", () => {
    expect(
      buildComplaintBody({
        category: "other",
        upload: null,
        location: null,
        landmark: "  ",
        description: " x ",
        onBehalf: true,
        onBehalfName: " Kamla ",
        onBehalfPhone: "",
      }),
    ).toEqual({ category: "other", description: "x", onBehalfOf: { name: "Kamla" } });
  });
});
