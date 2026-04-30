-- =====================================================
-- LACOLLA · STORAGE POLICIES per a colla-fotos
-- Path: {colla_id}/{album_id}/{filename}
-- =====================================================

insert into storage.buckets (id, name, public)
values ('colla-fotos', 'colla-fotos', true)
on conflict (id) do update set public = true;

-- INSERT: membres actius (o només comissió, segons config)
create policy "colla_fotos_insert" on storage.objects for insert
  with check (
    bucket_id = 'colla-fotos'
    and auth.uid() is not null
    and (
      is_comissio((storage.foldername(name))[1]::uuid)
      or is_superadmin()
      or (
        is_membre_actiu((storage.foldername(name))[1]::uuid)
        and (
          select qui_pot_pujar_fotos
          from colla_config
          where colla_id = (storage.foldername(name))[1]::uuid
        ) = 'membres'
      )
    )
  );

-- UPDATE: comissió o superadmin
create policy "colla_fotos_update" on storage.objects for update
  using (
    bucket_id = 'colla-fotos'
    and (is_comissio((storage.foldername(name))[1]::uuid) or is_superadmin())
  );

-- DELETE: comissió o superadmin (la taula fotos ja controla qui va pujar cada foto)
create policy "colla_fotos_delete" on storage.objects for delete
  using (
    bucket_id = 'colla-fotos'
    and (is_comissio((storage.foldername(name))[1]::uuid) or is_superadmin())
  );
