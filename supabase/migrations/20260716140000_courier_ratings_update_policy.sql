-- Allow the customer to revise their courier rating (stars) after submitting.
-- Applied to the hosted project on 2026-07-16 via MCP apply_migration.
create policy "customer updates own courier rating" on public.courier_ratings
  for update using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
