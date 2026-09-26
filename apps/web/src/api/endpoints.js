import { api } from "./client.js";

const data = (p) => p.then((r) => r.data.data);

// docs/02 §7.2 — only the endpoints the Phase 3 screens use.
export const authApi = {
  login: (body) => data(api.post("/auth/login", body)),
  register: (body) => data(api.post("/auth/register", body)),
  logout: () => data(api.post("/auth/logout")),
  logoutAll: () => data(api.post("/auth/logout-all")),
  forgot: (body) => data(api.post("/auth/password/forgot", body)),
  reset: (body) => data(api.post("/auth/password/reset", body)),
  me: () => data(api.get("/auth/me")),
};

export const usersApi = {
  update: (body) => data(api.patch("/users/me", body)),
  changePassword: (body) => data(api.put("/users/me/password", body)),
  remove: (body) => data(api.delete("/users/me", { data: body })),
  contacts: () => data(api.get("/users/me/contacts")),
  addContact: (body) => data(api.post("/users/me/contacts", body)),
  updateContact: (id, body) => data(api.patch(`/users/me/contacts/${id}`, body)),
  removeContact: (id) => data(api.delete(`/users/me/contacts/${id}`)),
};

export const jurisdictionsApi = {
  search: (params) => data(api.get("/jurisdictions", { params })),
};

export const healthApi = {
  get: () => api.get("/health", { validateStatus: () => true }).then((r) => r.data),
};

export const sosApi = {
  trigger: (body) => data(api.post("/sos", body)),
  get: (id) => data(api.get(`/sos/${id}`)),
  mine: (params) => data(api.get("/sos/mine", { params })),
  location: (id, body) => data(api.post(`/sos/${id}/location`, body)),
  resolve: (id) => data(api.post(`/sos/${id}/resolve`)),
};

// Public, no login needed (S-30). A 404 means the link is wrong or has expired.
export const trackApi = {
  get: (token) => data(api.get(`/track/${encodeURIComponent(token)}`)),
};

// Complaints (docs/02 §7.2 "Complaints (M2)").
export const complaintsApi = {
  // Upload + AI can take a while on 2G; the server caps the AI call at 8 s.
  classify: (file) => {
    const form = new FormData();
    form.append("image", file, file.name || "photo.jpg");
    return data(api.post("/complaints/classify", form, { timeout: 45000 }));
  },
  warmup: () => data(api.get("/complaints/classify/warmup")),
  routePreview: (params) => data(api.get("/complaints/route-preview", { params })),
  create: (body) => data(api.post("/complaints", body)),
  mine: (params) => data(api.get("/complaints/mine", { params })),
  get: (id) => data(api.get(`/complaints/${id}`)),
  reopen: (id, body) => data(api.post(`/complaints/${id}/reopen`, body)),
  // Authority / admin (docs/03 A-02, A-03).
  list: (params) => data(api.get("/complaints", { params })),
  exportCsv: (params) =>
    api.get("/complaints/export.csv", { params, responseType: "blob" }).then((r) => r.data),
  setStatus: (id, body) => data(api.patch(`/complaints/${id}/status`, body)),
  assignOptions: (id) => data(api.get(`/complaints/${id}/assign-options`)),
  assign: (id, body) => data(api.patch(`/complaints/${id}/assign`, body)),
  setCategory: (id, body) => data(api.patch(`/complaints/${id}/category`, body)),
  addNote: (id, body) => data(api.post(`/complaints/${id}/notes`, body)),
  resolutionPhoto: (id, file) => {
    const form = new FormData();
    form.append("image", file, file.name || "photo.jpg");
    return data(api.post(`/complaints/${id}/resolution-photo`, form, { timeout: 45000 }));
  },
  revealPhone: (id, target) => data(api.post(`/complaints/${id}/reveal-phone`, { target })),
};

// Schemes (docs/02 §7.2 "Schemes (M3)").
export const schemesApi = {
  list: (params) => data(api.get("/schemes", { params })),
  get: (slug) => data(api.get(`/schemes/${encodeURIComponent(slug)}`)),
  check: (body) => data(api.post("/schemes/eligibility", body)),
  saved: () => data(api.get("/users/me/saved-schemes")),
  save: (schemeId, body = {}) => data(api.put(`/users/me/saved-schemes/${schemeId}`, body)),
  unsave: (schemeId) => data(api.delete(`/users/me/saved-schemes/${schemeId}`)),
};

