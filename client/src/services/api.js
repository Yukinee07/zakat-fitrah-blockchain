import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Attach Bearer token from localStorage on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("zakat_jwt");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 clear session and redirect to /connect.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("zakat_jwt");
      localStorage.removeItem("zakat_role");
      window.location.href = "/connect";
    }
    return Promise.reject(err);
  }
);

export default api;
