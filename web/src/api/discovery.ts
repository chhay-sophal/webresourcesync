import { DISCOVERY_RESOURCE, getAccessToken } from "../auth/msalConfig";

export interface DataverseEnvironment {
  uniqueName: string;
  friendlyName: string;
  apiUrl: string;
  url: string;
}

interface DiscoveryInstance {
  UniqueName: string;
  FriendlyName: string;
  ApiUrl: string;
  Url: string;
  State: string;
}

export async function listEnvironments(): Promise<DataverseEnvironment[]> {
  const token = await getAccessToken(DISCOVERY_RESOURCE);
  const res = await fetch(`${DISCOVERY_RESOURCE}/api/discovery/v2.0/Instances`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to list environments: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { value: DiscoveryInstance[] };
  return data.value
    .filter((instance) => instance.State === "Enabled")
    .map((instance) => ({
      uniqueName: instance.UniqueName,
      friendlyName: instance.FriendlyName,
      apiUrl: instance.ApiUrl,
      url: instance.Url,
    }));
}
