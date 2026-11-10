-- =============================================================================
-- Fase 3 · Storage (sección 6.4 de SPEC.md)
--
-- Bucket PRIVADO `temarios` para los apuntes. Cada usuario solo accede a su
-- carpeta: {user_id}/{evaluacion_id o modulo-<id>}/{id}-{nombre}
-- Máximo 20 MB por archivo; PDF y fotos (JPG, PNG, WebP).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('temarios', 'temarios', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "temarios_select_mi_carpeta" on storage.objects
  for select to authenticated
  using (bucket_id = 'temarios' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "temarios_insert_mi_carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'temarios' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "temarios_update_mi_carpeta" on storage.objects
  for update to authenticated
  using (bucket_id = 'temarios' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'temarios' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "temarios_delete_mi_carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'temarios' and (storage.foldername(name))[1] = (select auth.uid())::text);
