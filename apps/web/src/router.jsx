import { createBrowserRouter } from "react-router-dom";
import { CitizenShell } from "./components/layout/CitizenShell.jsx";
import HomePage from "./features/home/HomePage.jsx";
import WelcomePage from "./features/welcome/WelcomePage.jsx";
import { CrashPage } from "./features/system/CrashPage.jsx";
import {
  GuestOnly,
  LanguageGate,
  RequireCitizen,
  RequireStaff,
} from "./features/system/guards.jsx";
import { ComingSoonPage, NotFoundPage } from "./features/system/SystemPages.jsx";
import { RouteSkeleton } from "./components/ui/States.jsx";

// Route map from docs/03 §1. Screens other than Home load on demand, so citizens never download
// portal or dev code. Modules built in later phases render a "coming soon" page with the
// helplines until then.

const page = (loader) => () => loader().then((m) => ({ Component: m.default }));
const soon = (titleKey) => ({ element: <ComingSoonPage titleKey={titleKey} /> });
const portalSoon = (titleKey) => ({
  lazy: () =>
    import("./features/portal/PortalPlaceholder.jsx").then((m) => ({
      Component: () => <m.default titleKey={titleKey} />,
    })),
});

export const routes = [
  { path: "/welcome", element: <WelcomePage />, errorElement: <CrashPage /> },
  {
    element: <LanguageGate />,
    errorElement: <CrashPage />,
    HydrateFallback: RouteSkeleton,
    children: [
      {
        element: <CitizenShell />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <GuestOnly />,
            children: [
              { path: "login", lazy: page(() => import("./features/auth/LoginPage.jsx")) },
              { path: "register", lazy: page(() => import("./features/auth/RegisterPage.jsx")) },
            ],
          },
          {
            path: "forgot-password",
            lazy: page(() => import("./features/auth/ForgotPasswordPage.jsx")),
          },
          {
            path: "reset-password",
            lazy: page(() => import("./features/auth/ResetPasswordPage.jsx")),
          },
          {
            path: "about",
            lazy: () =>
              import("./features/info/InfoPages.jsx").then((m) => ({ Component: m.AboutPage })),
          },
          {
            path: "privacy",
            lazy: () =>
              import("./features/info/InfoPages.jsx").then((m) => ({ Component: m.PrivacyPage })),
          },

          { path: "fake-call", lazy: page(() => import("./features/sos/FakeCallPage.jsx")) },

          // Public modules (later phases).
          { path: "emergency", ...soon("modules.emergency") },
          { path: "schemes", ...soon("modules.schemes") },
          { path: "schemes/check", ...soon("modules.check") },
          { path: "schemes/check/results", ...soon("modules.check") },
          { path: "schemes/:slug", ...soon("modules.schemes") },

          {
            element: <RequireCitizen />,
            children: [
              { path: "profile", lazy: page(() => import("./features/profile/ProfilePage.jsx")) },
              {
                path: "profile/contacts",
                lazy: page(() => import("./features/profile/ContactsPage.jsx")),
              },
              { path: "sos/:id/done", lazy: page(() => import("./features/sos/SosDonePage.jsx")) },
              {
                path: "complaints",
                lazy: page(() => import("./features/complaints/MyComplaintsPage.jsx")),
              },
              {
                path: "complaints/new",
                handle: { focus: true },
                lazy: page(() => import("./features/complaints/NewComplaintPage.jsx")),
              },
              {
                path: "complaints/new/success",
                lazy: page(() => import("./features/complaints/ComplaintSuccessPage.jsx")),
              },
              {
                path: "complaints/:id",
                lazy: page(() => import("./features/complaints/ComplaintDetailPage.jsx")),
              },
              { path: "my-schemes", ...soon("modules.schemes") },
              { path: "blood", ...soon("modules.blood") },
              { path: "blood/donor", ...soon("modules.blood") },
              { path: "sahayak", ...soon("modules.sahayak") },
              { path: "sahayak/:sessionId", ...soon("modules.sahayak") },
              { path: "sahayak/:sessionId/letter/:messageId", ...soon("modules.sahayak") },
              { path: "notifications", ...soon("modules.notifications") },
            ],
          },

          ...(import.meta.env.DEV
            ? [
                {
                  path: "dev/components",
                  lazy: page(() => import("./features/dev/ComponentsPage.jsx")),
                },
              ]
            : []),
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      // SOS screens are full screen, outside the citizen shell (docs/03 S-06, S-07).
      {
        path: "sos",
        lazy: page(() => import("./features/sos/SosLayout.jsx")),
        children: [
          { index: true, lazy: page(() => import("./features/sos/SosPage.jsx")) },
          {
            element: <RequireCitizen />,
            children: [
              { path: ":id", lazy: page(() => import("./features/sos/SosActivePage.jsx")) },
            ],
          },
        ],
      },
      {
        path: "portal",
        element: <RequireStaff />,
        children: [
          {
            lazy: () =>
              import("./components/layout/PortalShell.jsx").then((m) => ({
                Component: m.PortalShell,
              })),
            children: [
              { index: true, ...portalSoon() },
              { path: "complaints", ...portalSoon("nav.complaints") },
              { path: "complaints/:id", ...portalSoon("nav.complaints") },
              { path: "sos", ...portalSoon("nav.liveSos") },
              { path: "sos/:id", ...portalSoon("nav.liveSos") },
              { path: "analytics", ...portalSoon("nav.analytics") },
              { path: "profile", ...portalSoon("nav.profile") },
              {
                path: "admin",
                element: <RequireStaff adminOnly />,
                children: [
                  { path: "users", ...portalSoon("nav.users") },
                  { path: "schemes", ...portalSoon("nav.schemes") },
                  { path: "schemes/:id", ...portalSoon("nav.schemes") },
                  { path: "emergency-services", ...portalSoon("nav.emergencyDirectory") },
                  { path: "departments", ...portalSoon("nav.departments") },
                  { path: "jurisdictions", ...portalSoon("nav.jurisdictions") },
                  { path: "audit", ...portalSoon("nav.audit") },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  // S-30 public live-location page: no app chrome and no language gate (contacts open it).
  {
    path: "/track/:token",
    lazy: page(() => import("./features/sos/TrackPage.jsx")),
    errorElement: <CrashPage />,
    HydrateFallback: RouteSkeleton,
  },
];

export const createRouter = () => createBrowserRouter(routes);
