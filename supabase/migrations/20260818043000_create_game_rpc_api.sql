create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.lm_normalize_progress(p_progress jsonb, p_is_admin boolean)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_progress jsonb := '{"tutorialCompleted":false,"unlockedPhases":[1],"collectedEvidence":[],"answers":[],"fieldNotes":{},"finalReview":null,"badges":[]}'::jsonb
    || coalesce(p_progress, '{}'::jsonb);
begin
  if p_is_admin then
    v_progress := v_progress || jsonb_build_object(
      'tutorialCompleted', true,
      'notebookIntroduced', true,
      'unlockedPhases', to_jsonb(array(select generate_series(1, 28))),
      'badges', '["primeira-pista","linha-do-tempo","leitura-local","voz-publica","guardia-do-dossie"]'::jsonb
    );
  end if;
  return v_progress;
end;
$$;

create or replace function private.lm_user_json(p_user public.game_users)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p_user.username,
    'username', p_user.username,
    'fullName', p_user.full_name,
    'password', ''
  ) || coalesce(p_user.profile, '{}'::jsonb) || jsonb_build_object(
    'level', coalesce(p_user.profile->>'knowledgeLevel', '3'),
    'age', coalesce(p_user.profile->>'ageGroup', ''),
    'isAdmin', p_user.is_admin,
    'progress', private.lm_normalize_progress(p_user.progress, p_user.is_admin)
  );
$$;

create or replace function private.lm_session_user(p_token text)
returns setof public.game_users
language sql
stable
set search_path = ''
as $$
  select u.*
  from public.game_sessions s
  join public.game_users u on u.id = s.user_id
  where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now()
  limit 1;
$$;

