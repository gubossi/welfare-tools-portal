export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 공통 프록시 CSS
    if (pathname === "/_welmoa/shared.css") {
      return new Response(sharedCss(), {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
      });
    }

    // 공통 프록시 JS
    if (pathname === "/_welmoa/shared.js") {
      return new Response(sharedJs(), {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
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
      return proxyWithShell(
        request,
        "https://welfare-8nl.pages.dev",
        "/salary"
      );
    }

    // lottery reverse proxy
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxyWithShell(
        request,
        "https://lottery-webapp.gubossi.workers.dev",
        "/lottery"
      );
    }

    // 나머지는 Assets 정적 파일 처리
    return env.ASSETS.fetch(request);
  }
};

async function handleCreateShortUrl(request, env) {
  try {
    const body = await request.json();
    const rawUrl = String(body.url || "").trim();
    const rawSlug = String(body.slug || "").trim().toLowerCase();

    if (!rawUrl) {
      return json(
        { ok: false, message: "원본 URL을 입력해 주세요." },
        400
      );
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return json(
        { ok: false, message: "올바른 URL 형식이 아닙니다." },
        400
      );
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return json(
        { ok: false, message: "http 또는 https 주소만 사용할 수 있습니다." },
        400
      );
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
        return json(
          { ok: false, message: "이미 사용 중인 단축코드입니다." },
          409
        );
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
    return json(
      { ok: false, message: "단축 URL 생성 중 오류가 발생했습니다." },
      500
    );
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
        items.push(JSON.parse(value));
      } catch {
        // 무시
      }
    }

    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

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
    return json(
      { ok: false, message: "목록을 불러오는 중 오류가 발생했습니다." },
      500
    );
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
    return json(
      { ok: false, message: "삭제 중 오류가 발생했습니다." },
      500
    );
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
    const record = JSON.parse(value);

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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function proxyWithShell(request, targetBase, mountPath) {
  const reqUrl = new URL(request.url);

  const upstreamPath =
    reqUrl.pathname === mountPath
      ? "/"
      : reqUrl.pathname.slice(mountPath.length) || "/";

  const upstreamUrl = new URL(targetBase + upstreamPath + reqUrl.search);

  const upstreamRequest = new Request(upstreamUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: shouldHaveBody(request.method) ? request.body : undefined,
    redirect: "manual"
  });

  let response = await fetch(upstreamRequest);

  // upstream redirect가 원본 도메인으로 튀지 않도록 보정
  response = rewriteRedirectLocation(response, targetBase, mountPath);

  const contentType = response.headers.get("content-type") || "";

  // HTML이 아닌 파일(css/js/img/json 등)은 그대로 전달
  if (!contentType.includes("text/html")) {
    return response;
  }

  const rewriter = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(
          `
<base href="${mountPath}/">
<link rel="stylesheet" href="/_welmoa/shared.css">
<script defer src="/_welmoa/shared.js"></script>
`,
          { html: true }
        );
      }
    })
    .on("body", {
      element(el) {
        el.prepend(proxyTopbar(), { html: true });
      }
    })
    .on("a", new PrefixAttributeRewriter("href", mountPath))
    .on("link", new PrefixAttributeRewriter("href", mountPath))
    .on("script", new PrefixAttributeRewriter("src", mountPath))
    .on("img", new PrefixAttributeRewriter("src", mountPath))
    .on("iframe", new PrefixAttributeRewriter("src", mountPath))
    .on("form", new PrefixAttributeRewriter("action", mountPath))
    .on("source", new PrefixAttributeRewriter("src", mountPath))
    .on("video", new PrefixAttributeRewriter("src", mountPath))
    .on("audio", new PrefixAttributeRewriter("src", mountPath))
    .on("meta", new MetaContentRewriter(mountPath));

  return withNoBrokenEncoding(rewriter.transform(response));
}

function shouldHaveBody(method) {
  return !["GET", "HEAD"].includes(String(method).toUpperCase());
}

