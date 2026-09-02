import {
  Button,
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
import { InfoRegular } from "@fluentui/react-icons";
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
import { CreateWebResourceDialog } from "./CreateWebResourceDialog";
import { LocalFileLink } from "./LocalFileLink";
import { WebResourceDetailsDialog } from "./WebResourceDetailsDialog";
import { TYPE_LABELS } from "./webResourceTypes";

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
  publishSelected: () => Promise<void>;
  openCreateDialog: () => void;
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
  onSelectedCountChange?: (count: number) => void;
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
  onSelectedCountChange,
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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

  useEffect(() => {
    onSelectedCountChange?.(selectedIds.size);
  }, [selectedIds, onSelectedCountChange]);

  function handleRowPublished(webresourceId: string, localPath: string) {
    setModifiedStatus((prev) => new Map(prev).set(webresourceId, false));
    onFilePublished(localPath);
  }

  /** Updates local-linked content for the given resources (in parallel) and publishes
   * everything that either updated successfully or has no local link to update from. */
  async function publishResources(webresourceIds: string[]) {
    if (webresourceIds.length === 0) return;
    const idSet = new Set(webresourceIds);
    const linked = links.filter((l) => idSet.has(l.webresourceId));
    onPublishingAllChange?.(true);
    setPublishAllError(null);
    try {
      const results = await Promise.allSettled(
        linked.map(async (link) => {
          const content = await getLocalFileContent(link.localPath);
          await updateWebResourceContent(orgApiUrl, link.webresourceId, utf8ToBase64(content));
          return link;
        })
      );
      const failedIds = new Set<string>();
      const failedNames: string[] = [];
      const succeededLinks: ResourceLink[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") succeededLinks.push(result.value);
        else {
          failedIds.add(linked[index].webresourceId);
          failedNames.push(linked[index].webresourceName);
        }
      });
      const toPublish = webresourceIds.filter((id) => !failedIds.has(id));
      if (toPublish.length > 0) {
        await publishWebResources(orgApiUrl, toPublish);
        setModifiedStatus((prev) => {
          const next = new Map(prev);
          for (const id of toPublish) next.set(id, false);
          return next;
        });
        succeededLinks.forEach((l) => onFilePublished(l.localPath));
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

  async function publishAll() {
    const toPublish = links.filter((l) => modifiedStatus.get(l.webresourceId)).map((l) => l.webresourceId);
    await publishResources(toPublish);
  }

  async function publishSelected() {
    await publishResources([...selectedIds]);
    setSelectedIds(new Set());
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
    publishSelected,
    openCreateDialog: () => setCreateDialogOpen(true),
  }));

  const refreshResources = useCallback(() => {
    listWebResourcesForSolution(orgApiUrl, solutionId)
      .then(setResources)
      .catch((err) => setError(err.message));
  }, [orgApiUrl, solutionId]);

  useEffect(() => {
    setResources(null);
    setFilters(EMPTY_FILTERS);
    setSort(null);
    setModifiedStatus(new Map());
    setPublishAllError(null);
    setSelectedIds(new Set());
    refreshResources();
  }, [orgApiUrl, solutionId, refreshResources]);

  function handleCreated() {
    setCreateDialogOpen(false);
    refreshResources();
  }

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

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allDisplayedSelected =
    displayedResources.length > 0 && displayedResources.every((r) => selectedIds.has(r.webresourceid));
  const someDisplayedSelected = displayedResources.some((r) => selectedIds.has(r.webresourceid));

  function toggleSelectAllDisplayed() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allDisplayedSelected) {
        displayedResources.forEach((r) => next.delete(r.webresourceid));
      } else {
        displayedResources.forEach((r) => next.add(r.webresourceid));
      }
      return next;
    });
  }

  const createDialog = (
    <CreateWebResourceDialog
      orgApiUrl={orgApiUrl}
      solutionUniqueName={solutionUniqueName}
      open={createDialogOpen}
      onClose={() => setCreateDialogOpen(false)}
      onCreated={handleCreated}
    />
  );

  if (error)
    return (
      <>
        <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</Text>
        {createDialog}
      </>
    );
  if (!resources)
    return (
      <>
        <Spinner label="Loading web resources..." />
        {createDialog}
      </>
    );
  if (resources.length === 0)
    return (
      <>
        <Text>No web resources found in this solution.</Text>
        {createDialog}
      </>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    {publishAllError && (
      <Text className="mb-2 block" style={{ color: tokens.colorPaletteRedForeground1 }}>
        {publishAllError}
      </Text>
    )}
    <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
    <Table className="flex min-h-0 flex-1 flex-col w-full table-fixed min-w-[800px]">
      <TableHeader className="sticky top-0 z-10" style={{ background: tokens.colorNeutralBackground1 }}>
        <TableRow>
          <TableHeaderCell className="w-10">
            <Checkbox
              checked={allDisplayedSelected ? true : someDisplayedSelected ? "mixed" : false}
              onChange={toggleSelectAllDisplayed}
              aria-label="Select all web resources"
            />
          </TableHeaderCell>
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
            <HeaderContent label="Display Name">
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
          <TableHeaderCell className="w-[15%]">
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
          <TableHeaderCell className="w-[10%]">
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
          <TableHeaderCell className="w-1/4">
            <div className="font-bold">Local File</div>
          </TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody className="min-h-0 flex-1 overflow-y-auto">
        {displayedResources.map((r) => {
          const link = links.find((l) => l.webresourceId === r.webresourceid);
          const isSelected = selectedIds.has(r.webresourceid);
          return (
            <TableRow key={r.webresourceid} appearance={isSelected ? "brand" : "none"}>
              <TableCell>
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleSelected(r.webresourceid)}
                  aria-label={`Select ${r.name}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center justify-between gap-1">
                  <TableCellLayout truncate title={r.name} className="min-w-0 flex-1">
                    {r.name}
                  </TableCellLayout>
                  <Button
                    shape="circular"
                    appearance="subtle"
                    size="small"
                    icon={<InfoRegular />}
                    onClick={() => setDetailsId(r.webresourceid)}
                    aria-label={`View details for ${r.name}`}
                    className="shrink-0"
                  />
                </div>
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
            <TableCell colSpan={6}>
              <Text>No web resources match the current filters.</Text>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </div>
    <WebResourceDetailsDialog
      orgApiUrl={orgApiUrl}
      webresourceId={detailsId}
      linkedPath={links.find((l) => l.webresourceId === detailsId)?.localPath}
      onClose={() => setDetailsId(null)}
    />
    {createDialog}
    </div>
  );
}

function HeaderContent({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 font-bold">
      <span>{label}</span>
      {children}
    </div>
  );
}
