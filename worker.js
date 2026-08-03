const ANALYTICS_SCRIPT = `
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-4TNGJX9WB9"></script>
  <script is:inline>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-4TNGJX9WB9');
  </script>

  <!-- Naver Analytics -->
  <script src="https://wcs.pstatic.net/wcslog.js"></script>
  <script is:inline>
    if (!window.wcs_add) window.wcs_add = {};
    window.wcs_add["wa"] = "c4e4f76e4b7f40";

    if (window.wcs) {
      wcs_do();
    }
  </script>
`;

const GLOBAL_SEARCH_ASSETS = `
  <link rel="stylesheet" href="/assets/global-search.css?v=20260802-5">
  <script defer src="/assets/global-search.js?v=20260802-5"></script>
`;

async function injectPageEnhancements(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  let html = await response.text();
  html = await injectLatestPosts(html);

  if (
    !html.includes("G-4TNGJX9WB9") &&
    !html.includes("wcs.pstatic.net/wcslog.js")
  ) {
    html = html.replace(
      "</head>",
      `${ANALYTICS_SCRIPT}\n</head>`
    );
  }

  if (!html.includes("/assets/global-search.js")) {
    html = html.replace("</head>", `${GLOBAL_SEARCH_ASSETS}\n</head>`);
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

const LATEST_POSTS_URL = "https://blog.welmoa.kr/latest-posts.json";
const LATEST_POSTS_LIMIT = 6;

async function injectLatestPosts(html) {
  if (!html.includes('id="latest-posts"')) return html;

  try {
    const response = await fetch(LATEST_POSTS_URL, {
      headers: { accept: "application/json" },
      cf: { cacheEverything: true, cacheTtl: 300 }
    });

    if (!response.ok) return html;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return html;

    const cards = data
      .filter(isValidLatestPost)
      .slice(0, LATEST_POSTS_LIMIT)
      .map(renderLatestPostCard)
      .join("\n");

    if (!cards) return html;

    return html.replace(
      /(<div id="latest-posts"[^>]*>)[\\s\\S]*?(<\\/div>\\s*<div class="latest-more">)/,
      `$1\n${cards}\n    $2`
    );
  } catch (error) {
    console.error("latest posts injection failed", error);
    return html;
  }
}

function isValidLatestPost(post) {
  if (!post || typeof post !== "object") return false;

  try {
    const url = new URL(String(post.url || ""), "https://blog.welmoa.kr");
    return (
      url.origin === "https://blog.welmoa.kr" &&
      url.pathname.startsWith("/blog/") &&
      String(post.title || "").trim() !== ""
    );
  } catch {
    return false;
  }
}

function renderLatestPostCard(post) {
  const url = normalizeBlogUrl(post.url, "/blog/");
  const thumbnail = normalizeBlogUrl(post.thumbnail, "/images/");
  const title = escapeHtml(post.title);
  const description = escapeHtml(post.description || "");
  const category = escapeHtml(post.category || "콘텐츠");
  const pubDate = normalizePostDate(post.pubDate);
  const displayDate = formatPostDate(pubDate);

  return `    <article class="latest-post-card">
      <a class="post-thumb" href="${url}">
        <img src="${thumbnail}" alt="${title}">
      </a>
      <div class="post-body">
        <span class="post-category">${category}</span>
        <h3><a href="${url}">${title}</a></h3>
        <p>${description}</p>
        <time class="post-date" datetime="${pubDate}">${displayDate}</time>
      </div>
    </article>`;
}

function normalizeBlogUrl(value, requiredPathPrefix) {
  try {
    const url = new URL(String(value || ""), "https://blog.welmoa.kr");
    if (
      url.origin === "https://blog.welmoa.kr" &&
      url.pathname.startsWith(requiredPathPrefix)
    ) {
      return escapeHtml(url.toString());
    }
  } catch {}

  return requiredPathPrefix === "/images/"
    ? "https://blog.welmoa.kr/images/blog/default.webp"
    : "https://blog.welmoa.kr/blog/";
}

function normalizePostDate(value) {
  const match = String(value || "").match(/^\\d{4}-\\d{2}-\\d{2}/);
  return match ? match[0] : "";
}

function formatPostDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return `${year}. ${month}. ${day}.`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

if (pathname.startsWith("/blog")) {
  let newPath = pathname.replace(/\.html$/, "");

  if (!newPath.endsWith("/")) {
    newPath += "/";
  }

  return Response.redirect(`https://blog.welmoa.kr${newPath}`, 301);
}

if (pathname === "/guide" || pathname === "/guide/") {
  return Response.redirect("https://tools.welmoa.kr/tools/", 301);
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

    // 콘텐츠·도구 반응 및 비공개 의견 API
    if (pathname.startsWith("/api/engagement")) {
      return handleEngagementRequest(request, env);
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
    
    // 나머지 정적 파일
    const assetResponse = await env.ASSETS.fetch(request);
return injectPageEnhancements(assetResponse);
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
    .on("a", new PrefixRewriter("href", mountPath, true))
    .on("link", new PrefixRewriter("href", mountPath))
    .on("script", new PrefixRewriter("src", mountPath))
    .on("img", new PrefixRewriter("src", mountPath))
    .on("form", new PrefixRewriter("action", mountPath));

  const rewrittenResponse = new Response(
  rewriter.transform(response).body,
  response
);

return injectPageEnhancements(rewrittenResponse);
}

//////////////////////////////////////////////////////
// 경로 보정
//////////////////////////////////////////////////////

class PrefixRewriter {
  constructor(attr, mountPath, preservePortalLinks = false) {
    this.attr = attr;
    this.mountPath = mountPath;
    this.preservePortalLinks = preservePortalLinks;
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

    const portalUrl = this.preservePortalLinks ? getPortalUrl(value) : null;

    if (portalUrl) {
      el.setAttribute(this.attr, portalUrl);
      return;
    }

    if (value.startsWith("/")) {
      el.setAttribute(this.attr, this.mountPath + value);
    }
  }
}

function getPortalUrl(value) {
  const portalUrls = new Map([
    ["/", "https://welmoa.kr/"],
    ["/tools/", "https://tools.welmoa.kr/tools/"],
    ["/about/", "https://tools.welmoa.kr/about/"],
    ["/privacy/", "https://welmoa.kr/privacy/"],
    ["/terms/", "https://welmoa.kr/terms/"],
    ["/updates/", "https://tools.welmoa.kr/updates/"],
    ["/guide/", "https://tools.welmoa.kr/guide/"],
    ["/formatter/", "https://tools.welmoa.kr/formatter/"],
    ["/shortener/", "https://tools.welmoa.kr/shortener/"],
    ["/salary", "https://tools.welmoa.kr/salary"],
    ["/salary/", "https://tools.welmoa.kr/salary/"],
    ["/lottery", "https://tools.welmoa.kr/lottery"],
    ["/lottery/", "https://tools.welmoa.kr/lottery/"]
  ]);

  if (portalUrls.has(value)) {
    return portalUrls.get(value);
  }

  if (value.startsWith("/blog/")) {
    return `https://blog.welmoa.kr${value}`;
  }

  return null;
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

//////////////////////////////////////////////////////
// 콘텐츠·도구 반응 및 비공개 의견 API
//////////////////////////////////////////////////////

const ENGAGEMENT_ORIGINS = new Set([
  "https://welmoa.kr",
  "https://blog.welmoa.kr",
  "https://tools.welmoa.kr"
]);

async function handleEngagementRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin") || "";
  const corsHeaders = engagementCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    await ensureEngagementSchema(env);

    if (url.pathname === "/api/engagement/summary" && request.method === "GET") {
      const page = normalizeWelmoaPage(url.searchParams.get("page"));
      if (!page) return engagementJson({ ok: false, message: "페이지 주소가 올바르지 않습니다." }, 400, corsHeaders);

      const pageKey = pageKeyFromUrl(page);
      const reactions = await env.DB.prepare(`
        SELECT reaction, COUNT(*) AS count
        FROM engagement_reactions
        WHERE page_key = ?
        GROUP BY reaction
      `).bind(pageKey).all();

      return engagementJson({
        ok: true,
        pageKey,
        reactions: Object.fromEntries(reactions.results.map((row) => [row.reaction, Number(row.count)]))
      }, 200, corsHeaders);
    }

    if (url.pathname === "/api/engagement/react" && request.method === "POST") {
      const body = await readEngagementBody(request);
      const page = normalizeWelmoaPage(body.pageUrl);
      const visitorId = normalizeVisitorId(body.visitorId);
      const reaction = ["helpful", "used"].includes(body.reaction) ? body.reaction : "";

      if (!page || !visitorId || !reaction) {
        return engagementJson({ ok: false, message: "반응 정보를 확인해 주세요." }, 400, corsHeaders);
      }

      const pageKey = pageKeyFromUrl(page);
      const existing = await env.DB.prepare(`
        SELECT id FROM engagement_reactions
        WHERE page_key = ? AND reaction = ? AND visitor_id = ?
      `).bind(pageKey, reaction, visitorId).first();

      let selected = false;
      if (existing) {
        await env.DB.prepare("DELETE FROM engagement_reactions WHERE id = ?").bind(existing.id).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO engagement_reactions
            (page_key, page_url, page_title, page_type, reaction, visitor_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          pageKey,
          page,
          cleanText(body.pageTitle, 180),
          normalizePageType(body.pageType),
          reaction,
          visitorId
        ).run();
        selected = true;
      }

      const countRow = await env.DB.prepare(`
        SELECT COUNT(*) AS count FROM engagement_reactions
        WHERE page_key = ? AND reaction = ?
      `).bind(pageKey, reaction).first();

      return engagementJson({ ok: true, selected, count: Number(countRow?.count || 0) }, 200, corsHeaders);
    }

    if (url.pathname === "/api/engagement/share" && request.method === "POST") {
      const body = await readEngagementBody(request);
      const page = normalizeWelmoaPage(body.pageUrl);
      const channel = ["copy", "kakao", "native"].includes(body.channel) ? body.channel : "copy";
      if (!page) return engagementJson({ ok: false, message: "페이지 주소가 올바르지 않습니다." }, 400, corsHeaders);

      await env.DB.prepare(`
        INSERT INTO engagement_shares
          (page_key, page_url, page_title, page_type, channel)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        pageKeyFromUrl(page),
        page,
        cleanText(body.pageTitle, 180),
        normalizePageType(body.pageType),
        channel
      ).run();

      return engagementJson({ ok: true }, 200, corsHeaders);
    }

    if (url.pathname === "/api/engagement/feedback" && request.method === "POST") {
      const body = await readEngagementBody(request);
      const page = normalizeWelmoaPage(body.pageUrl);
      const category = ["helpful", "suggestion", "correction", "error"].includes(body.category)
        ? body.category
        : "suggestion";
      const message = cleanText(body.message, 2000);

      if (!page || message.length < 5) {
        return engagementJson({ ok: false, message: "의견을 5자 이상 입력해 주세요." }, 400, corsHeaders);
      }

      await env.DB.prepare(`
        INSERT INTO engagement_feedback
          (page_key, page_url, page_title, page_type, category, message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        pageKeyFromUrl(page),
        page,
        cleanText(body.pageTitle, 180),
        normalizePageType(body.pageType),
        category,
        message
      ).run();

      return engagementJson({ ok: true, message: "소중한 의견을 보내주셔서 감사합니다." }, 200, corsHeaders);
    }

    if (url.pathname === "/api/engagement/admin/dashboard" && request.method === "GET") {
      const authError = requireEngagementAdmin(request, env, corsHeaders);
      if (authError) return authError;

      const [pages, feedback] = await Promise.all([
        env.DB.prepare(`
          SELECT
            p.page_key,
            MAX(p.page_url) AS page_url,
            MAX(p.page_title) AS page_title,
            MAX(p.page_type) AS page_type,
            SUM(p.helpful) AS helpful,
            SUM(p.used) AS used,
            SUM(p.shares) AS shares,
            SUM(p.feedback_count) AS feedback_count
          FROM (
            SELECT page_key, MAX(page_url) AS page_url, MAX(page_title) AS page_title,
              MAX(page_type) AS page_type,
              SUM(CASE WHEN reaction = 'helpful' THEN 1 ELSE 0 END) AS helpful,
              SUM(CASE WHEN reaction = 'used' THEN 1 ELSE 0 END) AS used,
              0 AS shares, 0 AS feedback_count
            FROM engagement_reactions GROUP BY page_key
            UNION ALL
            SELECT page_key, MAX(page_url), MAX(page_title), MAX(page_type),
              0, 0, COUNT(*), 0
            FROM engagement_shares GROUP BY page_key
            UNION ALL
            SELECT page_key, MAX(page_url), MAX(page_title), MAX(page_type),
              0, 0, 0, COUNT(*)
            FROM engagement_feedback GROUP BY page_key
          ) p
          GROUP BY p.page_key
          ORDER BY (helpful + used + shares + feedback_count) DESC
          LIMIT 200
        `).all(),
        env.DB.prepare(`
          SELECT id, page_url, page_title, page_type, category, message, status, created_at
          FROM engagement_feedback
          ORDER BY CASE WHEN status = 'new' THEN 0 ELSE 1 END, created_at DESC
          LIMIT 300
        `).all()
      ]);

      return engagementJson({ ok: true, pages: pages.results, feedback: feedback.results }, 200, corsHeaders);
    }

    if (url.pathname === "/api/engagement/admin/feedback" && request.method === "PATCH") {
      const authError = requireEngagementAdmin(request, env, corsHeaders);
      if (authError) return authError;
      const body = await readEngagementBody(request);
      const id = Number(body.id);
      const status = ["new", "reviewed"].includes(body.status) ? body.status : "";
      if (!Number.isInteger(id) || id < 1 || !status) {
        return engagementJson({ ok: false, message: "처리 상태를 확인해 주세요." }, 400, corsHeaders);
      }
      await env.DB.prepare("UPDATE engagement_feedback SET status = ? WHERE id = ?").bind(status, id).run();
      return engagementJson({ ok: true }, 200, corsHeaders);
    }

    return engagementJson({ ok: false, message: "요청한 기능을 찾을 수 없습니다." }, 404, corsHeaders);
  } catch (error) {
    console.error("engagement api error", error);
    return engagementJson({ ok: false, message: "잠시 후 다시 시도해 주세요." }, 500, corsHeaders);
  }
}

async function ensureEngagementSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS engagement_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key TEXT NOT NULL,
      page_url TEXT NOT NULL,
      page_title TEXT NOT NULL DEFAULT '',
      page_type TEXT NOT NULL DEFAULT 'content',
      reaction TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(page_key, reaction, visitor_id)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS engagement_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key TEXT NOT NULL,
      page_url TEXT NOT NULL,
      page_title TEXT NOT NULL DEFAULT '',
      page_type TEXT NOT NULL DEFAULT 'content',
      channel TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS engagement_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key TEXT NOT NULL,
      page_url TEXT NOT NULL,
      page_title TEXT NOT NULL DEFAULT '',
      page_type TEXT NOT NULL DEFAULT 'content',
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_engagement_reactions_page ON engagement_reactions(page_key)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_engagement_feedback_status ON engagement_feedback(status, created_at)")
  ]);
}