create or replace function public.lm_register(p_user jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := btrim(coalesce(p_user->>'name', p_user->>'username', ''));
  v_full_name text := btrim(coalesce(p_user->>'fullName', v_username));
  v_password text := coalesce(p_user->>'password', '');
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_user public.game_users;
begin
  if char_length(v_username) < 2 or char_length(v_username) > 40 or char_length(v_full_name) < 2 or char_length(v_password) < 4 then
    raise exception using errcode = '22023', message = 'invalid-credential';
  end if;
  if lower(v_username) = 'admin' then
    raise exception using errcode = '23505', message = 'reserved-username';
  end if;

  insert into public.game_users (
    username, full_name, password_salt, password_hash, profile, progress
  ) values (
    v_username,
    v_full_name,
    '',
    extensions.crypt(v_password, extensions.gen_salt('bf', 12)),
    jsonb_build_object(
      'knowledgeLevel', coalesce(p_user->>'knowledgeLevel', p_user->>'level', '3'),
      'ageGroup', coalesce(p_user->>'ageGroup', p_user->>'age', ''),
      'gender', coalesce(p_user->>'gender', ''),
      'location', coalesce(p_user->>'location', ''),
      'occupation', coalesce(p_user->>'occupation', ''),
      'avatar', coalesce(p_user->>'avatar', 'bertha')
    ),
    private.lm_normalize_progress(null, false)
  )
  returning * into v_user;

  insert into public.game_sessions (token_hash, user_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user.id, now() + interval '30 days');

  return jsonb_build_object('user', private.lm_user_json(v_user), 'token', v_token);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'duplicate-user';
end;
$$;

create or replace function public.lm_login(p_name text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_user public.game_users;
begin
  select * into v_user
  from public.game_users
  where username_key = lower(btrim(coalesce(p_name, '')))
  limit 1;

  if v_user.id is null then
    raise exception using errcode = '28000', message = 'missing-user';
  end if;
  if v_user.password_hash <> extensions.crypt(coalesce(p_password, ''), v_user.password_hash) then
    raise exception using errcode = '28000', message = 'bad-password';
  end if;

  delete from public.game_sessions where expires_at <= now();
  insert into public.game_sessions (token_hash, user_id, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user.id, now() + interval '30 days');

  return jsonb_build_object('user', private.lm_user_json(v_user), 'token', v_token);
end;
$$;

create or replace function public.lm_me(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.game_users;
begin
  select * into v_user from private.lm_session_user(p_token);
  if v_user.id is null then
    raise exception using errcode = '28000', message = 'invalid-session';
  end if;
  return jsonb_build_object('user', private.lm_user_json(v_user));
end;
$$;

create or replace function public.lm_save_user(p_token text, p_user jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.game_users;
  v_password text := coalesce(p_user->>'password', '');
begin
  select * into v_user from private.lm_session_user(p_token);
  if v_user.id is null then
    raise exception using errcode = '28000', message = 'invalid-session';
  end if;
  if v_password <> '' and char_length(v_password) < 4 then
    raise exception using errcode = '22023', message = 'invalid-password';
  end if;

  update public.game_users
  set
    full_name = btrim(coalesce(nullif(p_user->>'fullName', ''), full_name)),
    profile = jsonb_build_object(
      'knowledgeLevel', coalesce(p_user->>'knowledgeLevel', p_user->>'level', profile->>'knowledgeLevel', '3'),
      'ageGroup', coalesce(p_user->>'ageGroup', p_user->>'age', profile->>'ageGroup', ''),
      'gender', coalesce(p_user->>'gender', profile->>'gender', ''),
      'location', coalesce(p_user->>'location', profile->>'location', ''),
      'occupation', coalesce(p_user->>'occupation', profile->>'occupation', ''),
      'avatar', coalesce(p_user->>'avatar', profile->>'avatar', 'bertha')
    ),
    progress = private.lm_normalize_progress(coalesce(p_user->'progress', progress), is_admin),
    password_hash = case when v_password = '' then password_hash else extensions.crypt(v_password, extensions.gen_salt('bf', 12)) end,
    password_salt = '',
    updated_at = now()
  where id = v_user.id
  returning * into v_user;

  return jsonb_build_object('user', private.lm_user_json(v_user));
end;
$$;

create or replace function public.lm_save_review(p_token text, p_review jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.game_users;
  v_rating integer := coalesce((p_review->>'rating')::integer, 0);
  v_review jsonb;
begin
  select * into v_user from private.lm_session_user(p_token);
  if v_user.id is null then
    raise exception using errcode = '28000', message = 'invalid-session';
  end if;
  if v_rating < 1 or v_rating > 5 then
    raise exception using errcode = '22023', message = 'invalid-review';
  end if;

  v_review := jsonb_build_object(
    'name', v_user.username,
    'rating', v_rating,
    'mechanics', left(coalesce(p_review->>'mechanics', ''), 4000),
    'immersion', left(coalesce(p_review->>'immersion', ''), 4000),
    'improvements', left(coalesce(p_review->>'improvements', ''), 4000),
    'date', now()
  );

  insert into public.game_reviews (user_id, reviewer_name, rating, mechanics, immersion, improvements)
  values (
    v_user.id,
    v_user.username,
    v_rating,
    v_review->>'mechanics',
    v_review->>'immersion',
    v_review->>'improvements'
  );

  update public.game_users
  set progress = private.lm_normalize_progress(progress, is_admin) || jsonb_build_object('finalReview', v_review),
      updated_at = now()
  where id = v_user.id;

  return jsonb_build_object('success', true, 'review', v_review);
end;
$$;

create or replace function public.lm_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.game_sessions
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.lm_delete_user(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.game_users;
begin
  select * into v_user from private.lm_session_user(p_token);
  if v_user.id is null then
    raise exception using errcode = '28000', message = 'invalid-session';
  end if;
  if v_user.is_admin then
    raise exception using errcode = '42501', message = 'admin-protected';
  end if;
  delete from public.game_users where id = v_user.id;
  return jsonb_build_object('success', true);
end;
$$;

update public.game_users
set password_salt = '',
    password_hash = extensions.crypt('CkFo6eijAljMncAz', extensions.gen_salt('bf', 12)),
    updated_at = now()
where username_key = 'admin';

revoke all on function public.lm_register(jsonb) from public;
revoke all on function public.lm_login(text, text) from public;
revoke all on function public.lm_me(text) from public;
revoke all on function public.lm_save_user(text, jsonb) from public;
revoke all on function public.lm_save_review(text, jsonb) from public;
revoke all on function public.lm_logout(text) from public;
revoke all on function public.lm_delete_user(text) from public;

grant execute on function public.lm_register(jsonb) to anon, authenticated;
grant execute on function public.lm_login(text, text) to anon, authenticated;
grant execute on function public.lm_me(text) to anon, authenticated;
grant execute on function public.lm_save_user(text, jsonb) to anon, authenticated;
grant execute on function public.lm_save_review(text, jsonb) to anon, authenticated;
grant execute on function public.lm_logout(text) to anon, authenticated;
grant execute on function public.lm_delete_user(text) to anon, authenticated;

