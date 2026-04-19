(async function () {
  const WORKER_URL = "https://my-web-site.sasha88543.workers.dev";

  if (sessionStorage.getItem("tracked")) return;
  sessionStorage.setItem("tracked", "1");

  // Запускаем гео-запрос, но НЕ ждём его — даём 1.5 секунды максимум
  let geo = {};
  try {
    const geoPromise = fetch(
      "https://ip-api.com/json/?fields=status,regionName,city,isp&lang=ru",
      { cache: "no-store" }
    );
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 1500)
    );
    const geoResp = await Promise.race([geoPromise, timeoutPromise]);
    if (geoResp.ok) geo = await geoResp.json();
  } catch (err) {
    console.warn("Гео недоступно:", err.message);
  }

  const payload = {
    region: geo.regionName || "—",
    city:   geo.city       || "—",
    isp:    geo.isp        || "—",
    ua:     navigator.userAgent,
    lang:   navigator.language || "—",
    page:   location.href,
  };

  // keepalive: true — ключевой флаг для мобильных
  // Запрос завершится даже если страница уже закрыта/выгружена
  try {
    await fetch(`${WORKER_URL}/track`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      keepalive: true,
    });
  } catch (err) {
    console.error("Ошибка отправки:", err);
  }
})();
