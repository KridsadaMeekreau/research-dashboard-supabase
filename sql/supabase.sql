-- Run this file in Supabase SQL Editor.
-- ตารางหลักตามโครงสร้างที่ระบุ และเพิ่ม unique index ที่ user_id เพื่อแยก/อัปเดตผลประเมินรายคน

create extension if not exists pgcrypto;

create table if not exists public.satisfaction_surveys (
  id uuid not null default gen_random_uuid(),
  user_id text null,
  q1 smallint null,
  q2 smallint null,
  q3 smallint null,
  q4 smallint null,
  q5 smallint null,
  q6 smallint null,
  q7 smallint null,
  q8 smallint null,
  created_at timestamp with time zone not null default now(),
  constraint satisfaction_surveys_pkey primary key (id)
);

-- ถ้ามีข้อมูลเก่าและ user_id ซ้ำกัน ให้เคลียร์ข้อมูลซ้ำก่อนรันบรรทัดนี้
create unique index if not exists satisfaction_surveys_user_id_unique
  on public.satisfaction_surveys (user_id);

alter table public.satisfaction_surveys enable row level security;

-- โค้ดตัวอย่างนี้บันทึกผ่าน Next.js API Route ด้วย server-side secret/service key
-- จึงไม่จำเป็นต้องเปิด public insert policy ให้ browser เขียน table โดยตรง
