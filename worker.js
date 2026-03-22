export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // salary 앱 프록시
    if (pathname === "/salary" || pathname.startsWith("/salary/")) {
      return proxyTo(request, "https://welfare-8nl.pages.dev", "/salary");
    }

    // lottery 앱 프록시
    if (pathname === "/lottery" || pathname.startsWith("/lottery/")) {
      return proxyTo(request, "https://lottery-webapp.gubossi.workers.dev", "/lottery");
    }

    // 루트 접속 처리
    if (pathname === "/") {
      return env.ASSETS.fetch(
        new Request(new URL("/index.html", request.url), request)
      );
    }

    // 나머지는 그대로 정적 자산
    return env.ASSETS.fetch(request);
  }
};

async function proxyTo(request, targetOrigin, mountPath) {
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

  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
}
