function sharedJs() {
  return `
console.log("Welmoa UI applied");

// 일부 앱이 body margin 이상하게 줄 경우 보정
document.body.style.marginTop = "0";

// 상단바 때문에 내용 가려지는 경우 보정
const bar = document.querySelector(".welmoa-bar");
if (bar) {
  const h = bar.offsetHeight;
  document.body.style.paddingTop = h + "px";
}
`;
}
