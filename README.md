# Research Dashboard + Supabase Survey

WebApp สำหรับอัปโหลด Excel, ทำความสะอาดข้อความ, สร้าง Dashboard 4 มุมมอง และบันทึกแบบประเมินความพึงพอใจ 8 ข้อลง Supabase โดยแยกผลประเมินตามรายคนผ่าน `user_id`.

## สิ่งที่ระบบทำได้

1. อัปโหลดไฟล์ Excel `.xlsx` หรือ `.xls`
2. อ่าน Sheet แรกของไฟล์
3. Clean ชื่อคอลัมน์และข้อความในเซลล์ด้วยการ Trim ช่องว่าง, tab, newline
4. แปลงงบประมาณเป็นตัวเลข
5. แยกคำสำคัญจาก `คำสำคัญ` และ `Keyword`
6. สร้าง Dashboard 4 มุมมอง
   - Overview
   - Faculty Analysis
   - Fund Analysis
   - Keyword Analysis
7. บันทึกแบบประเมิน 8 ข้อลง Supabase
8. แสดงผลแบบประเมินรายคนสำหรับ Admin ด้วย `ADMIN_TOKEN`

## โครงสร้างไฟล์สำคัญ

```text
app/page.tsx                    หน้า Dashboard + Survey
app/api/survey/route.ts          API บันทึกแบบประเมินลง Supabase
app/api/survey-results/route.ts  API อ่านผลประเมินสำหรับ Admin
lib/supabase-admin.ts            Supabase server-side client
sql/supabase.sql                 SQL สำหรับสร้าง/ปรับตาราง
.env.example                     ตัวอย่าง environment variables
```

## 1) เตรียม Supabase

> ถ้าคุณเคยวางรหัสผ่านฐานข้อมูลไว้ในแชทหรือเอกสารสาธารณะ ควรเปลี่ยนรหัสผ่าน/หมุน secret ใหม่ทันที และอย่าใส่รหัสผ่านฐานข้อมูลลงใน Frontend หรือ GitHub

1. เข้า Supabase Dashboard
2. เปิด Project ของคุณ
3. ไปที่ SQL Editor
4. วางและรันไฟล์ `sql/supabase.sql`
5. ไปที่ Settings > API Keys
6. คัดลอก
   - Project URL
   - service_role key หรือ secret key สำหรับฝั่ง server เท่านั้น

## 2) ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` ที่ root project โดยดูตัวอย่างจาก `.env.example`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-side-secret-or-service-role-key
ADMIN_TOKEN=ตั้งรหัสแอดมินเองเช่น dashboard-admin-2026
```

สำคัญ:
- `NEXT_PUBLIC_SUPABASE_URL` เปิดเผยได้
- `SUPABASE_SERVICE_ROLE_KEY` ห้ามเปิดเผย และห้ามใส่ prefix `NEXT_PUBLIC_`
- `ADMIN_TOKEN` ใช้สำหรับเปิดดูผลประเมินรายคนในหน้า Admin panel

## 3) รันบนเครื่องตัวเอง

```bash
npm install
npm run dev
```

เปิดเว็บที่ `http://localhost:3000`

## 4) Deploy ขึ้น Vercel

1. Push project นี้ขึ้น GitHub
2. เข้า vercel.com
3. กด Add New Project
4. เลือก GitHub repository นี้
5. ในหน้า Environment Variables ใส่
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_TOKEN`
6. กด Deploy

## 5) วิธีใช้หน้าเว็บ

1. เปิด URL ที่ Deploy แล้ว
2. อัปโหลด Excel ที่มี 16 คอลัมน์ตามโจทย์
3. ใช้ Dropdown Filter เลือกคณะหรือประเภทแหล่งทุน
4. กด Reset เพื่อกลับภาพรวมทั้งหมด
5. ให้ผู้ประเมินกรอกชื่อ/รหัสผู้ประเมินและให้คะแนน 1-5 ทั้ง 8 ข้อ
6. Admin กรอก `ADMIN_TOKEN` แล้วกดโหลดผลประเมินเพื่อดูคะแนนรายคนและค่าเฉลี่ย

## หมายเหตุด้านข้อมูล

- ระบบถือว่า `ประเภทงบประมาณ` คือ “ประเภทแหล่งทุน”
- ระบบถือว่า `สังกัด` คือ “คณะ”
- ถ้าผู้ประเมินใช้ `user_id` เดิม ระบบจะ upsert หรืออัปเดตคะแนนเดิมของคนนั้น เพื่อไม่ให้มีคะแนนซ้ำหลายรอบ
- ถ้าต้องการให้คนเดิมตอบได้หลายครั้ง ให้ลบ unique index `satisfaction_surveys_user_id_unique` และเปลี่ยน API จาก `.upsert()` เป็น `.insert()`
