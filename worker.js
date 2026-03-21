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

    // 1. 포털 정적 자산 우선 처리
    if (pathname.startsWith("/assets/")) {
      return env.ASSETS.fetch(request);
    }

    // 2. 포털 페이지 라우팅
    const portalPageMap = {
      "/": "/index.html",
      "/tools": "/tools.html",
      "/updates": "/updates.html",
      "/about": "/about.html"
    };

    if (portalPageMap[pathname]) {
      const assetUrl = new URL(portalPageMap[pathname], url.origin);
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    // 직접 html 접근 허용
    if (
      pathname === "/index.html" ||
      pathname === "/tools.html" ||
      pathname === "/updates.html" ||
      pathname === "/about.html" ||
      pathname === "/favicon.ico"
    ) {
      return env.ASSETS.fetch(request);
    }

    // 3. salary 앱 프록시
    if (pathname === "/salary" || pathname.startsWith("/salary/")) {
      return proxyToWithShell(
        request,
        "https://welfare-8nl.pages.dev",
        "/salary",
        "salary"
      );
    }

    // 4. lottery 앱 프록시
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxyToWithShell(
        request,
        "https://lottery-webapp.gubossi.workers.dev",
        "/lottery",
        "lottery"
      );
    }

    // 5. 급여 앱 루트 정적 자산 fallback
    // 예: /main.js, /app.css 같은 salary 앱의 루트 자산
    if (isSalaryTopLevelRoute(pathname)) {
      return proxyToWithShell(
        request,
        "https://welfare-8nl.pages.dev",
        "",
        "salary"
      );
    }

    // 6. 나머지는 포털 정적 파일에서 찾기
    const assetResponse = await env.ASSETS.fetch(request);
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

function isSalaryTopLevelRoute(pathname) {
  if (
    pathname === "/" ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/salary") ||
    pathname.startsWith("/lottery") ||
    pathname.startsWith("/_welmoa") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/updates") ||
    pathname.startsWith("/about")
  ) {
    return false;
  }

  if (pathname.endsWith(".html")) return true;

  if (
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".ttf") ||
    pathname.endsWith(".map")
  ) {
    return true;
  }

  return false;
}

async function proxyToWithShell(request, targetOrigin, mountPath, appName) {
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

  // HTML 응답은 필요 시 여기서 후처리 가능
  if (contentType.includes("text/html")) {
    let html = await response.text();

    // 앱 루트 경로 기준 링크 보정
    if (mountPath) {
      html = rewriteHtmlPaths(html, mountPath, appName);
    }

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

function rewriteHtmlPaths(html, mountPath, appName) {
  const prefix = mountPath === "/" ? "" : mountPath;

  // 절대경로 자산을 /salary/... 또는 /lottery/... 아래로 보정
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

  // SPA 라우팅용 base 태그가 없으면 삽입
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
