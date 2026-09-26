import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, citizen, http, loggedInAs, server } from "./server.js";

const HERE = { latitude: 23.2005, longitude: 77.0805, accuracy: 20 };

function mockGeo(mode = "ok", permission = "prompt") {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (ok, fail) =>
        mode === "ok" ? ok({ coords: HERE }) : fail({ code: mode === "denied" ? 1 : 3 }),
    },
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: async () => ({ state: permission }) },
  });
}

const svc = (over = {}) => ({
  id: "e1",
  source: "curated",
  type: "hospital",
  name: { en: "District Hospital", hi: "जिला अस्पताल" },
  address: { en: "Sehore", hi: "सीहोर" },
  phones: ["07562-000000"],
  lat: 23.21,
  lng: 77.09,
  distanceM: 4200,
  is24x7: true,
  notes: null,
  verifiedAt: "2026-09-01",
  ...over,
});

function backend(services = [svc()]) {
  const state = { queries: [], events: [] };
  server.use(
    http.get("*/api/v1/emergency/nearby", ({ request }) => {
      const p = Object.fromEntries(new URL(request.url).searchParams);
      state.queries.push(p);
      const list = services.filter((s) => p.type === "hospital" || s.type === p.type);
      return HttpResponse.json({
        data: {
          services: list,
          placesUsed: false,
          from: p.lat ? { lat: Number(p.lat), lng: Number(p.lng) } : { lat: 23.2, lng: 77.08 },
          approximate: !p.lat,
        },
      });
    }),
    http.post("*/api/v1/events", async ({ request }) => {
      state.events.push(await request.json());
      return HttpResponse.json({ data: { ok: true } }, { status: 202 });
    }),
    http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: [] })),
  );
  return state;
}

beforeEach(() => mockGeo("ok"));

describe("S-20 emergency help", () => {
  it("shows helplines (tap = call, counted) and asks before using location", async () => {
    const state = backend();
    renderApp("/emergency");
    const call112 = await screen.findByRole("link", {
      name: "सभी आपात स्थितियाँ — 112 पर कॉल करें",
    });
    expect(call112).toHaveAttribute("href", "tel:112");
    call112.addEventListener("click", (e) => e.preventDefault());
    await userEvent.click(call112);
    await waitFor(() =>
      expect(state.events).toEqual([{ type: "emergency_call_tap", props: { number: "112" } }]),
    );
    expect(
      screen.getByText("पास की सेवाएँ ढूँढने के लिए लोकेशन की अनुमति दें"),
    ).toBeInTheDocument();
    expect(state.queries).toHaveLength(0);
  });

  it("after Allow: nearest services with distance, badges, Call and Directions", async () => {
    const state = backend([
      svc(),
      svc({
        id: "place:x",
        source: "google",
        name: { en: "City Hospital", hi: "City Hospital" },
        distanceM: 650,
        is24x7: null,
      }),
    ]);
    renderApp("/emergency");
    await userEvent.click(await screen.findByRole("button", { name: "अनुमति दें" }));
    expect(await screen.findByText("जिला अस्पताल")).toBeInTheDocument();
    expect(state.queries[0]).toMatchObject({ type: "hospital", lat: "23.2005", lng: "77.0805" });
    expect(screen.getByText("4.2 कि.मी.")).toBeInTheDocument();
    expect(screen.getByText("650 मी.")).toBeInTheDocument();
    expect(screen.getByText("टीम द्वारा जाँचा गया")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    const call = screen.getAllByRole("link", { name: "कॉल करें" })[0];
    expect(call).toHaveAttribute("href", "tel:07562-000000");
    expect(screen.getAllByRole("link", { name: "रास्ता देखें" })[0]).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=23.210000,77.090000",
    );
  });

  it("switches type tabs and shows the empty state with 112/108", async () => {
    mockGeo("ok", "granted");
    backend([svc()]);
    renderApp("/emergency");
    await screen.findByText("जिला अस्पताल");
    await userEvent.click(screen.getByRole("tab", { name: "दमकल" }));
    const empty = await screen.findByText("पास में कोई दमकल नहीं मिला। 112 या 108 पर कॉल करें।");
    const box = empty.closest('[role="status"]');
    expect(within(box).getByRole("link", { name: "112 पर कॉल करें" })).toHaveAttribute(
      "href",
      "tel:112",
    );
  });

  it("location denied: signed-in citizens see services near their village", async () => {
    mockGeo("denied", "denied");
    loggedInAs(citizen());
    const state = backend();
    renderApp("/emergency");
    expect(await screen.findByText(/आपके गाँव के पास की सेवाएँ/)).toBeInTheDocument();
    expect(await screen.findByText("जिला अस्पताल")).toBeInTheDocument();
    expect(state.queries[0]).not.toHaveProperty("lat");
  });

  it("location denied as a guest: a note, no request", async () => {
    mockGeo("denied", "denied");
    const state = backend();
    renderApp("/emergency");
    expect(
      await screen.findByText(/लोकेशन बंद है। पास की सेवाएँ देखने के लिए/),
    ).toBeInTheDocument();
    expect(state.queries).toHaveLength(0);
  });
});