// Emergency services (M5).
export const emergencyApi = {
  nearby: (params) => data(api.get("/emergency/nearby", { params })),
};

// Blood donors (M4).
export const donorsApi = {
  me: () => data(api.get("/donors/me")),
  save: (body) => data(api.put("/donors/me", body)),
  availability: (available) => data(api.patch("/donors/me/availability", { available })),
  remove: () => data(api.delete("/donors/me")),
  search: (params) => data(api.get("/donors/search", { params })),
  reveal: (id, bloodGroupSearched) =>
    data(api.post(`/donors/${id}/reveal`, { bloodGroupSearched })),
};

// Sahayak (docs/02 §7.2 "Sahayak (M7)"). An LLM reply can take several seconds on 2G.
export const chatApi = {
  sessions: () => data(api.get("/chat/sessions")),
  start: (body) => data(api.post("/chat/sessions", body)),
  get: (id) => data(api.get(`/chat/sessions/${id}`)),
  send: (id, body) => data(api.post(`/chat/sessions/${id}/messages`, body, { timeout: 30000 })),
  saveLetter: (id, messageId, body) =>
    data(api.put(`/chat/sessions/${id}/messages/${messageId}/letter`, body)),
  remove: (id) => data(api.delete(`/chat/sessions/${id}`)),
};

export const notificationsApi = {
  list: (params) => data(api.get("/notifications", { params })),
  read: (body) => data(api.post("/notifications/read", body)),
};

// Fire-and-forget usage events (docs/05 §5.18); never blocks the UI.
export const eventsApi = {
  send: (type, props = {}) => api.post("/events", { type, props }).catch(() => {}),
};

// Authority / admin portal (docs/02 §7.2 "Authority / Admin (M6)").
export const adminApi = {
  overview: () => data(api.get("/admin/overview")),
  analytics: (params) => data(api.get("/admin/analytics", { params })),
  meta: () => data(api.get("/admin/meta")),
  users: (params) => data(api.get("/admin/users", { params })),
  createUser: (body) => data(api.post("/admin/users", body)),
  updateUser: (id, body) => data(api.patch(`/admin/users/${id}`, body)),
  resetCode: (id) => data(api.post(`/admin/users/${id}/reset-code`)),
  departments: () => data(api.get("/admin/departments")),
  createDepartment: (body) => data(api.post("/admin/departments", body)),
  updateDepartment: (id, body) => data(api.patch(`/admin/departments/${id}`, body)),
  jurisdictions: () => data(api.get("/admin/jurisdictions")),
  createJurisdiction: (body) => data(api.post("/admin/jurisdictions", body)),
  updateJurisdiction: (id, body) => data(api.patch(`/admin/jurisdictions/${id}`, body)),
  audit: (params) => data(api.get("/admin/audit-logs", { params })),
  schemes: (params) => data(api.get("/admin/schemes", { params })),
  scheme: (id) => data(api.get(`/admin/schemes/${id}`)),
  createScheme: (body) => data(api.post("/admin/schemes", body)),
  updateScheme: (id, body) => data(api.patch(`/admin/schemes/${id}`, body)),
  schemeAction: (id, action) => data(api.post(`/admin/schemes/${id}/${action}`)),
  deleteScheme: (id) => data(api.delete(`/admin/schemes/${id}`)),
  services: () => data(api.get("/admin/emergency-services")),
  createService: (body) => data(api.post("/admin/emergency-services", body)),
  updateService: (id, body) => data(api.patch(`/admin/emergency-services/${id}`, body)),
  importServices: (csv) => data(api.post("/admin/emergency-services/import", { csv })),
  serviceTemplate: () =>
    api.get("/admin/emergency-services/template.csv", { responseType: "blob" }).then((r) => r.data),
};

// SOS actions for the portal (A-04, A-05).
export const sosAdminApi = {
  active: (params) => data(api.get("/sos/active", { params })),
  get: (id) => data(api.get(`/sos/${id}`)),
  acknowledge: (id) => data(api.post(`/sos/${id}/acknowledge`)),
  close: (id, body) => data(api.post(`/sos/${id}/close`, body)),
  revealPhone: (id, body) => data(api.post(`/sos/${id}/reveal-phone`, body)),
};
