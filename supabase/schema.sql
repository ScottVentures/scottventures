-- =====================================================================
-- ScottVentures — Supabase schema (Postgres + Row Level Security)
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query.
-- It is safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
-- Only the *publishable (anon)* key ever goes in the website. Everything
-- below is protected by RLS, so that key can only do what these policies allow.
-- =====================================================================

-- ---------- Admins ----------
-- Anyone whose login email is in this table is a site admin (contact inbox,
-- user management, forum pinning/moderation). Nobody can read/write it via the API.
-- Edit the emails below BEFORE running, or add more rows later:
--   insert into public.admin_emails (email) values ('someone@example.com');
create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;
insert into public.admin_emails (email) values
  ('johnniekips@gmail.com'), ('scottechstar@gmail.com')
on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_emails a where a.email = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

-- ---------- Profiles (one row per auth user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  avatar_url text,
  notify_login    boolean not null default true,
  notify_replies  boolean not null default true,
  notify_messages boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles readable by members" on public.profiles;
create policy "profiles readable by members" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id,
          left(coalesce(new.raw_user_meta_data ->> 'first_name',''), 60),
          left(coalesce(new.raw_user_meta_data ->> 'last_name',''), 60))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Article reactions (anonymous, one vote per browser id) ----------
create table if not exists public.article_reactions (
  article_id text primary key, likes int not null default 0, dislikes int not null default 0);
create table if not exists public.reaction_votes (
  article_id text not null, voter_id text not null,
  vote_type text not null check (vote_type in ('like','dislike')),
  primary key (article_id, voter_id));
alter table public.article_reactions enable row level security;
alter table public.reaction_votes enable row level security;

create or replace function public.get_reactions(p_article text, p_voter text default null) returns json
language plpgsql security definer set search_path = public as $$
declare r record; v text;
begin
  if p_article !~ '^[a-z0-9-]{1,80}$' then raise exception 'Invalid article id'; end if;
  select likes, dislikes into r from article_reactions where article_id = p_article;
  if p_voter is not null then select vote_type into v from reaction_votes where article_id = p_article and voter_id = p_voter; end if;
  return json_build_object('likes', coalesce(r.likes,0), 'dislikes', coalesce(r.dislikes,0), 'yourVote', v);
end $$;

create or replace function public.react(p_article text, p_voter text, p_vote text) returns json
language plpgsql security definer set search_path = public as $$
declare existing text; r record; state text;
begin
  if p_article !~ '^[a-z0-9-]{1,80}$' then raise exception 'Invalid article id'; end if;
  if p_voter is null or length(p_voter) < 8 or length(p_voter) > 100 then raise exception 'Invalid voterId'; end if;
  if p_vote not in ('like','dislike') then raise exception 'vote must be like or dislike'; end if;
  insert into article_reactions (article_id) values (p_article) on conflict do nothing;
  select vote_type into existing from reaction_votes where article_id = p_article and voter_id = p_voter;
  if existing = p_vote then
    delete from reaction_votes where article_id = p_article and voter_id = p_voter;
    if p_vote = 'like' then update article_reactions set likes = greatest(likes-1,0) where article_id = p_article;
    else update article_reactions set dislikes = greatest(dislikes-1,0) where article_id = p_article; end if;
    state := null;
  elsif existing is not null then
    update reaction_votes set vote_type = p_vote where article_id = p_article and voter_id = p_voter;
    if p_vote = 'like' then update article_reactions set likes = likes+1, dislikes = greatest(dislikes-1,0) where article_id = p_article;
    else update article_reactions set dislikes = dislikes+1, likes = greatest(likes-1,0) where article_id = p_article; end if;
    state := p_vote;
  else
    insert into reaction_votes values (p_article, p_voter, p_vote);
    if p_vote = 'like' then update article_reactions set likes = likes+1 where article_id = p_article;
    else update article_reactions set dislikes = dislikes+1 where article_id = p_article; end if;
    state := p_vote;
  end if;
  select likes, dislikes into r from article_reactions where article_id = p_article;
  return json_build_object('likes', r.likes, 'dislikes', r.dislikes, 'yourVote', state);
end $$;

-- ---------- Notifications ----------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, message text not null, link text,
  read_at timestamptz, created_at timestamptz not null default now());
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify_login() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from profiles where id = auth.uid() and notify_login) then
    insert into notifications (user_id, type, message)
    values (auth.uid(), 'login', 'New login to your account on ' || to_char(now() at time zone 'utc','YYYY-MM-DD HH24:MI') || ' UTC');
  end if;
end $$;

