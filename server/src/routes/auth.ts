import { Router } from "express";
import { getAuthStatus, login, logout } from "../auth.js";

export const authRouter = Router();

authRouter.get("/status", async (_req, res) => {
  res.json(await getAuthStatus());
});

authRouter.post("/login", async (req, res) => {
  try {
    const tenant = typeof req.body?.tenant === "string" ? req.body.tenant.trim() || undefined : undefined;
    res.json(await login(tenant));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

authRouter.post("/logout", async (_req, res) => {
  await logout();
  res.status(204).end();
});
