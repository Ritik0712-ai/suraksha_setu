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
import { NotFoundPage } from "./features/system/SystemPages.jsx";
import { RouteSkeleton } from "./components/ui/States.jsx";
import { loadNamespaces } from "./i18n/index.js";

// Route map from docs/03 §1. Screens other than Home load on demand, so citizens never download
// portal or dev code.

// `ns`: translation namespaces the screen needs that aren't in the first download (i18n/index.js).
const page =
  (loader, ns = []) =>
  () =>
    Promise.all([loader(), loadNamespaces(ns)]).then(([m]) => ({ Component: m.default }));

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
          {
            path: "emergency",
            lazy: page(() => import("./features/emergency/EmergencyPage.jsx"), ["emergency"]),
          },
          {
            path: "schemes",
            lazy: page(() => import("./features/schemes/SchemesPage.jsx"), ["schemes"]),
          },
          {
            path: "schemes/check",
            lazy: page(() => import("./features/schemes/EligibilityPage.jsx"), ["schemes"]),
          },
          {
            path: "schemes/check/results",
            lazy: page(() => import("./features/schemes/EligibilityResultsPage.jsx"), ["schemes"]),
          },
          {
            path: "schemes/:slug",
            lazy: page(() => import("./features/schemes/SchemeDetailPage.jsx"), ["schemes"]),
          },

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
              {
                path: "my-schemes",
                lazy: page(() => import("./features/schemes/MySchemesPage.jsx"), ["schemes"]),
              },
              {
                path: "blood",
                lazy: page(() => import("./features/blood/BloodSearchPage.jsx"), ["blood"]),
              },
              {
                path: "blood/donor",
                lazy: page(() => import("./features/blood/DonorProfilePage.jsx"), ["blood"]),
              },
              {
                path: "sahayak",
                lazy: page(() => import("./features/sahayak/SahayakHomePage.jsx"), ["sahayak"]),
              },
              {
                path: "sahayak/:sessionId",
                lazy: page(() => import("./features/sahayak/ChatPage.jsx"), ["sahayak"]),
              },
              {
                path: "sahayak/:sessionId/letter/:messageId",
                lazy: page(() => import("./features/sahayak/LetterPage.jsx"), ["sahayak"]),
              },
              {
                path: "notifications",
                lazy: page(
                  () => import("./features/notifications/NotificationsPage.jsx"),
                  ["notifications"],
                ),
              },
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
              Promise.all([
                import("./components/layout/PortalShell.jsx"),
                loadNamespaces(["portal"]),
              ]).then(([m]) => ({ Component: m.PortalShell })),
            children: [
              { index: true, lazy: page(() => import("./features/portal/OverviewPage.jsx")) },
              {
                path: "complaints",
                lazy: page(() => import("./features/portal/ComplaintsTablePage.jsx")),
              },
              {
                path: "complaints/:id",
                lazy: page(() => import("./features/portal/ComplaintManagePage.jsx")),
              },
              { path: "sos", lazy: page(() => import("./features/portal/LiveSosPage.jsx")) },
              { path: "sos/:id", lazy: page(() => import("./features/portal/LiveSosPage.jsx")) },
              {
                path: "analytics",
                lazy: page(() => import("./features/portal/AnalyticsPage.jsx")),
              },
              {
                path: "profile",
                lazy: page(() => import("./features/portal/PortalProfilePage.jsx")),
              },
              {
                path: "notifications",
                lazy: page(
                  () => import("./features/notifications/NotificationsPage.jsx"),
                  ["notifications"],
                ),
              },
              {
                path: "admin",
                element: <RequireStaff adminOnly />,
                children: [
                  { path: "users", lazy: page(() => import("./features/portal/UsersPage.jsx")) },
                  {
                    path: "schemes",
                    lazy: page(() => import("./features/portal/SchemesAdminPage.jsx"), ["schemes"]),
                  },
                  {
                    path: "schemes/:id",
                    lazy: page(() => import("./features/portal/SchemeEditorPage.jsx"), ["schemes"]),
                  },
                  {
                    path: "emergency-services",
                    lazy: page(
                      () => import("./features/portal/EmergencyDirectoryPage.jsx"),
                      ["emergency"],
                    ),
                  },
                  {
                    path: "departments",
                    lazy: page(() => import("./features/portal/DepartmentsPage.jsx")),
                  },
                  {
                    path: "jurisdictions",
                    lazy: page(() => import("./features/portal/JurisdictionsPage.jsx")),
                  },
                  { path: "audit", lazy: page(() => import("./features/portal/AuditPage.jsx")) },
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
