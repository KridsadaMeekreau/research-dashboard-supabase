import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../lib/supabase-admin";

const QUESTION_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"] as const;

type QuestionKey = (typeof QUESTION_KEYS)[number];

function normalizeUserId(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function readScore(value: unknown) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return null;
  }
  return score;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }

  const userId = normalizeUserId(body.user_id);

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "กรุณากรอกชื่อหรือรหัสผู้ประเมิน" },
      { status: 400 },
    );
  }

  const payload: Record<QuestionKey | "user_id", number | string> = {
    user_id: userId,
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    q5: 0,
    q6: 0,
    q7: 0,
    q8: 0,
  };

  for (const key of QUESTION_KEYS) {
    const score = readScore(body[key]);
    if (score === null) {
      return NextResponse.json(
        { ok: false, error: `คะแนน ${key} ต้องเป็นเลข 1-5` },
        { status: 400 },
      );
    }
    payload[key] = score;
  }

  try {
    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from("satisfaction_surveys")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "บันทึกแบบประเมินเรียบร้อย",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
