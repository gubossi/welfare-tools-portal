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

    // 급여조회 프록시
    if (pathname === "/salary" || pathname.startsWith("/salary/")) {
      return proxyToWithShell(
        request,
        "https://welfare-8nl.pages.dev",
        "/salary",
        "salary"
      );
    }

    // 추첨 프록시
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxyToWithShell(
        request,
        "https://lottery-webapp.gubossi.workers.dev",
        "/lottery",
        "lottery"
      );
    }

    // 급여 앱이 루트 기준으로 사용하는 html/css/js/img 같은 경로도 급여 앱으로 연결
    if (isSalaryTopLevelRoute(pathname)) {
      return proxyToWithShell(
        request,
        "https://welfare-8nl.pages.dev",
        "",
        "salary"
      );
    }

    // 나머지는 기존처럼 정적 포털 홈/자산 처리
    return env.ASSETS.fetch(request);
  }
};

async function proxyToWithShell(request, upstreamOrigin, mountPath, activeKey) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(upstreamOrigin);

  let rewrittenPath = incomingUrl.pathname;

  if (mountPath) {
    rewrittenPath = incomingUrl.pathname.slice(mountPath.length);
    if (!rewrittenPath.startsWith("/")) rewrittenPath = "/" + rewrittenPath;
    if (rewrittenPath === "//") rewrittenPath = "/";
    if (rewrittenPath === "") rewrittenPath = "/";
  }

  upstreamUrl.pathname = rewrittenPath;
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.set("host", upstreamUrl.host);

  const init = {
    method: request.method,
    headers,
    redirect: "manual"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const upstreamRequest = new Request(upstreamUrl.toString(), init);
  const upstreamResponse = await fetch(upstreamRequest);

  const contentType = upstreamResponse.headers.get("content-type") || "";

  const rewrittenHeaders = rewriteLocationHeader(
    upstreamResponse.headers,
    upstreamOrigin,
    incomingUrl,
    mountPath,
    activeKey
  );

  if (!contentType.includes("text/html")) {
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: rewrittenHeaders
    });
  }

  let response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: rewrittenHeaders
  });

  response = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(injectedHead(activeKey), { html: true });
      }
    })
    .on("body", {
      element(el) {
        el.prepend(injectedHeader(activeKey), { html: true });
        el.append(injectedFooter(), { html: true });
        el.append(`<script src="/_welmoa/shared.js"></script>`, { html: true });
      }
    })
    .on("a[href]", new PrefixRootRelativeUrls(mountPath, activeKey))
    .on("link[href]", new PrefixRootRelativeUrls(mountPath, activeKey))
    .on("script[src]", new PrefixRootRelativeSrc(mountPath, activeKey))
    .on("img[src]", new PrefixRootRelativeSrc(mountPath, activeKey))
    .on("form[action]", new PrefixRootRelativeAction(mountPath, activeKey))
    .transform(response);

  const finalHeaders = new Headers(response.headers);
  finalHeaders.delete("content-security-policy");
  finalHeaders.delete("content-security-policy-report-only");
  finalHeaders.delete("x-frame-options");
  finalHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: finalHeaders
  });
}

function rewriteLocationHeader(originalHeaders, upstreamOrigin, incomingUrl, mountPath, activeKey) {
  const newHeaders = new Headers(originalHeaders);
  const location = newHeaders.get("location");
  if (!location) return newHeaders;

  try {
    const upstreamBase = new URL(upstreamOrigin);
    const locUrl = new URL(location, upstreamOrigin);

    if (locUrl.origin === upstreamBase.origin) {
      locUrl.host = incomingUrl.host;
      locUrl.protocol = incomingUrl.protocol;

      if (mountPath) {
        locUrl.pathname = mountPath + (locUrl.pathname === "/" ? "" : locUrl.pathname);
      } else if (activeKey === "salary") {
        locUrl.pathname = "/salary" + (locUrl.pathname === "/" ? "" : locUrl.pathname);
      }

      newHeaders.set("location", locUrl.toString());
    }
  } catch {}

  return newHeaders;
}