-- ---------- Comments (articles, tutorials, materials and forum threads) ----------
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  article_id text not null check (article_id ~ '^[a-z0-9-]{1,80}$'),
  user_id uuid references auth.users(id) on delete set null,
  name text not null, message text not null check (char_length(message) between 1 and 4000),
  parent_id bigint references public.comments(id) on delete cascade,
  is_owner boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists idx_comments_article on public.comments (article_id, created_at);
alter table public.comments enable row level security;
drop policy if exists "comments readable" on public.comments;
create policy "comments readable" on public.comments for select to anon, authenticated using (true);
drop policy if exists "comments admin delete" on public.comments;
create policy "comments admin delete" on public.comments for delete to authenticated using (public.is_admin() or user_id = auth.uid());

-- ---------- Forum ----------
create table if not exists public.forum_posts (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 150),
  body text not null check (char_length(body) between 1 and 5000),
  category text not null default 'general' check (category in ('general','help','showcase','career')),
  author_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  pinned boolean not null default false, views int not null default 0,
  created_at timestamptz not null default now());
create table if not exists public.forum_votes (
  post_id bigint not null references public.forum_posts(id) on delete cascade,
  voter_id text not null, vote text not null check (vote in ('up','down')),
  primary key (post_id, voter_id));
create table if not exists public.forum_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id bigint not null references public.forum_posts(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, post_id));
alter table public.forum_posts enable row level security;
alter table public.forum_votes enable row level security;
alter table public.forum_bookmarks enable row level security;
drop policy if exists "forum posts readable" on public.forum_posts;
create policy "forum posts readable" on public.forum_posts for select to anon, authenticated using (true);
drop policy if exists "forum posts edit own" on public.forum_posts;
create policy "forum posts edit own" on public.forum_posts for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
revoke update on public.forum_posts from authenticated;
grant update (title, body, category) on public.forum_posts to authenticated;
drop policy if exists "forum posts delete own" on public.forum_posts;
create policy "forum posts delete own" on public.forum_posts for delete to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "bookmarks own" on public.forum_bookmarks;
create policy "bookmarks own" on public.forum_bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.forum_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin delete from comments where article_id = 'forum-' || old.id; return old; end $$;
drop trigger if exists forum_post_deleted on public.forum_posts;
create trigger forum_post_deleted after delete on public.forum_posts for each row execute function public.forum_cleanup();

