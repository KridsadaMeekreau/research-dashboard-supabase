import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const QUESTION_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"] as const;

type QuestionKey = (typeof QUESTION_KEYS)[number];

type SurveyRow = {
  id: string;
  user_id: string | null;
  created_at: string;
} & Record<QuestionKey, number | null>;

function isAuthorized(request: Request) {
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken) {
    return false;
  }

  const token = request.headers.get("x-admin-token") ?? "";
  return token === expectedToken;
}

function average(rows: SurveyRow[], key: QuestionKey) {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
  return Math.round((total / rows.length) * 100) / 100;
}

export async function GET(request: Request) {
  if (!process.env.ADMIN_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้ง ADMIN_TOKEN บน Server" },
      { status: 500 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Admin token ไม่ถูกต้อง" },
      { status: 401 },
    );
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("satisfaction_surveys")
      .select("id,user_id,q1,q2,q3,q4,q5,q6,q7,q8,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as SurveyRow[];
    const averages = Object.fromEntries(
      QUESTION_KEYS.map((key) => [key, average(rows, key)]),
    );

    return NextResponse.json({
      ok: true,
      total: rows.length,
      averages,
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