function isSalaryTopLevelRoute(pathname) {
  if (
    pathname === "/" ||
    pathname.startsWith("/salary") ||
    pathname.startsWith("/lottery") ||
    pathname.startsWith("/_welmoa")
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

class PrefixRootRelativeUrls {
  constructor(mountPath, activeKey) {
    this.mountPath = mountPath;
    this.activeKey = activeKey;
  }

  element(el) {
    const href = el.getAttribute("href");
    if (!href) return;
    if (!href.startsWith("/")) return;
    if (href.startsWith("/_welmoa")) return;
    if (href.startsWith("/salary")) return;
    if (href.startsWith("/lottery")) return;
    if (href.startsWith("//")) return;

    if (this.mountPath) {
      el.setAttribute("href", this.mountPath + href);
      return;
    }

    if (this.activeKey === "salary") {
      el.setAttribute("href", "/salary" + href);
    }
  }
}

class PrefixRootRelativeSrc {
  constructor(mountPath, activeKey) {
    this.mountPath = mountPath;
    this.activeKey = activeKey;
  }

  element(el) {
    const src = el.getAttribute("src");
    if (!src) return;
    if (!src.startsWith("/")) return;
    if (src.startsWith("/_welmoa")) return;
    if (src.startsWith("/salary")) return;
    if (src.startsWith("/lottery")) return;
    if (src.startsWith("//")) return;

    if (this.mountPath) {
      el.setAttribute("src", this.mountPath + src);
      return;
    }

    if (this.activeKey === "salary") {
      el.setAttribute("src", "/salary" + src);
    }
  }
}

class PrefixRootRelativeAction {
  constructor(mountPath, activeKey) {
    this.mountPath = mountPath;
    this.activeKey = activeKey;
  }

  element(el) {
    const action = el.getAttribute("action");
    if (!action) return;
    if (!action.startsWith("/")) return;
    if (action.startsWith("/_welmoa")) return;
    if (action.startsWith("/salary")) return;
    if (action.startsWith("/lottery")) return;
    if (action.startsWith("//")) return;

    if (this.mountPath) {
      el.setAttribute("action", this.mountPath + action);
      return;
    }

    if (this.activeKey === "salary") {
      el.setAttribute("action", "/salary" + action);
    }
  }
}

function injectedHead(activeKey) {
  const title =
    activeKey === "salary"
      ? "급여조회 | Welmoa Tools"
      : "신청자 추첨 | Welmoa Tools";

  return `
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="welmoa-shell" content="true" />
    <title>${title}</title>
    <link rel="stylesheet" href="/_welmoa/shared.css">
    <script>window.__WELMOA_ACTIVE__ = "${activeKey}";</script>
  `;
}

function injectedHeader(activeKey) {
  return `
    <div id="welmoa-shell" data-active="${activeKey}">
      <header class="welmoa-header">
        <div class="welmoa-header-inner">
          <a class="welmoa-brand" href="/">
            <div class="welmoa-brand-mark">W</div>
            <div class="welmoa-brand-text">
              <div class="welmoa-brand-title">Welmoa Tools</div>
              <div class="welmoa-brand-sub">복지 실무자를 위한 업무 도구 포털</div>
            </div>
          </a>

          <nav class="welmoa-nav" aria-label="주요 메뉴">
            <a class="welmoa-nav-link" href="/">포털 홈</a>
            <a class="welmoa-nav-link ${activeKey === "salary" ? "active" : ""}" href="/salary">급여조회</a>
            <a class="welmoa-nav-link ${activeKey === "lottery" ? "active" : ""}" href="/lottery">신청자 추첨</a>
          </nav>
        </div>
      </header>
      <div class="welmoa-top-spacer"></div>
    </div>
  `;
}

function injectedFooter() {
  return `
    <footer class="welmoa-footer">
      <div class="welmoa-footer-inner">
        <div>
          <div class="welmoa-footer-title">Welmoa Tools</div>
          <div>사회복지 실무에 필요한 기능을 한 곳에서 편리하게.</div>
        </div>

        <div class="welmoa-footer-links">
          <a href="/">포털 홈</a>
          <a href="/salary">급여조회</a>
          <a href="/lottery">신청자 추첨</a>
        </div>
      </div>
    </footer>
  `;
}

function sharedJs() {
  return `
(function () {
  const active = window.__WELMOA_ACTIVE__ || "";
  const shell = document.getElementById("welmoa-shell");
  if (shell && active) {
    shell.setAttribute("data-active", active);
  }
})();
  `;
}

function sharedCss() {
  return `
:root{
  --welmoa-bg: #f4f7fb;
  --welmoa-surface: #ffffff;
  --welmoa-text: #16202a;
  --welmoa-muted: #627083;
  --welmoa-line: #dbe4ee;
  --welmoa-primary: #1f6feb;
  --welmoa-primary-soft: #eaf2ff;
  --welmoa-max: 1200px;
}

html{
  background:
    radial-gradient(circle at top left, rgba(31,111,235,0.06), transparent 22%),
    linear-gradient(180deg, #f8fbff 0%, #f3f6fa 100%);
}

body{
  margin: 0 !important;
  color: var(--welmoa-text);
}

.welmoa-header{
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(219,228,238,0.9);
}

.welmoa-header-inner{
  max-width: var(--welmoa-max);
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-family: "Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;
}

.welmoa-brand{
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}

.welmoa-brand-mark{
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #1f6feb 0%, #6aa5ff 100%);
  flex: 0 0 auto;
}

.welmoa-brand-title{
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.2;
}

.welmoa-brand-sub{
  font-size: 0.83rem;
  color: var(--welmoa-muted);
  margin-top: 2px;
  line-height: 1.2;
}

.welmoa-nav{
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.welmoa-nav-link{
  padding: 10px 14px;
  border-radius: 999px;
  color: var(--welmoa-muted);
  font-weight: 700;
  text-decoration: none;
  transition: all .2s ease;
  font-family: "Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;
}

.welmoa-nav-link:hover{
  background: var(--welmoa-primary-soft);
  color: var(--welmoa-primary);
}

.welmoa-nav-link.active{
  background: var(--welmoa-primary);
  color: #fff;
}

.welmoa-top-spacer{
  height: 76px;
}

.welmoa-footer{
  margin-top: 40px;
  background: rgba(255,255,255,0.84);
  border-top: 1px solid var(--welmoa-line);
  font-family: "Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;
}

.welmoa-footer-inner{
  max-width: var(--welmoa-max);
  margin: 0 auto;
  padding: 24px 20px 34px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  color: var(--welmoa-muted);
  font-size: 0.94rem;
}

.welmoa-footer-title{
  color: var(--welmoa-text);
  font-weight: 800;
  margin-bottom: 4px;
}

.welmoa-footer-links{
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.welmoa-footer-links a{
  color: inherit;
  text-decoration: none;
}

.welmoa-footer-links a:hover{
  color: var(--welmoa-primary);
}

/* lottery 앱 중앙 정렬 */
#welmoa-shell[data-active="lottery"] ~ * {
  max-width: 980px;
  margin-left: auto;
  margin-right: auto;
}

#welmoa-shell[data-active="lottery"] ~ .welmoa-footer {
  max-width: none;
}

@media (max-width: 860px){
  .welmoa-header-inner{
    flex-direction: column;
    align-items: flex-start;
  }

  .welmoa-nav{
    width: 100%;
    justify-content: flex-start;
  }

  .welmoa-top-spacer{
    height: 126px;
  }
}
  `;
}
