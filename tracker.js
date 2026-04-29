(function () {
  const WORKER_URL = "https://my-web-site.sasha88543.workers.dev";

  if (sessionStorage.getItem("tracked")) return;
  sessionStorage.setItem("tracked", "1");

  const payload = {
    region: "—", city: "—", isp: "—",
    ua:   navigator.userAgent,
    lang: navigator.language || "—",
    page: location.href,
    referrer: document.referrer || "Прямой заход / неизвестно",
  };

  // Без async/await — запрос уходит мгновенно
  // keepalive: true гарантирует отправку даже если браузер закрыл вкладку
  fetch(`${WORKER_URL}/track`, {
    method:    "POST",
    headers:   { "Content-Type": "application/json" },
    body:      JSON.stringify(payload),
    keepalive: true,
  });
})();
