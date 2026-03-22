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

    // 루트(/)는 index.html로 연결
    if (pathname === "/") {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    // 나머지는 portal-site 기준 정적 파일 그대로 처리
    return env.ASSETS.fetch(request);
  }
};

async function proxyTo(request, targetOrigin, mountPath) {
  const incomingUrl = new URL(request.url);

  let upstreamPath = incomingUrl.pathname;
  if (mountPath && upstreamPath.startsWith(mountPath)) {
    upstreamPath = incomingUrl.pathname.slice(mountPath.length) || "/";
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
