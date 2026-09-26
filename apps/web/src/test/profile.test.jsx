import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { HttpResponse, apiErr, citizen, http, loggedInAs, server } from "./server.js";

const contact = (i) => ({
  id: `c${i}`,
  name: `Contact ${i}`,
  relation: "friend",
  phone: `+91981111111${i}`,
  email: null,
});

function contactsApi(initial = []) {
  const list = [...initial];
  const bodies = [];
  server.use(
    http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: list })),
    http.post("*/api/v1/users/me/contacts", async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      const c = { id: `n${list.length}`, ...body };
      list.push(c);
      return HttpResponse.json({ data: c }, { status: 201 });
    }),
    http.delete("*/api/v1/users/me/contacts/:id", ({ params }) => {
      list.splice(
        list.findIndex((c) => c.id === params.id),
        1,
      );
      return HttpResponse.json({ data: { ok: true } });
    }),
    http.get("*/api/v1/auth/me", () =>
      HttpResponse.json({ data: citizen({ emergencyContactCount: list.length }) }),
    ),
  );
  return { list, bodies };
}

describe("S-28 emergency contacts", () => {
  it("adds a contact and caches the list on the device for offline SOS", async () => {
    loggedInAs(citizen());
    const api = contactsApi();
    renderApp("/profile/contacts");
    expect(await screen.findByText("अभी कोई संपर्क नहीं")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "संपर्क जोड़ें" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("नाम"), "Maa");
    await userEvent.click(within(dialog).getByRole("radio", { name: "माँ" }));
    await userEvent.type(within(dialog).getByLabelText("मोबाइल नंबर"), "98111 11111");
    await userEvent.click(within(dialog).getByRole("button", { name: "सेव करें" }));

    expect(await screen.findByText("Maa")).toBeInTheDocument();
    expect(api.bodies).toEqual([
      { name: "Maa", relation: "mother", phone: "+919811111111", email: null },
    ]);
    await waitFor(() => expect(JSON.parse(localStorage.getItem("ss_contacts"))).toHaveLength(1));
    expect(screen.getByRole("link", { name: "टेस्ट अलर्ट" }).getAttribute("href")).toMatch(
      /^sms:\+919811111111\?body=/,
    );
  });

  it("refuses the user's own number before calling the API", async () => {
    loggedInAs(citizen());
    const api = contactsApi();
    renderApp("/profile/contacts");
    await userEvent.click(await screen.findByRole("button", { name: "संपर्क जोड़ें" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("नाम"), "Me");
    await userEvent.click(within(dialog).getByRole("radio", { name: "अन्य" }));
    await userEvent.type(within(dialog).getByLabelText("मोबाइल नंबर"), "9876543210");
    await userEvent.click(within(dialog).getByRole("button", { name: "सेव करें" }));
    expect(await within(dialog).findByText("यह आपका अपना नंबर है।")).toBeInTheDocument();
    expect(api.bodies).toEqual([]);
  });

  it("disables adding at 5 contacts", async () => {
    loggedInAs(citizen({ emergencyContactCount: 5 }));
    contactsApi([1, 2, 3, 4, 5].map(contact));
    renderApp("/profile/contacts");
    expect(await screen.findByText("Contact 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "संपर्क जोड़ें" })).toBeDisabled();
    expect(screen.getByText("अधिकतम 5 संपर्क")).toBeInTheDocument();
  });

  it("deletes after confirmation", async () => {
    loggedInAs(citizen({ emergencyContactCount: 1 }));
    contactsApi([contact(1)]);
    renderApp("/profile/contacts");
    await userEvent.click(await screen.findByRole("button", { name: "Contact 1 के लिए विकल्प" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "हटाएं" }));
    const dialog = await screen.findByRole("dialog", { name: "Contact 1 को हटाएं?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "हटाएं" }));
    expect(await screen.findByText("अभी कोई संपर्क नहीं")).toBeInTheDocument();
  });
});

describe("S-27 profile", () => {
  it("shows the masked phone and village, and edits the name", async () => {
    loggedInAs(citizen());
    let body;
    server.use(
      http.patch("*/api/v1/users/me", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: citizen({ name: "Sunita Verma" }) });
      }),
    );
    renderApp("/profile");
    expect(await screen.findByText("+91 98XXX XX210")).toBeInTheDocument();
    expect(await screen.findByText("महोदिया")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "बदलें" }));
    const name = screen.getByLabelText("पूरा नाम");
    await userEvent.clear(name);
    await userEvent.type(name, "Sunita Verma");
    await userEvent.click(screen.getByRole("button", { name: "सेव करें" }));
    expect(await screen.findByText("Sunita Verma")).toBeInTheDocument();
    expect(body).toEqual({ name: "Sunita Verma", email: null });
  });

  it("deletes the account only with the right password", async () => {
    loggedInAs(citizen());
    let attempts = 0;
    server.use(
      http.delete("*/api/v1/users/me", async ({ request }) => {
        attempts += 1;
        const { password } = await request.json();
        return password === "right-pass-1"
          ? HttpResponse.json({ data: { ok: true } })
          : apiErr(400, "VALIDATION_ERROR", "Your current password is incorrect.", [
              { field: "password", issue: "incorrect" },
            ]);
      }),
    );
    const { router } = renderApp("/profile");
    await userEvent.click(await screen.findByRole("button", { name: "मेरा खाता हटाएं" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "खाता हटाएं" });
    expect(confirm).toBeDisabled();
    await userEvent.type(
      within(dialog).getByLabelText("पक्का करने के लिए अपना पासवर्ड डालें"),
      "wrong-pass",
    );
    await userEvent.click(confirm);
    expect(await within(dialog).findByText("यह पासवर्ड गलत है।")).toBeInTheDocument();

    const pw = within(dialog).getByLabelText("पक्का करने के लिए अपना पासवर्ड डालें");
    await userEvent.clear(pw);
    await userEvent.type(pw, "right-pass-1");
    await userEvent.click(confirm);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(attempts).toBe(2);
    expect(await screen.findByText("खाता हटा दिया गया")).toBeInTheDocument();
  });

  it("logs out and clears the session", async () => {
    loggedInAs(citizen());
    server.use(http.post("*/api/v1/auth/logout", () => HttpResponse.json({ data: { ok: true } })));
    const { router } = renderApp("/profile");
    await userEvent.click(await screen.findByRole("button", { name: "लॉग आउट" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(await screen.findByText("लॉग आउट हो गए")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "रजिस्टर करें" })).toBeInTheDocument();
  });
});
