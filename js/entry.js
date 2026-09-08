/* =====================================================
   СТАРТОВЫЙ ЭКРАН
   -----------------------------------------------------
   1. Плавный переход с карточки в раздел.
      Сами карточки теперь обычные ссылки <a href>, поэтому
      всё работает и без JS, и по средней кнопке мыши,
      и в поиске. Скрипт только добавляет анимацию.
   2. Схема связей стека технологий внутри карточек.
   ===================================================== */
(function () {
    'use strict';

    var reduceMotion = false;
    try {
        reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}

    /* =================================================
       1. ПЕРЕХОД В РАЗДЕЛ
       ================================================= */
    (function initNavigation() {
        var EXIT_DELAY = 100;   // мс до затемнения экрана
        var NAV_DELAY  = 520;   // мс до самого перехода
        var entryScreen = document.getElementById('entry-screen');
        if (!entryScreen) return;

        document.querySelectorAll('.split-card[href]').forEach(function (card) {
            card.addEventListener('click', function (e) {
                /* Ctrl/Cmd/Shift-клик и средняя кнопка — это
                   «открыть в новой вкладке», не мешаем браузеру */
                if (e.defaultPrevented || e.button !== 0 ||
                    e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                if (reduceMotion) return;

                e.preventDefault();
                card.classList.add('split-card--chosen');
                setTimeout(function () {
                    entryScreen.classList.add('entry-screen--exit');
                }, EXIT_DELAY);
                setTimeout(function () {
                    window.location.href = card.href;
                }, NAV_DELAY);
            });
        });
    })();

    /* =================================================
       2. СХЕМА СТЕКА ТЕХНОЛОГИЙ
       -------------------------------------------------
       hub — точка слева, от неё расходятся связи.
       edges: [откуда, куда]; null означает hub.
       ================================================= */
    (function initCharts() {
        var NS = 'http://www.w3.org/2000/svg';

        var CHARTS = {
            dev: {
                viewBox: '0 0 220 340',
                hub:   [3, 170],
                color: '#4dd9ff',
                glow:  'rgba(77,217,255,0.55)',
                nodes: [
                    { p: [85,  72],  t: ['C++'],              rx: 23, ry: 14 },
                    { p: [170, 34],  t: ['Qt'],               rx: 22, ry: 14 },
                    { p: [165, 112], t: ['Unreal', 'Engine'], rx: 34, ry: 20 },
                    { p: [80,  220], t: ['HTML & CSS'],       rx: 38, ry: 14 },
                    { p: [170, 190], t: ['MySQL'],            rx: 30, ry: 14 },
                    { p: [168, 268], t: ['JavaScript'],       rx: 40, ry: 14 },
                    { p: [85,  308], t: ['Python'],           rx: 28, ry: 14 }
                ],
                edges: [
                    [null, 0], [0, 1], [0, 2], [null, 3],
                    [3, 4], [3, 5], [4, 5], [null, 6]
                ]
            },
            video: {
                viewBox: '0 0 222 224',
                hub:   [3, 112],
                color: '#c97dff',
                glow:  'rgba(201,125,255,0.55)',
                nodes: [
                    { p: [118, 37],  t: ['Sony Vegas Pro'],        rx: 46, ry: 14 },
                    { p: [118, 116], t: ['Adobe', 'Premiere Pro'], rx: 43, ry: 20 },
                    { p: [118, 192], t: ['CapCut'],                rx: 28, ry: 14 }
                ],
                edges: [[null, 0], [null, 1], [null, 2]]
            }
        };

        /* Мелкий помощник: create + set attributes одной строкой */
        function svg(tag, attrs, className) {
            var el = document.createElementNS(NS, tag);
            for (var key in attrs) {
                if (attrs[key] !== undefined) el.setAttribute(key, attrs[key]);
            }
            if (className) el.setAttribute('class', className);
            return el;
        }

        function buildChart(type) {
            var cfg = CHARTS[type];
            var filterId = 'chart-glow-' + type;
            var blurUrl  = 'url(#' + filterId + ')';

            var root = svg('svg', { viewBox: cfg.viewBox, 'aria-hidden': 'true' }, 'the-chart');

            var defs = svg('defs');
            var filter = svg('filter', {
                id: filterId, x: '-60%', y: '-60%', width: '220%', height: '220%'
            });
            filter.appendChild(svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '2.5' }));
            defs.appendChild(filter);
            root.appendChild(defs);

            /* ── Связи ── */
            cfg.edges.forEach(function (edge, i) {
                var from = edge[0] === null ? cfg.hub : cfg.nodes[edge[0]].p;
                var to   = cfg.nodes[edge[1]].p;
                var coords = { x1: from[0], y1: from[1], x2: to[0], y2: to[1] };

                [
                    { stroke: cfg.glow,  width: 5,   filter: blurUrl, cls: 'chart-edge chart-edge--glow' },
                    { stroke: cfg.color, width: 1.5, filter: undefined, cls: 'chart-edge' }
                ].forEach(function (style) {
                    var line = svg('line', {
                        x1: coords.x1, y1: coords.y1, x2: coords.x2, y2: coords.y2,
                        stroke: style.stroke, 'stroke-width': style.width, filter: style.filter
                    }, style.cls);
                    line.style.setProperty('--di', i);
                    root.appendChild(line);
                });
            });

            /* ── Точка-источник ── */
            var hub = svg('g', null, 'chart-hub');
            hub.appendChild(svg('circle', {
                cx: cfg.hub[0], cy: cfg.hub[1], r: 9, fill: cfg.glow, filter: blurUrl
            }));
            hub.appendChild(svg('circle', {
                cx: cfg.hub[0], cy: cfg.hub[1], r: 5, fill: cfg.color
            }));
            root.appendChild(hub);

            /* ── Узлы ── */
            cfg.nodes.forEach(function (node, i) {
                var group = svg('g', null, 'chart-node');
                group.style.setProperty('--ni', i);

                group.appendChild(svg('ellipse', {
                    cx: node.p[0], cy: node.p[1],
                    rx: node.rx + 5, ry: node.ry + 5,
                    fill: 'none', stroke: cfg.glow, 'stroke-width': 3, filter: blurUrl
                }));
                group.appendChild(svg('ellipse', {
                    cx: node.p[0], cy: node.p[1], rx: node.rx, ry: node.ry,
                    fill: 'rgba(4,12,28,0.92)', stroke: cfg.color, 'stroke-width': 1.5
                }));

                var text = svg('text', {
                    'text-anchor': 'middle', fill: cfg.color,
                    'font-family': 'Manrope, sans-serif', 'font-size': 8.5,
                    'font-weight': 700, 'letter-spacing': 0.25
                });

                if (node.t.length === 1) {
                    text.setAttribute('x', node.p[0]);
                    text.setAttribute('y', node.p[1]);
                    text.setAttribute('dominant-baseline', 'middle');
                    text.textContent = node.t[0];
                } else {
                    node.t.forEach(function (line, li) {
                        var tspan = svg('tspan', { x: node.p[0] });
                        if (li === 0) tspan.setAttribute('y', node.p[1] - 4);
                        else tspan.setAttribute('dy', 11);
                        tspan.textContent = line;
                        text.appendChild(tspan);
                    });
                }

                group.appendChild(text);
                root.appendChild(group);
            });

            return root;
        }

        document.querySelectorAll('.split-card[data-chart]').forEach(function (card) {
            var type = card.dataset.chart;
            if (!CHARTS[type]) return;
            var wrap = document.createElement('div');
            wrap.className = 'chart-wrap';
            wrap.appendChild(buildChart(type));
            card.appendChild(wrap);
        });
    })();
})();
