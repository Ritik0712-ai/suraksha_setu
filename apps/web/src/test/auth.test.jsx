import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, VILLAGE, apiErr, citizen, http, officer, server, tokens } from "./server.js";

// Screens are lazy-loaded, so wait for the field to appear before typing.
const type = async (label, text) => userEvent.type(await screen.findByLabelText(label), text);

describe("S-03 login", () => {
  it("validates on the client before calling the API", async () => {
    renderApp("/login");
    await userEvent.click(await screen.findByRole("button", { name: "लॉग इन करें" }));
    expect(await screen.findAllByText("यह भरना ज़रूरी है।")).toHaveLength(2);
    await type("मोबाइल नंबर", "12345");
    await userEvent.click(screen.getByRole("button", { name: "लॉग इन करें" }));
    expect(await screen.findByText("10 अंकों का मोबाइल नंबर डालें।")).toBeInTheDocument();
  });

  it("cleans the phone, shows the server's message on 401, and logs in on success", async () => {
    let body;
    let attempts = 0;
    server.use(
      http.post("*/api/v1/auth/login", async ({ request }) => {
        body = await request.json();
        attempts += 1;
        return attempts === 1
          ? apiErr(401, "UNAUTHENTICATED", "मोबाइल नंबर या पासवर्ड गलत है।")
          : HttpResponse.json(tokens(citizen()));
      }),
    );
    const { router } = renderApp("/login?next=%2Fprofile");
    await screen.findByText("आगे बढ़ने के लिए लॉग इन करें");
    await type("मोबाइल नंबर", "+91 098765 43210");
    expect(screen.getByLabelText("मोबाइल नंबर")).toHaveValue("9876543210");
    await type("पासवर्ड", "wrong-pass");
    await userEvent.click(screen.getByRole("button", { name: "लॉग इन करें" }));
    expect(await screen.findByText("मोबाइल नंबर या पासवर्ड गलत है।")).toBeInTheDocument();
    expect(body).toEqual({ phone: "9876543210", password: "wrong-pass" });

    await userEvent.click(screen.getByRole("button", { name: "लॉग इन करें" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/profile"));
  });

  it("sends authorities to the portal, whatever ?next says", async () => {
    server.use(http.post("*/api/v1/auth/login", () => HttpResponse.json(tokens(officer()))));
    const { router } = renderApp("/login?next=%2Fprofile");
    await type("मोबाइल नंबर", "9876543210");
    await type("पासवर्ड", "safe-pass-1");
    await userEvent.click(await screen.findByRole("button", { name: "लॉग इन करें" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/portal"));
    expect(await screen.findByText("स्वागत है, Mr Verma")).toBeInTheDocument();
  });

  it("ignores an off-site ?next (no open redirect)", async () => {
    server.use(http.post("*/api/v1/auth/login", () => HttpResponse.json(tokens(citizen()))));
    const { router } = renderApp("/login?next=%2F%2Fevil.example");
    await type("मोबाइल नंबर", "9876543210");
    await type("पासवर्ड", "safe-pass-1");
    await userEvent.click(await screen.findByRole("button", { name: "लॉग इन करें" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});

describe("S-04 register", () => {
  it("pre-selects Mahodiya, registers and continues to the contacts step", async () => {
    let body;
    server.use(
      http.post("*/api/v1/auth/register", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(tokens(citizen()), { status: 201 });
      }),
      http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: [] })),
    );
    const { router } = renderApp("/register");
    await type("पूरा नाम", "सुनीता देवी");
    await type("मोबाइल नंबर", "98765 43210");
    await waitFor(() => expect(screen.getByLabelText("गाँव / इलाका")).toHaveValue("महोदिया"));
    await type("पासवर्ड", "handpump-2026");
    await userEvent.click(screen.getByRole("checkbox", { name: /मैं सहमत हूँ/ }));
    await userEvent.click(screen.getByRole("button", { name: "खाता बनाएँ" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/profile/contacts"));
    expect(body).toEqual({
      name: "सुनीता देवी",
      phone: "9876543210",
      password: "handpump-2026",
      jurisdictionId: VILLAGE.id,
      language: "hi",
      consent: true,
    });
    expect(
      await screen.findByText("एक आखिरी कदम: आपातकाल में जिन्हें अलर्ट भेजना है, उन्हें जोड़ें"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "अभी छोड़ें" })).toHaveAttribute("href", "/");
  });

  it("needs consent, and accepts a village that isn't listed", async () => {
    let body;
    server.use(
      http.post("*/api/v1/auth/register", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(tokens(citizen()), { status: 201 });
      }),
      http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: [] })),
    );
    renderApp("/register");
    await type("पूरा नाम", "Ramesh Kumar");
    await type("मोबाइल नंबर", "9812345678");
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "मेरा गाँव सूची में नहीं है" }),
    );
    await type("गाँव का नाम", "Bilkisganj");
    await type("पासवर्ड", "handpump-2026");
    await userEvent.click(screen.getByRole("radio", { name: "पुरुष" }));
    await userEvent.click(screen.getByRole("button", { name: "खाता बनाएँ" }));
    expect(await screen.findByText("आगे बढ़ने के लिए स्वीकार करें।")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: /मैं सहमत हूँ/ }));
    await userEvent.click(screen.getByRole("button", { name: "खाता बनाएँ" }));
    await waitFor(() => expect(body).toMatchObject({ villageOther: "Bilkisganj", gender: "male" }));
    expect(body).not.toHaveProperty("jurisdictionId");
  });

  it("shows 'already registered' under the phone with a log-in link", async () => {
    server.use(
      http.post("*/api/v1/auth/register", () =>
        apiErr(409, "CONFLICT", "यह नंबर पहले से रजिस्टर है।", [
          { field: "phone", issue: "taken" },
        ]),
      ),
    );
    renderApp("/register");
    await type("पूरा नाम", "Sunita Devi");
    await type("मोबाइल नंबर", "9876543210");
    await waitFor(() => expect(screen.getByLabelText("गाँव / इलाका")).toHaveValue("महोदिया"));
    await type("पासवर्ड", "handpump-2026");
    await userEvent.click(screen.getByRole("checkbox", { name: /मैं सहमत हूँ/ }));
    await userEvent.click(screen.getByRole("button", { name: "खाता बनाएँ" }));
    expect(await screen.findByText("यह नंबर पहले से रजिस्टर है।")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "लॉग इन करें" })).toHaveAttribute("href", "/login");
  });
});

