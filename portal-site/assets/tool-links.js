(function () {
  "use strict";

  const tools = [
    {
      id: "salary",
      title: "급여조회 💰",
      description: "급여 및 수당 계산",
      url: "/salary"
    },
    {
      id: "lottery",
      title: "신청자 추첨 🎲",
      description: "공정한 추첨 진행",
      url: "/lottery"
    },
    {
      id: "shortener",
      title: "URL 단축 🔗",
      description: "링크 간편 공유",
      url: "/shortener"
    },
    {
      id: "formatter",
      title: "명단정리 🧾",
      description: "데이터 정리 자동화",
      url: "/formatter"
    },
    {
      id: "operation-log",
      title: "총괄운영일지 Beta 📔",
      description: "운영실적과 일지관리",
      url: "/tools/operation-log/"
    },
    {
      id: "eapproval",
      title: "교육용 모의 전자결재 ✅",
      description: "기안·반려·승인 실습",
      url: "/tools/eapproval/"
    }
  ];

  function detectCurrentTool(pathname) {
    return tools.find(function (tool) {
      const normalizedPath = pathname.replace(/\/+$/, "");
      const normalizedUrl = tool.url.replace(/\/+$/, "");
      return normalizedPath === normalizedUrl ||
        normalizedPath.indexOf(normalizedUrl + "/") === 0;
    });
  }

  function createToolCard(tool, extraClass) {
    const link = document.createElement("a");
    link.className = "tool-nav-card" + (extraClass ? " " + extraClass : "");
    link.href = tool.url;

    const title = document.createElement("div");
    title.className = "tool-nav-title";
    title.textContent = tool.title;

    const description = document.createElement("div");
    description.className = "tool-nav-desc";
    description.textContent = tool.description;

    link.append(title, description);
    return link;
  }

  function renderToolNavigation(container) {
    const currentId = container.dataset.currentTool ||
      (detectCurrentTool(window.location.pathname) || {}).id;
    const limit = Number(container.dataset.toolLimit || 5);

    tools
      .filter(function (tool) { return tool.id !== currentId; })
      .slice(0, limit)
      .forEach(function (tool) {
        container.appendChild(createToolCard(tool));
      });

    container.appendChild(createToolCard({
      title: "도구 전체보기 →",
      description: "웰모아 도구 모아보기",
      url: "/tools/"
    }, "tool-nav-card--all"));

    container.classList.add("is-shared");
  }

  document.querySelectorAll("[data-tool-nav]").forEach(renderToolNavigation);
})();
