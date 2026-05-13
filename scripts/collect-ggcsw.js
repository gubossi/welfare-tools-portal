const LIST_URL = "https://www.ggcsw.or.kr/?state=contest";

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
  const match = String(value || "").match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function makeAbsoluteUrl(href) {
  if (!href) return LIST_URL;
  try {
    return new URL(href, "https://www.ggcsw.or.kr/").toString();
  } catch {
    return LIST_URL;
  }
}

function makeExternalId(item) {
  const base = `${item.title}|${item.url}|${item.posted_date}`;
  let hash = 0;

  for (let i = 0; i < base.length; i++) {
    hash = (Math.imul(31, hash) + base.charCodeAt(i)) | 0;
  }

  return `ggcsw_${Math.abs(hash)}`;
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
    "공모": 10,
    "지원사업": 10,
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

function extractRows(html) {
  const rows = [];

  const linkRegex = /<a[^>]+href=["']([^"']*state=contest[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const title = stripTags(match[2]);

    if (!title || title.length < 5) continue;
    if (title.includes("공모정보") || title.includes("검색")) continue;

    const around = html.slice(Math.max(0, match.index - 500), match.index + 1000);
    const dateMatch = around.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    const postedDate = normalizeDate(dateMatch?.[1] || "");

    rows.push({
      title,
      url: makeAbsoluteUrl(href),
      posted_date: postedDate
    });
  }

  const unique = new Map();
  for (const row of rows) {
    unique.set(`${row.title}|${row.url}`, row);
  }

  return [...unique.values()];
}

async function main() {
  const res = await fetch(LIST_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 Welmoa-Grants-Collector/1.0"
    }
  });

  if (!res.ok) {
    throw new Error(`GGCSW page failed: ${res.status}`);
  }

  const html = await res.text();
  const rows = extractRows(html);

  console.error(`GGCSW items extracted: ${rows.length}`);

  if (!rows.length) {
    console.log("-- no ggcsw items extracted");
    return;
  }

  const sqls = rows.map(row => {
    const item = {
      source: "ggcsw",
      external_id: "",
      title: row.title,
      organization: "경기도사회복지협의회",
      category: "공모정보",
      region: "경기",
      apply_start: "",
      apply_end: "",
      posted_date: row.posted_date,
      url: row.url,
      summary: "경기도사회복지협의회 공모정보 게시판 공고"
    };

    item.external_id = makeExternalId(item);

    return `
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
  '${q(item.external_id)}',
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
);`;
  });

  console.log(sqls.join("\n"));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
