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

   Всплывающих уведомлений здесь больше нет: про VPN
   предупреждает окно при входе на страницу (js/ui.js).
   Этот скрипт только помечает те карточки, которые
   действительно не ожили, и даёт ссылку на ролик в VK.

   Тестовые режимы (в адресной строке):
      ?vktest=block — пометить все карточки принудительно
      ?vktest=ok    — считать, что всё работает
   ===================================================== */
(function () {
    'use strict';

    var READY_TIMEOUT = 9000;   // сколько ждём признаков жизни плеера
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

        note.append(icon, document.createTextNode(' Плеер VK не загрузился в этом браузере. '), link);

        var info = card.querySelector('.video-case-info');
        (info || card).appendChild(note);
    }

    /* ── Тестовый режим ── */
    if (TEST_MODE === 'block') {
        frames.forEach(markCard);
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
       Плеер, которого нет на экране, не загружается и молчит —
       это не гео-ограничение. Поэтому кадр судим только после
       того, как его окно пробыло открытым READY_TIMEOUT.
       Об открытии и закрытии папок сообщает js/ui.js
       событиями folder:open / folder:close. */
    var pending = [];   // [frame, timer]

    function cancel(frame) {
        for (var i = pending.length - 1; i >= 0; i--) {
            if (pending[i][0] === frame) {
                clearTimeout(pending[i][1]);
                pending.splice(i, 1);
            }
        }
    }

    function judgeLater(frame) {
        cancel(frame);
        var timer = setTimeout(function () {
            cancel(frame);
            if (frame.offsetParent === null) return;   // окно успели закрыть
            if (alive.indexOf(frame) === -1 || errored.indexOf(frame) !== -1) {
                markCard(frame);
            }
        }, READY_TIMEOUT);
        pending.push([frame, timer]);
    }

    function framesIn(panel) {
        return frames.filter(function (f) { return panel && panel.contains(f); });
    }

    document.addEventListener('folder:open', function (e) {
        framesIn(e.detail && e.detail.panel).forEach(judgeLater);
    });

    document.addEventListener('folder:close', function (e) {
        framesIn(e.detail && e.detail.panel).forEach(cancel);
    });

    /* Уже видимые кадры: папка открыта по прямой ссылке
       (ui.js успел открыть окно до запуска этого скрипта) */
    frames.forEach(function (f) {
        if (f.offsetParent !== null) judgeLater(f);
    });
})();