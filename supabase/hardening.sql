-- =====================================================================
-- hardening.sql — server-side anti-abuse for the public write endpoints.
-- Run once in the Supabase SQL Editor AFTER schema.sql. Safe to re-run.
--
-- Because the site is static, anyone can read the public anon key and call
-- the database directly, bypassing every browser-side check. So the limits
-- below live in Postgres where they cannot be skipped.
-- =====================================================================

create table if not exists public.rate_limits (
  bucket text not null,
  actor  text not null,
  hit_at timestamptz not null default now()
);
create index if not exists rate_limits_idx on public.rate_limits (bucket, actor, hit_at desc);
alter table public.rate_limits enable row level security;   -- no policies: nobody can read/write directly
revoke all on public.rate_limits from anon, authenticated;

-- Best-effort caller identity: signed-in user id, else the client IP
-- forwarded by Supabase's API gateway, else a shared 'anon' bucket.
create or replace function public.sv_actor() returns text
language plpgsql stable as $$
declare h json; ip text;
begin
  if auth.uid() is not null then return 'u:' || auth.uid()::text; end if;
  begin
    h := current_setting('request.headers', true)::json;
    ip := split_part(coalesce(h->>'cf-connecting-ip', h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1);
  exception when others then ip := ''; end;
  return 'ip:' || coalesce(nullif(trim(ip), ''), 'anon');
end $$;

-- Raises when the caller made more than p_max hits in the last p_window.
create or replace function public.sv_rate_check(p_bucket text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = public as $$
declare a text := public.sv_actor(); n int;
begin
  select count(*) into n from public.rate_limits
   where bucket = p_bucket and actor = a and hit_at > now() - p_window;
  if n >= p_max then
    raise exception 'Too many requests — please wait a few minutes and try again.' using errcode = 'P0429';
  end if;
  insert into public.rate_limits(bucket, actor) values (p_bucket, a);
  -- opportunistic cleanup (about 1 call in 50)
  if random() < 0.02 then delete from public.rate_limits where hit_at < now() - interval '2 days'; end if;
end $$;
revoke all on function public.sv_rate_check(text, int, interval) from public;
grant execute on function public.sv_rate_check(text, int, interval) to anon, authenticated;

-- Generic trigger: TG_ARGV = bucket, max, window
create or replace function public.sv_rate_trigger() returns trigger
language plpgsql as $$
begin
  perform public.sv_rate_check(TG_ARGV[0], TG_ARGV[1]::int, TG_ARGV[2]::interval);
  return new;
end $$;

drop trigger if exists rl_contact on public.contact_messages;
create trigger rl_contact before insert on public.contact_messages
  for each row execute function public.sv_rate_trigger('contact', '3', '1 hour');

drop trigger if exists rl_subscribe on public.subscribers;
create trigger rl_subscribe before insert on public.subscribers
  for each row execute function public.sv_rate_trigger('subscribe', '5', '1 hour');

drop trigger if exists rl_comment on public.comments;
create trigger rl_comment before insert on public.comments
  for each row execute function public.sv_rate_trigger('comment', '8', '10 minutes');

drop trigger if exists rl_forum on public.forum_posts;
create trigger rl_forum before insert on public.forum_posts
  for each row execute function public.sv_rate_trigger('forum', '5', '1 hour');

drop trigger if exists rl_dm on public.direct_messages;
create trigger rl_dm before insert on public.direct_messages
  for each row execute function public.sv_rate_trigger('dm', '40', '10 minutes');

drop trigger if exists rl_reaction on public.reaction_votes;
create trigger rl_reaction before insert on public.reaction_votes
  for each row execute function public.sv_rate_trigger('reaction', '60', '10 minutes');

-- Chatbot (used by the Edge Function with the service role): 20 questions / 10 min / visitor.
-- Called as: select public.sv_rate_check_for('chat', '<ip>', 20, interval '10 minutes');
create or replace function public.sv_rate_check_for(p_bucket text, p_actor text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.rate_limits where bucket = p_bucket and actor = p_actor and hit_at > now() - p_window;
  if n >= p_max then return false; end if;
  insert into public.rate_limits(bucket, actor) values (p_bucket, p_actor);
  return true;
end $$;
revoke all on function public.sv_rate_check_for(text, text, int, interval) from public, anon, authenticated;
grant execute on function public.sv_rate_check_for(text, text, int, interval) to service_role;
