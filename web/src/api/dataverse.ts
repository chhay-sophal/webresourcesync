import { getAccessToken } from "../auth/msalConfig";

const API_VERSION = "v9.2";

/** Solution component type code for Web Resource records, per Dataverse's componenttype option set. */
const WEBRESOURCE_COMPONENT_TYPE = 61;

export const WEBRESOURCE_TYPES = {
  HTML: 1,
  CSS: 2,
  JS: 3,
} as const;

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

async function callDataverse(
  orgApiUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken(orgApiUrl);
  const res = await fetch(`${orgApiUrl}/api/data/${API_VERSION}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Dataverse request failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

export async function listSolutions(orgApiUrl: string): Promise<Solution[]> {
  const res = await callDataverse(
    orgApiUrl,
    "solutions?$select=solutionid,uniquename,friendlyname,ismanaged" +
      "&$filter=isvisible eq true and uniquename ne 'Default'"
  );
  const data = (await res.json()) as { value: Solution[] };
  return data.value;
}

export async function listWebResourcesForSolution(
  orgApiUrl: string,
  solutionId: string
): Promise<WebResource[]> {
  const componentsRes = await callDataverse(
    orgApiUrl,
    `solutioncomponents?$select=objectid&$filter=_solutionid_value eq ${solutionId} and componenttype eq ${WEBRESOURCE_COMPONENT_TYPE}`
  );
  const components = (await componentsRes.json()) as { value: { objectid: string }[] };
  const ids = components.value.map((c) => c.objectid);
  if (ids.length === 0) return [];

  const filter = ids.map((id) => `webresourceid eq ${id}`).join(" or ");
  const resourcesRes = await callDataverse(
    orgApiUrl,
    `webresourceset?$select=webresourceid,name,displayname,webresourcetype,ismanaged&$filter=${filter}`
  );
  const data = (await resourcesRes.json()) as { value: WebResource[] };
  return data.value;
}

export async function getWebResourceContent(
  orgApiUrl: string,
  webresourceId: string
): Promise<string> {
  const res = await callDataverse(
    orgApiUrl,
    `webresourceset(${webresourceId})?$select=content`
  );
  const data = (await res.json()) as { content: string };
  return data.content;
}

export async function createWebResource(
  orgApiUrl: string,
  solutionUniqueName: string,
  resource: { name: string; displayname: string; webresourcetype: number; content: string }
): Promise<string> {
  const res = await callDataverse(orgApiUrl, "webresourceset", {
    method: "POST",
    headers: { "MSCRM.SolutionUniqueName": solutionUniqueName },
    body: JSON.stringify(resource),
  });
  const location = res.headers.get("OData-EntityId") ?? "";
  const match = location.match(/\(([0-9a-fA-F-]+)\)/);
  if (!match) throw new Error("Could not determine new web resource id from response");
  return match[1];
}

export async function updateWebResourceContent(
  orgApiUrl: string,
  webresourceId: string,
  base64Content: string
): Promise<void> {
  await callDataverse(orgApiUrl, `webresourceset(${webresourceId})`, {
    method: "PATCH",
    body: JSON.stringify({ content: base64Content }),
  });
}

export async function deleteWebResource(orgApiUrl: string, webresourceId: string): Promise<void> {
  await callDataverse(orgApiUrl, `webresourceset(${webresourceId})`, { method: "DELETE" });
}

export async function publishWebResources(
  orgApiUrl: string,
  webresourceIds: string[]
): Promise<void> {
  const inner = webresourceIds.map((id) => `<webresource>{${id}}</webresource>`).join("");
  const parameterXml = `<importexportxml><webresources>${inner}</webresources></importexportxml>`;
  await callDataverse(orgApiUrl, "PublishXml", {
    method: "POST",
    body: JSON.stringify({ ParameterXml: parameterXml }),
  });
}
