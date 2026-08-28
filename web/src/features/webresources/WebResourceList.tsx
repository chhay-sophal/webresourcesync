import {
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { listWebResourcesForSolution, type WebResource } from "../../api/dataverse";

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

interface Props {
  orgApiUrl: string;
  solutionId: string;
}

export function WebResourceList({ orgApiUrl, solutionId }: Props) {
  const [resources, setResources] = useState<WebResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResources(null);
    listWebResourcesForSolution(orgApiUrl, solutionId)
      .then(setResources)
      .catch((err) => setError(err.message));
  }, [orgApiUrl, solutionId]);

  if (error) return <Text style={{ color: "red" }}>{error}</Text>;
  if (!resources) return <Spinner label="Loading web resources..." />;
  if (resources.length === 0) return <Text>No web resources found in this solution.</Text>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Display name</TableHeaderCell>
          <TableHeaderCell>Type</TableHeaderCell>
          <TableHeaderCell>Managed</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((r) => (
          <TableRow key={r.webresourceid}>
            <TableCell>{r.name}</TableCell>
            <TableCell>{r.displayname}</TableCell>
            <TableCell>{TYPE_LABELS[r.webresourcetype] ?? r.webresourcetype}</TableCell>
            <TableCell>{r.ismanaged ? "Yes" : "No"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
