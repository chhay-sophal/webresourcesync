import { useMsal } from "@azure/msal-react";
import { Button, Text, Title2, Title3 } from "@fluentui/react-components";
import { useState } from "react";
import type { DataverseEnvironment } from "./api/discovery";
import type { Solution } from "./api/dataverse";
import { EnvironmentPicker } from "./features/environments/EnvironmentPicker";
import { SolutionPicker } from "./features/solutions/SolutionPicker";
import { WebResourceList } from "./features/webresources/WebResourceList";

function App() {
  const { instance, accounts } = useMsal();
  const [environment, setEnvironment] = useState<DataverseEnvironment | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);

  const isSignedIn = accounts.length > 0;

  if (!isSignedIn) {
    return (
      <div style={{ padding: 24 }}>
        <Title2>Web Resource Sync</Title2>
        <p>
          <Button appearance="primary" onClick={() => instance.loginPopup({ scopes: [] })}>
            Sign in
          </Button>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Title2>Web Resource Sync</Title2>
        <div>
          <Text>{accounts[0].username}</Text>{" "}
          <Button appearance="subtle" onClick={() => instance.logoutPopup()}>
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
          <Title3>3. Web resources</Title3>
          <WebResourceList orgApiUrl={environment.apiUrl} solutionId={solution.solutionid} />
        </div>
      )}
    </div>
  );
}

export default App;
