/* =====================================================
   УВЕДОМЛЕНИЕ О ПРОБЛЕМАХ С ВИДЕО
   -----------------------------------------------------
   Один и тот же тост нужен и yt-check.js, и vk-check.js.
   Раньше он был написан дважды почти слово в слово —
   теперь это общий модуль, а проверки только говорят,
   что показать.

   Использование:
       MediaToast.show({
           title: 'Заголовок',
           text:  'Пояснение',
           action: { url: '...', label: 'Открыть', icon: 'fab fa-youtube' },
           dismissKey: 'yt_toast_dismissed'   // «больше не показывать»
       });

   Возвращает true, если тост показан. Второй тост за
   сессию не показывается: одного предупреждения хватает.
   ===================================================== */
(function () {
    'use strict';

    var LIFE       = 15000;   // мс до автозакрытия
    var LEAVE_TIME = 320;     // длительность анимации ухода
    var HOVER_TAIL = 4000;    // сколько ждать после увода курсора

    var shown = false;

    function isMuted(key) {
        if (!key) return false;
        try { return !!sessionStorage.getItem(key); } catch (e) { return false; }
    }

    function mute(key) {
        if (!key) return;
        try { sessionStorage.setItem(key, '1'); } catch (e) {}
    }

    function show(options) {
        if (shown) return false;
        if (!options.force && isMuted(options.dismissKey)) return false;
        shown = true;

        var action = options.action || {};

        var toast = document.createElement('div');
        toast.className = 'media-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'media-toast__close';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        closeBtn.innerHTML = '&times;';

        var icon = document.createElement('div');
        icon.className = 'media-toast__icon';
        icon.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>';

        var body = document.createElement('div');
        body.className = 'media-toast__body';

        var title = document.createElement('p');
        title.className = 'media-toast__title';
        title.textContent = options.title;

        var text = document.createElement('p');
        text.className = 'media-toast__text';
        text.textContent = options.text;

        var actions = document.createElement('div');
        actions.className = 'media-toast__actions';

        if (action.url) {
            var link = document.createElement('a');
            link.className = 'media-toast__btn';
            link.href = action.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.innerHTML = '<i class="' + (action.icon || 'fas fa-arrow-up-right-from-square') +
                             '" aria-hidden="true"></i> ';
            link.appendChild(document.createTextNode(action.label || 'Открыть'));
            actions.appendChild(link);
        }

        var muteBtn = document.createElement('button');
        muteBtn.type = 'button';
        muteBtn.className = 'media-toast__ghost';
        muteBtn.textContent = 'Больше не показывать';
        actions.appendChild(muteBtn);

        var progress = document.createElement('span');
        progress.className = 'media-toast__progress';
        progress.style.animationDuration = LIFE + 'ms';

        body.append(title, text, actions);
        toast.append(closeBtn, icon, body, progress);
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('media-toast--visible');
        });

        var hideTimer = setTimeout(hide, LIFE);

        function hide() {
            clearTimeout(hideTimer);
            toast.classList.add('media-toast--leaving');
            setTimeout(function () { toast.remove(); }, LEAVE_TIME);
        }

        /* Пока читают — не закрывать */
        toast.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
        toast.addEventListener('mouseleave', function () { hideTimer = setTimeout(hide, HOVER_TAIL); });

        closeBtn.addEventListener('click', hide);
        muteBtn.addEventListener('click', function () {
            mute(options.dismissKey);
            hide();
        });

        return true;
    }

    window.MediaToast = { show: show };
})();
