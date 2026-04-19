/**
 * tracker.js — клиентский трекер посещений для Sanyek004.github.io
 *
 * Подключается в конце <body> в index.html:
 *   <script src="tracker.js"></script>
 *
 * Что делает:
 *   1. Получает гео-данные по IP через ip-api.com (бесплатно, без ключа)
 *   2. Отправляет данные на Cloudflare Worker, который:
 *      - пишет счётчик в KV-хранилище
 *      - шлёт уведомление в Telegram
 *
 * Замени WORKER_URL на реальный URL твоего воркера.
 */

(async function () {
  const WORKER_URL = "https://my-web-site.sasha88543.workers.dev";

  // ── Защита от повторного трека (сессионный, сбрасывается при закрытии вкладки)
  //if (sessionStorage.getItem("tracked")) return;
  //sessionStorage.setItem("tracked", "1");

  try {
    // ── 1. Получаем гео по IP ──────────────────────────────
    const geoResp = await fetch(
      "https://ip-api.com/json/?fields=status,regionName,city,isp&lang=ru",
      { cache: "no-store" }
    );
    const geo = geoResp.ok ? await geoResp.json() : {};

    // ── 2. Собираем данные о клиенте ───────────────────────
    const payload = {
      region: geo.regionName || "—",
      city:   geo.city       || "—",
      isp:    geo.isp        || "—",
      ua:     navigator.userAgent,
      lang:   navigator.language || navigator.userLanguage || "—",
      page:   location.href,
    };

    // ── 3. Отправляем воркеру ──────────────────────────────
    await fetch(`${WORKER_URL}/track`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

  } catch (_) {
    // Трекер не должен ломать сайт — тихо глотаем ошибки
  }
})();
