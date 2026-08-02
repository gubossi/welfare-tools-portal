(() => {
  const PANEL_ID = 'welmoaGlobalSearchPanel';

  const engagementPaths = new Set([
    '/salary',
    '/lottery',
    '/shortener',
    '/formatter',
    '/tools/hobong',
    '/tools/operation-log',
    '/tools/eapproval'
  ]);
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';

  const footerCopy = document.querySelector('.footer-copy > div');
  if (footerCopy && !footerCopy.querySelector('.welmoa-admin-link') && footerCopy.innerHTML.includes('© Welmoa.')) {
    footerCopy.innerHTML = footerCopy.innerHTML.replace(
      '© Welmoa.',
      '<a class="welmoa-admin-link" href="https://tools.welmoa.kr/feedback/" aria-label="Welmoa 운영자 화면" style="color:inherit;text-decoration:none">© Welmoa.</a>'
    );
  }

  const footerLinks = document.querySelector('.footer-links');
  if (footerLinks && !footerLinks.querySelector('a[href*="/tools/"]')) {
    const toolsLink = document.createElement('a');
    toolsLink.href = 'https://tools.welmoa.kr/tools/';
    toolsLink.textContent = '도구';
    const privacyLink = Array.from(footerLinks.querySelectorAll('a')).find((link) =>
      link.href.includes('/privacy/')
    );
    footerLinks.insertBefore(toolsLink, privacyLink || null);
  }

  if (engagementPaths.has(normalizedPath) && !document.querySelector('script[data-welmoa-engagement]')) {
    const engagementScript = document.createElement('script');
    engagementScript.src = 'https://tools.welmoa.kr/assets/engagement.js?v=20260802-3';
    engagementScript.defer = true;
    engagementScript.dataset.welmoaEngagement = 'tool';
    document.head.append(engagementScript);
  }

  function installSearch() {
    if (document.querySelector('.welmoa-global-search-toggle')) return true;

    const header = document.querySelector('.site-header') || document.querySelector('body > header');
    const nav = header?.querySelector('nav');

    if (!header || !nav) return false;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'welmoa-global-search-toggle';
    toggle.setAttribute('aria-label', '검색 열기');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', PANEL_ID);
    toggle.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m16.5 16.5 4 4"></path>
      </svg>
      <span class="welmoa-global-search-label">검색</span>
    `;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'welmoa-global-search-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <form class="welmoa-global-search-form" action="https://blog.welmoa.kr/blog/" method="get" role="search">
        <label for="welmoaGlobalSearchInput">콘텐츠 검색</label>
        <div class="welmoa-global-search-field">
          <input id="welmoaGlobalSearchInput" name="q" type="search" placeholder="제목, 설명 또는 분류로 검색해 보세요" autocomplete="off">
          <button class="welmoa-global-search-submit" type="submit">검색</button>
        </div>
      </form>
    `;

    nav.append(toggle);
    header.insertAdjacentElement('afterend', panel);

    const input = panel.querySelector('input');
    const close = () => {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', '검색 열기');
    };

    toggle.addEventListener('click', () => {
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      toggle.setAttribute('aria-expanded', String(willOpen));
      toggle.setAttribute('aria-label', willOpen ? '검색 닫기' : '검색 열기');
      if (willOpen) input?.focus();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        close();
        toggle.focus();
      }
    });

    return true;
  }

  if (installSearch()) return;

  const observer = new MutationObserver(() => {
    if (installSearch()) observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 15000);
})();
