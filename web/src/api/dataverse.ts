import { backendJson } from "./backend";

export interface DataverseEnvironment {
  id: string;
  displayName: string;
  domainName: string;
  apiUrl: string;
  tenantId: string;
}

export interface Solution {
  solutionid: string;
  uniquename: string;
  friendlyname: string;
  ismanaged: boolean;
}

export interface WebResource {
  webresourceid: string;
  name: string;
  displayname: string;
  webresourcetype: number;
  ismanaged: boolean;
}

export const WEBRESOURCE_TYPES = {
  HTML: 1,
  CSS: 2,
  JS: 3,
} as const;

export function listEnvironments(): Promise<DataverseEnvironment[]> {
  return backendJson<DataverseEnvironment[]>("/dataverse/environments");
}

export function listSolutions(orgApiUrl: string): Promise<Solution[]> {
  return backendJson<Solution[]>(`/dataverse/solutions?orgApiUrl=${encodeURIComponent(orgApiUrl)}`);
}

export function listWebResourcesForSolution(
  orgApiUrl: string,
  solutionId: string
): Promise<WebResource[]> {
  const params = new URLSearchParams({ orgApiUrl, solutionId });
  return backendJson<WebResource[]>(`/dataverse/webresources?${params}`);
}

export async function getWebResourceContent(
  orgApiUrl: string,
  webresourceId: string
): Promise<string> {
  const params = new URLSearchParams({ orgApiUrl });
  const { content } = await backendJson<{ content: string }>(
    `/dataverse/webresources/${webresourceId}/content?${params}`
  );
  return content;
}

export async function createWebResource(
  orgApiUrl: string,
  solutionUniqueName: string,
  resource: { name: string; displayname: string; webresourcetype: number; content: string }
): Promise<string> {
  const params = new URLSearchParams({ orgApiUrl, solutionUniqueName });
  const { webresourceid } = await backendJson<{ webresourceid: string }>(
    `/dataverse/webresources?${params}`,
    { method: "POST", body: JSON.stringify(resource) }
  );
  return webresourceid;
}

export async function updateWebResourceContent(
  orgApiUrl: string,
  webresourceId: string,
  base64Content: string
): Promise<void> {
  const params = new URLSearchParams({ orgApiUrl });
  await backendJson<void>(`/dataverse/webresources/${webresourceId}?${params}`, {
    method: "PATCH",
    body: JSON.stringify({ content: base64Content }),
  });
}

export async function deleteWebResource(orgApiUrl: string, webresourceId: string): Promise<void> {
  const params = new URLSearchParams({ orgApiUrl });
  await backendJson<void>(`/dataverse/webresources/${webresourceId}?${params}`, {
    method: "DELETE",
  });
}

export async function publishWebResources(
  orgApiUrl: string,
  webresourceIds: string[]
): Promise<void> {
  const params = new URLSearchParams({ orgApiUrl });
  await backendJson<void>(`/dataverse/webresources/publish?${params}`, {
    method: "POST",
    body: JSON.stringify({ ids: webresourceIds }),
  });
}
