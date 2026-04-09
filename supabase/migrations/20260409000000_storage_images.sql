-- Add image_url to locations (resources already has it)
alter table public.locations add column if not exists image_url text;

-- Create a public bucket for tenant images (resources, locations)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images',
  'images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- Anyone can read images (bucket is public)
create policy "Public read access"
  on storage.objects for select
  using (bucket_id = 'images');

-- Authenticated tenant owners can upload images scoped to their tenant_id prefix
create policy "Tenant owner can upload images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (
      select id::text from public.tenants where user_id = auth.uid() limit 1
    )
  );

-- Tenant owner can update their own images
create policy "Tenant owner can update images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (
      select id::text from public.tenants where user_id = auth.uid() limit 1
    )
  );

-- Tenant owner can delete their own images
create policy "Tenant owner can delete images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (
      select id::text from public.tenants where user_id = auth.uid() limit 1
    )
  );
