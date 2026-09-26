import { describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import C from "../config/constants.js";
import { HttpResponse, citizen, http, loggedInAs, officer, server } from "./server.js";
import { dispatchSocketEvent } from "../lib/socket.js";
import { blankScheme, slugify, toBody } from "../features/portal/schemeForm.js";

const MAHODIYA = { en: "Mahodiya", hi: "महोदिया" };
const GP = {
  id: "d1",
  name: { en: "Gram Panchayat Mahodiya", hi: "ग्राम पंचायत महोदिया" },
  code: "GP_MAHODIYA",
};

const staffComplaint = (over = {}) => ({
  id: "c1",
  complaintNo: "SS-2026-000123",
  category: "garbage",
  categorySource: "user_selected",
  status: "SUBMITTED",
  imageUrl: null,
  landmark: "स्कूल के पास",
  village: MAHODIYA,
  department: { id: "d1", name: GP.name },
  departmentId: "d1",
  description: "कचरा पड़ा है",
  location: { lat: 23.2, lng: 77.08 },
  onBehalfOf: null,
  citizen: { name: "Sunita Devi", maskedPhone: "+91 98XXX XX210" },
  assignee: null,
  aiSuggestion: null,
  resolutionImageUrl: null,
  rejection: null,
  createdAt: "2026-10-01T09:00:00Z",
  updatedAt: "2026-10-01T09:00:00Z",
  timeline: [
    {
      type: "created",
      toStatus: "SUBMITTED",
      visibility: "public",
      actorRole: "citizen",
      actorName: null,
      at: "2026-10-01T09:00:00Z",
    },
  ],
  actions: { statuses: ["VERIFIED", "REJECTED"], canAssign: false },
  ...over,
});

describe("A-01 overview", () => {
  it("shows KPIs, active SOS, waiting complaints and activity; red KPI with active SOS", async () => {
    loggedInAs(officer());
    server.use(
      http.get("*/api/v1/admin/overview", () =>
        HttpResponse.json({
          data: {
            scope: [MAHODIYA],
            kpis: { openComplaints: 4, resolvedThisWeek: 2, activeSos: 1, avgResolutionDays: 3.5 },
            activeSos: [
              {
                id: "s1",
                status: "ACTIVE",
                name: "Pooja",
                village: MAHODIYA,
                triggeredAt: new Date().toISOString(),
                lastLocation: null,
              },
            ],
            needsAction: [
              {
                id: "c1",
                complaintNo: "SS-2026-000001",
                category: "garbage",
                status: "SUBMITTED",
                village: MAHODIYA,
                landmark: null,
                ageDays: 9,
              },
            ],
            activity: [
              {
                kind: "complaint_new",
                complaintNo: "SS-2026-000001",
                at: new Date().toISOString(),
              },
            ],
          },
        }),
      ),
    );
    renderApp("/portal");
    expect(await screen.findByText("नमस्ते, Mr Verma")).toBeInTheDocument();
    expect(screen.getByText("3.5 दिन")).toBeInTheDocument();
    expect(screen.getByText("Pooja")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "देखें" })).toHaveAttribute("href", "/portal/sos/s1");
    expect(screen.getByText("9 दिन")).toBeInTheDocument();
    expect(screen.getByText("नई शिकायत SS-2026-000001")).toBeInTheDocument();
  });
});

