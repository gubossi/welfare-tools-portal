export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 공통 CSS
    if (pathname === "/_welmoa/shared.css") {
      return new Response(sharedCss(), {
        headers: { "content-type": "text/css; charset=utf-8" }
      });
    }

    // 공통 JS
    if (pathname === "/_welmoa/shared.js") {
      return new Response(sharedJs(), {
        headers: { "content-type": "application/javascript; charset=utf-8" }
      });
    }

    // salary
    if (pathname === "/salary" || pathname.startsWith("/salary/")) {
      return proxyWithShell(request, "https://welfare-8nl.pages.dev", "/salary");
    }

    // lottery (수정된 주소)
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxyWithShell(
        request,
        "https://lottery-webapp.gubossi.workers.dev",
        "/lottery"
      );
    }

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

  const res = await fetch(new Request(upstreamUrl, request));
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return res;

  return new HTMLRewriter()
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
    })
    .transform(res);
}

function proxyTopbar() {
  return `
<div class="welmoa-bar">
  <div class="welmoa-inner">
    <a href="/" class="welmoa-logo">Welmoa Tools</a>
    <div class="welmoa-menu">
      <a href="/">홈</a>
      <a href="/tools">도구</a>
      <a href="/updates">업데이트</a>
      <a href="/about">소개</a>
    </div>
  </div>
</div>
`;
}