describe("S-05 / S-05b password reset", () => {
  it("forgot password always shows the same message", async () => {
    server.use(
      http.post("*/api/v1/auth/password/forgot", () => HttpResponse.json({ data: { ok: true } })),
    );
    renderApp("/forgot-password");
    await type("मोबाइल नंबर", "9876543210");
    await userEvent.click(await screen.findByRole("button", { name: "आगे बढ़ें" }));
    expect(await screen.findByText(/हमने पासवर्ड बदलने का लिंक भेज दिया है/)).toBeInTheDocument();
  });

  it("code mode checks the confirmation, then returns to login with a message", async () => {
    let body;
    server.use(
      http.post("*/api/v1/auth/password/reset", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ok: true } });
      }),
    );
    const { router } = renderApp("/reset-password");
    await type("मोबाइल नंबर", "9876543210");
    await type("6 अंकों का कोड", "123456");
    await type("नया पासवर्ड", "brand-new-9");
    await type("नया पासवर्ड फिर से डालें", "brand-new-8");
    await userEvent.click(screen.getByRole("button", { name: "पासवर्ड बदलें" }));
    expect(await screen.findByText("पासवर्ड मेल नहीं खाते।")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("नया पासवर्ड फिर से डालें"));
    await type("नया पासवर्ड फिर से डालें", "brand-new-9");
    await userEvent.click(screen.getByRole("button", { name: "पासवर्ड बदलें" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(body).toEqual({ phone: "9876543210", code: "123456", password: "brand-new-9" });
    expect(await screen.findByText("पासवर्ड बदल गया। कृपया लॉग इन करें।")).toBeInTheDocument();
  });

  it("token mode (email link) only asks for the new password", async () => {
    let body;
    server.use(
      http.post("*/api/v1/auth/password/reset", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ok: true } });
      }),
    );
    renderApp("/reset-password?token=abcdefghijklmnopqrstuvwxyz");
    await screen.findByLabelText("नया पासवर्ड");
    expect(screen.queryByLabelText("6 अंकों का कोड")).not.toBeInTheDocument();
    await type("नया पासवर्ड", "brand-new-9");
    await type("नया पासवर्ड फिर से डालें", "brand-new-9");
    await userEvent.click(screen.getByRole("button", { name: "पासवर्ड बदलें" }));
    await waitFor(() =>
      expect(body).toEqual({ token: "abcdefghijklmnopqrstuvwxyz", password: "brand-new-9" }),
    );
  });
});
