import { describeSchema } from "@/lib/cube/schema";
import { AppShell } from "@/components/shell/AppShell";

export default function SchemaPage() {
  const schema = describeSchema();
  return (
    <AppShell>
      <h1>Schema</h1>
      {schema.tables.map((table) => (
        <section key={table.name}>
          <h2>{table.name}</h2>
          <p className="empty">{table.grain}</p>
          <p>{table.columns.join(", ")}</p>
        </section>
      ))}
      <h2>Metrics</h2>
      <ul>
        {schema.metrics.map((m) => (
          <li key={m.id}>
            {m.id} — {m.description}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
