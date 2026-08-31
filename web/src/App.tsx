import { Button, Field, Input, Spinner, Text, Title2, Title3 } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import { getAuthStatus, login, logout } from "./api/auth";
import type { DataverseEnvironment, Solution } from "./api/dataverse";
import { EnvironmentPicker } from "./features/environments/EnvironmentPicker";
import { SolutionPicker } from "./features/solutions/SolutionPicker";
import { WebResourceList, type WebResourceListHandle } from "./features/webresources/WebResourceList";

function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tenant, setTenant] = useState("");
  const [environment, setEnvironment] = useState<DataverseEnvironment | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [hasActiveWebResourceFilters, setHasActiveWebResourceFilters] = useState(false);
  const webResourceListRef = useRef<WebResourceListHandle>(null);

  useEffect(() => {
    getAuthStatus()
      .then((status) => setUsername(status.signedIn ? status.username ?? null : null))
      .finally(() => setCheckingStatus(false));
  }, []);

  async function handleSignIn() {
    setSigningIn(true);
    setAuthError(null);
    try {
      const result = await login(tenant.trim() || undefined);
      setUsername(result.username);
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await logout();
    setUsername(null);
    setEnvironment(null);
    setSolution(null);
  }

  if (checkingStatus) {
    return (
      <div style={{ padding: 24 }}>
        <Spinner label="Checking sign-in status..." />
      </div>
    );
  }

  if (!username) {
    return (
      <div style={{ padding: 24, maxWidth: 360 }}>
        <Title2>Web Resource Sync</Title2>
        <Field
          label="Tenant (optional)"
          hint="Only needed if your Dataverse environment is in a different organization than your account's home tenant — e.g. a domain like contoso.onmicrosoft.com."
          style={{ marginTop: 16 }}
        >
          <Input
            value={tenant}
            onChange={(_, data) => setTenant(data.value)}
            placeholder="contoso.onmicrosoft.com"
            disabled={signingIn}
          />
        </Field>
        <p>
          <Button appearance="primary" onClick={handleSignIn} disabled={signingIn}>
            {signingIn ? "Waiting for browser sign-in..." : "Sign in"}
          </Button>
        </p>
        {signingIn && (
          <Text>A browser window has opened to sign in with your Microsoft account.</Text>
        )}
        {authError && <Text style={{ color: "red" }}>{authError}</Text>}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Title2>Web Resource Sync</Title2>
        <div>
          <Text>{username}</Text>{" "}
          <Button appearance="subtle" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>

      <div>
        <Title3>1. Environment</Title3>
        <EnvironmentPicker
          selected={environment}
          onSelect={(env) => {
            setEnvironment(env);
            setSolution(null);
          }}
        />
      </div>

      {environment && (
        <div>
          <Title3>2. Solution</Title3>
          <SolutionPicker
            orgApiUrl={environment.apiUrl}
            selected={solution}
            onSelect={setSolution}
          />
        </div>
      )}

      {environment && solution && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Title3>3. Web resources</Title3>
            {hasActiveWebResourceFilters && (
              <Button
                appearance="subtle"
                onClick={() => webResourceListRef.current?.clearAllFiltersAndSort()}
              >
                Clear filters
              </Button>
            )}
          </div>
          <WebResourceList
            ref={webResourceListRef}
            orgApiUrl={environment.apiUrl}
            solutionId={solution.solutionid}
            onActiveFilterOrSortChange={setHasActiveWebResourceFilters}
          />
        </div>
      )}
    </div>
  );
}

export default App;
