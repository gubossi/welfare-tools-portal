const API_KEY = process.env.BIZINFO_API_KEY;
const DB_NAME = "welmoa-grants";

if (!API_KEY) {
  console.error("BIZINFO_API_KEY is missing");
  process.exit(1);
}

const apiUrl = new URL("https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do");
apiUrl.searchParams.set("crtfcKey", API_KEY);
apiUrl.searchParams.set("dataType", "json");
apiUrl.searchParams.set("searchCnt", "50");

function q(value) {
  return String(value || "").replaceAll("'", "''");
}

function normalizeDate(value) {
  const text = String(value || "");
  const match = text.match(/(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/);
  if (!match) return "";

  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj?.[key]) return String(obj[key]).trim();
  }
  return "";
}

function makeExternalId(item) {
  const base = `${item.title || ""}|${item.url || ""}`;
  let hash = 0;

  for (let i = 0; i < base.length; i++) {
    hash = (Math.imul(31, hash) + base.charCodeAt(i)) | 0;
  }

  return `bizinfo_${Math.abs(hash)}`;
}

function calculateFitScore(item) {
  const text = [
    item.title,
    item.organization,
    item.category,
    item.region,
    item.summary
  ].join(" ");

  const keywords = {
    "장애인": 30,
    "발달장애": 30,
    "아동": 20,
    "청소년": 20,
    "복지관": 25,
    "사회복지": 25,
    "비영리": 15,
    "디지털": 10,
    "AI": 10,
    "인공지능": 10,
    "VR": 10,
    "메타버스": 10,
    "문화": 10,
    "체육": 10,
    "경기": 10,
    "수원": 15
  };

  let score = 0;
  for (const [keyword, point] of Object.entries(keywords)) {
    if (text.includes(keyword)) score += point;
  }

  return Math.min(score, 100);
}

async function main() {
  const res = await fetch(apiUrl.toString());

  if (!res.ok) {
    throw new Error(`Bizinfo API failed: ${res.status}`);
  }

  const data = await res.json();

  const rawItems =
    data?.jsonArray ||
    data?.items ||
    data?.item ||
    data?.response?.body?.items?.item ||
    [];

  const list = Array.isArray(rawItems) ? rawItems : [rawItems];

  const sqls = [];

  for (const raw of list) {
    if (!raw) continue;

    const item = {
      title: pick(raw, ["pblancNm", "title", "pblancTitle"]) || "제목 없음",
      organization: pick(raw, ["jrsdInsttNm", "excInsttNm", "organization"]),
      category: pick(raw, ["pldirSportRealmLclasCodeNm", "category"]),
      region: pick(raw, ["areaNm", "region"]),
      apply_start: normalizeDate(pick(raw, ["reqstBeginDe"])),
      apply_end: normalizeDate(pick(raw, ["reqstEndDe"])),
      posted_date: normalizeDate(pick(raw, ["creatPnttm", "registDt", "pubDate"])),
      url: pick(raw, ["pblancUrl", "link", "url"]),
      summary: pick(raw, ["bsnsSumryCn", "description", "summary"])
    };

    if (!item.title || item.title === "제목 없음") continue;

    const externalId = pick(raw, ["pblancId", "id", "pblancNo"]) || makeExternalId(item);
    const score = calculateFitScore(item);

    sqls.push(`
INSERT OR IGNORE INTO grants (
  source,
  external_id,
  title,
  organization,
  category,
  region,
  apply_start,
  apply_end,
  posted_date,
  url,
  summary,
  fit_score
) VALUES (
  'bizinfo',
  '${q(externalId)}',
  '${q(item.title)}',
  '${q(item.organization)}',
  '${q(item.category)}',
  '${q(item.region)}',
  '${q(item.apply_start)}',
  '${q(item.apply_end)}',
  '${q(item.posted_date)}',
  '${q(item.url)}',
  '${q(item.summary)}',
  ${score}
);`);
  }

  console.log(sqls.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
