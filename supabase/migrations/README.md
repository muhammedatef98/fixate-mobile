# Supabase Migrations

Database schema and policy migrations for the Fixatee project. Files are named
`YYYYMMDDHHMMSS_short_description.sql` and are intended to be applied **in order**.

> The single source of truth for the live database is [Supabase Studio](https://supabase.com/dashboard/project/gpucisjxecupcyosumgy).
> Most of these migrations were also applied through the Supabase MCP server during
> development. The files here exist for traceability and so the schema can be
> reproduced from scratch.

## Apply on a fresh project

```bash
# Install the CLI once
npm install -g supabase

# Link to your project (run from repo root)
supabase link --project-ref <YOUR_PROJECT_REF>

# Push every migration in order
supabase db push
```

## Apply manually (no CLI)

Open the **SQL Editor** in Supabase Studio and run each `.sql` file in this folder
in numeric order (oldest filename first). Stop and inspect the result if any
statement fails — they are mostly idempotent (`CREATE … IF NOT EXISTS`,
`DROP POLICY IF EXISTS`) but a partially-applied migration can leave the schema
in a state that confuses later ones.

## Migration index

| Order | File | Purpose |
| ----- | ---- | ------- |
| 1 | `20240101000000_initial_schema.sql` | Core tables: users, services, orders, technicians, reviews + initial RLS |
| 2 | `20240102000000_final_setup.sql` | Final schema tweaks for first launch |
| 3 | `20240103000000_messages_table.sql` | Chat messages between customer and technician |
| 4 | `20240104000000_technician_orders_policy.sql` | RLS so technicians can read their assigned orders |
| 5 | `20240105000000_technician_accept_policy.sql` | RLS for atomic order accept by technicians |
| 6 | `20240106000000_service_id_nullable.sql` | Allow orders without a pre-defined service row |
| 7 | `20240107000000_security_hardening.sql` | Tightened RLS for users, orders, technicians, reviews, messages |

Later migrations (payments, OTP codes, technician verification, addresses,
notification preferences, technician live locations, admin role) were applied
directly through the Supabase MCP server and live only in the database. Run
`supabase db diff` against a clean project to dump them into this folder if you
need to reproduce.
