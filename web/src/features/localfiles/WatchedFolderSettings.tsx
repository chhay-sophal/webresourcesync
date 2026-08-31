import { Button, Field, Input, Text } from "@fluentui/react-components";
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
      <Field
        label="Local folder"
        hint="The folder on this machine containing your HTML/JS/CSS files. Files here can be linked to web resources below."
      >
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={handleBrowse} disabled={browsing || saving}>
            {browsing ? "Waiting for dialog..." : "Browse..."}
          </Button>
          <Input
            style={{ flex: 1 }}
            value={path}
            onChange={(_, data) => setPath(data.value)}
            placeholder="D:\path\to\your\webresources"
          />
          <Button
            appearance="primary"
            onClick={() => applyRoot(path.trim())}
            disabled={saving || browsing || !path.trim()}
          >
            {saving ? "Setting..." : "Set folder"}
          </Button>
        </div>
      </Field>
      {root && <Text size={200}>Watching {root} — {fileCount} file(s) found.</Text>}
      {error && <Text style={{ color: "red" }}>{error}</Text>}
    </div>
  );
}
