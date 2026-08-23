alter table public.students add column if not exists photo_path text;
alter table public.profiles add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('face-photos', 'face-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy face_photos_admin_select on storage.objects for select to authenticated using (bucket_id='face-photos' and private.current_app_role()='admin');
create policy face_photos_admin_insert on storage.objects for insert to authenticated with check (bucket_id='face-photos' and private.current_app_role()='admin');
create policy face_photos_admin_update on storage.objects for update to authenticated using (bucket_id='face-photos' and private.current_app_role()='admin') with check (bucket_id='face-photos' and private.current_app_role()='admin');
create policy face_photos_admin_delete on storage.objects for delete to authenticated using (bucket_id='face-photos' and private.current_app_role()='admin');