describe("A-02 complaints table", () => {
  it("filters live in the URL and rows open A-03", async () => {
    loggedInAs(officer());
    const asked = [];
    server.use(
      http.get("*/api/v1/admin/meta", () =>
        HttpResponse.json({
          data: { villages: [{ id: "v1", name: MAHODIYA }], departments: [GP] },
        }),
      ),
      http.get("*/api/v1/complaints", ({ request }) => {
        asked.push(Object.fromEntries(new URL(request.url).searchParams));
        return HttpResponse.json({
          data: {
            items: [{ ...staffComplaint(), ageDays: 9, aiAccepted: true }],
            total: 1,
            page: 1,
            limit: 20,
          },
        });
      }),
      http.get("*/api/v1/complaints/c1", () => HttpResponse.json({ data: staffComplaint() })),
    );
    const { router } = renderApp("/portal/complaints?status=SUBMITTED,VERIFIED&sort=age");
    expect(await screen.findByText("SS-2026-000123")).toBeInTheDocument();
    expect(asked[0]).toMatchObject({
      status: "SUBMITTED,VERIFIED",
      sort: "age",
      page: "1",
      limit: "20",
    });
    await userEvent.click(screen.getByText("SS-2026-000123"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/portal/complaints/c1"));
  });
});

describe("A-03 complaint management", () => {
  function backend(start = staffComplaint()) {
    const state = { c: start, calls: [] };
    server.use(
      http.get("*/api/v1/complaints/c1", () => HttpResponse.json({ data: state.c })),
      http.patch("*/api/v1/complaints/c1/status", async ({ request }) => {
        const body = await request.json();
        state.calls.push(["status", body]);
        state.c = {
          ...state.c,
          status: body.status,
          actions:
            body.status === "VERIFIED"
              ? { statuses: ["REJECTED"], canAssign: true }
              : { statuses: [], canAssign: false },
          rejection: body.rejection ?? null,
        };
        return HttpResponse.json({ data: state.c });
      }),
      http.get("*/api/v1/complaints/c1/assign-options", () =>
        HttpResponse.json({
          data: {
            departments: [{ ...GP, handlesCategory: true }],
            assignees: [{ id: "u9", name: "JE Sharma", departmentId: null }],
          },
        }),
      ),
      http.patch("*/api/v1/complaints/c1/assign", async ({ request }) => {
        const body = await request.json();
        state.calls.push(["assign", body]);
        state.c = {
          ...state.c,
          status: "ASSIGNED",
          assignee: { id: "u9", name: "JE Sharma" },
          actions: { statuses: ["IN_PROGRESS"], canAssign: true },
        };
        return HttpResponse.json({ data: state.c });
      }),
      http.post("*/api/v1/complaints/c1/notes", async ({ request }) => {
        const body = await request.json();
        state.calls.push(["note", body]);
        state.c = {
          ...state.c,
          timeline: [
            ...state.c.timeline,
            {
              type: `${body.visibility}_note`,
              text: body.text,
              visibility: body.visibility,
              actorRole: "authority",
              actorName: "Mr Verma",
              at: new Date().toISOString(),
            },
          ],
        };
        return HttpResponse.json({ data: state.c });
      }),
      http.post("*/api/v1/complaints/c1/reveal-phone", () =>
        HttpResponse.json({ data: { phone: "+919876543210" } }),
      ),
    );
    return state;
  }

  it("verifies, then assigns to a department and officer", async () => {
    loggedInAs(officer());
    const state = backend();
    renderApp("/portal/complaints/c1");
    await userEvent.click(await screen.findByRole("button", { name: "जाँचें (Verify)" }));
    expect(await screen.findByText("अपडेट हो गया")).toBeInTheDocument();
    expect(state.calls[0]).toEqual(["status", { status: "VERIFIED" }]);

    await userEvent.click(await screen.findByRole("button", { name: "विभाग को सौंपें" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText("अधिकारी (वैकल्पिक)"));
    await userEvent.click(await screen.findByRole("option", { name: "JE Sharma" }));
    await userEvent.type(
      within(dialog).getByLabelText("नागरिक के लिए नोट (वैकल्पिक)"),
      "Team sent",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "विभाग को सौंपें" }));
    await waitFor(() =>
      expect(state.calls[1]).toEqual([
        "assign",
        { departmentId: "d1", assigneeId: "u9", publicNote: "Team sent" },
      ]),
    );
    expect(await screen.findByText(/JE Sharma/)).toBeInTheDocument();
  });

  it("rejects with a required reason", async () => {
    loggedInAs(officer());
    const state = backend();
    renderApp("/portal/complaints/c1");
    await userEvent.click(await screen.findByRole("button", { name: "अस्वीकार करें" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "अस्वीकार करें" }));
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText("कारण"));
    await userEvent.click(await screen.findByRole("option", { name: "पहले ही दर्ज है" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "अस्वीकार करें" }));
    await waitFor(() =>
      expect(state.calls[0]).toEqual([
        "status",
        { status: "REJECTED", rejection: { code: "duplicate" } },
      ]),
    );
  });

  it("adds an internal note and reveals the phone", async () => {
    loggedInAs(officer());
    const state = backend();
    renderApp("/portal/complaints/c1");
    await userEvent.click(await screen.findByRole("tab", { name: "अंदरूनी नोट" }));
    await userEvent.type(screen.getByRole("textbox", { name: "अंदरूनी नोट" }), "Call sarpanch");
    await userEvent.click(screen.getByRole("button", { name: "जोड़ें" }));
    await waitFor(() =>
      expect(state.calls[0]).toEqual(["note", { visibility: "internal", text: "Call sarpanch" }]),
    );
    expect(await screen.findByText("Call sarpanch")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "नंबर देखें" }));
    expect(await screen.findByRole("link", { name: "+919876543210" })).toHaveAttribute(
      "href",
      "tel:+919876543210",
    );
  });

  it("reloads on 409 and says so", async () => {
    loggedInAs(officer());
    backend();
    server.use(
      http.patch("*/api/v1/complaints/c1/status", () =>
        HttpResponse.json({ error: { code: "CONFLICT", message: "x" } }, { status: 409 }),
      ),
    );
    renderApp("/portal/complaints/c1");
    await userEvent.click(await screen.findByRole("button", { name: "जाँचें (Verify)" }));
    expect(
      await screen.findByText("इसे किसी और ने बदल दिया है। दोबारा लोड किया गया।"),
    ).toBeInTheDocument();
  });
});

