/* =====================================================
   YOUTUBE: ТОСТ О ЗАМЕДЛЕНИИ / БЛОКИРОВКЕ
   -----------------------------------------------------
   Как это работает:
   1. Подключаем YouTube IFrame API и «оборачиваем» им
      уже существующие <iframe> (добавляется enablejsapi=1).
   2. API не загрузился за N сек или ни один плеер не
      инициализировался — считаем, что YouTube недоступен.
   3. Плеер завис в состоянии BUFFERING дольше N сек —
      считаем, что видеохостинг замедлен провайдером.
   4. В обоих случаях показываем всплывающее уведомление
      в правом нижнем углу (один раз за сессию).

   Тестовые режимы (в адресной строке):
      ?yttest=block — показать тост «недоступен»
      ?yttest=slow  — показать тост «замедление»
      ?yttest=ok    — считать, что всё работает
   ===================================================== */
(function () {
    'use strict';

    const API_TIMEOUT   = 8000;   // ждём загрузку iframe_api
    const READY_TIMEOUT = 12000;  // ждём инициализацию хотя бы одного плеера
    const STALL_LIMIT   = 7000;   // сколько буферизации считаем замедлением
    const TOAST_LIFE    = 14000;  // автозакрытие тоста
    const CHANNEL_URL   = 'https://www.youtube.com/@Zillendaw';
    const DISMISS_KEY   = 'yt_toast_dismissed';

    const TEST_MODE = new URLSearchParams(location.search).get('yttest');

    /* ── Плееры YouTube на странице ── */
    const ytFrames = Array.from(document.querySelectorAll(
        'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]'
    ));
    if (!ytFrames.length && !TEST_MODE) return;

    let toastShown = false;

    /* =================================================
       ТОСТ
       ================================================= */
    const TEXTS = {
        block: {
            title: 'YouTube не открывается',
            text:  'Похоже, видео не загружается из-за ограничений доступа к YouTube в вашем регионе.'
        },
        slow: {
            title: 'Видео грузится медленно',
            text:  'Скорее всего, это замедление YouTube со стороны провайдера...'
        }
    };

    function showToast(kind, videoUrl) {
        if (toastShown) return;
        if (!TEST_MODE) {
            try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch {}
        }
        toastShown = true;

        const info = TEXTS[kind] || TEXTS.block;
        const link = videoUrl || CHANNEL_URL;

        const toast = document.createElement('div');
        toast.className = 'yt-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
            <button type="button" class="yt-toast__close" data-yt-close aria-label="Закрыть">&times;</button>
            <div class="yt-toast__icon"><i class="fas fa-triangle-exclamation"></i></div>
            <div class="yt-toast__body">
                <p class="yt-toast__title">${info.title}</p>
                <p class="yt-toast__text">${info.text}</p>
                <div class="yt-toast__actions">
                    <a class="yt-toast__btn" href="${link}" target="_blank" rel="noopener">
                        <i class="fab fa-youtube"></i> Открыть на YouTube
                    </a>
                    <button type="button" class="yt-toast__ghost" data-yt-mute>Больше не показывать</button>
                </div>
            </div>
            <span class="yt-toast__progress" style="animation-duration:${TOAST_LIFE}ms"></span>
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('yt-toast--visible'));

        let hideTimer = setTimeout(hide, TOAST_LIFE);

        function hide() {
            clearTimeout(hideTimer);
            toast.classList.add('yt-toast--leaving');
            setTimeout(() => toast.remove(), 320);
        }

        /* Наведение — не закрывать, пока читают */
        toast.addEventListener('mouseenter', () => clearTimeout(hideTimer));
        toast.addEventListener('mouseleave', () => { hideTimer = setTimeout(hide, 4000); });

        toast.querySelector('[data-yt-close]').addEventListener('click', hide);
        toast.querySelector('[data-yt-mute]').addEventListener('click', () => {
            try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
            hide();
        });
    }

    /* =================================================
       ТЕСТОВЫЕ РЕЖИМЫ
       ================================================= */
    if (TEST_MODE === 'ok') return;
    if (TEST_MODE === 'block' || TEST_MODE === 'slow') {
        showToast(TEST_MODE);
        return;
    }

    /* =================================================
       ПОДГОТОВКА IFRAME: enablejsapi=1 + id
       ================================================= */
    ytFrames.forEach((frame, i) => {
        if (!frame.id) frame.id = 'yt-player-' + i;
        try {
            const url = new URL(frame.src, location.href);
            if (url.searchParams.get('enablejsapi') !== '1') {
                url.searchParams.set('enablejsapi', '1');
                if (location.protocol.startsWith('http')) {
                    url.searchParams.set('origin', location.origin);
                }
                frame.src = url.toString();
            }
        } catch {}
    });

    /* ── Ссылка на конкретный ролик ── */
    function watchUrl(frame) {
        const m = frame.src.match(/\/embed\/([A-Za-z0-9_-]{6,})/);
        return m ? 'https://www.youtube.com/watch?v=' + m[1] : CHANNEL_URL;
    }

    /* =================================================
       ЗАГРУЗКА IFRAME API
       ================================================= */
    function loadApi() {
        return new Promise(resolve => {
            if (window.YT && window.YT.Player) return resolve(true);

            const timer = setTimeout(() => resolve(false), API_TIMEOUT);
            const prev  = window.onYouTubeIframeAPIReady;

            window.onYouTubeIframeAPIReady = function () {
                clearTimeout(timer);
                if (typeof prev === 'function') prev();
                resolve(true);
            };

            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onerror = () => { clearTimeout(timer); resolve(false); };
            document.head.appendChild(tag);
        });
    }

    /* =================================================
       НАБЛЮДЕНИЕ ЗА ПЛЕЕРАМИ
       ================================================= */
    function watchPlayers() {
        let anyReady = false;

        const readyTimer = setTimeout(() => {
            // API есть, но ни один плеер не ожил — домен режется
            if (!anyReady) showToast('block');
        }, READY_TIMEOUT);

        ytFrames.forEach(frame => {
            let stallTimer = null;

            const player = new YT.Player(frame.id, {
                events: {
                    onReady: () => {
                        anyReady = true;
                        clearTimeout(readyTimer);
                    },
                    onStateChange: e => {
                        clearTimeout(stallTimer);

                        // Долгая буферизация = замедление
                        if (e.data === YT.PlayerState.BUFFERING) {
                            stallTimer = setTimeout(() => {
                                // всё ещё буферизуемся — значит правда медленно
                                try {
                                    if (player.getPlayerState() === YT.PlayerState.BUFFERING) {
                                        showToast('slow', watchUrl(frame));
                                    }
                                } catch {
                                    showToast('slow', watchUrl(frame));
                                }
                            }, STALL_LIMIT);
                        }
                    },
                    onError: e => {
                        // 5 / 100 / 150 — проблемы воспроизведения или доступа
                        if (e.data === 5 || e.data === 100 || e.data === 150) {
                            showToast('block', watchUrl(frame));
                        }
                    }
                }
            });
        });
    }

    /* =================================================
       СТАРТ
       ================================================= */
    loadApi().then(ok => {
        if (!ok) { showToast('block'); return; }   // API не догрузился — YouTube режется
        watchPlayers();
    });
})();