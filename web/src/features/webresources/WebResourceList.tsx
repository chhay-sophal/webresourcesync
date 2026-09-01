import {
  Checkbox,
  Input,
  Radio,
  RadioGroup,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useCallback, useEffect, useImperativeHandle, useMemo, useState, type ReactNode, type Ref } from "react";
import {
  getWebResourceContent,
  listWebResourcesForSolution,
  publishWebResources,
  updateWebResourceContent,
  type WebResource,
} from "../../api/dataverse";
import { getLocalFileContent, listLinks, type LocalFile, type ResourceLink } from "../../api/local";
import { base64ToUtf8, utf8ToBase64 } from "../../lib/base64";
import { ColumnHeaderMenu, type SortDirection } from "./ColumnHeaderMenu";
import { LocalFileLink } from "./LocalFileLink";

const TYPE_LABELS: Record<number, string> = {
  1: "HTML",
  2: "CSS",
  3: "JavaScript",
  4: "XML",
  5: "PNG",
  6: "JPG",
  7: "GIF",
  9: "XSL",
  10: "ICO",
  11: "SVG",
  12: "RESX",
};

type ManagedFilter = "all" | "managed" | "unmanaged";
type SortColumn = "name" | "displayname" | "type" | "managed";

interface Filters {
  name: string;
  displayname: string;
  types: Set<number>;
  managed: ManagedFilter;
}

const EMPTY_FILTERS: Filters = { name: "", displayname: "", types: new Set(), managed: "all" };

/** Matches `pattern` against `value`. Plain text is a case-insensitive "contains" match;
 * `*` (any run of characters) and `?` (any single character) make it a full wildcard match. */
