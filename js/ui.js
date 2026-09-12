/* =====================================================
   ОБЩИЙ ИНТЕРФЕЙС САЙТА
   -----------------------------------------------------
   Раньше этот код лежал прямо в index.html, programming.html
   и video.html — тремя почти одинаковыми копиями. Теперь он
   в одном месте, а страницы просто подключают файл.

   Что внутри:
     1. Данные об образовании (единственное место в проекте).
     2. Универсальный механизм модальных окон:
        Esc, клик по фону, возврат фокуса, ловушка фокуса,
        блокировка прокрутки страницы.
     3. Сборка окна «Образование» из данных.
     4. Вкладки раздела «Видеомонтаж» (со счётчиками,
        которые считаются сами, и навигацией стрелками).
     5. Папки типов роликов во вкладке «Портфолио».
     6. Снятие метки «золотое сечение» по дате.
     7. Окно «Видео с разных площадок» на странице
        видеомонтажа: VK, YouTube и предупреждение про VPN.
   ===================================================== */
(function () {
    'use strict';

    /* =================================================
       1. ДАННЫЕ: ОБРАЗОВАНИЕ
       Правится только здесь — окно соберётся само
       на всех страницах сразу.
       ================================================= */
    var EDUCATION = [
        {
            modifier:    'spo',
            icon:        'fa-school',
            institution: 'Владивостокский Государственный Университет',
            program:     'Информационные системы и программирование',
            levelIcon:   'fa-certificate',
            level:       'СПО · 2020 – 2025',
            note:        'Специальность: Информационные системы и программирование'
        },
        {
            modifier:    'bachelor',
            icon:        'fa-user-graduate',
            institution: 'Владивостокский Государственный Университет',
            program:     'Программная инженерия',
            levelIcon:   'fa-graduation-cap',
            level:       'Бакалавриат · 2025 – настоящее время',
            note:        'Направление: Программная инженерия'
        }
    ];

    /* =================================================
       2. МОДАЛЬНЫЕ ОКНА
       ================================================= */
    var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    var openStack = [];

    function createModal(modal, options) {
        options = options || {};
        var lastFocused = null;

        function open() {
            lastFocused = document.activeElement;
            if (options.onOpen) options.onOpen(modal);
            modal.classList.add('modal--open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('body--modal-open');
            openStack.push(api);

            var first = modal.querySelector(FOCUSABLE);
            if (first) first.focus();
        }

        function close() {
            modal.classList.remove('modal--open');
            modal.setAttribute('aria-hidden', 'true');
            var i = openStack.indexOf(api);
            if (i !== -1) openStack.splice(i, 1);
            if (!openStack.length) document.body.classList.remove('body--modal-open');
            if (options.onClose) options.onClose(modal);
            if (lastFocused && lastFocused.focus) lastFocused.focus();
        }

        /* Клик именно по подложке, а не по любому месту окна */
        modal.addEventListener('click', function (e) {
            if (e.target === modal) close();
        });

        /* Фокус не убегает из открытого окна */
        modal.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab') return;
            var items = Array.prototype.filter.call(
                modal.querySelectorAll(FOCUSABLE),
                function (el) { return el.offsetParent !== null; }
            );
            if (!items.length) return;

            var first = items[0];
            var last  = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        });

        var api = { open: open, close: close, el: modal };
        return api;
    }

    /* Esc закрывает верхнее окно */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && openStack.length) {
            openStack[openStack.length - 1].close();
        }
    });

    /* =================================================
       3. ОКНО «ОБРАЗОВАНИЕ»
       ================================================= */
    function initEducation() {
        var triggers = document.querySelectorAll('.btn-education-trigger');
        if (!triggers.length) return;

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'eduModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Моё образование');
        modal.setAttribute('aria-hidden', 'true');

        var content = document.createElement('div');
        content.className = 'modal-content edu-modal-content';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'close-btn';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        closeBtn.innerHTML = '&times;';

        var title = document.createElement('h3');
        title.className = 'edu-modal-title';
        title.innerHTML = '<i class="fas fa-graduation-cap" aria-hidden="true"></i> Моё образование';

        var list = document.createElement('div');
        list.className = 'edu-cards-container';

        EDUCATION.forEach(function (item) {
            var card = document.createElement('div');
            card.className = 'edu-card edu-card--' + item.modifier;

            var shine = document.createElement('div');
            shine.className = 'edu-card__shine';

            var icon = document.createElement('div');
            icon.className = 'edu-icon';
            icon.innerHTML = '<i class="fas ' + item.icon + '" aria-hidden="true"></i>';

            var info = document.createElement('div');
            info.className = 'edu-info';

            var institution = document.createElement('span');
            institution.className = 'edu-institution';
            institution.textContent = item.institution;

            var program = document.createElement('h3');
            program.textContent = item.program;

            var level = document.createElement('h5');
            level.innerHTML = '<i class="fas ' + item.levelIcon + '" aria-hidden="true"></i> ';
            level.appendChild(document.createTextNode(item.level));

            var note = document.createElement('p');
            note.textContent = item.note;

            info.append(institution, program, level, note);
            card.append(shine, icon, info);
            list.appendChild(card);
        });

        content.append(closeBtn, title, list);
        modal.appendChild(content);
        document.body.appendChild(modal);

        var api = createModal(modal, {
            /* блик по стеклу должен проигрываться при каждом открытии */
            onOpen: function (el) {
                el.querySelectorAll('.edu-card__shine').forEach(function (shine) {
                    shine.style.animation = 'none';
                    void shine.offsetHeight;
                    shine.style.animation = '';
                });
            }
        });

        closeBtn.addEventListener('click', api.close);
        triggers.forEach(function (btn) {
            btn.addEventListener('click', api.open);
        });
    }

    /* =================================================
       4. ВКЛАДКИ «ШОУРИЛЫ / КЕЙСЫ»
       ================================================= */
    function initVideoTabs() {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('.video-tab'));
        if (!tabs.length) return;

        function panelOf(tab) {
            return document.getElementById('tab-' + tab.dataset.tab);
        }

        function activate(tab, focus) {
            tabs.forEach(function (t) {
                var isActive = t === tab;
                t.classList.toggle('video-tab--active', isActive);
                t.setAttribute('aria-selected', isActive ? 'true' : 'false');
                t.tabIndex = isActive ? 0 : -1;

                var panel = panelOf(t);
                if (panel) panel.classList.toggle('video-tab-panel--hidden', !isActive);
            });
            if (focus) tab.focus();
        }

        tabs.forEach(function (tab, i) {
            var panel = panelOf(tab);
            if (panel) {
                tab.id = tab.id || 'video-tab-' + tab.dataset.tab;
                tab.setAttribute('aria-controls', panel.id);
                panel.setAttribute('aria-labelledby', tab.id);
                panel.tabIndex = 0;

                /* Счётчик считается по разметке, а не проставляется руками */
                var counter = tab.querySelector('.video-tab__count');
                if (counter) {
                    counter.textContent = panel.querySelectorAll('.video-case-card').length;
                }
            }

            tab.addEventListener('click', function () { activate(tab); });
            tab.addEventListener('keydown', function (e) {
                var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!step) return;
                e.preventDefault();
                activate(tabs[(i + step + tabs.length) % tabs.length], true);
            });
        });
    }

    /* =================================================
       5. ПАПКИ ТИПОВ РОЛИКОВ
       -------------------------------------------------
       Кнопка .folder-card управляет блоком .folder-panel,
       id которого указан в aria-controls. Открыта всегда
       не больше одной папки — повторное нажатие закрывает.
       Приоткрывание при наведении делает CSS, здесь только
       состояние.
       ================================================= */
    function initFolders() {
        var cards = Array.prototype.slice.call(
            document.querySelectorAll('.folder-card[aria-controls]')
        );
        if (!cards.length) return;

        function panelOf(card) {
            return document.getElementById(card.getAttribute('aria-controls'));
        }

        function setState(card, open) {
            var panel = panelOf(card);
            card.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (!panel) return;
            panel.hidden = !open;
            if (open) {
                /* перезапуск анимации появления при каждом открытии */
                panel.style.animation = 'none';
                void panel.offsetHeight;
                panel.style.animation = '';
            }
        }

        cards.forEach(function (card) {
            var panel = panelOf(card);
            if (!panel) return;

            /* Счётчик роликов считается по разметке */
            var counter = card.querySelector('.folder-card__count');
            if (counter) {
                counter.textContent = panel.querySelectorAll('.video-case-card').length;
            }

            card.addEventListener('click', function () {
                var willOpen = card.getAttribute('aria-expanded') !== 'true';
                cards.forEach(function (other) { setState(other, false); });
                if (willOpen) setState(card, true);
            });
        });
    }

    /* =================================================
       6. «ЗОЛОТОЕ СЕЧЕНИЕ»: МЕТКА СНИМАЕТСЯ САМА
       Видна до даты в data-golden-until (не включая её).
       ================================================= */
    function initGoldenRibbons() {
        document.querySelectorAll('.video-case-card--golden[data-golden-until]').forEach(function (card) {
            var until = new Date(card.dataset.goldenUntil + 'T00:00:00');
            if (isNaN(until) || new Date() >= until) {
                card.classList.remove('video-case-card--golden');
                var ribbon = card.querySelector('.golden-ribbon');
                if (ribbon) ribbon.remove();
            }
        });
    }

    /* =================================================
       7. ОКНО «ВИДЕО С РАЗНЫХ ПЛОЩАДОК»
       -------------------------------------------------
       Открывается само при входе на страницу видеомонтажа
       и только один раз за сессию: часть роликов лежит в
       VK, часть на YouTube, а VK не показывает видео с
       зарубежных IP — про это честнее предупредить сразу,
       чем ловить сломанный плеер уведомлением потом.
       ================================================= */
    var NOTICE_KEY   = 'platforms_notice_seen';
    var NOTICE_DELAY = 700;   // мс: даём странице проявиться

    function initPlatformNotice() {
        if (document.body.dataset.mode !== 'video') return;

        try {
            if (sessionStorage.getItem(NOTICE_KEY)) return;
        } catch (e) {}

        var modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'platformsModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Видео с разных площадок');
        modal.setAttribute('aria-hidden', 'true');

        var content = document.createElement('div');
        content.className = 'modal-content notice-modal';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'close-btn';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        closeBtn.innerHTML = '&times;';

        var badge = document.createElement('div');
        badge.className = 'notice-modal__icon';
        badge.innerHTML = '<i class="fas fa-circle-info" aria-hidden="true"></i>';

        var title = document.createElement('h3');
        title.className = 'notice-modal__title';
        title.textContent = 'Видео с разных площадок';

        var text = document.createElement('p');
        text.className = 'notice-modal__text';
        text.textContent = 'Часть роликов опубликована в VK Видео, часть — на YouTube. ' +
                           'Все плееры встроены прямо в страницу.';

        var platforms = document.createElement('div');
        platforms.className = 'notice-modal__platforms';
        platforms.innerHTML =
            '<span class="video-source-badge video-source-badge--vk">' +
            '<i class="fab fa-vk" aria-hidden="true"></i> VK Видео</span>' +
            '<span class="video-source-badge video-source-badge--yt">' +
            '<i class="fab fa-youtube" aria-hidden="true"></i> YouTube</span>';

        var warn = document.createElement('p');
        warn.className = 'notice-modal__warn';
        warn.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>';
        warn.appendChild(document.createElement('span')).textContent =
            'Если включён VPN, видео из VK может не загрузиться: просмотр ограничен ' +
            'для зарубежных IP-адресов. Отключите VPN — и ролики заработают.';

        var okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'notice-modal__ok';
        okBtn.textContent = 'Понятно';

        /* Крестик последним в разметке — тогда фокус при открытии
           встаёт на «Понятно», а не на кнопку закрытия.
           Визуально он всё равно в углу: position: absolute. */
        content.append(badge, title, text, platforms, warn, okBtn, closeBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);

        var api = createModal(modal);
        closeBtn.addEventListener('click', api.close);
        okBtn.addEventListener('click', api.close);

        try { sessionStorage.setItem(NOTICE_KEY, '1'); } catch (e) {}
        setTimeout(api.open, NOTICE_DELAY);
    }

    /* =================================================
       СТАРТ
       ================================================= */
    initEducation();
    initVideoTabs();
    initFolders();
    initGoldenRibbons();
    initPlatformNotice();
})();