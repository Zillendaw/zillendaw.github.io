/* =====================================================
   VK ВИДЕО: ПРОВЕРКА ДОСТУПНОСТИ
   -----------------------------------------------------
   Зачем: VK отдаёт видео только на российские IP.
   С VPN / зарубежного адреса iframe ЗАГРУЖАЕТСЯ УСПЕШНО,
   но вместо плеера рисует заглушку «Видео недоступно».
   Поэтому обычные проверки (onerror, «домен не открылся»)
   тут не срабатывают — страница-то отдалась.

   Что ловим на самом деле:
   1. Добавляем к embed-ссылке js_api=1 — тогда настоящий
      плеер VK начинает слать в родительское окно
      postMessage-события.
   2. Заглушка «Видео недоступно» плеер не содержит и
      не шлёт НИ ОДНОГО сообщения.
   3. Значит: пришло сообщение за N сек → плеер живой;
      тишина → видео недоступно в этом регионе.
   4. Дополнительно ловим явные события со словом error.

   Тестовые режимы (в адресной строке):
      ?vktest=block — показать уведомление принудительно
      ?vktest=ok    — считать, что всё работает
   ===================================================== */
(function () {
    'use strict';

    var READY_TIMEOUT = 9000;    // сколько ждём признаков жизни плеера
    var TOAST_LIFE    = 15000;   // автозакрытие уведомления
    var DISMISS_KEY   = 'vk_toast_dismissed';
    var VK_HOST_RE    = /(^|\.)(vk\.com|vkvideo\.ru|vk\.ru|userapi\.com)$/i;

    var TEST_MODE = new URLSearchParams(location.search).get('vktest');
    if (TEST_MODE === 'ok') return;

    var frames = Array.prototype.slice.call(
        document.querySelectorAll('iframe[src*="/video_ext.php"]')
    );
    if (!frames.length && !TEST_MODE) return;

    /* =================================================
       ССЫЛКА НА РОЛИК В VK
       ================================================= */
    function watchUrl(frame) {
        try {
            var q = new URL(frame.src, location.href).searchParams;
            var oid = q.get('oid'), id = q.get('id');
            if (oid && id) return 'https://vkvideo.ru/video' + oid + '_' + id;
        } catch (e) {}
        return 'https://vkvideo.ru/';
    }

    /* =================================================
       УВЕДОМЛЕНИЕ (переиспользуем стили .yt-toast)
       ================================================= */
    function showToast(videoUrl) {
        // Не показываем два уведомления сразу (YouTube + VK)
        if (window.__mediaToastShown) return;
        if (!TEST_MODE) {
            try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch (e) {}
        }
        window.__mediaToastShown = true;

        var toast = document.createElement('div');
        toast.className = 'yt-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML =
            '<button type="button" class="yt-toast__close" data-vk-close aria-label="Закрыть">&times;</button>' +
            '<div class="yt-toast__icon"><i class="fas fa-triangle-exclamation"></i></div>' +
            '<div class="yt-toast__body">' +
                '<p class="yt-toast__title">VK Видео не проигрывается</p>' +
                '<p class="yt-toast__text">Похоже, вы заходите с зарубежного IP-адреса — VK ограничивает просмотр видео за пределами России. Попробуйте отключить VPN.</p>' +
                '<div class="yt-toast__actions">' +
                    '<a class="yt-toast__btn" href="' + (videoUrl || 'https://vkvideo.ru/') + '" target="_blank" rel="noopener">' +
                        '<i class="fas fa-arrow-up-right-from-square"></i> Открыть в VK Видео' +
                    '</a>' +
                    '<button type="button" class="yt-toast__ghost" data-vk-mute>Больше не показывать</button>' +
                '</div>' +
            '</div>' +
            '<span class="yt-toast__progress" style="animation-duration:' + TOAST_LIFE + 'ms"></span>';

        document.body.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('yt-toast--visible'); });

        var hideTimer = setTimeout(hide, TOAST_LIFE);

        function hide() {
            clearTimeout(hideTimer);
            toast.classList.add('yt-toast--leaving');
            setTimeout(function () { toast.remove(); }, 320);
        }

        // Пока читают — не закрывать
        toast.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
        toast.addEventListener('mouseleave', function () { hideTimer = setTimeout(hide, 4000); });

        toast.querySelector('[data-vk-close]').addEventListener('click', hide);
        toast.querySelector('[data-vk-mute]').addEventListener('click', function () {
            try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
            hide();
        });
    }

    /* =================================================
       ПОМЕТКА КОНКРЕТНОЙ КАРТОЧКИ
       ================================================= */
    function markCard(frame) {
        var card = frame.closest ? frame.closest('.video-case-card') : null;
        if (!card || card.classList.contains('video-case-card--unavailable')) return;
        card.classList.add('video-case-card--unavailable');

        var note = document.createElement('p');
        note.className = 'media-note';
        note.innerHTML =
            '<i class="fas fa-circle-info"></i> Не открывается с зарубежного IP. ' +
            '<a href="' + watchUrl(frame) + '" target="_blank" rel="noopener">Смотреть в VK</a>';

        var info = card.querySelector('.video-case-info');
        if (info) info.appendChild(note); else card.appendChild(note);
    }

    /* =================================================
       ТЕСТОВЫЙ РЕЖИМ
       ================================================= */
    if (TEST_MODE === 'block') {
        frames.forEach(markCard);
        showToast(frames.length ? watchUrl(frames[0]) : null);
        return;
    }

    /* =================================================
       ВКЛЮЧАЕМ JS-API У IFRAME
       ================================================= */
    frames.forEach(function (frame, i) {
        if (!frame.id) frame.id = 'vk-player-' + i;
        try {
            var url = new URL(frame.src, location.href);
            if (url.searchParams.get('js_api') !== '1') {
                url.searchParams.set('js_api', '1');
                frame.src = url.toString();
            }
        } catch (e) {}
    });

    /* =================================================
       СЛУШАЕМ ПРИЗНАКИ ЖИЗНИ ПЛЕЕРА
       ================================================= */
    var alive   = [];   // кадры, приславшие хоть что-то
    var errored = [];   // кадры с явной ошибкой

    function hostOf(origin) {
        try { return new URL(origin).hostname; } catch (e) { return ''; }
    }

    window.addEventListener('message', function (e) {
        if (!VK_HOST_RE.test(hostOf(e.origin))) return;

        var frame = null;
        for (var i = 0; i < frames.length; i++) {
            if (frames[i].contentWindow === e.source) { frame = frames[i]; break; }
        }
        if (!frame) return;

        if (alive.indexOf(frame) === -1) alive.push(frame);

        // Разбираем полезную нагрузку — вдруг это явная ошибка
        var data = e.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (err) { return; }
        }
        if (!data || typeof data !== 'object') return;

        var kind = data.method || data.event || data.type;
        if (typeof kind === 'string' && /error|unavailable|restrict/i.test(kind)) {
            if (errored.indexOf(frame) === -1) errored.push(frame);
        }
    });

    /* =================================================
       ВЕРДИКТ
       ================================================= */
    setTimeout(function () {
        var broken = frames.filter(function (f) {
            return alive.indexOf(f) === -1 || errored.indexOf(f) !== -1;
        });
        if (!broken.length) return;

        broken.forEach(markCard);
        showToast(watchUrl(broken[0]));
    }, READY_TIMEOUT);
})();
