import {
  Button,
  Card,
  Field,
  Input,
  Spinner,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import {
  AppsListDetailRegular,
  CloudRegular,
  DocumentBulletListRegular,
  FolderRegular,
  SignOutRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { getAuthStatus, login, logout } from "./api/auth";
import type { DataverseEnvironment, Solution } from "./api/dataverse";
import { SectionCard } from "./components/SectionCard";
import { EnvironmentPicker } from "./features/environments/EnvironmentPicker";
import { useLocalFiles } from "./features/localfiles/useLocalFiles";
import { WatchedFolderSettings } from "./features/localfiles/WatchedFolderSettings";
import { SolutionPicker } from "./features/solutions/SolutionPicker";
import { WebResourceList, type WebResourceListHandle } from "./features/webresources/WebResourceList";

interface Props {
  isDark: boolean;
  onToggleTheme: () => void;
}

function App({ isDark, onToggleTheme }: Props) {
  const [username, setUsername] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tenant, setTenant] = useState("");
  const [environment, setEnvironment] = useState<DataverseEnvironment | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [hasActiveWebResourceFilters, setHasActiveWebResourceFilters] = useState(false);
  const webResourceListRef = useRef<WebResourceListHandle>(null);
  const localFiles = useLocalFiles();

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

  const themeToggleButton = (
    <Button
      appearance="subtle"
      icon={isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
      onClick={onToggleTheme}
    />
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.colorNeutralBackground2,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 24px",
          background: tokens.colorNeutralBackground1,
          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        <Text weight="semibold" size={500}>
          Web Resource Sync
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {username && <Text size={200}>{username}</Text>}
          {themeToggleButton}
          {username && (
            <Button appearance="subtle" icon={<SignOutRegular />} onClick={handleSignOut}>
              Sign out
            </Button>
          )}
        </div>
      </header>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 900,
          margin: "0 auto",
          padding: 24,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {checkingStatus ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Spinner label="Checking sign-in status..." />
          </div>
        ) : !username ? (
          <Card style={{ maxWidth: 420, margin: "48px auto", padding: 32 }}>
            <Title2 as="h1" style={{ marginBottom: 20 }}>
              Sign in to get started
            </Title2>
            <Field
              label="Tenant (optional)"
              hint="Only needed if your Dataverse environment is in a different organization than your account's home tenant — e.g. a domain like contoso.onmicrosoft.com."
            >
              <Input
                value={tenant}
                onChange={(_, data) => setTenant(data.value)}
                placeholder="contoso.onmicrosoft.com"
                disabled={signingIn}
              />
            </Field>
            <Button
              appearance="primary"
              onClick={handleSignIn}
              disabled={signingIn}
              style={{ marginTop: 16, width: "100%" }}
            >
              {signingIn ? "Waiting for browser sign-in..." : "Sign in"}
            </Button>
            {signingIn && (
              <Text size={200} style={{ display: "block", marginTop: 8 }}>
                A browser window has opened to sign in with your Microsoft account.
              </Text>
            )}
            {authError && (
              <Text style={{ color: tokens.colorPaletteRedForeground1, display: "block", marginTop: 8 }}>
                {authError}
              </Text>
            )}
          </Card>
        ) : (
          <>
            <SectionCard icon={<FolderRegular />} title="Local folder">
              <WatchedFolderSettings
                root={localFiles.root}
                fileCount={localFiles.files.length}
                onSetRoot={localFiles.setRootFolder}
              />
            </SectionCard>

            <SectionCard step={1} icon={<CloudRegular />} title="Environment">
              <EnvironmentPicker
                selected={environment}
                onSelect={(env) => {
                  setEnvironment(env);
                  setSolution(null);
                }}
              />
            </SectionCard>

            {environment && (
              <SectionCard step={2} icon={<AppsListDetailRegular />} title="Solution">
                <SolutionPicker
                  orgApiUrl={environment.apiUrl}
                  selected={solution}
                  onSelect={setSolution}
                />
              </SectionCard>
            )}

            {environment && solution && (
              <SectionCard
                step={3}
                icon={<DocumentBulletListRegular />}
                title="Web resources"
                action={
                  hasActiveWebResourceFilters && (
                    <Button
                      appearance="subtle"
                      onClick={() => webResourceListRef.current?.clearAllFiltersAndSort()}
                    >
                      Clear filters
                    </Button>
                  )
                }
              >
                <WebResourceList
                  ref={webResourceListRef}
                  orgApiUrl={environment.apiUrl}
                  solutionId={solution.solutionid}
                  environmentId={environment.id}
                  solutionUniqueName={solution.uniquename}
                  localFiles={localFiles.files}
                  modifiedPaths={localFiles.modifiedPaths}
                  onFilePublished={localFiles.clearModified}
                  onActiveFilterOrSortChange={setHasActiveWebResourceFilters}
                />
              </SectionCard>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
