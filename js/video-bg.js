/* =====================================================
   ФОН РАЗДЕЛА «ВИДЕОМОНТАЖ»
   -----------------------------------------------------
   Очень медленная вертикальная прокрутка превьюшек
   роликов с низкой прозрачностью — только как фон.

   Как это работает:
   1. ID роликов берём прямо со страницы (из <iframe>),
      чтобы фон сам обновлялся при добавлении кейсов.
   2. Собираем несколько колонок, содержимое каждой
      дублируется 2 раза — это даёт бесшовный цикл
      (сдвиг ровно на -50% высоты).
   3. Если превью не загрузились (YouTube недоступен) —
      слой молча удаляется, фон остаётся обычным.
   4. При prefers-reduced-motion фон не создаётся вовсе.
   ===================================================== */
(function () {
    'use strict';

    if (document.body.dataset.mode !== 'video') return;

    try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}

    var COLUMNS   = 4;     // сколько колонок на десктопе
    var PER_COL   = 6;     // превью в одной колонке (до дублирования)
    var BASE_TIME = 240;   // секунд на полный цикл у первой колонки
    var STEP_TIME = 55;    // насколько медленнее каждая следующая
    var GIVE_UP   = 9000;  // мс: ни одной картинки — убираем слой

    /* ── 1. Собираем ID роликов со страницы ── */
    var ids = [];
    document.querySelectorAll(
        'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]'
    ).forEach(function (frame) {
        var m = (frame.getAttribute('src') || '').match(/\/embed\/([A-Za-z0-9_-]{6,})/);
        if (m && ids.indexOf(m[1]) === -1) ids.push(m[1]);
    });

    if (ids.length < 2) return;

    /* ── 2. Строим слой ── */
    var layer = document.createElement('div');
    layer.className = 'video-bg';
    layer.setAttribute('aria-hidden', 'true');

    var total = 0, loaded = 0, failed = 0, offset = 0;

    function onLoad() {
        loaded++;
        if (loaded === 1) layer.classList.add('video-bg--ready');
    }
    function onError() {
        failed++;
        if (failed >= total && !loaded) removeLayer();
    }
    function removeLayer() {
        if (layer.parentNode) layer.parentNode.removeChild(layer);
    }

    for (var c = 0; c < COLUMNS; c++) {
        var col = document.createElement('div');
        col.className = 'video-bg__col' + (c % 2 ? ' video-bg__col--down' : '');
        col.style.animationDuration = (BASE_TIME + c * STEP_TIME) + 's';

        // содержимое колонки + его копия = бесшовная петля
        var half = document.createDocumentFragment();
        for (var i = 0; i < PER_COL; i++) {
            var img = document.createElement('img');
            img.className = 'video-bg__thumb';
            img.decoding = 'async';
            img.loading = 'lazy';
            img.alt = '';
            img.src = 'https://i.ytimg.com/vi/' + ids[offset++ % ids.length] + '/hqdefault.jpg';
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
            total++;
            half.appendChild(img);
        }
        // клоны не вызывают обработчики — считаем только оригиналы
        col.appendChild(half.cloneNode(true));
        col.appendChild(half);
        layer.appendChild(col);
    }

    document.body.appendChild(layer);

    // Страховка: YouTube режется — ни одна картинка не пришла
    setTimeout(function () { if (!loaded) removeLayer(); }, GIVE_UP);
})();
