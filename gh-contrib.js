/* =====================================================
   GITHUB CONTRIBUTIONS — ЛЕНТА ТОЧЕК
   -----------------------------------------------------
   1 кружок = 1 неделя (пн–вс), кружки сгруппированы
   по месяцам. Яркость кружка зависит от числа коммитов
   за неделю. При наведении — короткая подсказка.
   Справа сверху — когда была последняя активность.

   Данных о contributions в официальном REST API нет,
   поэтому берём их с публичного зеркала (два запасных
   источника на случай, если первый не отвечает).
   ===================================================== */
(function () {
    'use strict';

    const root = document.getElementById('gh-contrib');
    if (!root) return;

    const USER  = root.dataset.user || 'Zillendaw';
    const WEEKS = 53;                       // сколько недель показываем
    const PROFILE_URL = 'https://github.com/' + USER;

    const elTrack = root.querySelector('.gh-contrib__track');
    const elLast  = root.querySelector('.gh-contrib__last');
    const elScroll = root.querySelector('.gh-contrib__scroll');

    /* ── Утилиты ─────────────────────────────────────── */
    const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн',
                    'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

    function plural(n, one, few, many) {
        const n10 = n % 10, n100 = n % 100;
        if (n10 === 1 && n100 !== 11) return one;
        if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
        return many;
    }
    const contribWord = n => plural(n, 'контрибуция', 'контрибуции', 'контрибуций');

    const fmtDay = d => d.getDate() + ' ' + MONTHS[d.getMonth()];

    const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function daysAgoText(d) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff = Math.round((today - d) / 86400000);
        if (diff <= 0) return 'сегодня';
        if (diff === 1) return 'вчера';
        if (diff < 7)   return diff + ' ' + plural(diff, 'день', 'дня', 'дней') + ' назад';
        if (diff < 31)  { const w = Math.floor(diff / 7); return w + ' ' + plural(w, 'неделю', 'недели', 'недель') + ' назад'; }
        const m = Math.floor(diff / 30);
        if (m < 12) return m + ' ' + plural(m, 'месяц', 'месяца', 'месяцев') + ' назад';
        const y = Math.floor(diff / 365);
        return y + ' ' + plural(y, 'год', 'года', 'лет') + ' назад';
    }

    function mondayOf(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const shift = (d.getDay() + 6) % 7;          // вс = 6, пн = 0
        d.setDate(d.getDate() - shift);
        return d;
    }

    /* ── Загрузка данных ─────────────────────────────── */
    // Свой Worker — первоисточник: видит приватные контрибуции
    // и не имеет лимитов. Зеркала оставлены как подстраховка
    // (приватные они не видят, но лучше, чем пустая лента).
    const WORKER_URL = 'https://my-web-site.sasha88543.workers.dev';

    const SOURCES = [
        {
            url: u => `${WORKER_URL}/contrib?user=${u}`,
            parse: json => (json.contributions || []).map(c => ({ date: c.date, count: c.count }))
        },
        {
            url: u => `https://github-contributions-api.jogruber.de/v4/${u}?y=last`,
            parse: json => (json.contributions || []).map(c => ({ date: c.date, count: c.count }))
        }
    ];

    async function loadContributions() {
        let lastErr;
        for (const src of SOURCES) {
            try {
                const res = await fetch(src.url(USER), { headers: { Accept: 'application/json' } });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const days = src.parse(await res.json());
                // Источник может ответить 200, но с пустышкой
                // (так сломался один из зеркал — все count = 0).
                if (days && days.length && days.some(d => d.count > 0)) return days;
                throw new Error('пустой ответ');
            } catch (e) { lastErr = e; }
        }
        throw lastErr || new Error('нет данных');
    }

    /* ── Репозитории: публичные события GitHub ────────────
       GitHub отдаёт названия репозиториев только для
       публичной активности и только примерно за 90 дней.
       Всё, что осталось «сверху» (или недели вовсе без
       публичных событий) — это приватные репозитории:
       их названия GitHub не раскрывает никогда.
       ──────────────────────────────────────────────── */
    const EVENTS_DAYS = 90;                  // глубина, которую покрывает API
    const EVENT_TYPES = {
        PushEvent: e => e.payload?.size || 1,
        PullRequestEvent: e => (e.payload?.action === 'opened' ? 1 : 0),
        IssuesEvent:      e => (e.payload?.action === 'opened' ? 1 : 0),
        PullRequestReviewEvent: () => 1,
        CreateEvent: e => (e.payload?.ref_type === 'repository' ? 1 : 0)
    };

    async function loadEvents() {
        const events = [];
        for (let page = 1; page <= 3; page++) {
            const res = await fetch(
                `https://api.github.com/users/${USER}/events/public?per_page=100&page=${page}`,
                { headers: { Accept: 'application/vnd.github+json' } }
            );
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const chunk = await res.json();
            if (!Array.isArray(chunk) || !chunk.length) break;
            events.push(...chunk);
            if (chunk.length < 100) break;
        }
        return events;
    }

    /* Недельный ключ → Map(репозиторий → количество) */
    function repoIndex(events) {
        const index = new Map();
        events.forEach(e => {
            const scoreFn = EVENT_TYPES[e.type];
            if (!scoreFn) return;
            const score = scoreFn(e);
            if (!score) return;

            const date = new Date(e.created_at);
            if (isNaN(date)) return;
            const key = mondayOf(date).toISOString().slice(0, 10);

            const full = e.repo?.name || '';
            if (!full) return;

            if (!index.has(key)) index.set(key, new Map());
            const repos = index.get(key);
            repos.set(full, (repos.get(full) || 0) + score);
        });
        return index;
    }

    /* ── Недели ──────────────────────────────────────── */
    function buildWeeks(days) {
        const map = new Map();                       // ISO-дата понедельника → сумма
        const totals = new Map();
        days.forEach(d => {
            const date = new Date(d.date + 'T00:00:00');
            if (isNaN(date)) return;
            const key = mondayOf(date).toISOString().slice(0, 10);
            map.set(key, (map.get(key) || 0) + (d.count || 0));
            totals.set(key, true);
        });

        const weeks = [];
        const start = mondayOf(new Date());
        start.setDate(start.getDate() - (WEEKS - 1) * 7);
        for (let i = 0; i < WEEKS; i++) {
            const from = new Date(start); from.setDate(start.getDate() + i * 7);
            const to   = new Date(from);  to.setDate(from.getDate() + 6);
            const key  = from.toISOString().slice(0, 10);
            weeks.push({ key, from, to, count: map.get(key) || 0 });
        }
        return weeks;
    }

    /* Раскладываем неделю на публичные репозитории + приватные */
    function attachRepos(weeks, index) {
        if (!index) return;                              // события не загрузились
        const edge = new Date();
        edge.setDate(edge.getDate() - EVENTS_DAYS);      // граница покрытия API

        weeks.forEach(w => {
            if (!w.count) return;
            if (w.to < edge) return;                     // старше 90 дней — данных нет

            w.covered = true;
            const repos = index.get(w.key);
            const list = repos
                ? [...repos.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([full, count]) => ({
                        name: full.startsWith(USER + '/') ? full.slice(USER.length + 1) : full,
                        url: 'https://github.com/' + full,
                        count
                    }))
                : [];

            const known = list.reduce((s, r) => s + r.count, 0);
            w.repos = list;
            // Ничего публичного нет, либо часть коммитов «не сходится»
            // (запас в 1 — на мелкие расхождения счётчиков GitHub)
            w.private = list.length ? (w.count - known >= 2) : true;
        });
    }

    function levelOf(count, max) {
        if (!count) return 0;
        if (count >= max * 0.75) return 4;
        if (count >= max * 0.5)  return 3;
        if (count >= max * 0.25) return 2;
        return 1;
    }

    /* ── Подсказка ───────────────────────────────────── */
    const tip = document.createElement('div');
    tip.className = 'gh-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);

    function showTip(dot, week) {
        const range = week.from.getMonth() === week.to.getMonth()
            ? `${week.from.getDate()}–${fmtDay(week.to)}`
            : `${fmtDay(week.from)} – ${fmtDay(week.to)}`;
        let html = week.count
            ? `<b>${week.count} ${contribWord(week.count)}</b><span>${range}</span>`
            : `<b>Без активности</b><span>${range}</span>`;

        if (week.count) {
            const rows = [];
            (week.repos || []).slice(0, 3).forEach(r => {
                rows.push(
                    `<span class="gh-tip__repo">
                        <i class="fas fa-book-bookmark"></i>${escapeHtml(r.name)}
                     </span>`
                );
            });
            const rest = (week.repos || []).length - 3;
            if (rest > 0) rows.push(`<span class="gh-tip__more">+ ещё ${rest}</span>`);
            if (week.private) {
                rows.push(
                    `<span class="gh-tip__repo gh-tip__repo--private">
                        <i class="fas fa-lock"></i>PRIVATE REPOSITORY
                     </span>`
                );
            }
            if (rows.length) html += `<div class="gh-tip__repos">${rows.join('')}</div>`;
        }

        tip.innerHTML = html;
        tip.classList.add('gh-tip--visible');

        const r = dot.getBoundingClientRect();
        const t = tip.getBoundingClientRect();
        let left = r.left + r.width / 2 - t.width / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
        let top = r.top - t.height - 10;
        tip.classList.toggle('gh-tip--below', top < 8);
        if (top < 8) top = r.bottom + 10;
        tip.style.left = left + 'px';
        tip.style.top  = top + 'px';
    }
    const hideTip = () => tip.classList.remove('gh-tip--visible');
    window.addEventListener('scroll', hideTip, true);

    /* ── Отрисовка ───────────────────────────────────── */
    function render(weeks) {
        const max = Math.max(1, ...weeks.map(w => w.count));
        elTrack.innerHTML = '';

        let group = null, groupMonth = null;
        weeks.forEach((w, i) => {
            // месяц недели определяем по её середине (четвергу)
            const mid = new Date(w.from); mid.setDate(mid.getDate() + 3);
            const key = mid.getFullYear() + '-' + mid.getMonth();

            if (key !== groupMonth) {
                groupMonth = key;
                group = document.createElement('div');
                group.className = 'gh-contrib__month';
                const dots = document.createElement('div');
                dots.className = 'gh-contrib__dots';
                const label = document.createElement('span');
                label.className = 'gh-contrib__month-label';
                label.textContent = mid.getMonth() === 0
                    ? MONTHS[0] + ' ’' + String(mid.getFullYear()).slice(2)
                    : MONTHS[mid.getMonth()];
                group.append(dots, label);
                elTrack.appendChild(group);
            }

            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'gh-contrib__dot';
            dot.dataset.level = levelOf(w.count, max);
            dot.style.setProperty('--i', i);
            dot.setAttribute('aria-label',
                `${fmtDay(w.from)} – ${fmtDay(w.to)}: ${w.count} ${contribWord(w.count)}`);

            dot.addEventListener('mouseenter', () => showTip(dot, w));
            dot.addEventListener('focus',      () => showTip(dot, w));
            dot.addEventListener('mouseleave', hideTip);
            dot.addEventListener('blur',       hideTip);
            dot.addEventListener('click', e => { e.preventDefault(); showTip(dot, w); });

            group.querySelector('.gh-contrib__dots').appendChild(dot);
        });

        // лента прокручена к «сегодня»
        if (elScroll) elScroll.scrollLeft = elScroll.scrollWidth;
    }

    function renderLast(days) {
        const active = days
            .map(d => ({ date: new Date(d.date + 'T00:00:00'), count: d.count || 0 }))
            .filter(d => d.count > 0 && d.date <= new Date())
            .sort((a, b) => b.date - a.date)[0];

        if (!active) { elLast.textContent = 'Активности за год нет'; return; }
        elLast.innerHTML =
            `<i class="fas fa-circle gh-contrib__pulse"></i> Последняя активность: <b>${daysAgoText(active.date)}</b>` +
            `<span class="gh-contrib__last-sub"> · ${fmtDay(active.date)}, ${active.count} ${contribWord(active.count)}</span>`;
    }

    /* ── Старт ───────────────────────────────────────── */
    Promise.all([
        loadContributions(),
        // события — необязательные: лимит API или ошибка не должны ломать ленту
        loadEvents().catch(() => null)
    ])
        .then(([days, events]) => {
            root.classList.remove('gh-contrib--loading');
            const weeks = buildWeeks(days);
            attachRepos(weeks, events ? repoIndex(events) : null);
            render(weeks);
            renderLast(days);
        })
        .catch(() => {
            root.classList.remove('gh-contrib--loading');
            root.classList.add('gh-contrib--error');
            elTrack.innerHTML =
                `<a class="gh-contrib__fallback" href="${PROFILE_URL}" target="_blank" rel="noopener">
                    Не удалось загрузить активность — открыть профиль на GitHub
                 </a>`;
            elLast.textContent = '';
        });
})();