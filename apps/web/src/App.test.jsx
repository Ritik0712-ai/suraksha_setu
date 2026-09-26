import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material";
import i18n from "./i18n/index.js";
import { theme } from "./theme/theme.js";
import App from "./App.jsx";
import C from "./config/constants.js";

const renderApp = () =>
  render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>,
  );

describe("App (Phase 0 shell)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await act(() => i18n.changeLanguage(C.defaultLanguage));
  });

  it("renders in Hindi by default with the emergency bar and disclaimer", () => {
    renderApp();
    expect(screen.getByRole("link", { name: /112 पर कॉल करें/ })).toHaveAttribute(
      "href",
      "tel:112",
    );
    expect(screen.getByText(/यह सरकारी सेवा नहीं है/)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("hi");
  });

  it("switches to English and updates <html lang>", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("button", { name: "Language / भाषा" }));
    expect(screen.getByRole("link", { name: /Call 112/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("ss_lang")).toBe("en");
  });
});
