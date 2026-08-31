import { backendJson } from "./backend";

export interface AuthStatus {
  signedIn: boolean;
  username?: string;
}

export function getAuthStatus(): Promise<AuthStatus> {
  return backendJson<AuthStatus>("/auth/status");
}

export function login(tenant?: string): Promise<{ username: string }> {
  return backendJson<{ username: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ tenant }),
  });
}

export function logout(): Promise<void> {
  return backendJson<void>("/auth/logout", { method: "POST" });
}
