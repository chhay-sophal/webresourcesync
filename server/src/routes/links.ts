import { randomUUID } from "node:crypto";
import { Router } from "express";
import { addLink, readLinks, removeLink, type Link } from "../linksStore.js";

export const linksRouter = Router();

linksRouter.get("/", async (_req, res) => {
  res.json(await readLinks());
});

linksRouter.post("/", async (req, res) => {
  const body = req.body as Omit<Link, "id">;
  if (
    !body.environmentUniqueName ||
    !body.solutionUniqueName ||
    !body.webresourceId ||
    !body.localPath
  ) {
    res.status(400).json({ error: "Missing required link fields" });
    return;
  }
  const link: Link = { id: randomUUID(), ...body };
  await addLink(link);
  res.status(201).json(link);
});

linksRouter.delete("/:id", async (req, res) => {
  await removeLink(req.params.id);
  res.status(204).end();
});
