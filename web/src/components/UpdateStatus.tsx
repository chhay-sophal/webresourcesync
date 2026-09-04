import { Button, Spinner, Text, tokens } from "@fluentui/react-components";
import { ArrowDownloadRegular } from "@fluentui/react-icons";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect, useState } from "react";

type UpdateState =
  | { status: "checking" }
  | { status: "upToDate" }
  | { status: "available"; update: Update }
  | { status: "downloading"; percent: number | null }
  | { status: "installing" }
  | { status: "error"; message: string };

/** Shows the running app's version next to the title, and - since the updater checks on
 * every launch - an Update button when a newer release is available. */
export function UpdateStatus() {
  const [version, setVersion] = useState<string | null>(null);
  const [state, setState] = useState<UpdateState>({ status: "checking" });

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => {
        // Not running inside Tauri (e.g. the plain browser dev flow) - no version to show.
      });
  }, []);

  useEffect(() => {
    check()
      .then((update) => setState(update ? { status: "available", update } : { status: "upToDate" }))
      .catch((err) => setState({ status: "error", message: (err as Error).message }));
  }, []);

  async function handleUpdate() {
    if (state.status !== "available") return;
    const { update } = state;
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength ?? 0;
          setState({ status: "downloading", percent: totalBytes ? 0 : null });
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          setState({
            status: "downloading",
            percent: totalBytes ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null,
          });
        } else if (event.event === "Finished") {
          setState({ status: "installing" });
        }
      });
      // No-op on Windows, where a successful downloadAndInstall already exits the app to run
      // the installer - only macOS/Linux need an explicit relaunch to pick up the new version.
      await relaunch();
    } catch (err) {
      setState({ status: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="flex items-center gap-2">
      {version && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          v{version}
        </Text>
      )}
      {state.status === "available" && (
        <Button size="small" appearance="primary" icon={<ArrowDownloadRegular />} onClick={handleUpdate}>
          Update to v{state.update.version}
        </Button>
      )}
      {state.status === "downloading" && (
        <Button size="small" appearance="primary" disabled icon={<Spinner size="tiny" />}>
          {state.percent !== null ? `Downloading… ${state.percent}%` : "Downloading…"}
        </Button>
      )}
      {state.status === "installing" && (
        <Button size="small" appearance="primary" disabled icon={<Spinner size="tiny" />}>
          Installing…
        </Button>
      )}
      {state.status === "error" && (
        <Text
          size={200}
          style={{ color: tokens.colorNeutralForeground3 }}
          title={state.message}
        >
          (update check failed)
        </Text>
      )}
    </div>
  );
}
