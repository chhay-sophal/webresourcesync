import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import App from "./App";

function prefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function Root() {
  const [isDark, setIsDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme} style={{ minHeight: "100vh" }}>
      <App isDark={isDark} onToggleTheme={() => setIsDark((d) => !d)} />
    </FluentProvider>
  );
}
