import { describeSchema } from "@/lib/cube/schema";
import { AppShell } from "@/components/shell/AppShell";
import { SchemaExplorer } from "@/components/schema/SchemaExplorer";

export default function SchemaPage() {
  const schema = describeSchema();
  return (
    <AppShell>
      <SchemaExplorer schema={schema} />
    </AppShell>
  );
}
