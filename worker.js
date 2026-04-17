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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 루트 도메인
    if (url.hostname === "welmoa.kr") {
      return new Response(ROOT_HTML, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    // 공통 리소스
    if (pathname === "/_welmoa/shared.css") {
      return new Response(sharedCss(), {
        headers: { "content-type": "text/css" }
      });
    }

    if (pathname === "/_welmoa/shared.js") {
      return new Response(sharedJs(), {
        headers: { "content-type": "application/javascript" }
      });
    }

    // URL 단축
    if (pathname.startsWith("/api/shorten")) {
      return handleShortApi(request, env);
    }

    if (pathname.startsWith("/s/")) {
      return handleShortRedirect(request, env);
    }

    // ✅ 핵심: salary (헤더 주입 없음)
    if (pathname === "/salary" || pathname.startsWith("/salary/")) {
      return proxy(request, "https://welfare-8nl.pages.dev", "/salary");
    }

    // ✅ 핵심: lottery (헤더 주입 없음)
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxy(request, "https://lottery-webapp.gubossi.workers.dev", "/lottery");
    }

    // 나머지
    return env.ASSETS.fetch(request);
  }
};

//////////////////////////////////////////////////////
// ✅ 핵심: "쉘 제거된 순수 프록시"
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

  // 👉 base만 유지 (경로 깨짐 방지)
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

  return new Response(rewriter.transform(response).body, response);
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
    ) return;

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
// 단축 URL
//////////////////////////////////////////////////////

async function handleShortApi(request, env) {
  if (request.method === "POST") {
    const { url } = await request.json();
    const slug = Math.random().toString(36).substring(2, 8);
    await env.SHORT_LINKS.put(slug, url);
    return new Response(JSON.stringify({ short: `/s/${slug}` }));
  }

  return new Response("Not allowed", { status: 405 });
}

async function handleShortRedirect(request, env) {
  const slug = request.url.split("/s/")[1];
  const target = await env.SHORT_LINKS.get(slug);
  if (!target) return new Response("Not found", { status: 404 });

  return Response.redirect(target, 302);
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
