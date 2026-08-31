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
import { listWebResourcesForSolution, type WebResource } from "../../api/dataverse";
import { listLinks, type LocalFile, type ResourceLink } from "../../api/local";
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
  ref,
}: Props) {
  const [resources, setResources] = useState<WebResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" } | null>(null);
  const [links, setLinks] = useState<ResourceLink[]>([]);

  const refreshLinks = useCallback(() => {
    listLinks().then(setLinks);
  }, []);

  useEffect(() => {
    refreshLinks();
  }, [refreshLinks, solutionId]);

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
  }));

  useEffect(() => {
    setResources(null);
    setFilters(EMPTY_FILTERS);
    setSort(null);
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
    <div style={{ overflowX: "auto" }}>
    <Table style={{ tableLayout: "fixed", width: "100%", minWidth: 760 }}>
      <TableHeader>
        <TableRow>
          <TableHeaderCell style={{ width: "25%" }}>
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
          <TableHeaderCell style={{ width: "25%" }}>
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
          <TableHeaderCell style={{ width: "10%" }}>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
          <TableHeaderCell style={{ width: "7%" }}>
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
          <TableHeaderCell style={{ width: "33%" }}>Local file</TableHeaderCell>
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
                  isModified={!!link && modifiedPaths.has(link.localPath)}
                  onLinksChanged={refreshLinks}
                  onPublished={onFilePublished}
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
  );
}

function HeaderContent({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span>{label}</span>
      {children}
    </div>
  );
}
