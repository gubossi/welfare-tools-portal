const LIST_URL = "https://proposal.chest.or.kr/mobile/mobileMainBsnsList.do";

const REGIONS = "중앙|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주";

function q(value) {
  return String(value || "").replaceAll("'", "''");
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value) {
  const match = String(value || "").match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function makeExternalId(item) {
  const base = `${item.region}|${item.title}|${item.apply_end}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (Math.imul(31, hash) + base.charCodeAt(i)) | 0;
  }
  return `chest_${Math.abs(hash)}`;
}

function calculateFitScore(item) {
  const text = [item.title, item.region, item.summary].join(" ");

  const keywords = {
    "장애인": 30,
    "발달장애": 30,
    "아동": 20,
    "청소년": 20,
    "복지": 25,
    "사회복지": 25,
    "시설": 10,
    "비영리": 15,
    "디지털": 10,
    "AI": 10,
    "VR": 10,
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
  const res = await fetch(LIST_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 Welmoa-Grants-Collector/1.0"
    }
  });

  if (!res.ok) {
    throw new Error(`Chest page failed: ${res.status}`);
  }

  const html = await res.text();
  const text = stripTags(html);

  console.error(`Fetched HTML length: ${html.length}`);
  console.error(`Extracted text length: ${text.length}`);

  const regex = new RegExp(
    `(${REGIONS})\\s+(.+?)\\s+마감일시\\s*\\(18시\\)\\s*[:：]?\\s*(\\d{4}[.-]\\d{1,2}[.-]\\d{1,2})`,
    "g"
  );

  const sqls = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const region = match[1];
    const title = match[2].trim().replace(/\s+/g, " ");
    const applyEnd = normalizeDate(match[3]);

    if (!title || !applyEnd) continue;

    const item = {
      source: "chest",
      title,
      organization: "사회복지공동모금회",
      category: "배분공고",
      region,
      apply_start: "",
      apply_end: applyEnd,
      posted_date: "",
      url: LIST_URL,
      summary: `${region} 사랑의열매 온라인배분신청 공모사업`
    };

    const externalId = makeExternalId(item);

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
  '${q(item.source)}',
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
  ${calculateFitScore(item)}
);`);
  }

  console.error(`Chest items extracted: ${sqls.length}`);

  if (!sqls.length) {
    console.log("-- no chest items extracted");
    return;
  }

  console.log(sqls.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
