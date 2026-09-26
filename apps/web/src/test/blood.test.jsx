import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, apiErr, citizen, http, loggedInAs, server } from "./server.js";

function mockGeo(mode = "ok") {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok, fail) =>
        mode === "ok"
          ? ok({ coords: { latitude: 23.2005, longitude: 77.0805, accuracy: 15 } })
          : fail({ code: 1 }),
    },
  });
}

const donor = (over = {}) => ({
  id: "d1",
  bloodGroup: "B+",
  displayName: "Rahul S.",
  village: { en: "Mahodiya", hi: "महोदिया" },
  distanceM: 1200,
  lastDonatedAt: null,
  compatible: false,
  maskedPhone: "98XXXXXX21",
  ...over,
});
const myProfile = (over = {}) => ({
  id: "me1",
  bloodGroup: "O+",
  lastDonatedAt: null,
  eligibleFrom: "2026-01-01T00:00:00Z",
  eligibleNow: true,
  available: true,
  location: { lat: 23.2, lng: 77.08 },
  village: { en: "Mahodiya", hi: "महोदिया" },
  displayName: "Sunita D.",
  consentAt: "2026-01-01T00:00:00Z",
  viewsThisMonth: 2,
  ...over,
});

function backend({
  donors = [
    donor(),
    donor({ id: "d2", displayName: "Ravi K.", bloodGroup: "O-", compatible: true }),
  ],
  me = null,
  revealStatus = 200,
} = {}) {
  const state = { searches: [], reveals: [], saved: [], me, availability: [] };
  server.use(
    http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: [] })),
    http.get("*/api/v1/donors/me", () =>
      state.me
        ? HttpResponse.json({ data: state.me })
        : apiErr(404, "NOT_FOUND", "रक्तदाता नहीं मिला।"),
    ),
    http.put("*/api/v1/donors/me", async ({ request }) => {
      const body = await request.json();
      state.saved.push(body);
      state.me = myProfile({ bloodGroup: body.bloodGroup, available: body.available });
      return HttpResponse.json({ data: state.me }, { status: 201 });
    }),
    http.patch("*/api/v1/donors/me/availability", async ({ request }) => {
      const { available } = await request.json();
      state.availability.push(available);
      state.me = { ...state.me, available };
      return HttpResponse.json({ data: state.me });
    }),
    http.delete("*/api/v1/donors/me", () => {
      state.me = null;
      return HttpResponse.json({ data: { removed: true } });
    }),
    http.get("*/api/v1/donors/search", ({ request }) => {
      const p = Object.fromEntries(new URL(request.url).searchParams);
      state.searches.push(p);
      return HttpResponse.json({
        data: {
          donors: p.radiusKm === "50" ? [] : donors,
          radiusKm: Number(p.radiusKm),
          groups: [],
        },
      });
    }),
    http.post("*/api/v1/donors/:id/reveal", async ({ params, request }) => {
      state.reveals.push({ id: params.id, ...(await request.json()) });
      if (revealStatus === 429)
        return apiErr(
          429,
          "RATE_LIMITED",
          "आज आप 10 नंबर देख चुके हैं। कल कोशिश करें या अस्पताल के ब्लड बैंक को फ़ोन करें।",
        );
      return HttpResponse.json({ data: { phone: "+919811111121", revealsLeftToday: 9 } });
    }),
  );
  return state;
}

beforeEach(() => mockGeo("ok"));