-- post row + vote counts + comment count (+ this browser's vote)
create or replace function public.forum_feed(p_voter text default null)
returns table (id bigint, title text, body text, category text, author_name text, user_id uuid,
  created_at timestamptz, pinned boolean, views int, ups int, downs int, comment_count int, your_vote text)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.body, p.category, p.author_name, p.user_id, p.created_at, p.pinned, p.views,
    (select count(*)::int from forum_votes v where v.post_id = p.id and v.vote = 'up'),
    (select count(*)::int from forum_votes v where v.post_id = p.id and v.vote = 'down'),
    (select count(*)::int from comments c where c.article_id = 'forum-' || p.id),
    (select v.vote from forum_votes v where v.post_id = p.id and v.voter_id = p_voter)
  from forum_posts p;
$$;

create or replace function public.forum_get_post(p_id bigint, p_voter text default null, p_count_view boolean default true)
returns table (id bigint, title text, body text, category text, author_name text, user_id uuid,
  created_at timestamptz, pinned boolean, views int, ups int, downs int, comment_count int, your_vote text)
language plpgsql security definer set search_path = public as $$
begin
  if p_count_view then update forum_posts set views = forum_posts.views + 1 where forum_posts.id = p_id; end if;
  return query select * from public.forum_feed(p_voter) f where f.id = p_id;
end $$;

create or replace function public.create_forum_post(p_name text, p_title text, p_body text, p_category text)
returns bigint language plpgsql security definer set search_path = public as $$
declare author text; new_id bigint; cat text;
begin
  if char_length(trim(coalesce(p_title,''))) not between 3 and 150 then raise exception 'Title must be 3-150 characters.'; end if;
  if char_length(trim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Post body must be 1-5000 characters.'; end if;
  cat := case when p_category in ('general','help','showcase','career') then p_category else 'general' end;
  if auth.uid() is not null then
    select trim(first_name || ' ' || last_name) into author from profiles where id = auth.uid();
  else
    author := trim(coalesce(p_name,''));
    if char_length(author) not between 1 and 60 then raise exception 'Name must be 1-60 characters.'; end if;
  end if;
  insert into forum_posts (title, body, category, author_name, user_id)
  values (trim(p_title), trim(p_body), cat, coalesce(nullif(author,''),'Member'), auth.uid()) returning forum_posts.id into new_id;
  return new_id;
end $$;

create or replace function public.forum_vote(p_post bigint, p_voter text, p_vote text) returns void
language plpgsql security definer set search_path = public as $$
declare existing text;
begin
  if p_voter is null or length(p_voter) < 8 or length(p_voter) > 100 then raise exception 'Invalid voterId.'; end if;
  if p_vote not in ('up','down') then raise exception 'Vote must be up or down.'; end if;
  if not exists (select 1 from forum_posts where id = p_post) then raise exception 'Post not found.'; end if;
  select vote into existing from forum_votes where post_id = p_post and voter_id = p_voter;
  if existing = p_vote then delete from forum_votes where post_id = p_post and voter_id = p_voter;
  elsif existing is not null then update forum_votes set vote = p_vote where post_id = p_post and voter_id = p_voter;
  else insert into forum_votes values (p_post, p_voter, p_vote); end if;
end $$;

create or replace function public.forum_toggle_pin(p_post bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare s boolean;
begin
  if not public.is_admin() then raise exception 'Admin account required.'; end if;
  update forum_posts set pinned = not pinned where id = p_post returning pinned into s;
  return s;
end $$;

-- add_comment: used by every comment form. Name/admin badge come from the signed-in account.
create or replace function public.add_comment(p_article text, p_name text, p_message text, p_parent bigint default null)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); final_name text; owner boolean := false; parent_row record; new_row comments;
        post_row record; post_id bigint;
begin
  if p_article !~ '^[a-z0-9-]{1,80}$' then raise exception 'Invalid article id'; end if;
  if char_length(trim(coalesce(p_message,''))) not between 1 and 4000 then raise exception 'Comment must be 1-1000 characters'; end if;
  if uid is not null then
    select trim(first_name || ' ' || last_name) into final_name from profiles where id = uid;
    owner := public.is_admin();
  else
    final_name := trim(coalesce(p_name,''));
    if char_length(final_name) not between 1 and 120 then raise exception 'Name must be 1-60 characters'; end if;
  end if;
  if p_parent is not null then
    select id, parent_id into parent_row from comments where id = p_parent and article_id = p_article;
    if not found then raise exception 'Parent comment not found'; end if;
    if parent_row.parent_id is not null then raise exception 'Cannot reply to a reply'; end if;
  end if;
  insert into comments (article_id, user_id, name, message, parent_id, is_owner)
  values (p_article, uid, coalesce(nullif(final_name,''),'Member'), trim(p_message), p_parent, owner) returning * into new_row;

  if p_article like 'forum-%' and not owner then
    begin
      post_id := substring(p_article from 7)::bigint;
      select user_id, title into post_row from forum_posts where id = post_id;
      if post_row.user_id is not null and post_row.user_id is distinct from uid
         and exists (select 1 from profiles where id = post_row.user_id and notify_replies) then
        insert into notifications (user_id, type, message, link)
        values (post_row.user_id, 'reply', new_row.name || ' replied to your post "' || post_row.title || '"', '../forum-post.html?id=' || post_id);
      end if;
    exception when others then null;
    end;
  end if;
  return json_build_object('id', new_row.id, 'name', new_row.name, 'message', new_row.message,
    'created_at', new_row.created_at, 'parent_id', new_row.parent_id, 'is_owner', new_row.is_owner);
end $$;

-- ---------- Newsletter ----------
create table if not exists public.subscribers (
  id bigint generated always as identity primary key,
  email text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 254),
  created_at timestamptz not null default now());
create unique index if not exists subscribers_email_key on public.subscribers (lower(email));
alter table public.subscribers enable row level security;
drop policy if exists "anyone can subscribe" on public.subscribers;
create policy "anyone can subscribe" on public.subscribers for insert to anon, authenticated with check (true);
drop policy if exists "admins read subscribers" on public.subscribers;
create policy "admins read subscribers" on public.subscribers for select to authenticated using (public.is_admin());

-- ---------- Contact form ----------
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) <= 100), phone text not null check (char_length(phone) <= 50),
  email text not null check (char_length(email) <= 254), subject text not null check (char_length(subject) <= 150),
  message text not null check (char_length(message) <= 5000),
  created_at timestamptz not null default now(),
  replied_at timestamptz, reply_body text, replied_by text);
alter table public.contact_messages enable row level security;
drop policy if exists "anyone can contact" on public.contact_messages;
create policy "anyone can contact" on public.contact_messages for insert to anon, authenticated
  with check (char_length(trim(name)) > 0 and char_length(trim(message)) > 0 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
drop policy if exists "admins read contact" on public.contact_messages;
create policy "admins read contact" on public.contact_messages for select to authenticated using (public.is_admin());
drop policy if exists "admins update contact" on public.contact_messages;
create policy "admins update contact" on public.contact_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete contact" on public.contact_messages;
create policy "admins delete contact" on public.contact_messages for delete to authenticated using (public.is_admin());
revoke update on public.contact_messages from authenticated;
grant update (replied_at, reply_body, replied_by) on public.contact_messages to authenticated;

create or replace function public.contact_notify_admins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, type, message, link)
  select u.id, 'contact', 'New contact message from ' || new.name || ': "' || new.subject || '"', '../contact-inbox.html'
  from auth.users u join admin_emails a on a.email = lower(u.email);
  return new;
