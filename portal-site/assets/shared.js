(function () {
  const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";

  const isHome = normalizedPath === "/" || normalizedPath === "/index.html";
  const isSalary = normalizedPath === "/salary" || normalizedPath === "/salary/index.html";
  const isLottery = normalizedPath === "/lottery" || normalizedPath === "/lottery/index.html";

  function navLink(href, label, active) {
    return `<a class="nav-link ${active ? "active" : ""}" href="${href}">${label}</a>`;
  }

  const headerHtml = `
    <header class="site-header">
      <div class="site-header-inner">
        <a class="brand" href="/">
          <div class="brand-mark">W</div>
          <div class="brand-text">
            <div class="brand-title">Welmoa Tools</div>
            <div class="brand-sub">복지 실무자를 위한 업무 도구 포털</div>
          </div>
        </a>

        <nav class="site-nav" aria-label="주요 메뉴">
          ${navLink("/", "포털 홈", isHome)}
          ${navLink("/salary", "급여조회", isSalary)}
          ${navLink("/lottery", "신청자 추첨", isLottery)}
        </nav>
      </div>
    </header>
  `;

  const footerHtml = `
    <footer class="site-footer">
      <div class="site-footer-inner">
        <div>
          <div class="footer-title">Welmoa Tools</div>
          <div>사회복지 실무에 필요한 기능을 한 곳에서 편리하게.</div>
        </div>

        <div class="footer-links">
          <a href="/">포털 홈</a>
          <a href="/salary">급여조회</a>
          <a href="/lottery">신청자 추첨</a>
        </div>
      </div>
    </footer>
  `;

  document.addEventListener("DOMContentLoaded", function () {
    const headerMount = document.getElementById("site-header");
    const footerMount = document.getElementById("site-footer");

    if (headerMount) headerMount.innerHTML = headerHtml;
    if (footerMount) footerMount.innerHTML = footerHtml;
  });
})();
