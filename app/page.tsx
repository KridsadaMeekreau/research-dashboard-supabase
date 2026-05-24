"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ProjectRow = {
  order: number;
  contractNo: string;
  year: string;
  status: string;
  projectType: string;
  title: string;
  fundDetail: string;
  fundType: string;
  academicPosition: string;
  firstName: string;
  lastName: string;
  faculty: string;
  budget: number;
  thaiKeywords: string[];
  englishKeywords: string[];
  coResearchers: string;
};

type ChartDatum = {
  name: string;
  count: number;
  budget: number;
  budgetMillion: number;
};

type SurveyResultRow = {
  id: string;
  user_id: string | null;
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  q5: number | null;
  q6: number | null;
  q7: number | null;
  q8: number | null;
  created_at: string;
};

const REQUIRED_COLUMNS = [
  "ลำดับ",
  "เลขที่สัญญา",
  "ปีที่",
  "ลักษณะโครงการ",
  "ประเภทโครงการ",
  "ชื่อข้อเสนอโครงการวิจัย",
  "รายละเอียดทุน",
  "ประเภทงบประมาณ",
  "ตำแหน่งทางวิชาการ",
  "ชื่อ",
  "นามสกุล",
  "สังกัด",
  "งบประมาณ",
  "คำสำคัญ",
  "Keyword",
  "ผู้ร่วมวิจัย",
];

const COLORS = [
  "#2457d6",
  "#13a89e",
  "#f59e0b",
  "#ef4444",
  "#7c3aed",
  "#0ea5e9",
  "#84cc16",
  "#f97316",
  "#64748b",
];

const SURVEY_QUESTIONS = [
  {
    key: "q1",
    dimension: "ด้านความถูกต้องของข้อมูล",
    text: "ข้อมูลที่แสดงในแดชบอร์ดตรงกับข้อมูลจริงในฐานข้อมูลต้นฉบับ",
  },
  {
    key: "q2",
    dimension: "ด้านความถูกต้องของข้อมูล",
    text: "การจัดหมวดหมู่ประเภทแหล่งทุนและคณะมีความถูกต้อง",
  },
  {
    key: "q3",
    dimension: "ด้านความสะดวกในการใช้งาน",
    text: "หน้าตาของแดชบอร์ดเข้าใจง่ายและไม่ซับซ้อนเกินไป",
  },
  {
    key: "q4",
    dimension: "ด้านความสะดวกในการใช้งาน",
    text: "สามารถกรองและสำรวจข้อมูลได้โดยไม่ต้องรับคำแนะนำเพิ่มเติม",
  },
  {
    key: "q5",
    dimension: "ด้านความสะดวกในการใช้งาน",
    text: "กราฟและแผนภูมิช่วยให้เข้าใจข้อมูลได้รวดเร็ว",
  },
  {
    key: "q6",
    dimension: "ด้านประโยชน์เชิงนโยบาย",
    text: "ข้อมูลที่นำเสนอสอดคล้องกับความต้องการในการตัดสินใจเชิงนโยบาย",
  },
  {
    key: "q7",
    dimension: "ด้านประโยชน์เชิงนโยบาย",
    text: "ระบบแดชบอร์ดช่วยลดเวลาในการหาข้อมูลสำหรับการประชุมหรือรายงาน",
  },
  {
    key: "q8",
    dimension: "ด้านประโยชน์เชิงนโยบาย",
    text: "ท่านมีความพึงพอใจในภาพรวมต่อระบบแดชบอร์ดนี้",
  },
] as const;

type SurveyKey = (typeof SURVEY_QUESTIONS)[number]["key"];

const emptySurvey = Object.fromEntries(
  SURVEY_QUESTIONS.map((question) => [question.key, 0]),
) as Record<SurveyKey, number>;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = cleanText(value).replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function splitKeywords(value: unknown) {
  const text = cleanText(value);
  if (!text) return [];

  return text
    .split(/[,，;；|/]+/)
    .map((item) => cleanText(item))
    .filter(Boolean)
    .map((item) => (item.length > 80 ? `${item.slice(0, 80)}…` : item));
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "th"),
  );
}

