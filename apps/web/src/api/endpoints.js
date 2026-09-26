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
