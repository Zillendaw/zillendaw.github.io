/* =====================================================
   YOUTUBE: ЗАМЕДЛЕНИЕ ИЛИ БЛОКИРОВКА
   -----------------------------------------------------
   Как это работает:
   1. Подключаем YouTube IFrame API и «оборачиваем» им
      уже существующие <iframe> (добавляется enablejsapi=1).
   2. API не загрузился за N сек или ни один плеер не
      инициализировался — считаем, что YouTube недоступен.
   3. Плеер завис в состоянии BUFFERING дольше N сек —
      считаем, что видеохостинг замедлен провайдером.
   4. В обоих случаях показываем уведомление (общий модуль
      media-toast.js — один тост за сессию).

   Тестовые режимы (в адресной строке):
      ?yttest=block — показать тост «недоступен»
      ?yttest=slow  — показать тост «замедление»
      ?yttest=ok    — считать, что всё работает
   ===================================================== */
(function () {
    'use strict';

    var API_TIMEOUT   = 8000;    // ждём загрузку iframe_api
    var READY_TIMEOUT = 12000;   // ждём инициализацию хотя бы одного плеера
    var STALL_LIMIT   = 7000;    // столько буферизации считаем замедлением
    var CHANNEL_URL   = 'https://www.youtube.com/@Zillendaw';
    var DISMISS_KEY   = 'yt_toast_dismissed';

    var TEXTS = {
        block: {
            title: 'YouTube не открывается',
            text:  'Похоже, видео не загружается из-за ограничений доступа к YouTube в вашем регионе.'
        },
        slow: {
            title: 'Видео грузится медленно',
            text:  'Скорее всего, это замедление YouTube со стороны провайдера.'
        }
    };

    var TEST_MODE = new URLSearchParams(location.search).get('yttest');
    if (TEST_MODE === 'ok') return;

    var frames = Array.prototype.slice.call(document.querySelectorAll(
        'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]'
    ));
    if (!frames.length && !TEST_MODE) return;

    function notify(kind, videoUrl) {
        var info = TEXTS[kind] || TEXTS.block;
        if (!window.MediaToast) return;
        window.MediaToast.show({
            title:      info.title,
            text:       info.text,
            dismissKey: DISMISS_KEY,
            force:      !!TEST_MODE,
            action: {
                url:   videoUrl || CHANNEL_URL,
                label: 'Открыть на YouTube',
                icon:  'fab fa-youtube'
            }
        });
    }

    if (TEST_MODE === 'block' || TEST_MODE === 'slow') {
        notify(TEST_MODE);
        return;
    }

    /* ── Готовим iframe: enablejsapi=1 + id ── */
    frames.forEach(function (frame, i) {
        if (!frame.id) frame.id = 'yt-player-' + i;
        try {
            var url = new URL(frame.src, location.href);
            if (url.searchParams.get('enablejsapi') !== '1') {
                url.searchParams.set('enablejsapi', '1');
                if (location.protocol.indexOf('http') === 0) {
                    url.searchParams.set('origin', location.origin);
                }
                frame.src = url.toString();
            }
        } catch (e) {}
    });

    function watchUrl(frame) {
        var m = frame.src.match(/\/embed\/([A-Za-z0-9_-]{6,})/);
        return m ? 'https://www.youtube.com/watch?v=' + m[1] : CHANNEL_URL;
    }

    /* ── Загрузка IFrame API ── */
    function loadApi() {
        return new Promise(function (resolve) {
            if (window.YT && window.YT.Player) return resolve(true);

            var timer = setTimeout(function () { resolve(false); }, API_TIMEOUT);
            var prev  = window.onYouTubeIframeAPIReady;

            window.onYouTubeIframeAPIReady = function () {
                clearTimeout(timer);
                if (typeof prev === 'function') prev();
                resolve(true);
            };

            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onerror = function () { clearTimeout(timer); resolve(false); };
            document.head.appendChild(tag);
        });
    }

    /* ── Наблюдение за плеерами ── */
    function watchPlayers() {
        var anyReady = false;
        var visibleSince = null;
        var started = Date.now();
        var POLL   = 2500;
        var GIVEUP = 120000;

        /* Плееры внутри закрытой папки или скрытой вкладки не
           инициализируются — это не блокировка. Ждём, пока хотя бы
           один кадр окажется на экране, и даём ему READY_TIMEOUT
           на то, чтобы подать признаки жизни. */
        function verdict() {
            if (anyReady) return;
            var now = Date.now();

            if (visibleSince === null && frames.some(function (f) { return f.offsetParent !== null; })) {
                visibleSince = now;
            }

            if (visibleSince !== null && now - visibleSince >= READY_TIMEOUT) {
                notify('block');
                return;
            }

            if (now - started < GIVEUP) setTimeout(verdict, POLL);
        }

        var readyTimer = setTimeout(verdict, READY_TIMEOUT);

        frames.forEach(function (frame) {
            var stallTimer = null;

            var player = new YT.Player(frame.id, {
                events: {
                    onReady: function () {
                        anyReady = true;
                        clearTimeout(readyTimer);
                    },
                    onStateChange: function (e) {
                        clearTimeout(stallTimer);
                        if (e.data !== YT.PlayerState.BUFFERING) return;

                        stallTimer = setTimeout(function () {
                            // всё ещё буферизуемся — значит правда медленно
                            var stillBuffering = true;
                            try {
                                stillBuffering = player.getPlayerState() === YT.PlayerState.BUFFERING;
                            } catch (err) {}
                            if (stillBuffering) notify('slow', watchUrl(frame));
                        }, STALL_LIMIT);
                    },
                    onError: function (e) {
                        // 5 / 100 / 150 — проблемы воспроизведения или доступа
                        if (e.data === 5 || e.data === 100 || e.data === 150) {
                            notify('block', watchUrl(frame));
                        }
                    }
                }
            });
        });
    }

    loadApi().then(function (ok) {
        if (!ok) { notify('block'); return; }   // API не догрузился — YouTube режется
        watchPlayers();
    });
})();
