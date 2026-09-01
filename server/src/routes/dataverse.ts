import { Router, type Request, type Response } from "express";
import {
  createWebResource,
  deleteWebResource,
  getWebResourceContent,
  getWebResourceDetails,
  listEnvironments,
  listSolutions,
  listWebResourcesForSolution,
  publishWebResources,
  updateWebResourceContent,
} from "../dataverseClient.js";

export const dataverseRouter = Router();

function requireQueryParam(req: Request, name: string): string {
  const value = req.query[name];
  if (typeof value !== "string" || !value) {
    throw new Error(`Missing required query parameter: ${name}`);
  }
  return value;
}

function handleErrors(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  };
}

dataverseRouter.get(
  "/environments",
  handleErrors(async (_req, res) => {
    res.json(await listEnvironments());
  })
);

dataverseRouter.get(
  "/solutions",
  handleErrors(async (req, res) => {
    const orgApiUrl = requireQueryParam(req, "orgApiUrl");
    res.json(await listSolutions(orgApiUrl));
  })
);

dataverseRouter.get(
  "/webresources",
  handleErrors(async (req, res) => {
    const orgApiUrl = requireQueryParam(req, "orgApiUrl");
    const solutionId = requireQueryParam(req, "solutionId");
    res.json(await listWebResourcesForSolution(orgApiUrl, solutionId));
  })
);

dataverseRouter.get(
  "/webresources/:id/details",
  handleErrors(async (req, res) => {
    const orgApiUrl = requireQueryParam(req, "orgApiUrl");
    res.json(await getWebResourceDetails(orgApiUrl, req.params.id));
  })
);

dataverseRouter.get(
  "/webresources/:id/content",
  handleErrors(async (req, res) => {
    const orgApiUrl = requireQueryParam(req, "orgApiUrl");
    res.json({ content: await getWebResourceContent(orgApiUrl, req.params.id) });
  })
);

dataverseRouter.post(
  "/webresources",
  handleErrors(async (req, res) => {
    const orgApiUrl = requireQueryParam(req, "orgApiUrl");
    const solutionUniqueName = requireQueryParam(req, "solutionUniqueName");
    const id = await createWebResource(orgApiUrl, solutionUniqueName, req.body);
    res.status(201).json({ webresourceid: id });
  })
);

dataverseRouter.patch(
  "/webresources/:id",
  handleErrors(async (req, res) => {
    const orgApiUrl = requireQueryParam(req, "orgApiUrl");
    await updateWebResourceContent(orgApiUrl, req.params.id, req.body.content);
    res.status(204).end();
  })
);

dataverseRouter.delete(
  "/webresources/:id",
  handleErrors(async (req, res) => {
    const orgApiUrl = requireQueryParam(req, "orgApiUrl");
    await deleteWebResource(orgApiUrl, req.params.id);
    res.status(204).end();
  })
);

dataverseRouter.post(
  "/webresources/publish",
  handleErrors(async (req, res) => {
    const orgApiUrl = requireQueryParam(req, "orgApiUrl");
    await publishWebResources(orgApiUrl, req.body.ids);
    res.status(204).end();
  })
);
