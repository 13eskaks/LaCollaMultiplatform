-- =====================================================================
-- 040: les referències a usuaris (profiles / auth.users) no tenien regla
-- ON DELETE, i esborrar un compte fallava (p. ex. si havia escrit al fòrum).
-- Columnes opcionals → SET NULL (el contingut es queda, sense autor).
-- Columnes obligatòries → CASCADE.
-- =====================================================================
do $$
declare
  r record;
  action text;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl, a.attname as col, a.attnotnull as notnull,
           c.confrelid::regclass as reftbl, ra.attname as refcol
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]
    where c.contype = 'f'
      and array_length(c.conkey, 1) = 1
      and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and c.confdeltype = 'a'
  loop
    action := case when r.notnull then 'cascade' else 'set null' end;
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references %s(%I) on delete %s',
                   r.tbl, r.conname, r.col, r.reftbl, r.refcol, action);
  end loop;
end $$;
