# Workspace schema on Supabase (PostgreSQL)

ERP / `src_*` views stay on **MySQL**. Only workspace-owned tables live here.

## Apply schema + seed from local MySQL

Requires:

- `DATABASE_URL` — Supabase Postgres (script prefers session port `5432` for DDL)
- `DB_*` — local MySQL with `giga_workspace` data

```bash
npm run db:migrate:supabase
```

This runs `001_workspace_schema.sql`, truncates tables, copies rows (preserving ids), and resets identity sequences.

## Nest connections

| Name | Engine | Env |
|------|--------|-----|
| `workspace` | Postgres (Supabase) | `DATABASE_URL` |
| `source` | MySQL | `SOURCE_DB_*` (DB that contains `src_*` views) |

TypeORM rewrites pooler port `6543` → `5432` for the workspace connection so prepared statements work reliably.