describe("S-21 donor search", () => {
  it("searches by group, distance and compatibility; shows masked results", async () => {
    loggedInAs(citizen());
    const state = backend();
    renderApp("/blood");
    expect(
      await screen.findByRole("link", { name: /क्या आप रक्तदाता हैं\? रजिस्टर करें/ }),
    ).toHaveAttribute("href", "/blood/donor");
    const searchBtn = screen.getByRole("button", { name: "खोजें" });
    expect(searchBtn).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "B+" }));
    expect(screen.getByText("जैसे B+ के लिए B−, O+, O− भी दिखाए जाएँगे")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "10 कि.मी." }));
    await userEvent.click(screen.getByRole("button", { name: "अनुमति दें" }));
    await userEvent.click(searchBtn);

    expect(await screen.findByText("2 रक्तदाता मिले")).toBeInTheDocument();
    expect(state.searches[0]).toEqual({
      bloodGroup: "B+",
      radiusKm: "10",
      includeCompatible: "true",
      lat: "23.2005",
      lng: "77.0805",
    });
    expect(screen.getByText("Rahul S.")).toBeInTheDocument();
    expect(screen.getAllByText("98XXXXXX21")).toHaveLength(2);
    expect(screen.getByText("मेल खाता")).toBeInTheDocument();
  });

  it("reveal: warning dialog → number + Call + WhatsApp", async () => {
    loggedInAs(citizen());
    const state = backend();
    renderApp("/blood");
    await userEvent.click(await screen.findByRole("radio", { name: "B+" }));
    await userEvent.click(screen.getByRole("button", { name: "खोजें" }));
    await screen.findByText("Rahul S.");
    await userEvent.click(screen.getAllByRole("button", { name: "नंबर देखें और कॉल करें" })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/आपका नाम दर्ज किया जाएगा/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "आगे बढ़ें" }));
    expect(await screen.findByText("+91 9811111121")).toBeInTheDocument();
    expect(state.reveals).toEqual([{ id: "d1", bloodGroupSearched: "B+" }]);
    expect(screen.getByRole("link", { name: "कॉल करें" })).toHaveAttribute(
      "href",
      "tel:+919811111121",
    );
    expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/919811111121\?text=/,
    );
    expect(screen.getByText("आज आप और 9 नंबर देख सकते हैं")).toBeInTheDocument();
  });

  it("shows the daily limit message on the card", async () => {
    loggedInAs(citizen());
    backend({ revealStatus: 429 });
    renderApp("/blood");
    await userEvent.click(await screen.findByRole("radio", { name: "B+" }));
    await userEvent.click(screen.getByRole("button", { name: "खोजें" }));
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "नंबर देखें और कॉल करें" }))[0],
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "आगे बढ़ें" }),
    );
    expect(await screen.findByText(/आज आप 10 नंबर देख चुके हैं/)).toBeInTheDocument();
  });

  it("empty: search wider (50 km), call 108", async () => {
    loggedInAs(citizen());
    const state = backend({ donors: [] });
    renderApp("/blood");
    await userEvent.click(await screen.findByRole("radio", { name: "O−".replace("−", "-") }));
    await userEvent.click(screen.getByRole("button", { name: "खोजें" }));
    expect(
      await screen.findByText("25 कि.मी. में कोई उपलब्ध रक्तदाता नहीं मिला।"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "और दूर तक खोजें (50 कि.मी.)" }));
    expect(
      await screen.findByText("50 कि.मी. में कोई उपलब्ध रक्तदाता नहीं मिला।"),
    ).toBeInTheDocument();
    expect(state.searches.at(-1).radiusKm).toBe("50");
    expect(screen.getByRole("link", { name: "108 पर कॉल करें" })).toHaveAttribute(
      "href",
      "tel:108",
    );
  });
});

describe("S-23 my donor profile", () => {
  it("registers: group required, consent required, never donated, current location", async () => {
    loggedInAs(citizen());
    const state = backend();
    renderApp("/blood/donor");
    expect(await screen.findByText(/रजिस्टर करने से आपातकाल में/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "रक्तदाता के रूप में रजिस्टर करें" }));
    expect(await screen.findByText("अपना ब्लड ग्रुप चुनें।")).toBeInTheDocument();
    expect(screen.getByText("कृपया संपर्क के लिए सहमति दें।")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "O+" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "कभी रक्तदान नहीं किया" }));
    await userEvent.click(screen.getByRole("button", { name: "मेरी अभी की लोकेशन लें" }));
    await screen.findByText("अभी की लोकेशन इस्तेमाल होगी");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "मैं रक्तदान के लिए संपर्क किए जाने से सहमत हूँ" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "रक्तदाता के रूप में रजिस्टर करें" }));

    expect(await screen.findByText("अभी रक्तदान कर सकते हैं ✅")).toBeInTheDocument();
    expect(state.saved[0]).toEqual({
      bloodGroup: "O+",
      lastDonatedAt: null,
      location: { lat: 23.2005, lng: 77.0805 },
      available: true,
      consent: true,
    });
    expect(screen.getByText("इस महीने आपका नंबर देखने वाले लोग: 2")).toBeInTheDocument();
  });

  it("toggles availability instantly and removes the profile after confirming", async () => {
    loggedInAs(citizen());
    const state = backend({
      me: myProfile({ eligibleNow: false, eligibleFrom: "2026-12-01T00:00:00Z" }),
    });
    renderApp("/blood/donor");
    expect(await screen.findByText(/इस तारीख से रक्तदान कर सकते हैं/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "मैं रक्तदान के लिए उपलब्ध हूँ" }));
    expect(await screen.findByText("अब आप खोज में नहीं दिखेंगे")).toBeInTheDocument();
    expect(state.availability).toEqual([false]);

    await userEvent.click(screen.getByRole("button", { name: "रक्तदाता सूची से मुझे हटाएँ" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "रक्तदाता सूची से मुझे हटाएँ" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/रजिस्टर करने से आपातकाल में/)).toBeInTheDocument(),
    );
  });
});
