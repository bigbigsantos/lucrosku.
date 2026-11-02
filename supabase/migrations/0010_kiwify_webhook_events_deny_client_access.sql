create policy "deny client access to kiwify events" on public.kiwify_webhook_events
for all to anon, authenticated using (false) with check (false);