function matchesText(value: string, pattern: string): boolean {
  if (!pattern.trim()) return true;
  if (!/[*?]/.test(pattern)) {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

function sortValue(r: WebResource, column: SortColumn): string {
  switch (column) {
    case "name":
      return r.name;
    case "displayname":
      return r.displayname;
    case "type":
      return TYPE_LABELS[r.webresourcetype] ?? String(r.webresourcetype);
    case "managed":
      return r.ismanaged ? "Yes" : "No";
  }
}

export interface WebResourceListHandle {
  clearAllFiltersAndSort: () => void;
  publishAll: () => Promise<void>;
}

interface Props {
  orgApiUrl: string;
  solutionId: string;
  environmentId: string;
  solutionUniqueName: string;
  localFiles: LocalFile[];
  modifiedPaths: Set<string>;
  onFilePublished: (localPath: string) => void;
  onActiveFilterOrSortChange?: (active: boolean) => void;
  onModifiedCountChange?: (count: number) => void;
  onPublishingAllChange?: (publishing: boolean) => void;
  ref?: Ref<WebResourceListHandle>;
}

export function WebResourceList({
  orgApiUrl,
  solutionId,
  environmentId,
  solutionUniqueName,
  localFiles,
  modifiedPaths,
  onFilePublished,
  onActiveFilterOrSortChange,
  onModifiedCountChange,
  onPublishingAllChange,
  ref,
}: Props) {
  const [resources, setResources] = useState<WebResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" } | null>(null);
  const [links, setLinks] = useState<ResourceLink[]>([]);
  const [modifiedStatus, setModifiedStatus] = useState<Map<string, boolean>>(new Map());
  const [publishAllError, setPublishAllError] = useState<string | null>(null);

  const refreshLinks = useCallback(() => {
    listLinks().then(setLinks);
  }, []);

  useEffect(() => {
    refreshLinks();
  }, [refreshLinks, solutionId]);

  const checkOneModified = useCallback(
    async (link: ResourceLink) => {
      try {
        const [localContent, remoteBase64] = await Promise.all([
          getLocalFileContent(link.localPath),
          getWebResourceContent(orgApiUrl, link.webresourceId),
        ]);
        const modified = localContent !== base64ToUtf8(remoteBase64);
        setModifiedStatus((prev) => new Map(prev).set(link.webresourceId, modified));
      } catch {
        // Transient fetch error — leave the previous known state alone rather than guess.
      }
    },
    [orgApiUrl]
  );

  // Full check whenever the linked-files list changes (initial load, solution switch, or a
  // link was just created/removed).
  useEffect(() => {
    links.forEach((link) => {
      checkOneModified(link);
    });
  }, [links, checkOneModified]);

  // Incremental re-check when a watched local file changes.
  useEffect(() => {
    for (const link of links) {
      if (modifiedPaths.has(link.localPath)) {
        checkOneModified(link);
      }
    }
  }, [modifiedPaths, links, checkOneModified]);

  const modifiedCount = useMemo(
    () => [...modifiedStatus.values()].filter(Boolean).length,
    [modifiedStatus]
  );

  useEffect(() => {
    onModifiedCountChange?.(modifiedCount);
  }, [modifiedCount, onModifiedCountChange]);

  function handleRowPublished(webresourceId: string, localPath: string) {
    setModifiedStatus((prev) => new Map(prev).set(webresourceId, false));
    onFilePublished(localPath);
  }

  async function publishAll() {
    const toPublish = links.filter((l) => modifiedStatus.get(l.webresourceId));
    if (toPublish.length === 0) return;
    onPublishingAllChange?.(true);
    setPublishAllError(null);
    try {
      const results = await Promise.allSettled(
        toPublish.map(async (link) => {
          const content = await getLocalFileContent(link.localPath);
          await updateWebResourceContent(orgApiUrl, link.webresourceId, utf8ToBase64(content));
          return link;
        })
      );
      const succeeded: ResourceLink[] = [];
      const failedNames: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") succeeded.push(result.value);
        else failedNames.push(toPublish[index].webresourceName);
      });
      if (succeeded.length > 0) {
        await publishWebResources(orgApiUrl, succeeded.map((l) => l.webresourceId));
        setModifiedStatus((prev) => {
          const next = new Map(prev);
          for (const l of succeeded) next.set(l.webresourceId, false);
          return next;
        });
        succeeded.forEach((l) => onFilePublished(l.localPath));
      }
      if (failedNames.length > 0) {
        setPublishAllError(`Failed to update: ${failedNames.join(", ")}`);
      }
    } catch (err) {
      setPublishAllError((err as Error).message);
    } finally {
      onPublishingAllChange?.(false);
    }
  }

  const hasActiveFilterOrSort =
    sort !== null ||
    filters.name !== "" ||
    filters.displayname !== "" ||
    filters.types.size > 0 ||
    filters.managed !== "all";

  useEffect(() => {
    onActiveFilterOrSortChange?.(hasActiveFilterOrSort);
  }, [hasActiveFilterOrSort, onActiveFilterOrSortChange]);

  useImperativeHandle(ref, () => ({
    clearAllFiltersAndSort: () => {
      setFilters(EMPTY_FILTERS);
      setSort(null);
    },
    publishAll,
  }));

  useEffect(() => {
    setResources(null);
    setFilters(EMPTY_FILTERS);
    setSort(null);
    setModifiedStatus(new Map());
    setPublishAllError(null);
    listWebResourcesForSolution(orgApiUrl, solutionId)
      .then(setResources)
      .catch((err) => setError(err.message));
  }, [orgApiUrl, solutionId]);

  const availableTypes = useMemo(() => {
    const seen = new Map<number, string>();
    for (const r of resources ?? []) {
      if (!seen.has(r.webresourcetype)) {
        seen.set(r.webresourcetype, TYPE_LABELS[r.webresourcetype] ?? String(r.webresourcetype));
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [resources]);

  const displayedResources = useMemo(() => {
    let list = (resources ?? []).filter(
      (r) =>
        matchesText(r.name, filters.name) &&
        matchesText(r.displayname, filters.displayname) &&
        (filters.types.size === 0 || filters.types.has(r.webresourcetype)) &&
        (filters.managed === "all" || (filters.managed === "managed") === r.ismanaged)
    );
    if (sort) {
      const dir = sort.direction === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => sortValue(a, sort.column).localeCompare(sortValue(b, sort.column)) * dir);
    }
    return list;
  }, [resources, filters, sort]);

  function sortDirectionFor(column: SortColumn): SortDirection {
    return sort?.column === column ? sort.direction : null;
  }

  function toggleType(code: number) {
    setFilters((f) => {
      const types = new Set(f.types);
      if (types.has(code)) types.delete(code);
      else types.add(code);
      return { ...f, types };
    });
  }

  if (error) return <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Text>;
  if (!resources) return <Spinner label="Loading web resources..." />;
  if (resources.length === 0) return <Text>No web resources found in this solution.</Text>;

  return (
    <div>
    {publishAllError && (
      <Text className="mb-2 block" style={{ color: tokens.colorPaletteRedForeground1 }}>
        {publishAllError}
      </Text>
    )}
    <div className="overflow-x-auto">
    <Table className="w-full table-fixed min-w-[760px]">
      <TableHeader>
        <TableRow>
          <TableHeaderCell className="w-1/4">
            <HeaderContent label="Name">
              <ColumnHeaderMenu
                active={sortDirectionFor("name") !== null || filters.name !== ""}
                sortDirection={sortDirectionFor("name")}
                onSort={(direction) => setSort(direction ? { column: "name", direction } : null)}
                onClear={() => {
                  setFilters((f) => ({ ...f, name: "" }));
                  setSort((s) => (s?.column === "name" ? null : s));
                }}
              >
                <Input
                  size="small"
                  value={filters.name}
                  onChange={(_, data) => setFilters((f) => ({ ...f, name: data.value }))}
                  placeholder="e.g. *_form or contact"
                />
              </ColumnHeaderMenu>
            </HeaderContent>
          </TableHeaderCell>
          <TableHeaderCell className="w-1/4">
            <HeaderContent label="Display name">
              <ColumnHeaderMenu
                active={sortDirectionFor("displayname") !== null || filters.displayname !== ""}
                sortDirection={sortDirectionFor("displayname")}
                onSort={(direction) =>
                  setSort(direction ? { column: "displayname", direction } : null)
                }
                onClear={() => {
                  setFilters((f) => ({ ...f, displayname: "" }));
                  setSort((s) => (s?.column === "displayname" ? null : s));
                }}
              >
                <Input
                  size="small"
                  value={filters.displayname}
                  onChange={(_, data) => setFilters((f) => ({ ...f, displayname: data.value }))}
                  placeholder="e.g. Contact*"
                />
              </ColumnHeaderMenu>
            </HeaderContent>
          </TableHeaderCell>
          <TableHeaderCell className="w-[10%]">
            <HeaderContent label="Type">
              <ColumnHeaderMenu
                active={sortDirectionFor("type") !== null || filters.types.size > 0}
                sortDirection={sortDirectionFor("type")}
                onSort={(direction) => setSort(direction ? { column: "type", direction } : null)}
                onClear={() => {
                  setFilters((f) => ({ ...f, types: new Set() }));
                  setSort((s) => (s?.column === "type" ? null : s));
                }}
              >
                <div className="flex flex-col gap-1">
                  {availableTypes.map(([code, label]) => (
                    <Checkbox
                      key={code}
                      label={label}
                      checked={filters.types.has(code)}
                      onChange={() => toggleType(code)}
                    />
                  ))}
                </div>
              </ColumnHeaderMenu>
            </HeaderContent>
          </TableHeaderCell>
          <TableHeaderCell className="w-[7%]">
            <HeaderContent label="Managed">
              <ColumnHeaderMenu
                active={sortDirectionFor("managed") !== null || filters.managed !== "all"}
                sortDirection={sortDirectionFor("managed")}
                onSort={(direction) => setSort(direction ? { column: "managed", direction } : null)}
                onClear={() => {
                  setFilters((f) => ({ ...f, managed: "all" }));
                  setSort((s) => (s?.column === "managed" ? null : s));
                }}
              >
                <RadioGroup
                  value={filters.managed}
                  onChange={(_, data) => setFilters((f) => ({ ...f, managed: data.value as ManagedFilter }))}
                >
                  <Radio value="all" label="All" />
                  <Radio value="managed" label="Managed" />
                  <Radio value="unmanaged" label="Unmanaged" />
                </RadioGroup>
              </ColumnHeaderMenu>
            </HeaderContent>
          </TableHeaderCell>
          <TableHeaderCell className="w-1/3">Local file</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {displayedResources.map((r) => {
          const link = links.find((l) => l.webresourceId === r.webresourceid);
          return (
            <TableRow key={r.webresourceid}>
              <TableCell>
                <TableCellLayout truncate title={r.name}>
                  {r.name}
                </TableCellLayout>
              </TableCell>
              <TableCell>
                <TableCellLayout truncate title={r.displayname}>
                  {r.displayname}
                </TableCellLayout>
              </TableCell>
              <TableCell>
                <TableCellLayout truncate>
                  {TYPE_LABELS[r.webresourcetype] ?? r.webresourcetype}
                </TableCellLayout>
              </TableCell>
              <TableCell>
                <TableCellLayout truncate>{r.ismanaged ? "Yes" : "No"}</TableCellLayout>
              </TableCell>
              <TableCell>
                <LocalFileLink
                  orgApiUrl={orgApiUrl}
                  environmentId={environmentId}
                  solutionUniqueName={solutionUniqueName}
                  webresourceId={r.webresourceid}
                  webresourceName={r.name}
                  localFiles={localFiles}
                  link={link}
                  isModified={!!link && (modifiedStatus.get(r.webresourceid) ?? false)}
                  onLinksChanged={refreshLinks}
                  onPublished={handleRowPublished}
                />
              </TableCell>
            </TableRow>
          );
        })}
        {displayedResources.length === 0 && (
          <TableRow>
            <TableCell colSpan={5}>
              <Text>No web resources match the current filters.</Text>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </div>
    </div>
  );
}

function HeaderContent({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      {children}
    </div>
  );
}
