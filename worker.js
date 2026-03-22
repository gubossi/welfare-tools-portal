export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Worker가 직접 제공하는 공통 CSS
    if (pathname === "/_welmoa/shared.css") {
      return new Response(sharedCss(), {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
      });
    }

    // Worker가 직접 제공하는 공통 JS
    if (pathname === "/_welmoa/shared.js") {
      return new Response(sharedJs(), {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
      });
    }

    // 1. salary 앱 프록시
    if (pathname === "/salary" || pathname.startsWith("/salary/")) {
      return proxyToWithShell(
        request,
        "https://welfare-8nl.pages.dev",
        "/salary"
      );
    }

    // 2. lottery 앱 프록시
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxyToWithShell(
        request,
        "https://lottery-webapp.gubossi.workers.dev",
        "/lottery"
      );
    }

    // 3. 포털 정적 파일은 portal-site 아래에서 찾기
    const portalRequest = mapPortalAssetRequest(request);
    const assetResponse = await env.ASSETS.fetch(portalRequest);

    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    return new Response("Not Found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
};

function mapPortalAssetRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 루트 접속 -> portal-site/index.html
  if (pathname === "/") {
    url.pathname = "/portal-site/index.html";
    return new Request(url.toString(), request);
  }

  // 포털 전용 페이지
  if (pathname === "/tools") {
    url.pathname = "/portal-site/tools.html";
    return new Request(url.toString(), request);
  }

  if (pathname === "/updates") {
    url.pathname = "/portal-site/updates.html";
    return new Request(url.toString(), request);
  }

  if (pathname === "/about") {
    url.pathname = "/portal-site/about.html";
    return new Request(url.toString(), request);
  }

  // 정적 자산
  if (pathname.startsWith("/assets/")) {
    url.pathname = "/portal-site" + pathname;
    return new Request(url.toString(), request);
  }

  // guide, privacy, terms 같은 폴더형 페이지
  if (
    pathname === "/guide" ||
    pathname.startsWith("/guide/") ||
    pathname === "/privacy" ||
    pathname.startsWith("/privacy/") ||
    pathname === "/terms" ||
    pathname.startsWith("/terms/")
  ) {
    url.pathname = "/portal-site" + pathname;
    return new Request(url.toString(), request);
  }

  // html 직접 접근
  if (
    pathname === "/index.html" ||
    pathname === "/tools.html" ||
    pathname === "/updates.html" ||
    pathname === "/about.html"
  ) {
    url.pathname = "/portal-site" + pathname;
    return new Request(url.toString(), request);
  }

  // favicon, robots, sitemap
  if (
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    url.pathname = "/portal-site" + pathname;
    return new Request(url.toString(), request);
  }

  // 그 외도 일단 portal-site 아래에서 찾기
  url.pathname = "/portal-site" + pathname;
  return new Request(url.toString(), request);
}

async function proxyToWithShell(request, targetOrigin, mountPath) {
  const incomingUrl = new URL(request.url);

  let upstreamPath = incomingUrl.pathname;
  if (mountPath && upstreamPath.startsWith(mountPath)) {
    upstreamPath = upstreamPath.slice(mountPath.length) || "/";
  }

  const upstreamUrl = new URL(targetOrigin);
  upstreamUrl.pathname = upstreamPath;
  upstreamUrl.search = incomingUrl.search;

  const proxyRequest = new Request(upstreamUrl.toString(), request);
  const response = await fetch(proxyRequest, {
    redirect: "follow"
  });

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/html")) {
    let html = await response.text();
    html = rewriteHtmlPaths(html, mountPath);

    const headers = new Headers(response.headers);
    headers.set("content-type", "text/html; charset=utf-8");

    return new Response(html, {
      status: response.status,
      headers
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
}

function rewriteHtmlPaths(html, mountPath) {
  const prefix = mountPath === "/" ? "" : mountPath;

  html = html.replace(
    /(src|href)=["']\/(?!\/)([^"']+)["']/gi,
    (match, attr, path) => {
      if (
        path.startsWith("assets/") ||
        path.startsWith("favicon") ||
        path.startsWith("manifest") ||
        path.startsWith("icons/") ||
        path.startsWith("static/") ||
        path.endsWith(".js") ||
        path.endsWith(".css") ||
        path.endsWith(".png") ||
        path.endsWith(".jpg") ||
        path.endsWith(".jpeg") ||
        path.endsWith(".svg") ||
        path.endsWith(".webp") ||
        path.endsWith(".ico") ||
        path.endsWith(".woff") ||
        path.endsWith(".woff2") ||
        path.endsWith(".ttf") ||
        path.endsWith(".map") ||
        path.endsWith(".json")
      ) {
        return `${attr}="${prefix}/${path}"`;
      }
      return match;
    }
  );

  if (!/<base\s/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${prefix}/">`
    );
  }

  return html;
}

function sharedCss() {
  return `
:root {
  --welmoa-primary: #2563eb;
  --welmoa-primary-dark: #1d4ed8;
  --welmoa-text: #0f172a;
  --welmoa-muted: #64748b;
  --welmoa-bg: #f8fafc;
  --welmoa-card: #ffffff;
  --welmoa-border: #e2e8f0;
  --welmoa-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  --welmoa-radius: 20px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Pretendard", "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--welmoa-text);
  background: var(--welmoa-bg);
}
`;
}

function sharedJs() {
  return `
document.addEventListener("DOMContentLoaded", () => {
  console.log("Welmoa shared.js loaded");
});
`;
}
