import { MsalProvider } from "@azure/msal-react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { msalInstance } from "./auth/msalConfig";
import "./index.css";

await msalInstance.initialize();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MsalProvider instance={msalInstance}>
      <FluentProvider theme={webLightTheme}>
        <App />
      </FluentProvider>
    </MsalProvider>
  </StrictMode>
);
