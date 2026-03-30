function sharedJs() {
  return `
console.log("Welmoa topbar only");

// 상단바 높이 보정
const bar = document.querySelector(".welmoa-bar");
if (bar) {
  const h = bar.offsetHeight;
  document.body.style.paddingTop = h + "px";
}
`;
}
