import { describe, expect, it } from "vitest";
import { toApiUrl } from "./dataverseClient.js";

describe("toApiUrl", () => {
  it("inserts the api subdomain into a standard org URL", () => {
    expect(toApiUrl("https://contoso.crm5.dynamics.com")).toBe(
      "https://contoso.api.crm5.dynamics.com"
    );
  });

  it("is idempotent when the URL already has the api subdomain", () => {
    expect(toApiUrl("https://contoso.api.crm5.dynamics.com")).toBe(
      "https://contoso.api.crm5.dynamics.com"
    );
  });

  it("works across different regional Dataverse domains", () => {
    expect(toApiUrl("https://contoso.crm.dynamics.com")).toBe(
      "https://contoso.api.crm.dynamics.com"
    );
    expect(toApiUrl("https://contoso.crm4.dynamics.com")).toBe(
      "https://contoso.api.crm4.dynamics.com"
    );
  });
});
