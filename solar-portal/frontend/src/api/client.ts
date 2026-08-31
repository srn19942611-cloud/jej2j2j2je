const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api${path}`);
  if (!res.ok) {
    throw new ApiError(`GET ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, { method: "POST" });
  if (!res.ok) {
    throw new ApiError(`POST ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function exportUrl(path: string): string {
  return `${API_BASE_URL}/api${path}`;
}
