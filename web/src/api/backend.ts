export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`/api${path}`, {
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
