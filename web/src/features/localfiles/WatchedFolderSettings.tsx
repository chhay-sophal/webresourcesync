import { Button, Field, Input, Text, tokens } from "@fluentui/react-components";
import { CheckmarkCircleRegular, FolderOpenRegular, SaveRegular } from "@fluentui/react-icons";
import { useState } from "react";
import { pickFolder } from "../../api/local";

interface Props {
  root: string | null;
  fileCount: number;
  onSetRoot: (root: string) => Promise<void>;
}

export function WatchedFolderSettings({ root, fileCount, onSetRoot }: Props) {
  const [path, setPath] = useState(root ?? "");
  const [saving, setSaving] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyRoot(newPath: string) {
    setSaving(true);
    setError(null);
    try {
      await onSetRoot(newPath);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBrowse() {
    setBrowsing(true);
    setError(null);
    try {
      const selected = await pickFolder();
      if (selected) {
        setPath(selected);
        await applyRoot(selected);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBrowsing(false);
    }
  }

  return (
    <div>
      <Field hint="The folder on this machine containing your HTML/JS/CSS files. Files here can be linked to web resources below.">
        <div className="flex gap-2">
          <Button icon={<FolderOpenRegular />} onClick={handleBrowse} disabled={browsing || saving}>
            {browsing ? "Waiting for dialog..." : "Browse..."}
          </Button>
          <Input
            className="flex-1"
            value={path}
            onChange={(_, data) => setPath(data.value)}
            placeholder="D:\path\to\your\webresources"
          />
          <Button
            appearance="primary"
            icon={<SaveRegular />}
            onClick={() => applyRoot(path.trim())}
            disabled={saving || browsing || !path.trim()}
          >
            {saving ? "Setting..." : "Set folder"}
          </Button>
        </div>
      </Field>
      {root && (
        <div className="mt-2 flex items-center gap-1.5">
          <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
          <Text size={200}>
            Watching {root} — {fileCount} file(s) found.
          </Text>
        </div>
      )}
      {error && (
        <Text className="mt-2 block" style={{ color: tokens.colorPaletteRedForeground1 }}>
          {error}
        </Text>
      )}
    </div>
  );
}
