import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePrefs } from "../../stores/prefs.js";
import { isStaff, useSession } from "../../stores/session.js";
import { toast } from "../../stores/toast.js";
import { ListSkeleton } from "../../components/ui/States.jsx";
import { ForbiddenPage } from "./SystemPages.jsx";

// Route guards (docs/03 §1 "Route guards").

const here = (loc) => `${loc.pathname}${loc.search}`;

/** First launch (no saved language) → S-01 (docs/03 S-01). */
export function LanguageGate() {
  const chosen = usePrefs((s) => s.languageChosen);
  const location = useLocation();
  if (!chosen) return <Navigate to="/welcome" replace state={{ from: here(location) }} />;
  return <Outlet />;
}

function RedirectStaffToPortal() {
  const { t } = useTranslation("system");
  useEffect(() => {
    toast(t("citizensOnly"), "info");
  }, [t]);
  return <Navigate to="/portal" replace />;
}

/** Citizen routes: guests → /login?next=, authorities/admins → /portal with a toast. */
export function RequireCitizen() {
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const endedByUser = useSession((s) => s.endedByUser);
  const location = useLocation();
  if (status === "loading") return <ListSkeleton />;
  if (status === "guest" && endedByUser) return <Navigate to="/" replace />;
  if (status !== "authed")
    return <Navigate to={`/login?next=${encodeURIComponent(here(location))}`} replace />;
  if (isStaff(user)) return <RedirectStaffToPortal />;
  return <Outlet />;
}

/** Portal routes: guests → login, citizens → X-02, authorities on admin routes → X-02. */
export function RequireStaff({ adminOnly = false }) {
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const endedByUser = useSession((s) => s.endedByUser);
  const location = useLocation();
  if (status === "loading") return <ListSkeleton />;
  if (status === "guest" && endedByUser) return <Navigate to="/" replace />;
  if (status !== "authed")
    return <Navigate to={`/login?next=${encodeURIComponent(here(location))}`} replace />;
  if (!isStaff(user) || (adminOnly && user.role !== "admin")) return <ForbiddenPage />;
  return <Outlet />;
}

/**
 * Login/register: users who arrive already logged in go to / (citizens) or /portal (staff).
 * Someone who logs in *on* this page is left alone, so the page's own redirect (?next=, the
 * post-registration contacts step) isn't overridden.
 */
export function GuestOnly() {
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const statusOnArrival = useRef(null);
  if (statusOnArrival.current === null && status !== "loading") statusOnArrival.current = status;
  if (status === "loading") return <ListSkeleton />;
  if (statusOnArrival.current === "authed")
    return <Navigate to={isStaff(user) ? "/portal" : "/"} replace />;
  return <Outlet />;
}
