(() => {
  const API_BASE = 'https://tools.welmoa.kr/api/engagement';
  const sourceScript = document.currentScript;
  const explicitMount = document.querySelector('[data-welmoa-engagement-mount]');
  const pageType = explicitMount?.dataset.pageType || sourceScript?.dataset.welmoaEngagement || 'tool';
  if (!['content', 'tool'].includes(pageType) || document.querySelector('.welmoa-engagement')) return;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'https://tools.welmoa.kr/assets/engagement.css?v=20260802-2';
  document.head.append(stylesheet);

  const pageUrl = `${location.origin}${location.pathname.replace(/\/+$/, '') || '/'}`;
  const pageTitle = (document.querySelector('h1')?.textContent || document.title).trim().slice(0, 180);
  const reaction = pageType === 'tool' ? 'used' : 'helpful';
  const reactionLabel = pageType === 'tool' ? '실무에 활용했어요' : '도움이 되었어요';
  const localReactionKey = `welmoa-reaction:${reaction}:${pageUrl}`;

  const trackEvent = (eventName, parameters = {}) => {
    const eventParameters = {
      page_location: pageUrl,
      page_title: pageTitle,
      welmoa_page_type: pageType,
      ...parameters
    };

    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, eventParameters);
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...eventParameters });
  };

  let visitorId = localStorage.getItem('welmoa-visitor-id');
  if (!visitorId) {
    visitorId = crypto.randomUUID().replaceAll('-', '');
    localStorage.setItem('welmoa-visitor-id', visitorId);
  }

  const section = document.createElement('div');
  section.className = 'welmoa-engagement';
  section.setAttribute('aria-labelledby', 'welmoaEngagementTitle');
  section.innerHTML = `
    <div class="welmoa-engagement__inner">
      <h2 class="welmoa-engagement__title" id="welmoaEngagementTitle">
        ${pageType === 'tool' ? '이 도구가 실무에 도움이 되었나요?' : '이 글이 실무에 도움이 되었나요?'}
      </h2>
      <p class="welmoa-engagement__description">여러분의 반응과 의견은 Welmoa를 개선하는 데 활용됩니다.</p>
      <div class="welmoa-engagement__actions">
        <button type="button" data-action="react" aria-pressed="${localStorage.getItem(localReactionKey) === 'true'}">
          <span aria-hidden="true">👍</span> ${reactionLabel} <span data-reaction-count>0</span>
        </button>
        <button type="button" data-action="copy"><span aria-hidden="true">🔗</span> 링크 복사</button>
        <button type="button" data-action="share"><span aria-hidden="true">↗</span> 공유하기</button>
        <button class="welmoa-engagement__feedback-button" type="button" data-action="feedback">수정·보완 의견 보내기</button>
      </div>
      <p class="welmoa-engagement__status" role="status" aria-live="polite"></p>
    </div>
  `;

  const dialog = document.createElement('dialog');
  dialog.className = 'welmoa-feedback-dialog';
  dialog.innerHTML = `
    <form class="welmoa-feedback-form" method="dialog">
      <h2>Welmoa에 의견 보내기</h2>
      <p>보내주신 의견은 공개되지 않으며 콘텐츠와 도구 개선에만 사용합니다.</p>
      <label for="welmoaFeedbackCategory">의견 유형</label>
      <select id="welmoaFeedbackCategory" name="category">
        <option value="suggestion">내용·기능 제안</option>
        <option value="correction">내용 수정 요청</option>
        <option value="error">오류 제보</option>
        <option value="helpful">도움이 된 점</option>
      </select>
      <label for="welmoaFeedbackMessage">의견 내용</label>
      <textarea id="welmoaFeedbackMessage" name="message" maxlength="2000" required placeholder="어떤 점을 보완하면 좋을지 자유롭게 알려주세요."></textarea>
      <p class="welmoa-feedback-form__notice">기관명, 이용자 이름, 연락처 등 개인정보는 입력하지 마세요.</p>
      <div class="welmoa-feedback-form__actions">
        <button type="button" data-dialog-close>취소</button>
        <button class="welmoa-feedback-form__submit" type="submit" value="submit">의견 보내기</button>
      </div>
    </form>
  `;

  if (explicitMount) explicitMount.replaceWith(section);
  else (document.querySelector('main') || document.body).append(section);
  document.body.append(dialog);

  const status = section.querySelector('.welmoa-engagement__status');
  const reactionButton = section.querySelector('[data-action="react"]');
  const reactionCount = section.querySelector('[data-reaction-count]');

  const announce = (message) => {
    status.textContent = message;
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => { status.textContent = ''; }, 4500);
  };

  const api = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '요청을 처리하지 못했습니다.');
    return data;
  };

  api(`/summary?page=${encodeURIComponent(pageUrl)}`)
    .then((data) => { reactionCount.textContent = Number(data.reactions?.[reaction] || 0).toLocaleString('ko-KR'); })
    .catch(() => { reactionCount.textContent = '0'; });

  reactionButton.addEventListener('click', async () => {
    reactionButton.disabled = true;
    try {
      const data = await api('/react', {
        method: 'POST',
        body: JSON.stringify({ pageUrl, pageTitle, pageType, reaction, visitorId })
      });
      reactionButton.setAttribute('aria-pressed', String(data.selected));
      reactionCount.textContent = Number(data.count).toLocaleString('ko-KR');
      localStorage.setItem(localReactionKey, String(data.selected));
      trackEvent('engagement_reaction', {
        reaction_type: reaction,
        reaction_action: data.selected ? 'select' : 'cancel'
      });
      announce(data.selected ? '반응을 남겨주셔서 감사합니다.' : '반응을 취소했습니다.');
    } catch (error) {
      announce(error.message);
    } finally {
      reactionButton.disabled = false;
    }
  });

  const recordShare = (channel) => api('/share', {
    method: 'POST',
    body: JSON.stringify({ pageUrl, pageTitle, pageType, channel })
  }).catch(() => {});

  section.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      recordShare('copy');
      trackEvent('engagement_share', { share_method: 'copy' });
      announce('링크를 복사했습니다.');
    } catch {
      announce('주소창의 링크를 복사해 주세요.');
    }
  });

  section.querySelector('[data-action="share"]').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: pageTitle, text: pageTitle, url: pageUrl });
        recordShare('native');
        trackEvent('engagement_share', { share_method: 'native' });
      } catch (error) {
        if (error.name !== 'AbortError') announce('공유 기능을 열지 못했습니다.');
      }
    } else {
      try {
        await navigator.clipboard.writeText(pageUrl);
        recordShare('copy');
        trackEvent('engagement_share', { share_method: 'copy_fallback' });
        announce('공유할 수 있도록 링크를 복사했습니다.');
      } catch {
        announce('주소창의 링크를 복사해 주세요.');
      }
    }
  });

  section.querySelector('[data-action="feedback"]').addEventListener('click', () => {
    trackEvent('engagement_feedback_open');
    dialog.showModal();
  });
  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const formData = new FormData(form);
    submit.disabled = true;
    try {
      const data = await api('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          pageUrl,
          pageTitle,
          pageType,
          category: formData.get('category'),
          message: formData.get('message')
        })
      });
      form.reset();
      dialog.close();
      trackEvent('engagement_feedback_submit', {
        feedback_category: formData.get('category')
      });
      announce(data.message);
    } catch (error) {
      announce(error.message);
      dialog.close();
    } finally {
      submit.disabled = false;
    }
  });
})();
