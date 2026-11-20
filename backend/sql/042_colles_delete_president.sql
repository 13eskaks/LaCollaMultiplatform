-- 042: el president (o un superadmin) pot esborrar la seua colla.
-- No hi havia cap política DELETE a colles.
drop policy if exists "colles_delete" on colles;
create policy "colles_delete" on colles for delete using (
  is_superadmin() or exists (
    select 1 from colla_membres m
    where m.colla_id = colles.id and m.user_id = auth.uid() and m.estat = 'actiu' and m.rol = 'president'
  )
);
