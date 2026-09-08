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

    var READY_TIMEOUT = 9000;   // сколько ждём признаков жизни плеера
    var DISMISS_KEY   = 'vk_toast_dismissed';
    var VK_HOST_RE    = /(^|\.)(vk\.com|vkvideo\.ru|vk\.ru|userapi\.com)$/i;

    var TEST_MODE = new URLSearchParams(location.search).get('vktest');
    if (TEST_MODE === 'ok') return;

    var frames = Array.prototype.slice.call(
        document.querySelectorAll('iframe[src*="/video_ext.php"]')
    );
    if (!frames.length) return;

    /* ── Ссылка на ролик в VK ── */
    function watchUrl(frame) {
        try {
            var q = new URL(frame.src, location.href).searchParams;
            var oid = q.get('oid'), id = q.get('id');
            if (oid && id) return 'https://vkvideo.ru/video' + oid + '_' + id;
        } catch (e) {}
        return 'https://vkvideo.ru/';
    }

    function notify(videoUrl) {
        if (!window.MediaToast) return;
        window.MediaToast.show({
            title:      'VK Видео не проигрывается',
            text:       'Похоже, вы заходите с зарубежного IP-адреса — VK ограничивает ' +
                        'просмотр видео за пределами России. Попробуйте отключить VPN.',
            dismissKey: DISMISS_KEY,
            force:      !!TEST_MODE,
            action: {
                url:   videoUrl || 'https://vkvideo.ru/',
                label: 'Открыть в VK Видео',
                icon:  'fab fa-vk'
            }
        });
    }

    /* ── Пометка конкретной карточки ── */
    function markCard(frame) {
        var card = frame.closest ? frame.closest('.video-case-card') : null;
        if (!card || card.classList.contains('video-case-card--unavailable')) return;
        card.classList.add('video-case-card--unavailable');

        var note = document.createElement('p');
        note.className = 'media-note';

        var icon = document.createElement('i');
        icon.className = 'fas fa-circle-info';
        icon.setAttribute('aria-hidden', 'true');

        var link = document.createElement('a');
        link.href = watchUrl(frame);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Смотреть в VK';

        note.append(icon, document.createTextNode(' Не открывается с зарубежного IP. '), link);

        var info = card.querySelector('.video-case-info');
        (info || card).appendChild(note);
    }

    /* ── Тестовый режим ── */
    if (TEST_MODE === 'block') {
        frames.forEach(markCard);
        notify(watchUrl(frames[0]));
        return;
    }

    /* ── Включаем js-api у iframe ── */
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

    /* ── Слушаем признаки жизни плеера ── */
    var alive   = [];   // кадры, приславшие хоть что-то
    var errored = [];   // кадры с явной ошибкой

    function hostOf(origin) {
        try { return new URL(origin).hostname; } catch (e) { return ''; }
    }

    window.addEventListener('message', function (e) {
        if (!VK_HOST_RE.test(hostOf(e.origin))) return;

        var frame = frames.filter(function (f) { return f.contentWindow === e.source; })[0];
        if (!frame) return;

        if (alive.indexOf(frame) === -1) alive.push(frame);

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

    /* ── Вердикт ──
       Плееры внутри закрытой папки или скрытой вкладки не
       загружаются и молчат — это не гео-ограничение. Поэтому
       по каждому кадру судим отдельно и только после того,
       как он пробыл на экране READY_TIMEOUT: столько нужно
       живому плееру, чтобы подать голос. */
    var POLL   = 2500;   // как часто пересматриваем ситуацию
    var GIVEUP = 120000; // через столько перестаём следить
    var shownAt = [];    // [frame, момент появления на экране]
    var started = Date.now();

    function shownSince(frame) {
        for (var i = 0; i < shownAt.length; i++) {
            if (shownAt[i][0] === frame) return shownAt[i][1];
        }
        return null;
    }

    function verdict() {
        var now = Date.now();

        frames.forEach(function (frame) {
            if (frame.offsetParent !== null && shownSince(frame) === null) {
                shownAt.push([frame, now]);
            }
        });

        var ripe = frames.filter(function (frame) {
            var since = shownSince(frame);
            return since !== null && now - since >= READY_TIMEOUT;
        });

        var broken = ripe.filter(function (f) {
            return alive.indexOf(f) === -1 || errored.indexOf(f) !== -1;
        });

        if (broken.length) {
            broken.forEach(markCard);
            notify(watchUrl(broken[0]));
        }

        /* Ещё не все кадры показывали — продолжаем наблюдать */
        if (ripe.length < frames.length && now - started < GIVEUP) {
            setTimeout(verdict, POLL);
        }
    }

    setTimeout(verdict, READY_TIMEOUT);
})();
