import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
const ACCESS_KEY = "sh_access";
const REFRESH_KEY = "sh_refresh";
export const tokenStore = {
  get access() { return localStorage.getItem(ACCESS_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set({ access_token, refresh_token }) {
    if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({ baseURL: BASE_URL });
const bare = axios.create({ baseURL: BASE_URL }); // no interceptors: used for token refresh

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = config?.url?.startsWith("/auth/login") || config?.url?.startsWith("/auth/refresh");
    if (response?.status !== 401 || config._retry || isAuthCall || !tokenStore.refresh) {
      return Promise.reject(error);
    }
    config._retry = true;
    try {
      refreshing ??= bare
        .post("/auth/refresh", { refresh_token: tokenStore.refresh })
        .finally(() => { refreshing = null; });
      const { data } = await refreshing;
      tokenStore.set(data);
      config.headers.Authorization = `Bearer ${data.access_token}`;
      return api(config);
    } catch {
      tokenStore.clear();
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(error);
    }
  }
);

/** Turn a FastAPI error (string detail or validation list) into one readable message. */
export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg.replace("Value error, ", "")}`).join("; ");
  }
  if (err?.code === "ERR_NETWORK") return "Cannot reach the server. Check your connection.";
  return fallback;
}

export default api;
