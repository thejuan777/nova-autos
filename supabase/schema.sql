-- Ejecutar en el SQL Editor de un proyecto Supabase nuevo.
begin;

create table public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- Sin policies: sólo SQL Editor / backend de confianza puede autorizar administradores.
revoke all on public.admin_users from anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select exists(select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table public.vehicles (
    id uuid primary key default gen_random_uuid(),
    brand text not null check (length(trim(brand)) between 1 and 80),
    model text not null check (length(trim(model)) between 1 and 100),
    version text not null default '' check (length(version) <= 120),
    year integer not null check (year between 1900 and 2100),
    mileage integer check (mileage between 0 and 10000000),
    price numeric(14,2) not null check (price > 0 and price <= 999999999999.99),
    condition text not null check (condition in ('Nuevo', 'Usado')),
    fuel text check (fuel in ('Nafta', 'Diesel', 'Híbrido', 'Eléctrico', 'GNC', 'Otro')),
    transmission text check (transmission in ('Manual', 'Automática')),
    color text not null default '' check (length(color) <= 80),
    doors integer check (doors between 1 and 6),
    engine text not null default '' check (length(engine) <= 100),
    description text not null default '' check (length(description) <= 6000),
    location text not null default '' check (length(location) <= 150),
    status text not null default 'available' check (status in ('available','reserved','sold')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index vehicles_status_created_idx on public.vehicles(status, created_at desc);
create index vehicles_created_idx on public.vehicles(created_at desc, id);
create function public.touch_vehicle() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
create trigger vehicles_updated before update on public.vehicles for each row execute function public.touch_vehicle();

create table public.vehicle_images (
    id uuid primary key default gen_random_uuid(),
    vehicle_id uuid not null references public.vehicles(id) on delete cascade,
    storage_path text not null unique,
    is_primary boolean not null default false,
    position integer not null check (position between 0 and 9),
    created_at timestamptz not null default now(),
    unique (vehicle_id, position),
    check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
    check (split_part(storage_path, '/', 1) = vehicle_id::text)
);
create unique index vehicle_primary_idx on public.vehicle_images(vehicle_id) where is_primary;

-- Cola durable. Storage y PostgreSQL no comparten una transacción.
create table public.storage_cleanup (
    storage_path text primary key check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
    not_before timestamptz not null default now()
);
create function public.queue_deleted_image() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.storage_cleanup(storage_path) values(old.storage_path)
    on conflict(storage_path) do update set not_before = now();
    return old;
end;
$$;
create trigger queue_image_cleanup after delete on public.vehicle_images
for each row execute function public.queue_deleted_image();

alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;
alter table public.storage_cleanup enable row level security;
-- No heredar permisos amplios del proyecto (TRUNCATE no está protegido por RLS).
revoke all on public.vehicles, public.vehicle_images, public.storage_cleanup from anon, authenticated;
grant select on public.vehicles, public.vehicle_images to anon, authenticated;
grant insert, update, delete on public.vehicles, public.vehicle_images to authenticated;
grant select, insert, update, delete on public.storage_cleanup to authenticated;
revoke all on public.storage_cleanup from anon;
create policy "Public reads vehicles" on public.vehicles for select to anon, authenticated using(true);
create policy "Admins insert vehicles" on public.vehicles for insert to authenticated with check((select public.is_admin()));
create policy "Admins update vehicles" on public.vehicles for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy "Admins delete vehicles" on public.vehicles for delete to authenticated using((select public.is_admin()));
create policy "Public reads images" on public.vehicle_images for select to anon, authenticated using(true);
create policy "Admins manage images" on public.vehicle_images for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy "Admins manage cleanup" on public.storage_cleanup for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));

-- Una única transacción publica los datos y las referencias de todas las fotografías.
-- SECURITY INVOKER: también se aplican los permisos y RLS del usuario llamante.
create function public.save_vehicle(payload jsonb, image_paths text[], expected_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
    vehicle_uuid uuid := (payload->>'id')::uuid;
    current_timestamp_value timestamptz;
    image_path text;
begin
    if not public.is_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
    if vehicle_uuid is null or coalesce(cardinality(image_paths),0) not between 1 and 10 then
        raise exception 'Between 1 and 10 images required' using errcode = '22023';
    end if;
    foreach image_path in array image_paths loop
        if image_path is null or split_part(image_path,'/',1) <> vehicle_uuid::text or not exists (
            select 1 from storage.objects where bucket_id = 'vehicle-photos' and name = image_path
        ) then raise exception 'Invalid image reference' using errcode = '22023'; end if;
    end loop;
    select updated_at into current_timestamp_value from public.vehicles where id = vehicle_uuid for update;
    if found then
        if expected_updated_at is null or current_timestamp_value <> expected_updated_at then
            raise exception 'Vehicle changed; reload before editing' using errcode = '40001';
        end if;
        update public.vehicles set
            brand = payload->>'brand', model = payload->>'model', version = coalesce(payload->>'version',''),
            year = (payload->>'year')::integer, mileage = (payload->>'mileage')::integer,
            price = (payload->>'price')::numeric, condition = payload->>'condition', fuel = payload->>'fuel',
            transmission = payload->>'transmission', color = coalesce(payload->>'color',''),
            doors = (payload->>'doors')::integer, engine = coalesce(payload->>'engine',''),
            description = coalesce(payload->>'description',''), location = coalesce(payload->>'location',''),
            status = payload->>'status'
        where id = vehicle_uuid;
    else
        if expected_updated_at is not null then raise exception 'Vehicle deleted' using errcode = '40001'; end if;
        insert into public.vehicles(id,brand,model,version,year,mileage,price,condition,fuel,transmission,color,doors,engine,description,location,status)
        values(vehicle_uuid,payload->>'brand',payload->>'model',coalesce(payload->>'version',''),
            (payload->>'year')::integer,(payload->>'mileage')::integer,(payload->>'price')::numeric,
            payload->>'condition',payload->>'fuel',payload->>'transmission',coalesce(payload->>'color',''),
            (payload->>'doors')::integer,coalesce(payload->>'engine',''),coalesce(payload->>'description',''),
            coalesce(payload->>'location',''),payload->>'status');
    end if;
    delete from public.vehicle_images where vehicle_id = vehicle_uuid;
    insert into public.vehicle_images(vehicle_id,storage_path,is_primary,position)
        select vehicle_uuid, path, ordinality = 1, (ordinality - 1)::integer
        from unnest(image_paths) with ordinality as images(path,ordinality);
    delete from public.storage_cleanup where storage_path = any(image_paths);
    return vehicle_uuid;
end;
$$;
revoke all on function public.save_vehicle(jsonb,text[],timestamptz) from public, anon;
grant execute on function public.save_vehicle(jsonb,text[],timestamptz) to authenticated;
revoke all on function public.touch_vehicle(), public.queue_deleted_image() from public, anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vehicle-photos','vehicle-photos',true,5242880,array['image/jpeg','image/png','image/webp']);
-- El bucket contiene sólo fotos públicas, nunca documentación personal.
create policy "Admins list vehicle files" on storage.objects for select to authenticated
using(bucket_id = 'vehicle-photos' and (select public.is_admin()));
create policy "Admins upload vehicle files" on storage.objects for insert to authenticated
with check(bucket_id = 'vehicle-photos' and (select public.is_admin())
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
create policy "Admins delete unused vehicle files" on storage.objects for delete to authenticated
using(bucket_id = 'vehicle-photos' and (select public.is_admin())
    and not exists(select 1 from public.vehicle_images where storage_path = name));
commit;
