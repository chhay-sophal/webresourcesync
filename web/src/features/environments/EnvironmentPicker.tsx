import { Dropdown, Option, Spinner, Text } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { listEnvironments, type DataverseEnvironment } from "../../api/discovery";

interface Props {
  selected: DataverseEnvironment | null;
  onSelect: (environment: DataverseEnvironment) => void;
}

export function EnvironmentPicker({ selected, onSelect }: Props) {
  const [environments, setEnvironments] = useState<DataverseEnvironment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEnvironments()
      .then(setEnvironments)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Text style={{ color: "red" }}>{error}</Text>;
  if (!environments) return <Spinner label="Loading environments..." />;

  return (
    <Dropdown
      placeholder="Choose an environment"
      value={selected?.friendlyName ?? ""}
      onOptionSelect={(_, data) => {
        const env = environments.find((e) => e.uniqueName === data.optionValue);
        if (env) onSelect(env);
      }}
    >
      {environments.map((env) => (
        <Option key={env.uniqueName} value={env.uniqueName}>
          {env.friendlyName}
        </Option>
      ))}
    </Dropdown>
  );
}
