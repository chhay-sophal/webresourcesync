import {
  Button,
  Card,
  Divider,
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
import { SettingsBarItem } from "./components/SettingsBarItem";
import { EnvironmentPicker } from "./features/environments/EnvironmentPicker";
import { useLocalFiles } from "./features/localfiles/useLocalFiles";
import { WatchedFolderSettings } from "./features/localfiles/WatchedFolderSettings";
import { SolutionPicker } from "./features/solutions/SolutionPicker";
import { WebResourceList, type WebResourceListHandle } from "./features/webresources/WebResourceList";
import { usePersistedState } from "./hooks/usePersistedState";

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
  const [environment, setEnvironment] = usePersistedState<DataverseEnvironment | null>(
    "wrs.environment",
    null
  );
  const [solution, setSolution] = usePersistedState<Solution | null>("wrs.solution", null);
  const [hasActiveWebResourceFilters, setHasActiveWebResourceFilters] = useState(false);
  const [folderBarOpen, setFolderBarOpen] = useState(false);
  const [environmentBarOpen, setEnvironmentBarOpen] = useState(false);
  const [solutionBarOpen, setSolutionBarOpen] = useState(false);
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.colorNeutralBackground2,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "sticky", top: 0, zIndex: 1 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 24px",
            background: tokens.colorNeutralBackground1,
            borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
          }}
        >
          <Text weight="semibold" size={500}>
            Web Resource Sync
          </Text>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {username && <Text size={200}>{username}</Text>}
            <Button
              appearance="subtle"
              icon={isDark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
              onClick={onToggleTheme}
            />
            {username && (
              <Button appearance="subtle" icon={<SignOutRegular />} onClick={handleSignOut}>
                Sign out
              </Button>
            )}
          </div>
        </header>

        {username && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 24px",
              background: tokens.colorNeutralBackground1,
              borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
              flexWrap: "wrap",
            }}
          >
            <SettingsBarItem
              icon={<FolderRegular />}
              label="Local folder"
              value={localFiles.root ?? "Not set"}
              open={folderBarOpen}
              onOpenChange={setFolderBarOpen}
            >
              <WatchedFolderSettings
                root={localFiles.root}
                fileCount={localFiles.files.length}
                onSetRoot={localFiles.setRootFolder}
              />
            </SettingsBarItem>

            <Divider vertical style={{ height: 28 }} />

            <SettingsBarItem
              icon={<CloudRegular />}
              label="Environment"
              value={environment?.displayName ?? "Not selected"}
              open={environmentBarOpen}
              onOpenChange={setEnvironmentBarOpen}
            >
              <EnvironmentPicker
                selected={environment}
                onSelect={(env) => {
                  setEnvironment(env);
                  setSolution(null);
                  setEnvironmentBarOpen(false);
                }}
              />
            </SettingsBarItem>

            <Divider vertical style={{ height: 28 }} />

            <SettingsBarItem
              icon={<AppsListDetailRegular />}
              label="Solution"
              value={solution?.friendlyname ?? (environment ? "Not selected" : "Pick an environment first")}
              disabled={!environment}
              open={solutionBarOpen}
              onOpenChange={setSolutionBarOpen}
            >
              {environment && (
                <SolutionPicker
                  orgApiUrl={environment.apiUrl}
                  selected={solution}
                  onSelect={(sol) => {
                    setSolution(sol);
                    setSolutionBarOpen(false);
                  }}
                />
              )}
            </SettingsBarItem>
          </div>
        )}
      </div>

      <main
        style={{
          flex: 1,
          width: "100%",
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
        ) : environment && solution ? (
          <SectionCard
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
        ) : (
          <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
            <Text style={{ color: tokens.colorNeutralForeground3 }}>
              Pick an environment and solution above to see its web resources.
            </Text>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
