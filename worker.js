export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 공통 CSS
    if (pathname === "/_welmoa/shared.css") {
      return new Response(sharedCss(), {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
      });
    }

    // 공통 JS
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
      const targetBase = "https://welfare-8nl.pages.dev";
      return proxyWithShell(request, targetBase, "/salary");
    }

    // lottery reverse proxy
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      const targetBase = "https://lottery-webapp.gubossi.workers.dev";
      return proxyWithShell(request, targetBase, "/lottery");
    }

    // 나머지는 Assets
    return env.ASSETS.fetch(request);
  }
};

async function proxyWithShell(request, targetBase, mountPath) {
  const reqUrl = new URL(request.url);
  const upstreamPath = reqUrl.pathname.replace(mountPath, "") || "/";
  const upstreamUrl = new URL(targetBase + upstreamPath + reqUrl.search);

  const upstreamRequest = new Request(upstreamUrl.toString(), request);
  const response = await fetch(upstreamRequest);

  const contentType = response.headers.get("content-type") || "";

  // HTML만 리라이트
  if (!contentType.includes("text/html")) {
    return response;
  }

  const rewriter = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(`
<link rel="stylesheet" href="/_welmoa/shared.css">
<script defer src="/_welmoa/shared.js"></script>
`, { html: true });
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
<div class="welmoa-proxybar">
  <div class="welmoa-proxybar__inner">
    <a class="welmoa-proxybar__brand" href="/">Welmoa Tools</a>
    <nav class="welmoa-proxybar__nav" aria-label="주요 메뉴">
      <a href="/">홈</a>
      <a href="/tools">도구</a>
      <a href="/updates">업데이트</a>
      <a href="/about">소개</a>
    </nav>
  </div>
</div>
`;
}

function sharedCss() {
  return `
:root {
  --welmoa-bg: #f6f8fc;
  --welmoa-surface: #ffffff;
  --welmoa-surface-2: #f8fbff;
  --welmoa-text: #18212f;
  --welmoa-text-soft: #5d6b82;
  --welmoa-line: #dbe3ef;
  --welmoa-primary: #2563eb;
  --welmoa-primary-strong: #1d4ed8;
  --welmoa-radius: 18px;
  --welmoa-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
  --welmoa-max: 1200px;
}

.welmoa-proxybar {
  position: sticky;
  top: 0;
  z-index: 9999;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--welmoa-line);
}

.welmoa-proxybar__inner {
  max-width: var(--welmoa-max);
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.welmoa-proxybar__brand {
  font-size: 18px;
  font-weight: 800;
  color: var(--welmoa-text);
  text-decoration: none;
  letter-spacing: -0.02em;
}

.welmoa-proxybar__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.welmoa-proxybar__nav a {
  text-decoration: none;
  color: var(--welmoa-text-soft);
  padding: 8px 12px;
  border-radius: 999px;
  font-weight: 600;
}

.welmoa-proxybar__nav a:hover {
  background: #eef4ff;
  color: var(--welmoa-primary-strong);
}

@media (max-width: 720px) {
  .welmoa-proxybar__inner {
    flex-direction: column;
    align-items: flex-start;
  }

  .welmoa-proxybar__nav {
    width: 100%;
  }
}
`;
}

function sharedJs() {
  return `
console.log("Welmoa shared UI loaded");
`;
}
