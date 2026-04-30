-- Allow the creator (any member) or comissió to update a votació.
-- Without this, the second UPDATE that saves descripcio_blocks fails silently
-- for non-comissió members because there was no UPDATE policy at all.
drop policy if exists "votacions_update" on votacions;
create policy "votacions_update" on votacions
  for update using (
    creador_id = auth.uid() or is_comissio(colla_id) or is_superadmin()
  );