function sumBudget(rows: ProjectRow[]) {
  return rows.reduce((sum, row) => sum + row.budget, 0);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

function groupRows(
  rows: ProjectRow[],
  getKey: (row: ProjectRow) => string,
): ChartDatum[] {
  const map = new Map<string, { count: number; budget: number }>();

  for (const row of rows) {
    const key = getKey(row) || "ไม่ระบุ";
    const current = map.get(key) ?? { count: 0, budget: 0 };
    current.count += 1;
    current.budget += row.budget;
    map.set(key, current);
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({
      name,
      count: value.count,
      budget: value.budget,
      budgetMillion: Math.round((value.budget / 1_000_000) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count || b.budget - a.budget);
}

function getTopFundKeys(rows: ProjectRow[]) {
  return groupRows(rows, (row) => row.fundType)
    .slice(0, 6)
    .map((item) => item.name);
}

function makeStackedFundData(rows: ProjectRow[], faculties: string[], fundKeys: string[]) {
  return faculties.map((faculty) => {
    const facultyRows = rows.filter((row) => row.faculty === faculty);
    const datum: Record<string, string | number> = {
      faculty,
    };

    for (const fundKey of fundKeys) {
      datum[fundKey] = facultyRows.filter((row) => (row.fundType || "ไม่ระบุ") === fundKey).length;
    }

    const otherCount = facultyRows.filter(
      (row) => !fundKeys.includes(row.fundType || "ไม่ระบุ"),
    ).length;

    if (otherCount > 0) {
      datum["อื่น ๆ"] = otherCount;
    }

    return datum;
  });
}

function makeKeywordCounts(rows: ProjectRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const keyword of [...row.thaiKeywords, ...row.englishKeywords]) {
      const normalized = keyword.toLowerCase();
      const display = keyword.trim();
      if (!display) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([normalized, count]) => ({
      name: normalized,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
}

function parseProjectsFromWorkbook(workbook: XLSX.WorkBook) {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("ไม่พบ Sheet ในไฟล์ Excel");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    throw new Error("ไฟล์ Excel ไม่มีข้อมูล");
  }

  const detectedHeaders = Object.keys(rawRows[0] ?? {}).map(normalizeHeader);
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !detectedHeaders.includes(column),
  );

  if (missingColumns.length > 0) {
    throw new Error(`ไม่พบคอลัมน์ที่จำเป็น: ${missingColumns.join(", ")}`);
  }

  return rawRows
    .map((rawRow, index) => {
      const cleaned: Record<string, string> = {};

      for (const [key, value] of Object.entries(rawRow)) {
        cleaned[normalizeHeader(key)] = cleanText(value);
      }

      const project: ProjectRow = {
        order: toNumber(cleaned["ลำดับ"]) || index + 1,
        contractNo: cleaned["เลขที่สัญญา"],
        year: cleaned["ปีที่"],
        status: cleaned["ลักษณะโครงการ"] || "ไม่ระบุ",
        projectType: cleaned["ประเภทโครงการ"] || "ไม่ระบุ",
        title: cleaned["ชื่อข้อเสนอโครงการวิจัย"],
        fundDetail: cleaned["รายละเอียดทุน"],
        fundType: cleaned["ประเภทงบประมาณ"] || "ไม่ระบุ",
        academicPosition: cleaned["ตำแหน่งทางวิชาการ"],
        firstName: cleaned["ชื่อ"],
        lastName: cleaned["นามสกุล"],
        faculty: cleaned["สังกัด"] || "ไม่ระบุ",
        budget: toNumber(cleaned["งบประมาณ"]),
        thaiKeywords: splitKeywords(cleaned["คำสำคัญ"]),
        englishKeywords: splitKeywords(cleaned["Keyword"]),
        coResearchers: cleaned["ผู้ร่วมวิจัย"],
      };

      return project;
    })
    .filter((row) => row.contractNo || row.title);
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <h2 className="section-title">{title}</h2>
      {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
    </>
  );
}

function EmptyDashboard() {
  return (
    <div className="empty-state">
      <h2>เริ่มจากอัปโหลดไฟล์ Excel</h2>
      <p>
        ระบบจะอ่าน Sheet แรกของไฟล์ ทำความสะอาดชื่อคอลัมน์และข้อความด้วยการ Trim
        ช่องว่าง จากนั้นสร้างแดชบอร์ดตาม 4 มุมมองที่กำหนด
      </p>
    </div>
  );
}

function TopFundList({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="top-list">
      {data.slice(0, 5).map((item) => (
        <div className="top-list-item" key={item.name}>
          <div className="top-list-row">
            <span>{item.name}</span>
            <strong>{formatInteger(item.count)} โครงการ</strong>
          </div>
          <div className="progress">
            <span style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SurveyForm() {
  const [userId, setUserId] = useState("");
  const [survey, setSurvey] = useState<Record<SurveyKey, number>>({
    ...emptySurvey,
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const missingQuestion = SURVEY_QUESTIONS.find(
      (question) => survey[question.key] < 1 || survey[question.key] > 5,
    );

    if (!userId.trim()) {
      setMessageType("error");
      setMessage("กรุณากรอกชื่อหรือรหัสผู้ประเมินก่อนส่งแบบประเมิน");
      return;
    }

    if (missingQuestion) {
      setMessageType("error");
      setMessage(`กรุณาให้คะแนนข้อ ${missingQuestion.key.replace("q", "")}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/survey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId.trim(),
          ...survey,
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "บันทึกข้อมูลไม่สำเร็จ");
      }

      setMessageType("success");
      setMessage(result.message ?? "บันทึกแบบประเมินเรียบร้อย");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="survey-card panel" onSubmit={handleSubmit}>
      <SectionTitle
        title="แบบประเมินความพึงพอใจระบบแดชบอร์ด"
        subtitle="ให้คะแนน 1 = น้อยที่สุด ถึง 5 = มากที่สุด ระบบจะบันทึกคะแนนแยกตามชื่อหรือรหัสผู้ประเมิน"
      />

      <div className="field">
        <label htmlFor="user-id">ชื่อหรือรหัสผู้ประเมิน</label>
        <input
          id="user-id"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder="เช่น evaluator-001 หรือชื่อย่อ"
        />
      </div>

      <div className="survey-grid">
        {SURVEY_QUESTIONS.map((question, index) => (
          <div className="survey-question" key={question.key}>
            <div className="survey-question-header">
              <span className="badge">{index + 1}</span>
              <div>
                <p>{question.text}</p>
                <small>{question.dimension}</small>
              </div>
            </div>

            <div className="score-row" aria-label={`คะแนนข้อ ${index + 1}`}>
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  aria-pressed={survey[question.key] === score}
                  className={
                    survey[question.key] === score
                      ? "score-button active"
                      : "score-button"
                  }
                  key={score}
                  onClick={() =>
                    setSurvey((current) => ({
                      ...current,
                      [question.key]: score,
                    }))
                  }
                  type="button"
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="form-actions">
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "กำลังบันทึก..." : "ส่งแบบประเมิน"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setSurvey({ ...emptySurvey });
            setMessage("");
          }}
        >
          ล้างคะแนน
        </button>
      </div>

      {message ? <div className={`alert ${messageType}`}>{message}</div> : null}
    </form>
  );
}

function AdminSurveyPanel() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<SurveyResultRow[]>([]);
  const [averages, setAverages] = useState<Record<string, number>>({});
  const [adminMessage, setAdminMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadResults() {
    setAdminMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/survey-results", {
        headers: {
          "x-admin-token": token,
        },
      });

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        rows?: SurveyResultRow[];
        averages?: Record<string, number>;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "โหลดผลประเมินไม่สำเร็จ");
      }

      setRows(result.rows ?? []);
      setAverages(result.averages ?? {});
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "โหลดผลประเมินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-box">
      <h3>ดูผลแบบประเมินรายคนสำหรับ Admin</h3>
      <p className="section-subtitle">
        กรอก ADMIN_TOKEN ที่ตั้งไว้ใน Vercel หรือไฟล์ .env.local แล้วกดโหลดข้อมูล
      </p>

      <div className="form-actions">
        <div className="field">
          <label htmlFor="admin-token">Admin token</label>
          <input
            id="admin-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="ADMIN_TOKEN"
          />
        </div>
        <button className="secondary-button" type="button" onClick={loadResults}>
          {loading ? "กำลังโหลด..." : "โหลดผลประเมิน"}
        </button>
      </div>

      {adminMessage ? <div className="alert error">{adminMessage}</div> : null}

      {rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ผู้ประเมิน</th>
                {SURVEY_QUESTIONS.map((question, index) => (
                  <th key={question.key}>ข้อ {index + 1}</th>
                ))}
                <th>วันที่บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.user_id}</td>
                  {SURVEY_QUESTIONS.map((question) => (
                    <td key={question.key}>{row[question.key] ?? "-"}</td>
                  ))}
                  <td>{new Date(row.created_at).toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>ค่าเฉลี่ย</td>
                {SURVEY_QUESTIONS.map((question) => (
                  <td key={question.key}>{averages[question.key] ?? 0}</td>
                ))}
                <td>{rows.length} คน</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState("all");
  const [selectedFundType, setSelectedFundType] = useState("all");
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState("");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setUploadError("");

    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsedProjects = parseProjectsFromWorkbook(workbook);

      setProjects(parsedProjects);
      setSelectedFaculty("all");
      setSelectedFundType("all");
      setFileName(file.name);
    } catch (error) {
      setProjects([]);
      setFileName("");
      setUploadError(error instanceof Error ? error.message : "อ่านไฟล์ Excel ไม่สำเร็จ");
    }
  }

  const facultyOptions = useMemo(
    () => uniqueSorted(projects.map((project) => project.faculty)),
    [projects],
  );

  const fundTypeOptions = useMemo(
    () => uniqueSorted(projects.map((project) => project.fundType)),
    [projects],
  );

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const matchFaculty =
          selectedFaculty === "all" || project.faculty === selectedFaculty;
        const matchFund =
          selectedFundType === "all" || project.fundType === selectedFundType;

        return matchFaculty && matchFund;
      }),
    [projects, selectedFaculty, selectedFundType],
  );

  const kpis = useMemo(
    () => ({
      totalProjects: filteredProjects.length,
      totalBudget: sumBudget(filteredProjects),
      fundTypes: new Set(filteredProjects.map((project) => project.fundType)).size,
      faculties: new Set(filteredProjects.map((project) => project.faculty)).size,
    }),
    [filteredProjects],
  );

  const statusData = useMemo(
    () => groupRows(filteredProjects, (project) => project.status),
    [filteredProjects],
  );

  const projectTypeData = useMemo(
    () => groupRows(filteredProjects, (project) => project.projectType),
    [filteredProjects],
  );

  const facultyChartData = useMemo(
    () => groupRows(filteredProjects, (project) => project.faculty),
    [filteredProjects],
  );

  const fundBudgetData = useMemo(
    () => groupRows(filteredProjects, (project) => project.fundType),
    [filteredProjects],
  );

  const topFundList = useMemo(
    () => groupRows(filteredProjects, (project) => project.fundType),
    [filteredProjects],
  );

  const stackedFundKeys = useMemo(() => getTopFundKeys(filteredProjects), [filteredProjects]);

  const stackedFundData = useMemo(() => {
    const faculties =
      selectedFaculty === "all" ? facultyOptions : facultyOptions.filter((faculty) => faculty === selectedFaculty);

    return makeStackedFundData(filteredProjects, faculties, stackedFundKeys);
  }, [facultyOptions, filteredProjects, selectedFaculty, stackedFundKeys]);

  const keywordCounts = useMemo(() => makeKeywordCounts(filteredProjects), [filteredProjects]);
  const topKeywords = keywordCounts.slice(0, 10);
  const maxKeywordCount = Math.max(...keywordCounts.map((item) => item.count), 1);

  const stackedKeysWithOther = useMemo(() => {
    const hasOther = stackedFundData.some((datum) => typeof datum["อื่น ๆ"] === "number");
    return hasOther ? [...stackedFundKeys, "อื่น ๆ"] : stackedFundKeys;
  }, [stackedFundData, stackedFundKeys]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-inner">
          <span className="hero-eyebrow">Vibe Analytics Dashboard</span>
          <h1>ระบบวิเคราะห์โครงการวิจัยจาก Excel และบันทึกแบบประเมินลง Supabase</h1>
          <p>
            อัปโหลดไฟล์ Excel 16 คอลัมน์ ระบบจะ Trim ช่องว่าง ทำความสะอาดข้อมูล
            สร้างแดชบอร์ด 4 มุมมอง และบันทึกแบบประเมินความพึงพอใจ 8 ข้อแยกตามรายบุคคล
          </p>
        </div>
      </section>

      <div className="main">
        <section className="uploader panel">
          <div className="uploader-grid">
            <div className="upload-box">
              <h2>อัปโหลด Excel</h2>
              <p>
                รองรับไฟล์ .xlsx และ .xls โดยอ่านข้อมูลจาก Sheet แรก
                ชื่อคอลัมน์และข้อความในเซลล์จะถูก Trim อัตโนมัติ
              </p>
              <input
                className="file-input"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                type="file"
              />
              {fileName ? (
                <div className="alert success">
                  โหลดไฟล์ {fileName} สำเร็จ: {formatInteger(projects.length)} records
                </div>
              ) : null}
              {uploadError ? <div className="alert error">{uploadError}</div> : null}
            </div>

            <div className="help-card">
              <h3>คอลัมน์ที่ระบบตรวจสอบ</h3>
              <p>
                ลำดับ, เลขที่สัญญา, ปีที่, ลักษณะโครงการ, ประเภทโครงการ,
                ชื่อข้อเสนอโครงการวิจัย, รายละเอียดทุน, ประเภทงบประมาณ,
                ตำแหน่งทางวิชาการ, ชื่อ, นามสกุล, สังกัด, งบประมาณ, คำสำคัญ,
                Keyword และผู้ร่วมวิจัย
              </p>
            </div>
          </div>
        </section>

        {projects.length > 0 ? (
          <>
            <section className="filter-bar panel">
              <div className="field">
                <label htmlFor="faculty-filter">Dropdown Filter: คณะ</label>
                <select
                  id="faculty-filter"
                  value={selectedFaculty}
                  onChange={(event) => setSelectedFaculty(event.target.value)}
                >
                  <option value="all">ทุกคณะ</option>
                  {facultyOptions.map((faculty) => (
                    <option key={faculty} value={faculty}>
                      {faculty}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="fund-filter">Dropdown Filter: ประเภทแหล่งทุน</label>
                <select
                  id="fund-filter"
                  value={selectedFundType}
                  onChange={(event) => setSelectedFundType(event.target.value)}
                >
                  <option value="all">ทุกประเภทแหล่งทุน</option>
                  {fundTypeOptions.map((fundType) => (
                    <option key={fundType} value={fundType}>
                      {fundType}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSelectedFaculty("all");
                  setSelectedFundType("all");
                }}
              >
                Reset
              </button>
            </section>

            <section className="dashboard-section">
              <SectionTitle
                title="1) ภาพรวม (Overview)"
                subtitle="KPI Cards และสัดส่วนสถานะโครงการเพื่อให้เห็นภาพรวมทันที"
              />

              <div className="kpi-grid">
                <div className="kpi-card panel">
                  <span>จำนวนโครงการทั้งหมด</span>
                  <strong>{formatInteger(kpis.totalProjects)}</strong>
                  <small>records หลังกรองข้อมูล</small>
                </div>
                <div className="kpi-card panel">
                  <span>งบประมาณรวม</span>
                  <strong>{formatMoney(kpis.totalBudget)}</strong>
                  <small>คำนวณจากคอลัมน์งบประมาณ</small>
                </div>
                <div className="kpi-card panel">
                  <span>ประเภทแหล่งทุน</span>
                  <strong>{formatInteger(kpis.fundTypes)}</strong>
                  <small>อ้างอิงคอลัมน์ประเภทงบประมาณ</small>
                </div>
                <div className="kpi-card panel">
                  <span>จำนวนคณะ</span>
                  <strong>{formatInteger(kpis.faculties)}</strong>
                  <small>อ้างอิงคอลัมน์สังกัด</small>
                </div>
              </div>

              <div className="chart-grid three-two dashboard-section">
                <div className="chart-card panel">
                  <h3>จำนวนโครงการตามประเภทโครงการ</h3>
                  <p className="caption">แยกตามโครงการสร้างองค์ความรู้และโครงการถ่ายทอด</p>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectTypeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="จำนวนโครงการ" fill={COLORS[0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card panel">
                  <h3>สัดส่วนสถานะโครงการ</h3>
                  <p className="caption">สถานะจากคอลัมน์ลักษณะโครงการ</p>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="count"
                          innerRadius={58}
                          outerRadius={92}
                          nameKey="name"
                          paddingAngle={2}
                        >
                          {statusData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card panel wide">
                  <h3>จำนวนแยกตามประเภทแหล่งทุน</h3>
                  <p className="caption">แสดง Top 5 ประเภทแหล่งทุนตามจำนวนโครงการ</p>
                  <TopFundList data={topFundList} />
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <SectionTitle
                title="2) วิเคราะห์รายคณะ (Faculty Analysis)"
                subtitle="เปรียบเทียบจำนวนโครงการและงบประมาณระหว่างคณะ พร้อมสัดส่วนสถานะที่เปลี่ยนตามตัวกรอง"
              />

              <div className="chart-grid">
                <div className="chart-card panel">
                  <h3>จำนวนโครงการและงบประมาณตามคณะ</h3>
                  <p className="caption">แกนซ้าย = จำนวนโครงการ, แกนขวา = งบประมาณล้านบาท</p>
                  <div className="chart-wrap tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={facultyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" allowDecimals={false} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="count"
                          name="จำนวนโครงการ"
                          fill={COLORS[0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="budgetMillion"
                          name="งบประมาณ (ล้านบาท)"
                          fill={COLORS[1]}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card panel">
                  <h3>สัดส่วนสถานะโครงการตามตัวกรอง</h3>
                  <p className="caption">เลือกคณะจาก Dropdown เพื่อดูสถานะของคณะนั้น</p>
                  <div className="chart-wrap tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="count"
                          nameKey="name"
                          outerRadius={112}
                          label
                        >
                          {statusData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <SectionTitle
                title="3) วิเคราะห์ประเภทแหล่งทุน (Fund Analysis)"
                subtitle="Stacked Bar Chart เพื่อดูการกระจายแหล่งทุนในแต่ละคณะ และ Donut Chart เพื่อดูงบประมาณตามแหล่งทุน"
              />

              <div className="chart-grid">
                <div className="chart-card panel">
                  <h3>การกระจายประเภทแหล่งทุนในแต่ละคณะ</h3>
                  <p className="caption">แสดง Top 6 แหล่งทุนตามจำนวนโครงการ และรวมที่เหลือเป็น “อื่น ๆ”</p>
                  <div className="chart-wrap tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stackedFundData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="faculty" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        {stackedKeysWithOther.map((fundKey, index) => (
                          <Bar
                            key={fundKey}
                            dataKey={fundKey}
                            stackId="funds"
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-card panel">
                  <h3>สัดส่วนงบประมาณตามแหล่งทุน</h3>
                  <p className="caption">คำนวณจากผลรวมงบประมาณของแต่ละประเภทแหล่งทุน</p>
                  <div className="chart-wrap tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={fundBudgetData}
                          dataKey="budget"
                          innerRadius={64}
                          outerRadius={112}
                          nameKey="name"
                          paddingAngle={2}
                        >
                          {fundBudgetData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatMoney(Number(value))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <SectionTitle
                title="4) วิเคราะห์คำสำคัญ (Keyword Analysis)"
                subtitle="Word Cloud และ Top 10 Keywords จากคอลัมน์คำสำคัญภาษาไทยและ Keyword ภาษาอังกฤษ"
              />

              <div className="chart-grid">
                <div className="chart-card panel">
                  <h3>Word Cloud</h3>
                  <p className="caption">ขนาดคำสะท้อนความถี่ที่ปรากฏในข้อมูลหลังกรอง</p>
                  <div className="word-cloud">
                    {keywordCounts.slice(0, 40).length > 0 ? (
                      keywordCounts.slice(0, 40).map((keyword) => {
                        const size = 13 + (keyword.count / maxKeywordCount) * 20;
                        return (
                          <span
                            className="word-chip"
                            key={keyword.name}
                            style={{ fontSize: `${size}px` }}
                            title={`${keyword.count} ครั้ง`}
                          >
                            {keyword.name}
                          </span>
                        );
                      })
                    ) : (
                      <p className="section-subtitle">ไม่พบคำสำคัญในข้อมูลที่เลือก</p>
                    )}
                  </div>
                </div>

                <div className="chart-card panel">
                  <h3>Top 10 Keywords</h3>
                  <p className="caption">เรียงตามความถี่จากมากไปน้อย</p>
                  <div className="chart-wrap tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topKeywords} layout="vertical" margin={{ left: 18 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="count" name="ความถี่" fill={COLORS[0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <EmptyDashboard />
        )}

        <section className="dashboard-section">
          <SurveyForm />
          <AdminSurveyPanel />
        </section>

        <p className="footer-note">
          ออกแบบให้ใช้งานผ่านเว็บเบราว์เซอร์ ปรับขนาดตาม Desktop และ Tablet
          พร้อม Hover Tooltip และ Reset Filter ตามแนวคิด Vibe Analytics
        </p>
      </div>
    </main>
  );
}