function rewriteRedirectLocation(response, targetBase, mountPath) {
  const status = response.status;
  const location = response.headers.get("location");

  if (!location || status < 300 || status >= 400) {
    return response;
  }

  const headers = new Headers(response.headers);

  try {
    const upstreamOrigin = new URL(targetBase).origin;
    const loc = new URL(location, upstreamOrigin);

    if (loc.origin === upstreamOrigin) {
      headers.set("location", `${mountPath}${loc.pathname}${loc.search}${loc.hash}`);
    }
  } catch {
    // 무시
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function withNoBrokenEncoding(response) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

class PrefixAttributeRewriter {
  constructor(attr, mountPath) {
    this.attr = attr;
    this.mountPath = mountPath;
  }

  element(el) {
    const value = el.getAttribute(this.attr);
    if (!value) return;

    // 건드리면 안 되는 것들
    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("//") ||
      value.startsWith("data:") ||
      value.startsWith("mailto:") ||
      value.startsWith("tel:") ||
      value.startsWith("#") ||
      value.startsWith("javascript:")
    ) {
      return;
    }

    // 이미 mountPath가 붙어 있으면 그대로 둠
    if (value === this.mountPath || value.startsWith(this.mountPath + "/")) {
      return;
    }

    // 루트 기준 경로
    if (value.startsWith("/")) {
      el.setAttribute(this.attr, this.mountPath + value);
      return;
    }

    // 상대 경로
    const normalized = value.replace(/^\.\//, "");
    el.setAttribute(this.attr, `${this.mountPath}/${normalized}`);
  }
}

class MetaContentRewriter {
  constructor(mountPath) {
    this.mountPath = mountPath;
  }

  element(el) {
    const httpEquiv = (el.getAttribute("http-equiv") || "").toLowerCase();
    const content = el.getAttribute("content");

    if (httpEquiv !== "refresh" || !content) return;

    const match = content.match(/^(\s*\d+\s*;\s*url=)(.+)$/i);
    if (!match) return;

    let target = match[2].trim();

    if (
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("//") ||
      target.startsWith("data:") ||
      target.startsWith("mailto:") ||
      target.startsWith("tel:") ||
      target.startsWith("#") ||
      target.startsWith("javascript:")
    ) {
      return;
    }

    if (target.startsWith("/") && !target.startsWith(this.mountPath + "/")) {
      el.setAttribute("content", `${match[1]}${this.mountPath}${target}`);
    }
  }
}

function proxyTopbar() {
  return `
<header class="welmoa-proxy-header">
  <div class="welmoa-proxy-header__inner">
    <a class="welmoa-proxy-brand" href="/">
      <span class="welmoa-proxy-brand__logo">W</span>
      <span class="welmoa-proxy-brand__text">
        <span class="welmoa-proxy-brand__title">Welmoa Tools</span>
        <span class="welmoa-proxy-brand__sub">복지업무 도구 포털</span>
      </span>
    </a>

    <nav class="welmoa-proxy-nav" aria-label="주요 메뉴">
      <a href="/" data-welmoa-nav="/">홈</a>
      <a href="/tools" data-welmoa-nav="/tools">도구</a>
      <a href="/updates" data-welmoa-nav="/updates">업데이트</a>
      <a href="/about" data-welmoa-nav="/about">소개</a>
    </nav>
  </div>
</header>
`;
}

function sharedCss() {
  return `
:root {
  --welmoa-bg: #f6f8fc;
  --welmoa-surface: #ffffff;
  --welmoa-text: #18212f;
  --welmoa-text-soft: #5d6b82;
  --welmoa-line: #dbe3ef;
  --welmoa-primary: #2563eb;
  --welmoa-primary-strong: #1d4ed8;
  --welmoa-radius-lg: 18px;
  --welmoa-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
  --welmoa-max: 1200px;
}

html, body {
  background: var(--welmoa-bg) !important;
}

.welmoa-proxy-header {
  position: sticky;
  top: 0;
  z-index: 9999;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(219, 227, 239, 0.95);
}

.welmoa-proxy-header__inner {
  max-width: var(--welmoa-max);
  margin: 0 auto;
  min-height: 72px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.welmoa-proxy-brand {
  text-decoration: none;
  color: var(--welmoa-text);
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.welmoa-proxy-brand__logo {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #2563eb, #60a5fa);
  color: #fff;
  font-weight: 800;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.welmoa-proxy-brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.welmoa-proxy-brand__title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.welmoa-proxy-brand__sub {
  font-size: 12px;
  color: var(--welmoa-text-soft);
}

.welmoa-proxy-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.welmoa-proxy-nav a {
  text-decoration: none;
  color: var(--welmoa-text-soft);
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 999px;
  transition: 0.2s ease;
}

.welmoa-proxy-nav a:hover,
.welmoa-proxy-nav a.is-active {
  background: #eff6ff;
  color: var(--welmoa-primary-strong);
}

.welmoa-proxy-shell {
  width: min(var(--welmoa-max), calc(100% - 32px));
  margin: 24px auto 40px;
}

.welmoa-hide-legacy-nav {
  display: none !important;
}

@media (max-width: 720px) {
  .welmoa-proxy-header__inner {
    min-height: auto;
    padding: 14px 16px;
    flex-direction: column;
    align-items: flex-start;
  }

  .welmoa-proxy-nav {
    width: 100%;
  }

  .welmoa-proxy-shell {
    width: calc(100% - 20px);
    margin-top: 16px;
  }
}
`;
}

function sharedJs() {
  return `
(function () {
  function setActive(target) {
    document.querySelectorAll("[data-welmoa-nav]").forEach((a) => {
      if (a.getAttribute("data-welmoa-nav") === target) {
        a.classList.add("is-active");
      }
    });
  }

  function markActiveMenu() {
    const path = window.location.pathname.replace(/\\/+$/, "") || "/";

    document.querySelectorAll("[data-welmoa-nav]").forEach((link) => {
      const target = link.getAttribute("data-welmoa-nav");

      if (target === "/" && path === "/") {
        link.classList.add("is-active");
      } else if (target !== "/" && path === target) {
        link.classList.add("is-active");
      }
    });

    if (path.startsWith("/salary")) {
      setActive("/tools");
    }

    if (path.startsWith("/lottery")) {
      setActive("/tools");
    }
  }

  function buildShell() {
    const header = document.querySelector(".welmoa-proxy-header");
    if (!header) return;
    if (document.querySelector(".welmoa-proxy-shell")) return;

    const shell = document.createElement("div");
    shell.className = "welmoa-proxy-shell";

    const nodes = Array.from(document.body.childNodes);
    nodes.forEach((node) => {
      if (node === header) return;
      shell.appendChild(node);
    });

    document.body.appendChild(shell);
  }

  function hideLegacyTopNav() {
    const shell = document.querySelector(".welmoa-proxy-shell");
    if (!shell) return;

    const elements = Array.from(shell.children).filter(
      (el) => el.nodeType === 1
    );
    if (!elements.length) return;

    for (const el of elements.slice(0, 3)) {
      const text = (el.textContent || "").replace(/\\s+/g, " ").trim();
      const links = el.querySelectorAll("a");

      if (!links.length) continue;

      const hrefs = Array.from(links).map(
        (a) => a.getAttribute("href") || ""
      );

      const hasPortalLinks =
        hrefs.some((h) =>
          h === "/" ||
          h === "/tools" ||
          h === "/updates" ||
          h === "/about" ||
          h === "/guide" ||
          h === "/privacy" ||
          h === "/terms"
        );

      const looksLikeSimpleNav =
        text.length <= 80 &&
        links.length >= 3 &&
        links.length <= 8;

      if (hasPortalLinks || looksLikeSimpleNav) {
        el.classList.add("welmoa-hide-legacy-nav");
        break;
      }
    }
  }

  markActiveMenu();
  buildShell();
  hideLegacyTopNav();
})();
`;
}
