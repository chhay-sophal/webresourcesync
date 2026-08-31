import { Button, Popover, PopoverSurface, PopoverTrigger, Text, tokens } from "@fluentui/react-components";
import type { ReactElement, ReactNode } from "react";

interface Props {
  icon: ReactElement;
  label: string;
  value: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function SettingsBarItem({ icon, label, value, disabled, open, onOpenChange, children }: Props) {
  return (
    <Popover
      open={open}
      onOpenChange={(_, data) => onOpenChange(data.open)}
      positioning="below-start"
      withArrow
    >
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="subtle" disabled={disabled} icon={icon}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.25 }}>
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              {label}
            </Text>
            <Text
              size={300}
              truncate
              wrap={false}
              style={{ maxWidth: 200, textAlign: "left" }}
            >
              {value}
            </Text>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverSurface style={{ minWidth: 340, maxWidth: 440 }}>{children}</PopoverSurface>
    </Popover>
  );
}
