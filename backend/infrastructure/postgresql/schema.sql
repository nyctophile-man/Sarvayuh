create extension if not exists vector;

create table if not exists users(id text primary key, name text not null, email text unique not null, pass_hash text not null, role text not null, created_at timestamptz default now());
create table if not exists profiles(user_id text primary key references users(id), dob text, gender text, phone text, blood text, allergies text, conditions text, photo text, photo_mime text, emergency_name text, emergency_phone text);
alter table profiles add column if not exists conditions text;
alter table profiles add column if not exists photo text;
alter table profiles add column if not exists photo_mime text;
create table if not exists medcards(card_id text primary key, user_id text unique references users(id), locked boolean default false);
create table if not exists records(id text primary key, user_id text references users(id), title text, category text, mime text, size int, file_key text, created_at timestamptz default now());
create table if not exists record_embeddings(
  record_id text primary key references records(id) on delete cascade,
  embedding vector(1536) not null,
  content text,
  created_at timestamptz default now()
);
create index if not exists record_embeddings_embedding_idx
  on record_embeddings using hnsw (embedding vector_cosine_ops);
create table if not exists shares(id text primary key, owner_id text references users(id), recipient_id text, token text, record_ids jsonb, expires_at timestamptz, revoked boolean default false, created_at timestamptz default now());
create table if not exists prescriptions(id text primary key, doctor_id text, patient_id text, items jsonb, notes text, status text default 'active', created_at timestamptz default now());
create table if not exists orders(id text primary key, patient_id text, prescription_id text, items jsonb, payment text, status text, approved_by text, created_at timestamptz default now());
create table if not exists feedback(id text primary key, user_id text references users(id), rating int, category text, message text, email text, platform text, created_at timestamptz default now());
create table if not exists audit_logs(id bigserial primary key, actor_id text, action text, target text, at timestamptz default now());
create table if not exists doctor_appointments(
  id text primary key,
  doctor_id text not null references users(id) on delete cascade,
  patient_id text not null references users(id) on delete cascade,
  appointment_date date not null,
  minutes smallint not null check (minutes between 0 and 1439),
  appointment_type text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed')),
  created_at timestamptz not null default now(),
  unique (doctor_id, appointment_date, minutes)
);
create index if not exists doctor_appointments_doctor_date_idx
  on doctor_appointments(doctor_id, appointment_date, minutes);
create table if not exists doctor_inbox_events(
  id text primary key,
  doctor_id text not null references users(id) on delete cascade,
  patient_id text not null references users(id) on delete cascade,
  event_type text not null,
  message text not null,
  reference_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists doctor_inbox_events_doctor_created_idx
  on doctor_inbox_events(doctor_id, created_at desc);
insert into doctor_inbox_events(id,doctor_id,patient_id,event_type,message,reference_id,created_at)
select 'share:' || s.id,s.recipient_id,s.owner_id,'records_shared',
  'Shared ' || jsonb_array_length(s.record_ids) || ' health record' ||
    case when jsonb_array_length(s.record_ids)=1 then '' else 's' end,
  s.id,s.created_at
from shares s
join users d on d.id=s.recipient_id and d.role='doctor'
where s.recipient_id is not null and jsonb_typeof(s.record_ids)='array'
on conflict (id) do nothing;
