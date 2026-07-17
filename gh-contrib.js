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
    const SOURCES = [
        {
            url: u => `https://github-contributions-api.jogruber.de/v4/${u}?y=last`,
            parse: json => (json.contributions || []).map(c => ({ date: c.date, count: c.count }))
        },
        {
            url: u => `https://github-contributions.vercel.app/api/v1/${u}`,
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
                if (days && days.length) return days;
                throw new Error('пустой ответ');
            } catch (e) { lastErr = e; }
        }
        throw lastErr || new Error('нет данных');
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
            weeks.push({ from, to, count: map.get(key) || 0 });
        }
        return weeks;
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
        tip.innerHTML = week.count
            ? `<b>${week.count} ${contribWord(week.count)}</b><span>${range}</span>`
            : `<b>Без активности</b><span>${range}</span>`;
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
    loadContributions()
        .then(days => {
            root.classList.remove('gh-contrib--loading');
            render(buildWeeks(days));
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
