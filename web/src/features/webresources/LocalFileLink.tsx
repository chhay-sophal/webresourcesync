import { Badge, Button, Dropdown, Option, Text, tokens } from "@fluentui/react-components";
import { CloudArrowUpRegular, LinkDismissRegular, LinkRegular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { getWebResourceContent, publishWebResources, updateWebResourceContent } from "../../api/dataverse";
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

function base64ToUtf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

interface Props {
  orgApiUrl: string;
  environmentId: string;
  solutionUniqueName: string;
  webresourceId: string;
  webresourceName: string;
  localFiles: LocalFile[];
  link: ResourceLink | undefined;
  /** A local file-change event landed for this resource's path since it was last checked —
   * used only to trigger a fresh content comparison, not as the modified state itself. */
  hasPendingChangeEvent: boolean;
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
  hasPendingChangeEvent,
  onLinksChanged,
  onPublished,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);

  // Compares actual local file content against what's currently published in Dataverse,
  // rather than trusting "a change event fired" as a proxy — that alone can't tell you
  // whether the edit was reverted, or whether the file diverged before this session ever
  // started watching it.
  useEffect(() => {
    if (!link) {
      setIsModified(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [localContent, remoteBase64] = await Promise.all([
          getLocalFileContent(link.localPath),
          getWebResourceContent(orgApiUrl, webresourceId),
        ]);
        if (!cancelled) setIsModified(localContent !== base64ToUtf8(remoteBase64));
      } catch {
        // Transient fetch error — leave the previous known state alone rather than guess.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [link, hasPendingChangeEvent, orgApiUrl, webresourceId]);

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
      setIsModified(false);
      onPublished(link.localPath);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {link ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <Text size={200} title={link.localPath} className="min-w-0 flex-1 truncate">
            {link.localPath}
          </Text>
          {isModified && (
            <Badge color="warning" className="shrink-0">
              Modified
            </Badge>
          )}
          {isModified && (
            <Button
              size="small"
              appearance="primary"
              icon={<CloudArrowUpRegular />}
              onClick={handlePublish}
              disabled={busy}
              className="shrink-0"
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
            className="shrink-0"
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
            <span className="flex items-center gap-1.5">
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
