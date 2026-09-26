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
};
