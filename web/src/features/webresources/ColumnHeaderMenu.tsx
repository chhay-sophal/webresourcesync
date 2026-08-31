import {
  Button,
  Divider,
  Menu,
  MenuPopover,
  MenuTrigger,
  Text,
} from "@fluentui/react-components";
import { ChevronDownRegular } from "@fluentui/react-icons";
import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc" | null;

interface Props {
  active: boolean;
  sortDirection: SortDirection;
  onSort: (direction: SortDirection) => void;
  onClear: () => void;
  children?: ReactNode;
}

export function ColumnHeaderMenu({ active, sortDirection, onSort, onClear, children }: Props) {
  return (
    <Menu positioning="below-end">
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance={active ? "primary" : "subtle"}
          size="small"
          icon={<ChevronDownRegular />}
        />
      </MenuTrigger>
      <MenuPopover>
        <div className="flex min-w-[220px] flex-col gap-2 p-1">
          <Text size={200} weight="semibold">
            Sort
          </Text>
          <div className="flex gap-1">
            <Button
              size="small"
              appearance={sortDirection === "asc" ? "primary" : "secondary"}
              onClick={() => onSort(sortDirection === "asc" ? null : "asc")}
            >
              A → Z
            </Button>
            <Button
              size="small"
              appearance={sortDirection === "desc" ? "primary" : "secondary"}
              onClick={() => onSort(sortDirection === "desc" ? null : "desc")}
            >
              Z → A
            </Button>
          </div>

          {children && (
            <>
              <Divider />
              <Text size={200} weight="semibold">
                Filter
              </Text>
              {children}
            </>
          )}

          <Divider />
          <Button size="small" appearance="subtle" onClick={onClear}>
            Clear
          </Button>
        </div>
      </MenuPopover>
    </Menu>
  );
}
