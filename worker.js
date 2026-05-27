const ROOT_HTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Welmoa Tools</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:sans-serif; text-align:center; padding:60px;">
  <h1>Welmoa Tools</h1>
  <p>복지 실무를 위한 업무도구 포털입니다.</p>

  <p style="margin-top:30px;">
    👉 <a href="https://tools.welmoa.kr">포털 바로가기</a>
  </p>
</body>
</html>
`;

const ANALYTICS_SCRIPT = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-4TNGJX9WB9"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-4TNGJX9WB9');
</script>

<!-- Naver Analytics -->
<script type="text/javascript" src="https://wcs.pstatic.net/wcslog.js"></script>
<script type="text/javascript">
if(!wcs_add) var wcs_add = {};
wcs_add["wa"] = "c4e4f76e4b7f40";
if(window.wcs) {
  wcs_do();
}
</script>
`;

async function injectAnalytics(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  let html = await response.text();

  if (
    html.includes("G-4TNGJX9WB9") ||
    html.includes("wcs.pstatic.net/wcslog.js")
  ) {
    return new Response(html, response);
  }

  html = html.replace(
    "</head>",
    `${ANALYTICS_SCRIPT}\n</head>`
  );

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

if (request.url.includes("/blog")) {
  return new Response("BLOG REDIRECT WORKING");
}

  return Response.redirect(
    `https://blog.welmoa.kr${newPath}`,
    301
  );
}
    
    // 공통 리소스
    if (pathname === "/_welmoa/shared.css") {
      return new Response(sharedCss(), {
        headers: { "content-type": "text/css; charset=utf-8" }
      });
    }

    if (pathname === "/_welmoa/shared.js") {
      return new Response(sharedJs(), {
        headers: { "content-type": "application/javascript; charset=utf-8" }
      });
    }

    // URL 단축 API
    if (pathname === "/api/shorten" && request.method === "POST") {
      return handleCreateShortUrl(request, env);
    }

    if (pathname === "/api/shorten" && request.method === "GET") {
      return handleListShortUrls(request, env);
    }

    if (pathname.startsWith("/api/shorten/") && request.method === "DELETE") {
      return handleDeleteShortUrl(request, env);
    }

    // 단축 URL 리다이렉트
    if (pathname.startsWith("/s/")) {
      return handleShortRedirect(request, env);
    }

    // salary reverse proxy
    if (pathname === "/salary" || pathname.startsWith("/salary/")) {
      return proxy(request, "https://welfare-8nl.pages.dev", "/salary");
    }

    // lottery reverse proxy
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxy(request, "https://lottery-webapp.gubossi.workers.dev", "/lottery");
    }
    
    if (url.pathname === "/api/grants/test") {

  const result = await env.DB
    .prepare("SELECT COUNT(*) as count FROM grants")
    .first();

  return Response.json({
    success: true,
    total: result.count
  });
}

    if (pathname === "/api/grants/sample") {

  await env.DB.prepare(`
    INSERT INTO grants (
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
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  .bind(
    "test",
    crypto.randomUUID(),
    "2026년 장애인 디지털 프로그램 지원사업",
    "테스트기관",
    "복지",
    "경기",
    "2026-05-01",
    "2026-05-31",
    "2026-05-10",
    "https://example.com",
    "장애인 대상 디지털 콘텐츠 지원사업",
    85
  )
  .run();

  return Response.json({
    success: true,
    message: "sample inserted"
  });
}

if (pathname === "/api/grants/list") {
  const rows = await env.DB.prepare(`
    SELECT
      id,
      source,
      title,
      organization,
      category,
      region,
      apply_start,
      apply_end,
      posted_date,
      url,
      summary,
      fit_score,
      collected_at
    FROM grants
    ORDER BY apply_end ASC, fit_score DESC
    LIMIT 100
  `).all();

  return Response.json({
    success: true,
    count: rows.results.length,
    items: rows.results
  });
}   

if (pathname === "/api/grants/collect") {
  return handleCollectBizinfoGrants(env);
}
    
    // 루트 도메인 안내 화면은 / 일 때만 표시
    if (url.hostname === "welmoa.kr" && pathname === "/") {
      return injectAnalytics(new Response(ROOT_HTML, {
  headers: { "content-type": "text/html; charset=utf-8" }
}));
    }

    // 나머지 정적 파일
    const assetResponse = await env.ASSETS.fetch(request);
return injectAnalytics(assetResponse);
  }
};

//////////////////////////////////////////////////////
// 순수 프록시
//////////////////////////////////////////////////////

async function proxy(request, targetBase, mountPath) {
  const reqUrl = new URL(request.url);

  const upstreamPath =
    reqUrl.pathname === mountPath
      ? "/"
      : reqUrl.pathname.slice(mountPath.length) || "/";

  const upstreamUrl = new URL(targetBase + upstreamPath + reqUrl.search);

  const upstreamRequest = new Request(upstreamUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual"
  });

  let response = await fetch(upstreamRequest);
  response = rewriteRedirectLocation(response, targetBase, mountPath);

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  const rewriter = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(`<base href="${mountPath}/">`, { html: true });
      }
    })
    .on("a", new PrefixRewriter("href", mountPath))
    .on("link", new PrefixRewriter("href", mountPath))
    .on("script", new PrefixRewriter("src", mountPath))
    .on("img", new PrefixRewriter("src", mountPath))
    .on("form", new PrefixRewriter("action", mountPath));

  const rewrittenResponse = new Response(
  rewriter.transform(response).body,
  response
);

return injectAnalytics(rewrittenResponse);
}

//////////////////////////////////////////////////////
// 경로 보정
//////////////////////////////////////////////////////

class PrefixRewriter {
  constructor(attr, mountPath) {
    this.attr = attr;
    this.mountPath = mountPath;
  }

  element(el) {
    const value = el.getAttribute(this.attr);
    if (!value) return;

    if (
      value.startsWith("http") ||
      value.startsWith("//") ||
      value.startsWith("#") ||
      value.startsWith("data:")
    ) {
      return;
    }

    if (value.startsWith("/")) {
      el.setAttribute(this.attr, this.mountPath + value);
    }
  }
}

//////////////////////////////////////////////////////
// redirect 보정
//////////////////////////////////////////////////////

function rewriteRedirectLocation(response, targetBase, mountPath) {
  const location = response.headers.get("location");
  if (!location) return response;

  const headers = new Headers(response.headers);

  try {
    const upstreamOrigin = new URL(targetBase).origin;
    const loc = new URL(location, upstreamOrigin);

    if (loc.origin === upstreamOrigin) {
      headers.set("location", `${mountPath}${loc.pathname}${loc.search}`);
    }
  } catch {}

  return new Response(response.body, {
    status: response.status,
    headers
  });
}

//////////////////////////////////////////////////////
// 단축 URL API
//////////////////////////////////////////////////////

async function handleCreateShortUrl(request, env) {
  try {
    const body = await request.json();
    const rawUrl = String(body.url || "").trim();
    const rawSlug = String(body.slug || "").trim().toLowerCase();

    if (!rawUrl) {
      return json({ ok: false, message: "원본 URL을 입력해 주세요." }, 400);
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return json({ ok: false, message: "올바른 URL 형식이 아닙니다." }, 400);
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return json({ ok: false, message: "http 또는 https 주소만 사용할 수 있습니다." }, 400);
    }

    let slug = rawSlug;
    if (slug) {
      if (!/^[a-z0-9_-]{3,30}$/.test(slug)) {
        return json(
          {
            ok: false,
            message: "단축코드는 3~30자의 영문 소문자, 숫자, -, _ 만 사용할 수 있습니다."
          },
          400
        );
      }

      const existing = await env.SHORT_LINKS.get(slug);
      if (existing) {
        return json({ ok: false, message: "이미 사용 중인 단축코드입니다." }, 409);
      }
    } else {
      slug = await generateUniqueSlug(env);
    }

    const now = new Date().toISOString();
    const record = {
      url: targetUrl.toString(),
      slug,
      createdAt: now,
      clicks: 0,
      lastClickedAt: ""
    };

    await env.SHORT_LINKS.put(slug, JSON.stringify(record));

    const origin = new URL(request.url).origin;
    return json({
      ok: true,
      slug,
      shortUrl: `${origin}/s/${slug}`,
      url: record.url,
      createdAt: now,
      clicks: 0,
      lastClickedAt: ""
    });
  } catch (error) {
    return json({ ok: false, message: "단축 링크 생성 중 오류가 발생했습니다." }, 500);
  }
}

async function handleListShortUrls(request, env) {
  try {
    const list = await env.SHORT_LINKS.list({ limit: 100 });
    const items = [];

    for (const key of list.keys) {
      const value = await env.SHORT_LINKS.get(key.name);
      if (!value) continue;

      try {
        const parsed = JSON.parse(value);
        items.push(parsed);
      } catch {
        items.push({
          slug: key.name,
          url: value,
          createdAt: "",
          clicks: 0,
          lastClickedAt: ""
        });
      }
    }

    items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const origin = new URL(request.url).origin;
    return json({
      ok: true,
      items: items.map((item) => ({
        ...item,
        clicks: item.clicks || 0,
        lastClickedAt: item.lastClickedAt || "",
        shortUrl: `${origin}/s/${item.slug}`
      }))
    });
  } catch (error) {
    return json({ ok: false, message: "목록을 불러오는 중 오류가 발생했습니다." }, 500);
  }
}

async function handleDeleteShortUrl(request, env) {
  try {
    const url = new URL(request.url);
    const slug = decodeURIComponent(url.pathname.replace("/api/shorten/", "")).trim();

    if (!slug) {
      return json({ ok: false, message: "삭제할 단축코드가 없습니다." }, 400);
    }

    const existing = await env.SHORT_LINKS.get(slug);
    if (!existing) {
      return json({ ok: false, message: "해당 단축코드를 찾을 수 없습니다." }, 404);
    }

    await env.SHORT_LINKS.delete(slug);
    return json({ ok: true, slug });
  } catch (error) {
    return json({ ok: false, message: "삭제 중 오류가 발생했습니다." }, 500);
  }
}

async function handleShortRedirect(request, env) {
  const url = new URL(request.url);
  const slug = decodeURIComponent(url.pathname.replace("/s/", "")).trim();

  if (!slug) {
    return new Response("Short URL not found", { status: 404 });
  }

  const value = await env.SHORT_LINKS.get(slug);
  if (!value) {
    return new Response("Short URL not found", { status: 404 });
  }

  try {
    let record;

    try {
      record = JSON.parse(value);
    } catch {
      record = {
        url: value,
        slug,
        clicks: 0,
        lastClickedAt: ""
      };
    }

    if (!record.url) {
      return new Response("Short URL not found", { status: 404 });
    }

    record.clicks = (record.clicks || 0) + 1;
    record.lastClickedAt = new Date().toISOString();

    await env.SHORT_LINKS.put(slug, JSON.stringify(record));

    return Response.redirect(record.url, 302);
  } catch {
    return new Response("Short URL not found", { status: 404 });
  }
}

async function generateUniqueSlug(env) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";

  for (let i = 0; i < 20; i++) {
    let slug = "";
    for (let j = 0; j < 6; j++) {
      slug += chars[Math.floor(Math.random() * chars.length)];
    }

    const exists = await env.SHORT_LINKS.get(slug);
    if (!exists) return slug;
  }

  throw new Error("slug generation failed");
}

async function handleCollectBizinfoGrants(env) {
  const apiUrl = new URL("https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do");

  apiUrl.searchParams.set("crtfcKey", env.BIZINFO_API_KEY || "");
  apiUrl.searchParams.set("dataType", "json");
  apiUrl.searchParams.set("searchCnt", "5");

  const res = await fetch(apiUrl.toString(), {
    headers: {
      "user-agent": "Welmoa-Grants-Collector/1.0"
    }
  });

  const text = await res.text();

  return new Response(text, {
    status: res.status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function normalizeBizinfoItems(data) {
  const rawItems =
    data?.jsonArray ||
    data?.items ||
    data?.item ||
    data?.response?.body?.items?.item ||
    data?.rss?.channel?.item ||
    [];

  const list = Array.isArray(rawItems) ? rawItems : [rawItems];

  return list
    .filter(Boolean)
    .map((raw) => {
      const title =
        pick(raw, ["pblancNm", "title", "사업명", "pblancTitle"]) || "제목 없음";

      const url =
        pick(raw, ["pblancUrl", "link", "url"]) || "";

      const summary =
        pick(raw, ["bsnsSumryCn", "description", "사업개요", "summary"]) || "";

      const applyPeriod =
        pick(raw, ["reqstBeginEndDe", "reqstPd", "신청기간"]) || "";

      const dates = parseDateRange(applyPeriod);

      return {
        external_id:
          pick(raw, ["pblancId", "id", "pblancNo"]) || makeExternalId({ title, url }),
        title,
        organization:
          pick(raw, ["jrsdInsttNm", "excInsttNm", "organization", "기관명"]) || "",
        category:
          pick(raw, ["pldirSportRealmLclasCodeNm", "hashtags", "category", "분야"]) || "",
        region:
          pick(raw, ["areaNm", "region", "지역"]) || "",
        apply_start:
          dates.start || normalizeDate(pick(raw, ["reqstBeginDe", "apply_start"])),
        apply_end:
          dates.end || normalizeDate(pick(raw, ["reqstEndDe", "apply_end"])),
        posted_date:
          normalizeDate(pick(raw, ["creatPnttm", "registDt", "posted_date", "pubDate"])),
        url,
        summary
      };
    })
    .filter((item) => item.title && item.title !== "제목 없음");
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") {
      return String(obj[key]).trim();
    }
  }
  return "";
}

function parseDateRange(value) {
  const text = String(value || "");
  const matches = text.match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g) || [];

  return {
    start: normalizeDate(matches[0]),
    end: normalizeDate(matches[1])
  };
}

function normalizeDate(value) {
  if (!value) return "";

  const text = String(value).trim();
  const match = text.match(/(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/);

  if (!match) return "";

  const y = match[1];
  const m = match[2].padStart(2, "0");
  const d = match[3].padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function makeExternalId(item) {
  const base = `${item.title || ""}|${item.url || ""}`;
  let hash = 0;

  for (let i = 0; i < base.length; i++) {
    hash = Math.imul(31, hash) + base.charCodeAt(i) | 0;
  }

  return `auto_${Math.abs(hash)}`;
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
    if (text.includes(keyword)) {
      score += point;
    }
  }

  return Math.min(score, 100);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

//////////////////////////////////////////////////////
// shared (사용 안하지만 유지)
//////////////////////////////////////////////////////

function sharedCss() {
  return "";
}

function sharedJs() {
  return "";
}
