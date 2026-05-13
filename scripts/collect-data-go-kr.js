const API_KEY = process.env.DATA_GO_KR_API_KEY;

if (!API_KEY) {
  console.error("DATA_GO_KR_API_KEY is missing");
  process.exit(1);
}

const apiUrl = new URL(
  "https://apis.data.go.kr/1051000/BusinessAnnouncementService/getBusinessAnnouncementList"
);

apiUrl.searchParams.set("serviceKey", API_KEY);
apiUrl.searchParams.set("numOfRows", "50");
apiUrl.searchParams.set("pageNo", "1");
apiUrl.searchParams.set("type", "json");

function q(value) {
  return String(value || "").replaceAll("'", "''");
}

function normalizeDate(value) {
  const text = String(value || "");
  const match = text.match(/(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/);

  if (!match) return "";

  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
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
    "사회복지": 25,
    "복지관": 25,
    "비영리": 15,
    "디지털": 10,
    "AI": 10,
    "VR": 10,
    "메타버스": 10,
    "문화": 10,
    "체육": 10,
    "경기": 10,
    "수원": 15
  };

  let score = 0;

  for (const [keyword, point] of Object.entries(keywords)) {
    if (text.includes(keyword)) {
      score += point;
    }
  }

  return Math.min(score, 100);
}

function makeExternalId(item) {
  const base = `${item.title}|${item.url}`;
  let hash = 0;

  for (let i = 0; i < base.length; i++) {
    hash = (Math.imul(31, hash) + base.charCodeAt(i)) | 0;
  }

  return `data_go_kr_${Math.abs(hash)}`;
}

async function main() {
  const res = await fetch(apiUrl.toString());

  if (!res.ok) {
    throw new Error(`data.go.kr API failed: ${res.status}`);
  }

  const data = await res.json();

  const items =
    data?.response?.body?.items?.item ||
    [];

  const list = Array.isArray(items) ? items : [items];

  const sqls = [];

  for (const raw of list) {
    if (!raw) continue;

    const item = {
      title: raw.bizNm || raw.title || "제목 없음",
      organization: raw.insttNm || "",
      category: raw.sprtBizTypeNm || "",
      region: raw.areaNm || "",
      apply_start: normalizeDate(raw.rcptBgngDt),
      apply_end: normalizeDate(raw.rcptEndDt),
      posted_date: normalizeDate(raw.creatDt),
      url: raw.pblancUrl || "",
      summary: raw.bsnsSumryCn || ""
    };

    if (!item.title || item.title === "제목 없음") continue;

    const externalId =
      raw.pblancId ||
      raw.bizPbancId ||
      makeExternalId(item);

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
  'data_go_kr',
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
