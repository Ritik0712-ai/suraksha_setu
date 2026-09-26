import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "../i18n/index.js";
import { server } from "./server.js";
import { resetStores } from "./utils.jsx";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => resetStores());
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetStores();
});
afterAll(() => server.close());
