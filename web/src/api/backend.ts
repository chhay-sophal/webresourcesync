/** This app's own local backend - the Express server (dev) or its Tauri sidecar (packaged
 * app), always on this fixed port (server/src/index.ts's PORT default). An absolute URL is
 * required here rather than a path relative to window.location: that only happened to work
 * via Vite's dev-server proxy (window.location = localhost:5173), and has no equivalent in
 * the packaged Tauri app, where window.location is Tauri's own internal origin with no route
 * for /api at all. */
export const BACKEND_ORIGIN = "http://127.0.0.1:4000";

export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BACKEND_ORIGIN}/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body || `Request failed: ${res.status}`;
    try {
      message = JSON.parse(body).error ?? message;
    } catch {
      // Body wasn't JSON; use the raw text as-is.
    }
    throw new Error(message);
  }
  return res;
}

export async function backendJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await backendFetch(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
