import { render } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import App from "../App.jsx";
import i18n from "../i18n/index.js";
import { queryClient } from "../lib/queryClient.js";
import { routes } from "../router.jsx";
import { bootstrapSession } from "../features/auth/session.js";
import { useNetwork } from "../stores/network.js";
import { usePrefs } from "../stores/prefs.js";
import { useSession } from "../stores/session.js";
import { useToast } from "../stores/toast.js";
import { useComplaintDraft } from "../stores/complaintDraft.js";
import { useEligibility } from "../stores/eligibility.js";
import { clearOutbox } from "../lib/outbox.js";

export function resetStores() {
  try {
    localStorage.clear();
    sessionStorage.clear(); // e.g. the last GPS fix, used as an SOS fallback
  } catch {
    // ignore
  }
  queryClient.clear();
  useSession.setState({ status: "loading", accessToken: null, user: null, endedByUser: false });
  usePrefs.setState({ language: "hi", languageChosen: true, textSize: "md" });
  useToast.setState({ toast: null });
  useComplaintDraft.getState().reset();
  clearOutbox();
  useEligibility.getState().reset();
  useNetwork.setState({ browserOnline: true, failures: 0 });
  document.documentElement.setAttribute("data-text-size", "md");
  i18n.changeLanguage("hi");
}

/** Renders the real app at `path` and runs the session bootstrap like main.jsx does. */
export function renderApp(path = "/", { bootstrap = true } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  if (bootstrap) bootstrapSession();
  const utils = render(<App router={router} />);
  return { ...utils, router };
}