function normalizeWelmoaPage(value) {
  try {
    const url = new URL(String(value || ""));
    if (!ENGAGEMENT_ORIGINS.has(url.origin)) return "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

function pageKeyFromUrl(value) {
  return value.replace(/^https:\/\//, "").replace(/\/$/, "");
}

function normalizeVisitorId(value) {
  const id = String(value || "");
  return /^[a-zA-Z0-9_-]{16,80}$/.test(id) ? id : "";
}

function normalizePageType(value) {
  return value === "tool" ? "tool" : "content";
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maxLength);
}

async function readEngagementBody(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 12000) throw new Error("request body too large");
  return request.json();
}

function engagementCorsHeaders(origin) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin"
  });
  if (ENGAGEMENT_ORIGINS.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
    headers.set("access-control-allow-headers", "Content-Type, Authorization");
  }
  return headers;
}

function engagementJson(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

function requireEngagementAdmin(request, env, corsHeaders) {
  if (!env.FEEDBACK_ADMIN_KEY) {
    return engagementJson({ ok: false, message: "운영자 키가 아직 설정되지 않았습니다." }, 503, corsHeaders);
  }
  const supplied = request.headers.get("authorization") || "";
  if (supplied !== `Bearer ${env.FEEDBACK_ADMIN_KEY}`) {
    return engagementJson({ ok: false, message: "운영자 인증이 필요합니다." }, 401, corsHeaders);
  }
  return null;
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
// 공통 콘텐츠 검색
//////////////////////////////////////////////////////

function sharedCss() {
  return `
.welmoa-content-search-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 10px 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: .95rem;
  font-weight: 700;
  cursor: pointer;
}

.welmoa-content-search-toggle:hover,
.welmoa-content-search-toggle[aria-expanded="true"] {
  background: #eff6ff;
  color: #2563eb;
}

.welmoa-content-search-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.welmoa-content-search-panel {
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.welmoa-content-search-panel[hidden] {
  display: none !important;
}

.welmoa-content-search-form {
  width: min(1120px, calc(100% - 40px));
  margin: 0 auto;
  padding: 18px 0;
}

.welmoa-content-search-form label {
  display: block;
  margin-bottom: 7px;
  color: #334155;
  font-size: .9rem;
  font-weight: 700;
}

.welmoa-content-search-field {
  display: flex;
  gap: 8px;
}

.welmoa-content-search-field input {
  flex: 1;
  min-width: 0;
  min-height: 46px;
  padding: 0 15px;
  border: 1px solid #cbd5e1;
  border-radius: 13px;
  background: #fff;
  color: #0f172a;
  font: inherit;
}

.welmoa-content-search-field input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, .12);
}

.welmoa-content-search-field button {
  min-width: 76px;
  border: 0;
  border-radius: 13px;
  background: #2563eb;
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 640px) {
  .welmoa-content-search-toggle {
    padding: 8px 10px;
  }

  .welmoa-content-search-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}
`;
}

function sharedJs() {
  return `
(() => {
  if (document.querySelector('.welmoa-content-search-toggle')) return;

  const header = document.querySelector('.site-header, header');
  const nav = header?.querySelector('nav');

  if (!header || !nav) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'welmoa-content-search-toggle';
  toggle.setAttribute('aria-label', '검색 열기');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'welmoaContentSearchPanel');
  toggle.innerHTML = '<span class="welmoa-content-search-icon" aria-hidden="true">⌕</span><span class="welmoa-content-search-label">검색</span>';

  const panel = document.createElement('div');
  panel.id = 'welmoaContentSearchPanel';
  panel.className = 'welmoa-content-search-panel';
  panel.hidden = true;
  panel.innerHTML = ` + "`" + `
    <form class="welmoa-content-search-form" action="https://blog.welmoa.kr/blog/" method="get" role="search">
      <label for="welmoaContentSearchInput">콘텐츠 검색</label>
      <div class="welmoa-content-search-field">
        <input id="welmoaContentSearchInput" name="q" type="search" placeholder="제목, 설명 또는 분류로 검색해 보세요" autocomplete="off">
        <button type="submit">검색</button>
      </div>
    </form>
  ` + "`" + `;

  nav.append(toggle);
  header.insertAdjacentElement('afterend', panel);

  const input = panel.querySelector('input');
  const close = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '검색 열기');
  };

  toggle.addEventListener('click', () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
    toggle.setAttribute('aria-label', willOpen ? '검색 닫기' : '검색 열기');
    if (willOpen) input?.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      close();
      toggle.focus();
    }
  });
})();
`;
}
