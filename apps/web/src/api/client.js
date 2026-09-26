import axios from "axios";
import i18n from "../i18n/index.js";
import { useNetwork } from "../stores/network.js";
import { useSession } from "../stores/session.js";

export const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";

/**
 * API client (docs/02 §3): attaches the in-memory access token and the UI language, refreshes
 * once on 401 TOKEN_EXPIRED and retries, and feeds the offline detector.
 */
export const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 20000 });

const lang = () => i18n.resolvedLanguage || "hi";

api.interceptors.request.use((config) => {
  const token = useSession.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["Accept-Language"] = lang();
  return config;
});

let refreshing = null;

/** POST /auth/refresh once, even if many requests ask at the same time. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_BASE}/auth/refresh`, null, {
        withCredentials: true,
        headers: { "Accept-Language": lang() },
      })
      .then((res) => {
        useSession.getState().setSession(res.data.data);
        return res.data.data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => {
    useNetwork.getState().requestOk();
    return res;
  },
  async (error) => {
    const { config, response } = error;
    if (!response) {
      if (!axios.isCancel(error)) useNetwork.getState().requestFailed();
      throw error;
    }
    useNetwork.getState().requestOk();

    const code = response.data?.error?.code;
    const isAuthCall = config?.url?.startsWith("/auth/") && !config.url.startsWith("/auth/me");
    if (response.status === 401 && config && !isAuthCall) {
      if (code === "TOKEN_EXPIRED" && !config._retried) {
        config._retried = true;
        try {
          await refreshSession();
          return api(config);
        } catch {
          useSession.getState().expire();
          throw error;
        }
      }
      if (config.headers?.Authorization) useSession.getState().expire();
    }
    throw error;
  },
);

/**
 * Normalises any request error to { status, code, messageKey?, message, details, network }.
 * `message` is the server's localised text when there is one.
 */
export function apiError(err) {
  if (!err?.response) return { network: true, status: 0, code: "NETWORK", details: [] };
  const e = err.response.data?.error ?? {};
  return {
    network: false,
    status: err.response.status,
    code: e.code ?? "INTERNAL",
    message: e.message,
    details: e.details ?? [],
  };
}
