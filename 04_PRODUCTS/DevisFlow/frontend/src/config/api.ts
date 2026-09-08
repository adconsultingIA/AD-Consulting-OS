export const API_URL =
  import.meta.env.VITE_DEVISFLOW_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8002/api/v1";
