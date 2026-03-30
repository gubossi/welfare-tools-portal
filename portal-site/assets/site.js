document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const navLinks = document.querySelectorAll("[data-nav]");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    if (href === "/" && path === "/") {
      link.classList.add("is-active");
      return;
    }

    if (href !== "/" && path === href) {
      link.classList.add("is-active");
    }
  });
});
