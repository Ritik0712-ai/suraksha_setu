import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, apiErr, citizen, http, loggedInAs, officer, server } from "./server.js";

describe("route guards (docs/03 §1)", () => {
  it("guests on a citizen route go to /login?next=", async () => {
    const { router } = renderApp("/profile");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?next=%2Fprofile");
  });

  it("citizens can't open the portal (X-02)", async () => {
    loggedInAs(citizen());
    renderApp("/portal");
    expect(await screen.findByText("आपको यह पेज देखने की अनुमति नहीं है")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "होम पर जाएं" })).toHaveAttribute("href", "/");
  });

  it("authorities on a citizen route go to the portal with a toast", async () => {
    loggedInAs(officer());
    const { router } = renderApp("/profile");
    await waitFor(() => expect(router.state.location.pathname).toBe("/portal"));
    expect(await screen.findByText("यह पेज नागरिकों के लिए है।")).toBeInTheDocument();
  });

  it("authorities can't open admin pages", async () => {
    loggedInAs(officer());
    renderApp("/portal/admin/users");
    expect(await screen.findByText("आपको यह पेज देखने की अनुमति नहीं है")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "पोर्टल पर जाएं" })).toHaveAttribute("href", "/portal");
  });

  it("admins see the admin section of the sidebar", async () => {
    loggedInAs(officer({ role: "admin", authority: null }));
    renderApp("/portal/admin/users");
    expect(
      await screen.findByRole("heading", { name: "उपयोगकर्ता और अधिकारी खाते" }),
    ).toBeInTheDocument();
  });

  it("logged-in users skip the login page", async () => {
    loggedInAs(citizen());
    const { router } = renderApp("/login");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("forces an admin-created account to change its password first (A-14)", async () => {
    loggedInAs(officer({ mustChangePassword: true }));
    let body;
    server.use(
      http.put("*/api/v1/users/me/password", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { accessToken: "t2", expiresIn: 900, user: officer() } });
      }),
    );
    renderApp("/portal");
    expect(await screen.findByText("आगे बढ़ने से पहले नया पासवर्ड बनाएँ।")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("मौजूदा पासवर्ड"), "Ss-temp-123");
    await userEvent.type(screen.getByLabelText("नया पासवर्ड"), "my-own-pass-1");
    await userEvent.type(screen.getByLabelText("नया पासवर्ड फिर से डालें"), "my-own-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "सेव करें" }));
    await waitFor(() =>
      expect(screen.queryByText("आगे बढ़ने से पहले नया पासवर्ड बनाएँ।")).not.toBeInTheDocument(),
    );
    expect(body).toEqual({ currentPassword: "Ss-temp-123", newPassword: "my-own-pass-1" });
  });

  it("shows the maintenance screen with helplines when the database is down (X-06)", async () => {
    server.use(
      http.get("*/api/v1/health", () =>
        HttpResponse.json({ status: "degraded", db: "down", ai: "up" }, { status: 503 }),
      ),
    );
    renderApp("/");
    expect(
      await screen.findByText(
        "हम कुछ ठीक कर रहे हैं। नीचे दिए आपातकालीन नंबर अभी भी काम करते हैं।",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /सभी आपात स्थितियाँ — 112 पर कॉल करें/ }),
    ).toHaveAttribute("href", "tel:112");
  });

  it("unknown routes show X-01", async () => {
    renderApp("/no-such-page");
    expect(await screen.findByText("यह पेज नहीं मिला")).toBeInTheDocument();
  });

  it("Sahayak is a citizen route (S-24)", async () => {
    loggedInAs(citizen());
    server.use(http.get("*/api/v1/chat/sessions", () => HttpResponse.json({ data: [] })));
    renderApp("/sahayak");
    expect(await screen.findByRole("heading", { level: 1, name: "सहायक" })).toBeInTheDocument();
    expect(screen.getByText(/मैं सहायक हूँ/)).toBeInTheDocument();
  });
});

describe("API client (docs/02 §3, docs/03 §2.7)", () => {
  it("refreshes once on TOKEN_EXPIRED and retries the request", async () => {
    loggedInAs(citizen());
    let calls = 0;
    const seen = [];
    server.use(
      http.get("*/api/v1/users/me/contacts", ({ request }) => {
        calls += 1;
        seen.push(request.headers.get("authorization"));
        return calls === 1
          ? apiErr(401, "TOKEN_EXPIRED", "expired")
          : HttpResponse.json({ data: [] });
      }),
    );
    renderApp("/profile/contacts");
    expect(await screen.findByText("अभी कोई संपर्क नहीं")).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(seen).toEqual(["Bearer token-u1", "Bearer token-u1"]);
  });

  it("shows 'Please log in again' when the refresh fails (X-04)", async () => {
    loggedInAs(citizen());
    renderApp("/profile/contacts");
    await screen.findByRole("heading", { name: "आपातकालीन संपर्क" });
    server.use(
      http.get("*/api/v1/users/me/contacts", () => apiErr(401, "TOKEN_EXPIRED", "expired")),
      http.post("*/api/v1/auth/refresh", () => apiErr(401, "UNAUTHENTICATED", "no")),
    );
    // Force a refetch with the expired token.
    const { queryClient } = await import("../lib/queryClient.js");
    await queryClient.refetchQueries({ queryKey: ["contacts"] });
    expect(
      await screen.findByText(
        "आपका सत्र खत्म हो गया। जहाँ थे वहीं से आगे बढ़ने के लिए लॉग इन करें।",
      ),
    ).toBeInTheDocument();
  });
});
