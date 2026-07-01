(function () {
  const WORKER_URL = "https://my-web-site.sasha88543.workers.dev";

  // ── Защита от повторов ────────────────────────────────────
  // Раньше визит считался один раз за сессию (ключ "tracked").
  // Теперь сайт состоит из нескольких отдельных страниц
  // (index.html, programming.html, video.html), поэтому считаем
  // каждую страницу один раз за сессию — так в Telegram видно,
  // какой именно раздел открыл посетитель.
  const PAGES_KEY   = "tracked_pages";    // список уже отслеженных путей
  const STARTED_KEY = "tracked_started";  // отметка, что сессия уже начата

  let trackedPages = [];
  try { trackedPages = JSON.parse(sessionStorage.getItem(PAGES_KEY) || "[]"); } catch {}
  if (!Array.isArray(trackedPages)) trackedPages = [];

  const path = location.pathname;
  if (trackedPages.includes(path)) return;        // эту страницу уже учли

  // Первое событие за сессию? (нужно, чтобы не раздувать счётчик визитов)
  const isFirst = !sessionStorage.getItem(STARTED_KEY);

  trackedPages.push(path);
  try {
    sessionStorage.setItem(PAGES_KEY, JSON.stringify(trackedPages));
    sessionStorage.setItem(STARTED_KEY, "1");
  } catch {}

  // ── Название раздела (для красивого уведомления) ──────────
  const pageName = (
    document.querySelector('meta[name="page-name"]')?.content ||
    document.title ||
    "—"
  ).trim();

  function detectSource() {
    const ref = document.referrer;
    const ua  = navigator.userAgent;
    const p   = new URLSearchParams(location.search);

    // ── 1. UTM-параметры (приоритет) ──────────────────────────
    if (p.get("utm_source")) {
      const s = p.get("utm_source");
      const m = p.get("utm_medium")   || "";
      const c = p.get("utm_campaign") || "";
      return `UTM: ${s}${m ? " / " + m : ""}${c ? " / " + c : ""}`;
    }

    // ── 2. Специальные параметры YouTube ──────────────────────
    if (p.get("si") || ref.includes("youtube.com") || ref.includes("youtu.be"))
      return "YouTube";

    // ── 3. Referrer — известные домены ────────────────────────
    const refMap = [
      [["google."],                           "Google"],
      [["yandex."],                           "Яндекс"],
      [["bing.com"],                          "Bing"],
      [["duckduckgo.com"],                    "DuckDuckGo"],
      [["vk.com", "vkontakte.ru"],            "ВКонтакте"],
      [["t.me", "telegram.org", "telegram.me"], "Telegram (Web-превью)"],
      [["instagram.com", "l.instagram.com"],  "Instagram"],
      [["facebook.com", "fb.com", "l.facebook.com"], "Facebook"],
      [["twitter.com", "t.co", "x.com"],      "Twitter / X"],
      [["tiktok.com"],                        "TikTok"],
      [["reddit.com"],                        "Reddit"],
      [["linkedin.com"],                      "LinkedIn"],
      [["github.com", "github.io"],           "GitHub"],
      [["discord.com", "discordapp.com"],     "Discord"],
      [["whatsapp.com"],                      "WhatsApp"],
      [["ok.ru"],                             "Одноклассники"],
      [["pinterest.com"],                     "Pinterest"],
      [["twitch.tv"],                         "Twitch"],
      [["snapchat.com"],                      "Snapchat"],
    ];

    if (ref) {
      for (const [domains, label] of refMap) {
        if (domains.some(d => ref.includes(d))) return label;
      }
      // Неизвестный referrer — вернуть домен
      try { return "Сайт: " + new URL(ref).hostname; } catch {}
    }

    // ── 4. User-Agent — приложения без referrer ────────────────
    // (порядок важен — от специфичных к общим)
    if (/Instagram/.test(ua))              return "Instagram (приложение)";
    if (/FBAN|FBAV|FB_IAB/.test(ua))       return "Facebook (приложение)";
    if (/TikTok/.test(ua))                 return "TikTok (приложение)";
    if (/Twitter/.test(ua))                return "Twitter (приложение)";
    if (/LinkedInApp/.test(ua))            return "LinkedIn (приложение)";
    if (/VK\//.test(ua))                   return "ВКонтакте (приложение)";
    if (/Snapchat/.test(ua))               return "Snapchat (приложение)";
    if (/WhatsApp/.test(ua))               return "WhatsApp (приложение)";
    if (/Telegram/.test(ua))               return "Telegram (приложение)";
    if (/Pinterest/.test(ua))              return "Pinterest (приложение)";
    if (/Discord/.test(ua))                return "Discord (приложение)";
    if (/Line\//.test(ua))                 return "Line (приложение)";

    // iOS WebView без явного приложения
    if (/iPhone|iPad/.test(ua) && !/Safari/.test(ua))
      return "iOS-приложение (WebView)";

    // Android WebView без явного приложения
    if (/wv\)/.test(ua) || (/Android/.test(ua) && !/Chrome\//.test(ua)))
      return "Android-приложение (WebView)";

    return "Прямой заход";
  }

  const payload = {
    region:    "—",
    city:      "—",
    isp:       "—",
    ua:        navigator.userAgent,
    lang:      navigator.language || "—",
    page:      location.href,
    page_name: pageName,                 // ← название раздела
    is_first:  isFirst,                  // ← первое событие за сессию
    referrer:  detectSource(),
    referrer_raw: document.referrer,
  };

  fetch(`${WORKER_URL}/track`, {
    method:    "POST",
    headers:   { "Content-Type": "application/json" },
    body:      JSON.stringify(payload),
    keepalive: true,
  });
})();