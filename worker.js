export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/_welmoa/shared.css") {
      return new Response(sharedCss(), {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
      });
    }

    if (pathname === "/_welmoa/shared.js") {
      return new Response(sharedJs(), {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
      });
    }

    if (pathname === "/salary" || pathname.startsWith("/salary/")) {
      return proxyWithShell(
        request,
        "https://welfare-8nl.pages.dev",
        "/salary",
        "salary"
      );
    }

    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxyWithShell(
        request,
        "https://lottery-webapp.gubossi.workers.dev",
        "/lottery",
        "lottery"
      );
    }

    return env.ASSETS.fetch(request);
  }
};

async function proxyWithShell(request, targetOrigin, mountPath, appName) {
  const incomingUrl = new URL(request.url);

  let upstreamPath = incomingUrl.pathname;
  if (upstreamPath.startsWith(mountPath)) {
    upstreamPath = upstreamPath.slice(mountPath.length) || "/";
  }

  const upstreamUrl = new URL(targetOrigin);
  upstreamUrl.pathname = upstreamPath;
  upstreamUrl.search = incomingUrl.search;

  const response = await fetch(new Request(upstreamUrl.toString(), request), {
    redirect: "follow"
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  }

  let html = await response.text();

  if (html.includes("</head>")) {
    html = html.replace(
      "</head>",
      `<link rel="stylesheet" href="/_welmoa/shared.css">
<script defer src="/_welmoa/shared.js"></script>
</head>`
    );
  }

  html = html.replace(
    /<body([^>]*)>/i,
    `<body$1>${renderShell(appName)}<div class="welmoa-page-body">`
  );

  html = html.replace(/<\/body>/i, `</div></body>`);

  html = rewriteAssetPaths(html, mountPath);

  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");

  return new Response(html, {
    status: response.status,
    headers
  });
}

function rewriteAssetPaths(html, mountPath) {
  return html.replace(
    /(src|href|action)=["']\/(?!\/)([^"']+)["']/gi,
    (match, attr, path) => {
      if (path.startsWith("_welmoa/")) return match;

      if (
        path.startsWith("assets/") ||
        path.startsWith("static/") ||
        path.startsWith("icons/") ||
        path.startsWith("images/") ||
        path.startsWith("img/") ||
        path.startsWith("fonts/") ||
        path.startsWith("favicon") ||
        path.startsWith("manifest") ||
        path.endsWith(".css") ||
        path.endsWith(".js") ||
        path.endsWith(".json") ||
        path.endsWith(".png") ||
        path.endsWith(".jpg") ||
        path.endsWith(".jpeg") ||
        path.endsWith(".svg") ||
        path.endsWith(".webp") ||
        path.endsWith(".ico") ||
        path.endsWith(".woff") ||
        path.endsWith(".woff2") ||
        path.endsWith(".ttf") ||
        path.endsWith(".map")
      ) {
        return `${attr}="${mountPath}/${path}"`;
      }
      return match;
    }
  );
}

function renderShell(active) {
  return `
<header class="welmoa-topbar">
  <div class="welmoa-wrap">
    <a class="welmoa-brand" href="/">Welmoa Tools</a>
    <nav class="welmoa-nav">
      <a href="/">홈</a>
      <a href="/salary" class="${active === "salary" ? "is-active" : ""}">급여조회</a>
      <a href="/lottery" class="${active === "lottery" ? "is-active" : ""}">신청자 추첨</a>
      <a href="/guide">가이드</a>
      <a href="/privacy">개인정보</a>
      <a href="/terms">이용약관</a>
    </nav>
  </div>
</header>`;
}

function sharedCss() {
  return `
:root {
  --welmoa-bg:#f8fafc;
  --welmoa-border:#e5e7eb;
  --welmoa-text:#111827;
  --welmoa-primary:#2563eb;
  --welmoa-primary-soft:#eff6ff;
}
body { margin:0; background:var(--welmoa-bg); color:var(--welmoa-text); font-family:"Pretendard","Noto Sans KR",system-ui,sans-serif; }
.welmoa-topbar { position:sticky; top:0; z-index:1000; background:rgba(255,255,255,.96); border-bottom:1px solid var(--welmoa-border); }
.welmoa-wrap { max-width:1280px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
.welmoa-brand { font-size:22px; font-weight:800; color:var(--welmoa-text); text-decoration:none; }
.welmoa-nav { display:flex; flex-wrap:wrap; gap:10px; }
.welmoa-nav a { text-decoration:none; color:#374151; padding:8px 12px; border-radius:10px; }
.welmoa-nav a.is-active { background:var(--welmoa-primary-soft); color:#1d4ed8; font-weight:700; }
.welmoa-page-body { max-width:1280px; margin:0 auto; padding:24px 20px 40px; }
`;
}

function sharedJs() {
  return `console.log("Welmoa shared shell loaded");`;
}
