import { describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./utils.jsx";
import { citizen, loggedInAs } from "./server.js";
import { usePrefs } from "../stores/prefs.js";
import { useNetwork } from "../stores/network.js";
import { useAppUpdate } from "../lib/pwa.js";

describe("citizen shell (docs/03 §2.1)", () => {
  it("renders in Hindi by default with the emergency bar and the disclaimer", async () => {
    renderApp("/");
    expect(await screen.findByRole("link", { name: /112 पर कॉल करें/ })).toHaveAttribute(
      "href",
      "tel:112",
    );
    expect(screen.getByText(/यह सरकारी सेवा नहीं है/)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("hi");
  });

  it("switches language instantly and remembers it (docs/03 §2.3)", async () => {
    renderApp("/");
    await userEvent.click(await screen.findByRole("button", { name: "Language / भाषा" }));
    expect(await screen.findByRole("link", { name: /Emergency\? Call 112/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("ss_lang")).toBe("en");
  });

  it("changes the root text size from the header (docs/03 §2.4)", async () => {
    renderApp("/");
    await userEvent.click(await screen.findByRole("button", { name: "अक्षर का आकार" }));
    await userEvent.click(screen.getByRole("button", { name: "बड़े अक्षर" }));
    expect(document.documentElement.dataset.textSize).toBe("lg");
    expect(localStorage.getItem("ss_text_size")).toBe("lg");
  });

  it("sends first-time visitors to the language screen (S-01)", async () => {
    usePrefs.setState({ languageChosen: false });
    renderApp("/");
    await userEvent.click(await screen.findByRole("button", { name: "English" }));
    expect(await screen.findByRole("heading", { name: "Namaste 🙏" })).toBeInTheDocument();
    expect(localStorage.getItem("ss_lang")).toBe("en");
  });

  it("shows the offline banner when the browser goes offline (X-03)", async () => {
    renderApp("/");
    await screen.findByRole("heading", { name: "नमस्ते 🙏" });
    act(() => useNetwork.getState().setBrowserOnline(false));
    expect(
      await screen.findByText("आप ऑफ़लाइन हैं। कुछ सुविधाएँ काम नहीं करेंगी।"),
    ).toBeInTheDocument();
  });
});

describe("home (S-02)", () => {
  it("guests see Register / Log in at the top, the SOS card and the tiles", async () => {
    renderApp("/");
    expect(await screen.findByRole("link", { name: /SOS — मदद चाहिए\?/ })).toHaveAttribute(
      "href",
      "/sos",
    );
    // In the header on every page, and next to the greeting on Home — never below the tiles.
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("link", { name: "लॉग इन" })).toHaveAttribute("href", "/login");
    expect(header.getByRole("link", { name: "रजिस्टर करें" })).toHaveAttribute("href", "/register");
    const main = within(screen.getByRole("main"));
    const register = main.getByRole("link", { name: "रजिस्टर करें" });
    const tiles = main.getByRole("button", { name: "शिकायत करें" });
    expect(register.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "शिकायत करें" })).toBeInTheDocument(); // login-gated tile
    expect(screen.queryByRole("navigation", { name: "मुख्य मेन्यू" })).toBeInTheDocument(); // desktop nav markup
  });

  it("logged-in citizens get a greeting, the setup prompt and the bottom nav", async () => {
    loggedInAs(citizen());
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "नमस्ते, Sunita" })).toBeInTheDocument();
    expect(screen.getByText("अभी तक कोई आपातकालीन संपर्क नहीं जोड़ा")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "मेरी शिकायतें" })).toBeInTheDocument();
    const navs = screen.getAllByRole("navigation", { name: "मुख्य मेन्यू" });
    expect(navs.some((n) => within(n).queryByRole("link", { name: "प्रोफ़ाइल" }))).toBe(true);
  });

  it("hides the setup prompt once contacts exist", async () => {
    loggedInAs(citizen({ emergencyContactCount: 2 }));
    renderApp("/");
    await screen.findByRole("heading", { name: "नमस्ते, Sunita" });
    expect(screen.queryByText("अभी तक कोई आपातकालीन संपर्क नहीं जोड़ा")).not.toBeInTheDocument();
  });

  it("sends guests to login when they tap a login-only tile", async () => {
    const { router } = renderApp("/");
    await userEvent.click(await screen.findByRole("button", { name: "रक्तदाता" }));
    // Data routers commit the navigation once the lazy login chunk has loaded.
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?next=%2Fblood");
    expect(await screen.findByText("आगे बढ़ने के लिए लॉग इन करें")).toBeInTheDocument();
  });

  it("offers a one-tap update when a new version has been downloaded", async () => {
    const apply = vi.fn();
    renderApp("/");
    expect(screen.queryByText("ऐप का नया वर्ज़न आ गया है।")).not.toBeInTheDocument();
    act(() => useAppUpdate.setState({ ready: true, apply }));
    await userEvent.click(await screen.findByRole("button", { name: "अपडेट करें" }));
    expect(apply).toHaveBeenCalledTimes(1);
    act(() => useAppUpdate.setState({ ready: false, apply: null }));
  });
});