end $$;
drop trigger if exists contact_after_insert on public.contact_messages;
create trigger contact_after_insert after insert on public.contact_messages for each row execute function public.contact_notify_admins();

-- ---------- Direct messages ----------
create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  created_at timestamptz not null default now(), read_at timestamptz,
  attachment_url text, attachment_name text, attachment_type text,
  check (sender_id <> recipient_id), check (body <> '' or attachment_url is not null));
create index if not exists idx_dm_sender on public.direct_messages (sender_id, created_at);
create index if not exists idx_dm_recipient on public.direct_messages (recipient_id, created_at);
create table if not exists public.message_reactions (
  message_id bigint not null references public.direct_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8), primary key (message_id, user_id));
alter table public.direct_messages enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "dm select participants" on public.direct_messages;
create policy "dm select participants" on public.direct_messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "dm insert as sender" on public.direct_messages;
create policy "dm insert as sender" on public.direct_messages for insert to authenticated with check (sender_id = auth.uid());
drop policy if exists "dm mark read" on public.direct_messages;
create policy "dm mark read" on public.direct_messages for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
revoke update on public.direct_messages from authenticated;
grant update (read_at) on public.direct_messages to authenticated;

create or replace function public.is_dm_participant(p_msg bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from direct_messages m where m.id = p_msg and (m.sender_id = auth.uid() or m.recipient_id = auth.uid()));
$$;
drop policy if exists "mr select" on public.message_reactions;
create policy "mr select" on public.message_reactions for select to authenticated using (public.is_dm_participant(message_id));
drop policy if exists "mr insert" on public.message_reactions;
create policy "mr insert" on public.message_reactions for insert to authenticated with check (user_id = auth.uid() and public.is_dm_participant(message_id));
drop policy if exists "mr update" on public.message_reactions;
create policy "mr update" on public.message_reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_dm_participant(message_id));
drop policy if exists "mr delete" on public.message_reactions;
create policy "mr delete" on public.message_reactions for delete to authenticated using (user_id = auth.uid());

create or replace function public.dm_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare sender_name text;
begin
  if exists (select 1 from profiles where id = new.recipient_id and notify_messages) then
    select trim(first_name || ' ' || last_name) into sender_name from profiles where id = new.sender_id;
    insert into notifications (user_id, type, message, link)
    values (new.recipient_id, 'message', coalesce(nullif(sender_name,''),'Someone') || ' sent you a message', '../Account/messages.html?with=' || new.sender_id);
  end if;
  return new;
end $$;
drop trigger if exists dm_after_insert on public.direct_messages;
create trigger dm_after_insert after insert on public.direct_messages for each row execute function public.dm_notify();

-- ---------- Account / admin helpers ----------
create or replace function public.admin_list_users()
returns table (id uuid, first_name text, last_name text, email text, created_at timestamptz, is_admin boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin account required.'; end if;
  return query select u.id, p.first_name, p.last_name, u.email::text, u.created_at,
    exists (select 1 from admin_emails a where a.email = lower(u.email))
    from auth.users u left join profiles p on p.id = u.id order by u.created_at desc;
end $$;

create or replace function public.admin_delete_user(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin account required.'; end if;
  if p_id = auth.uid() then raise exception 'You can''t delete your own account from here.'; end if;
  delete from auth.users where id = p_id;
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not logged in.'; end if;
  if public.is_admin() then raise exception 'Admin accounts can''t be self-deleted here.'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Lock the helper functions down: signed-out visitors may only call the public-facing ones.
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.forum_toggle_pin(bigint) from public, anon;
revoke execute on function public.notify_login() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.forum_toggle_pin(bigint) to authenticated;
grant execute on function public.notify_login() to authenticated;
grant execute on function public.is_admin(), public.get_reactions(text,text), public.react(text,text,text),
  public.forum_feed(text), public.forum_get_post(bigint,text,boolean), public.create_forum_post(text,text,text,text),
  public.forum_vote(bigint,text,text), public.add_comment(text,text,text,bigint) to anon, authenticated;

-- ---------- Storage (profile pictures + message attachments) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars','avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('message-attachments','message-attachments', true, 8388608,
    array['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain','application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars write own folder" on storage.objects;
create policy "avatars write own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments public read" on storage.objects;
create policy "attachments public read" on storage.objects for select using (bucket_id = 'message-attachments');
drop policy if exists "attachments write own folder" on storage.objects;
create policy "attachments write own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