describe("A-04 / A-05 live SOS", () => {
  const sos = (over = {}) => ({
    id: "s1",
    status: "ACTIVE",
    user: { name: "Pooja Sharma", maskedPhone: "+91 98XXX XX210" },
    village: MAHODIYA,
    triggeredAt: new Date().toISOString(),
    lastUpdateAt: new Date().toISOString(),
    lastLocation: { lat: 23.2, lng: 77.08 },
    lastAccuracyM: 12,
    locationSource: "gps",
    approximate: false,
    flaggedForReview: false,
    ...over,
  });

  it("lists active SOS, refreshes on sos:new, and acknowledges from the drawer", async () => {
    loggedInAs(officer());
    let list = [sos()];
    let detail = {
      ...sos(),
      trail: [],
      contacts: [{ index: 0, name: "Maa", relation: "mother" }],
      acknowledgedBy: null,
      closedBy: null,
    };
    server.use(
      http.get("*/api/v1/sos/active", () => HttpResponse.json({ data: list })),
      http.get("*/api/v1/sos/s1", () => HttpResponse.json({ data: detail })),
      http.post("*/api/v1/sos/s1/acknowledge", () => {
        detail = {
          ...detail,
          status: "ACKNOWLEDGED",
          acknowledgedBy: { name: "Mr Verma" },
          acknowledgedAt: new Date().toISOString(),
        };
        return HttpResponse.json({ data: detail });
      }),
    );
    const { router } = renderApp("/portal/sos");
    expect(await screen.findByText("Pooja Sharma")).toBeInTheDocument();
    list = [...list, sos({ id: "s2", user: { name: "Kavita", maskedPhone: "x" } })];
    act(() => dispatchSocketEvent("sos:new", { id: "s2" }));
    expect(await screen.findByText("Kavita")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Pooja Sharma"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/portal/sos/s1"));
    expect(await screen.findByText("Maa (माँ)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "देख लिया / Acknowledge" }));
    expect(await screen.findByText(/Mr Verma ने .* पर देखा/)).toBeInTheDocument();
  });
});

describe("A-07 users", () => {
  it("creates an authority account and shows the temporary password once", async () => {
    loggedInAs(officer({ role: "admin", authority: null }));
    let body = null;
    server.use(
      http.get("*/api/v1/admin/jurisdictions", () =>
        HttpResponse.json({
          data: [
            {
              id: "gp1",
              name: MAHODIYA,
              type: "gram_panchayat",
              parentId: null,
              centroid: { lat: 23.2, lng: 77.08 },
            },
          ],
        }),
      ),
      http.get("*/api/v1/admin/departments", () =>
        HttpResponse.json({ data: { items: [GP], gaps: [] } }),
      ),
      http.post("*/api/v1/admin/users", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { data: { user: { id: "n1", name: body.name }, tempPassword: "Ss-abc123XYZ" } },
          { status: 201 },
        );
      }),
    );
    renderApp("/portal/admin/users");
    await userEvent.click(await screen.findByRole("button", { name: "अधिकारी खाता बनाएँ" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("पूरा नाम"), "Ramesh Patel");
    await userEvent.type(within(dialog).getByLabelText("मोबाइल नंबर"), "9811122233");
    await userEvent.click(within(dialog).getByLabelText("क्षेत्र"));
    await userEvent.click(await screen.findByRole("option", { name: /महोदिया/ }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(dialog).getByRole("button", { name: "बनाएँ" }));
    expect(await screen.findByText("Ss-abc123XYZ")).toBeInTheDocument();
    expect(body).toMatchObject({
      name: "Ramesh Patel",
      phone: "+919811122233",
      role: "authority",
      jurisdictionIds: ["gp1"],
      departmentId: null,
    });
  });
});

describe("guards and helpers", () => {
  it("citizens can't open the portal", async () => {
    loggedInAs(citizen());
    renderApp("/portal/complaints");
    expect(await screen.findByText("आपको यह पेज देखने की अनुमति नहीं है")).toBeInTheDocument();
  });

  it("scheme editor form: slug from English name, empty rules → null, extra rows dropped", () => {
    expect(slugify("PM Kisan Samman Nidhi!")).toBe("pm-kisan-samman-nidhi");
    const v = {
      ...blankScheme(),
      slug: " pm-kisan ",
      documents: ["aadhaar"],
      tags: "kisan, किसान, ",
    };
    v.benefits = [
      { hi: "a", en: "b" },
      { hi: "", en: "" },
    ];
    const body = toBody(v);
    expect(body.rules).toBeNull();
    expect(body.slug).toBe("pm-kisan");
    expect(body.benefits).toHaveLength(1);
    expect(body.documents[0]).toMatchObject({ key: "aadhaar", label: { en: "Aadhaar card" } });
    expect(body.tags).toEqual(["kisan", "किसान"]);
    expect(body.state).toBeNull();
  });
});

describe("A-06 analytics — Sahayak usage (docs/06 task 5.6)", () => {
  const analytics = (sahayak) => ({
    from: "2026-09-01",
    to: "2026-09-27",
    byCategory: C.complaintCategories.map((category) => ({ category, count: 0 })),
    funnel: ["SUBMITTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"].map((status) => ({
      status,
      count: 0,
    })),
    complaintsPerDay: [],
    resolutionByWeek: [],
    sosPerDay: [],
    sosAvgAckMinutes: null,
    schemes: { checks: 0, topViewed: [] },
    ai: { withSuggestion: 0, acceptedPct: null, correctedPct: null },
    sahayak,
  });

  it("admins see LLM usage; authorities don't", async () => {
    loggedInAs(officer({ role: "admin", authority: null }));
    server.use(
      http.get("*/api/v1/admin/analytics", () =>
        HttpResponse.json({
          data: analytics({
            userMessages: 40,
            llmReplies: 35,
            letters: 6,
            emergencies: 2,
            users: 9,
            tokensInPer100: 210000,
            tokensOutPer100: 18000,
            avgLatencyMs: 2400,
          }),
        }),
      ),
    );
    renderApp("/portal/analytics");
    expect(await screen.findByText("सहायक का उपयोग (सिर्फ़ एडमिन)")).toBeInTheDocument();
    expect(screen.getByText("210000")).toBeInTheDocument();
  });

  it("hidden for authorities", async () => {
    loggedInAs(officer());
    server.use(
      http.get("*/api/v1/admin/analytics", () => HttpResponse.json({ data: analytics(null) })),
    );
    renderApp("/portal/analytics");
    expect(await screen.findByText(/AI/)).toBeInTheDocument();
    expect(screen.queryByText("सहायक का उपयोग (सिर्फ़ एडमिन)")).not.toBeInTheDocument();
  });
});
