import { Badge, Card, CardHeader, Text, tokens } from "@fluentui/react-components";
import type { ReactElement, ReactNode } from "react";

interface Props {
  step?: number;
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactElement | false;
  children: ReactNode;
}

export function SectionCard({ step, icon, title, description, action, children }: Props) {
  return (
    <Card style={{ padding: "20px 24px" }}>
      <CardHeader
        image={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: tokens.borderRadiusMedium,
              background: tokens.colorBrandBackground2,
              color: tokens.colorBrandForeground2,
            }}
          >
            {icon}
          </div>
        }
        header={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step !== undefined && (
              <Badge shape="circular" appearance="filled" color="informative" size="small">
                {step}
              </Badge>
            )}
            <Text weight="semibold" size={400}>
              {title}
            </Text>
          </div>
        }
        description={description ? <Text size={200}>{description}</Text> : undefined}
        action={action || undefined}
      />
      <div style={{ marginTop: 16 }}>{children}</div>
    </Card>
  );
}
