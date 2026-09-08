/* =====================================================
   СЧЁТЧИК ПОСЕЩЕНИЙ
   -----------------------------------------------------
   Отправляет в свой Worker факт открытия страницы, чтобы
   в Telegram приходило уведомление: какой раздел открыли
   и откуда пришёл посетитель.

   Каждая страница считается один раз за сессию — сайт
   состоит из нескольких отдельных страниц, и видеть
   переходы между ними полезнее, чем один общий визит.
   ===================================================== */
(function () {
    'use strict';

    var WORKER_URL  = 'https://my-web-site.sasha88543.workers.dev';
    var PAGES_KEY   = 'tracked_pages';    // список уже отслеженных путей
    var STARTED_KEY = 'tracked_started';  // отметка, что сессия уже начата

    /* Локальная разработка и «Не отслеживать» — не считаем */
    if (location.protocol === 'file:') return;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

    /* ── Защита от повторов ── */
    var trackedPages = [];
    try {
        trackedPages = JSON.parse(sessionStorage.getItem(PAGES_KEY) || '[]');
    } catch (e) {}
    if (!Array.isArray(trackedPages)) trackedPages = [];

    var path = location.pathname;
    if (trackedPages.indexOf(path) !== -1) return;   // эту страницу уже учли

    var isFirst = !sessionStorage.getItem(STARTED_KEY);   // первое событие за сессию

    trackedPages.push(path);
    try {
        sessionStorage.setItem(PAGES_KEY, JSON.stringify(trackedPages));
        sessionStorage.setItem(STARTED_KEY, '1');
    } catch (e) {}

    /* ── Название раздела (для читаемого уведомления) ── */
    var meta = document.querySelector('meta[name="page-name"]');
    var pageName = ((meta && meta.content) || document.title || '—').trim();

    /* =================================================
       ОТКУДА ПРИШЁЛ ПОСЕТИТЕЛЬ
       ================================================= */

    /* Домен в referrer → человекочитаемое название */
    var REFERRERS = [
        [['google.'],                                    'Google'],
        [['yandex.'],                                    'Яндекс'],
        [['bing.com'],                                   'Bing'],
        [['duckduckgo.com'],                             'DuckDuckGo'],
        [['vk.com', 'vkontakte.ru'],                     'ВКонтакте'],
        [['t.me', 'telegram.org', 'telegram.me'],        'Telegram (Web-превью)'],
        [['instagram.com', 'l.instagram.com'],           'Instagram'],
        [['facebook.com', 'fb.com', 'l.facebook.com'],   'Facebook'],
        [['twitter.com', 't.co', 'x.com'],               'Twitter / X'],
        [['tiktok.com'],                                 'TikTok'],
        [['reddit.com'],                                 'Reddit'],
        [['linkedin.com'],                               'LinkedIn'],
        [['github.com', 'github.io'],                    'GitHub'],
        [['discord.com', 'discordapp.com'],              'Discord'],
        [['whatsapp.com'],                               'WhatsApp'],
        [['ok.ru'],                                      'Одноклассники'],
        [['pinterest.com'],                              'Pinterest'],
        [['twitch.tv'],                                  'Twitch'],
        [['snapchat.com'],                               'Snapchat']
    ];

    /* Приложения без referrer — узнаются по User-Agent.
       Порядок важен: от специфичных к общим. */
    var APPS = [
        [/Instagram/,      'Instagram (приложение)'],
        [/FBAN|FBAV|FB_IAB/, 'Facebook (приложение)'],
        [/TikTok/,         'TikTok (приложение)'],
        [/Twitter/,        'Twitter (приложение)'],
        [/LinkedInApp/,    'LinkedIn (приложение)'],
        [/VK\//,           'ВКонтакте (приложение)'],
        [/Snapchat/,       'Snapchat (приложение)'],
        [/WhatsApp/,       'WhatsApp (приложение)'],
        [/Telegram/,       'Telegram (приложение)'],
        [/Pinterest/,      'Pinterest (приложение)'],
        [/Discord/,        'Discord (приложение)'],
        [/Line\//,         'Line (приложение)']
    ];

    function detectSource() {
        var ref = document.referrer;
        var ua  = navigator.userAgent;
        var p   = new URLSearchParams(location.search);

        // 1. UTM-метки — самый надёжный источник
        if (p.get('utm_source')) {
            var parts = [p.get('utm_source'), p.get('utm_medium'), p.get('utm_campaign')];
            return 'UTM: ' + parts.filter(Boolean).join(' / ');
        }

        // 2. Специальный параметр YouTube
        if (p.get('si') || ref.indexOf('youtube.com') !== -1 || ref.indexOf('youtu.be') !== -1) {
            return 'YouTube';
        }

        // 3. Известные домены в referrer
        if (ref) {
            for (var i = 0; i < REFERRERS.length; i++) {
                var domains = REFERRERS[i][0];
                for (var j = 0; j < domains.length; j++) {
                    if (ref.indexOf(domains[j]) !== -1) return REFERRERS[i][1];
                }
            }
            try { return 'Сайт: ' + new URL(ref).hostname; } catch (e) {}
        }

        // 4. Приложение по User-Agent
        for (var k = 0; k < APPS.length; k++) {
            if (APPS[k][0].test(ua)) return APPS[k][1];
        }

        if (/iPhone|iPad/.test(ua) && !/Safari/.test(ua)) return 'iOS-приложение (WebView)';
        if (/wv\)/.test(ua) || (/Android/.test(ua) && !/Chrome\//.test(ua))) {
            return 'Android-приложение (WebView)';
        }

        return 'Прямой заход';
    }

    /* =================================================
       ОТПРАВКА
       ================================================= */
    var payload = JSON.stringify({
        ua:           navigator.userAgent,
        lang:         navigator.language || '—',
        page:         location.href,
        page_name:    pageName,
        is_first:     isFirst,
        referrer:     detectSource(),
        referrer_raw: document.referrer
    });

    /* sendBeacon переживает уход со страницы; fetch — запасной путь.
       Ошибка сети не должна попадать в консоль как необработанная. */
    var sent = false;
    try {
        sent = navigator.sendBeacon(
            WORKER_URL + '/track',
            new Blob([payload], { type: 'application/json' })
        );
    } catch (e) {}

    if (!sent) {
        fetch(WORKER_URL + '/track', {
            method:    'POST',
            headers:   { 'Content-Type': 'application/json' },
            body:      payload,
            keepalive: true
        }).catch(function () {});
    }
})();
