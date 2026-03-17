export default {
  async fetch(request) {
    const url = new URL(request.url);

    // salary 페이지
    if (url.pathname.startsWith("/salary")) {
      return fetch("https://welfare-8nl.pages.dev/");
    }

    // lottery 페이지
    if (url.pathname.startsWith("/lottery")) {
      return fetch("https://lottery-webapp.gubossi.workers.dev/");
    }

    // 나머지는 기존 사이트
    return fetch(request);
  }
};
