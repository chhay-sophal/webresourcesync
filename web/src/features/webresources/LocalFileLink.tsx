import { Badge, Button, Dropdown, Option, Text, tokens } from "@fluentui/react-components";
import { CloudArrowUpRegular, LinkDismissRegular, LinkRegular } from "@fluentui/react-icons";
import { useState } from "react";
import { publishWebResources, updateWebResourceContent } from "../../api/dataverse";
import {
  createLink,
  deleteLink,
  getLocalFileContent,
  type LocalFile,
  type ResourceLink,
} from "../../api/local";

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

interface Props {
  orgApiUrl: string;
  environmentId: string;
  solutionUniqueName: string;
  webresourceId: string;
  webresourceName: string;
  localFiles: LocalFile[];
  link: ResourceLink | undefined;
  isModified: boolean;
  onLinksChanged: () => void;
  onPublished: (localPath: string) => void;
}

export function LocalFileLink({
  orgApiUrl,
  environmentId,
  solutionUniqueName,
  webresourceId,
  webresourceName,
  localFiles,
  link,
  isModified,
  onLinksChanged,
  onPublished,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink(localPath: string) {
    setBusy(true);
    setError(null);
    try {
      await createLink({
        environmentUniqueName: environmentId,
        solutionUniqueName,
        webresourceId,
        webresourceName,
        localPath,
      });
      onLinksChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLink(link.id);
      onLinksChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      const content = await getLocalFileContent(link.localPath);
      await updateWebResourceContent(orgApiUrl, webresourceId, utf8ToBase64(content));
      await publishWebResources(orgApiUrl, [webresourceId]);
      onPublished(link.localPath);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      {link ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <Text
            size={200}
            title={link.localPath}
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {link.localPath}
          </Text>
          {isModified && <Badge color="warning" style={{ flexShrink: 0 }}>Modified</Badge>}
          {isModified && (
            <Button
              size="small"
              appearance="primary"
              icon={<CloudArrowUpRegular />}
              onClick={handlePublish}
              disabled={busy}
              style={{ flexShrink: 0 }}
            >
              Publish
            </Button>
          )}
          <Button
            size="small"
            appearance="subtle"
            icon={<LinkDismissRegular />}
            onClick={handleUnlink}
            disabled={busy}
            style={{ flexShrink: 0 }}
          >
            Unlink
          </Button>
        </div>
      ) : (
        <Dropdown
          placeholder={localFiles.length === 0 ? "No local files found" : "Link a file..."}
          disabled={busy || localFiles.length === 0}
          onOptionSelect={(_, data) => data.optionValue && handleLink(data.optionValue)}
          button={
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <LinkRegular />
              {localFiles.length === 0 ? "No local files found" : "Link a file..."}
            </span>
          }
        >
          {localFiles.map((f) => (
            <Option key={f.path} value={f.path}>
              {f.path}
            </Option>
          ))}
        </Dropdown>
      )}
      {error && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {error}
        </Text>
      )}
    </div>
  );
}
