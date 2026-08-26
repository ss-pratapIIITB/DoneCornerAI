# Cube metrics

Query the close-pack cube. Do not invent numbers.

- Call `describe_schema` before a new metric.
- Call `query_cube` with `metric`, `grain` (`period` | `function` | `account`), and filters.
- Grain steps: period → function → account. Entity/region is a filter, not a drill level.
- Formulas live in `docs/metrics.md`.
