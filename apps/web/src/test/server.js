import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const VILLAGE = {
  id: "6ab80d7c71b27ffe37aa43c9",
  name: { en: "Mahodiya", hi: "महोदिया" },
  type: "village",
  parentId: null,
};

export const citizen = (over = {}) => ({
  id: "u1",
  name: "Sunita Devi",
  phone: "+919876543210",
  email: null,
  role: "citizen",
  status: "active",
  language: "hi",
  textSize: "md",
  gender: null,
  jurisdictionId: VILLAGE.id,
  villageOther: null,
  emergencyContactCount: 0,
  authority: null,
  mustChangePassword: false,
  ...over,
});

export const officer = (over = {}) =>
  citizen({
    id: "a1",
    name: "Mr Verma",
    role: "authority",
    authority: { jurisdictionIds: [VILLAGE.id], departmentId: null, title: null },
    ...over,
  });

export const tokens = (user) => ({
  data: { accessToken: `token-${user.id}`, expiresIn: 900, user },
});
export const apiErr = (status, code, message, details) =>
  HttpResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });

// Default: logged out, healthy API.
export const handlers = [
  http.get("*/ai-wake", () => HttpResponse.json({ status: "ok" })),
  http.get("*/api/v1/feedback/mine", () => HttpResponse.json({ data: {} })),
  http.post("*/api/v1/feedback", async ({ request }) =>
    HttpResponse.json({ data: await request.json() }),
  ),
  http.get("*/api/v1/chat/warmup", () => HttpResponse.json({ data: { ok: true } })),
  http.post("*/api/v1/auth/refresh", () => apiErr(401, "UNAUTHENTICATED", "Please log in again.")),
  http.get("*/api/v1/health", () => HttpResponse.json({ status: "ok", db: "up", ai: "up" })),
  http.get("*/api/v1/jurisdictions", () => HttpResponse.json({ data: [VILLAGE] })),
  http.get("*/api/v1/notifications", () =>
    HttpResponse.json({ data: { items: [], nextPage: null, unread: 0 } }),
  ),
  http.get("*/api/v1/users/me/contacts", () => HttpResponse.json({ data: [] })),
  http.get("*/api/v1/admin/overview", () =>
    HttpResponse.json({
      data: {
        scope: [VILLAGE.name],
        kpis: { openComplaints: 0, resolvedThisWeek: 0, activeSos: 0, avgResolutionDays: null },
        activeSos: [],
        needsAction: [],
        activity: [],
      },
    }),
  ),
  http.get("*/api/v1/admin/users", () =>
    HttpResponse.json({ data: { items: [], total: 0, page: 1 } }),
  ),
  http.patch("*/api/v1/users/me", async ({ request }) =>
    HttpResponse.json({ data: citizen(await request.json()) }),
  ),
];

export const server = setupServer(...handlers);

/** Makes the initial refresh succeed as `user`. */
export const loggedInAs = (user) =>
  server.use(http.post("*/api/v1/auth/refresh", () => HttpResponse.json(tokens(user))));

export { http, HttpResponse };
