import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme/theme.js";
import { StatusChip } from "../components/ui/StatusChip.jsx";
import { cleanPhoneInput, formatPhone, maskPhone, toTenDigits } from "../lib/phone.js";
import { safeNext } from "../lib/nextPath.js";

describe("StatusChip (docs/04 §3.3)", () => {
  it.each([
    ["SUBMITTED", "दर्ज हुई"],
    ["IN_PROGRESS", "काम चल रहा है"],
    ["RESOLVED", "हल हो गई"],
    ["REJECTED", "अस्वीकार"],
    ["SOS_ACTIVE", "SOS चालू"],
  ])("%s shows an icon and the text %s", (status, text) => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <StatusChip status={status} />
      </ThemeProvider>,
    );
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("phone helpers", () => {
  it("cleans typed input to 10 digits", () => {
    expect(cleanPhoneInput("+91 98765-43210")).toBe("9876543210");
    expect(cleanPhoneInput("098765 43210")).toBe("9876543210");
    expect(cleanPhoneInput("98765abc")).toBe("98765");
  });
  it("validates, masks and formats", () => {
    expect(toTenDigits("5876543210")).toBeNull();
    expect(toTenDigits("+919876543210")).toBe("9876543210");
    expect(maskPhone("+919876543210")).toBe("+91 98XXX XX210");
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });
});

describe("safeNext", () => {
  it("only allows in-app paths", () => {
    expect(safeNext("/profile")).toBe("/profile");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/login")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/"); // browsers treat /\ like //
    expect(safeNext("/\tevil")).toBe("/");
    expect(safeNext(undefined, "/x")).toBe("/x");
  });
});
