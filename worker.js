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

async function proxyWithShell(request, targetBase, mountPath) {
  const reqUrl = new URL(request.url);

  const upstreamPath =
    reqUrl.pathname === mountPath
      ? "/"
      : reqUrl.pathname.slice(mountPath.length);

  const upstreamUrl = new URL(targetBase + upstreamPath + reqUrl.search);

  const upstreamRequest = new Request(upstreamUrl.toString(), request);
  const response = await fetch(upstreamRequest);

  const contentType = response.headers.get("content-type") || "";

  // HTML이 아닌 파일(css/js/img 등)은 그대로 전달
  if (!contentType.includes("text/html")) {
    return response;
  }

  const rewriter = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(
          `
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
    });

  return rewriter.transform(response);
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

/* 배경만 통일 */
html, body {
  background: var(--welmoa-bg) !important;
}

/* 상단 헤더 */
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

/* 원본 앱을 담는 바깥 쉘 */
.welmoa-proxy-shell {
  width: min(var(--welmoa-max), calc(100% - 32px));
  margin: 24px auto 40px;
}

/* 원본 앱의 최상단 단순 텍스트 링크 네비 제거용 */
.welmoa-hide-legacy-nav {
  display: none !important;
}

/* 모바일 */
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
