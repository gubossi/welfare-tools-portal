export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/salary" || url.pathname.startsWith("/salary/")) {
      return proxyTo(request, "https://welfare-8nl.pages.dev", "/salary");
    }

    if (url.pathname === "/lottery" || url.pathname.startsWith("/lottery/")) {
      return proxyTo(request, "https://lottery-webapp.gubossi.workers.dev", "/lottery");
    }

    // 나머지는 정적 사이트 자산(index.html, guide/, privacy/, terms/ 등)
    return env.ASSETS.fetch(request);
  },
};

async function proxyTo(request, upstreamOrigin, mountPath) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(upstreamOrigin);

  let rewrittenPath = incomingUrl.pathname.slice(mountPath.length);
  if (!rewrittenPath.startsWith("/")) rewrittenPath = "/" + rewrittenPath;
  if (rewrittenPath === "//") rewrittenPath = "/";

  upstreamUrl.pathname = rewrittenPath;
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.set("host", upstreamUrl.host);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const upstreamRequest = new Request(upstreamUrl.toString(), init);
  const response = await fetch(upstreamRequest);

  const newHeaders = new Headers(response.headers);

  const location = newHeaders.get("location");
  if (location) {
    try {
      const locUrl = new URL(location, upstreamOrigin);
      if (locUrl.origin === upstreamOrigin) {
        locUrl.host = incomingUrl.host;
        locUrl.protocol = incomingUrl.protocol;
        locUrl.pathname = mountPath + (locUrl.pathname === "/" ? "/" : locUrl.pathname);
        newHeaders.set("location", locUrl.toString());
      }
    } catch (e) {
      // 그대로 둠
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
