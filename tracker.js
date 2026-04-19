(async function () {
  const WORKER_URL = "https://my-web-site.sasha88543.workers.dev";

  // Защита от повторного трека 
  if (sessionStorage.getItem("tracked")) return;
  sessionStorage.setItem("tracked", "1");

  let geo = {};

  // 1. Пытаемся получить гео-данные (может быть заблокировано браузером)
  try {
    const geoResp = await fetch(
      "https://ip-api.com/json/?fields=status,regionName,city,isp&lang=ru",
      { cache: "no-store" }
    );
    if (geoResp.ok) {
      geo = await geoResp.json();
    }
  } catch (err) {
    console.warn("Не удалось получить гео-данные (возможно, блокировщик):", err);
  }

  // 2. Собираем данные
  const payload = {
    region: geo.regionName || "—",
    city:   geo.city       || "—",
    isp:    geo.isp        || "—",
    ua:     navigator.userAgent,
    lang:   navigator.language || navigator.userLanguage || "—",
    page:   location.href,
  };

  // 3. Отправляем в Worker 
  try {
    await fetch(`${WORKER_URL}/track`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Ошибка отправки в Worker:", err);
  }
})();
