/* ============================================================
   sdtab.js —— 新版底部胶囊导航 + 皮肤层注入
   用法：在每个页面 </body> 之前加
       <link rel="stylesheet" href="css/sdtheme.css">
       <script src="js/sdtab.js"></script>
   （若只加 sdtab.js，本脚本会自动注入 sdtheme.css）
   ============================================================ */
(function () {
    'use strict';

    /* ---------- 0. 皮肤层兜底注入 ---------- */
    function ensureTheme() {
        var has = Array.prototype.some.call(
            document.querySelectorAll('link[rel="stylesheet"]'),
            function (l) { return (l.getAttribute('href') || '').indexOf('sdtheme.css') >= 0; }
        );
        if (!has) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/sdtheme.css';
            document.head.appendChild(link);
        }
    }

    /* ---------- 1. 图标（新版线性/面性混合风） ---------- */
    var ICONS = {
        sy: '<path d="M12 3.1 2.8 11a1 1 0 0 0 .65 1.75H5V20a1 1 0 0 0 1 1h3.7v-5.2h4.6V21H18a1 1 0 0 0 1-1v-7.25h1.55A1 1 0 0 0 21.2 11z"/>',
        db: '<path d="M7 2.8a2 2 0 0 0-2 2V21l7-4.05L19 21V4.8a2 2 0 0 0-2-2z"/>',
        bc: '<path d="M4 4h6.6v6.6H4zm9.4 0H20v6.6h-6.6zM4 13.4h6.6V20H4zm9.4 0H20V20h-6.6z"/>',
        xx: '<path d="M12 3C6.9 3 2.8 6.4 2.8 10.6c0 2.4 1.4 4.6 3.6 6L5.6 21l4.2-2.3c.7.1 1.4.2 2.2.2 5.1 0 9.2-3.4 9.2-7.6S17.1 3 12 3z"/>',
        w:  '<path d="M12 3.4a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8zm0 11c4.4 0 8 2.5 8 5.6v1.2H4V20c0-3.1 3.6-5.6 8-5.6z"/>'
    };

    var TABS = [
        { key: 'sy', label: '首页', href: 'shouye.html' },
        { key: 'db', label: '待办', href: 'daiban.html' },
        { key: 'bc', label: '办&查', href: 'bancha.html' },
        { key: 'xx', label: '消息', href: 'message.html' },
        { key: 'w',  label: '我的', href: 'index.html' }
    ];

    /* 页面 → 归属 tab（子页高亮所属主 tab） */
    var OWNER = {
        'shouye.html': 'sy', 'index.html': 'w',
        'daiban.html': 'db',
        'bancha.html': 'bc',
        'message.html': 'xx',
        'login.html': 'w', 'gerenxinxi.html': 'w', 'gerenxinxi_menu.html': 'w',
        'yhk.html': 'w', 'jtcy.html': 'w', 'jtcy_add.html': 'w',
        'aqzx.html': 'w', 'zixun.html': 'w', 'help_center.html': 'w',
        'care_version.html': 'w', 'about_app.html': 'w', 'about_us.html': 'w',
        'other_id.html': 'w', 'wodepiaojia.html': 'w',
        'zonghe.html': 'bc', 'zxkouchu.html': 'bc', 'chaxun.html': 'bc',
        'shuiming.html': 'bc', 'xiangqing.html': 'bc', 'nashui_edit.html': 'bc',
        'shenbao_jilu.html': 'bc', 'yiyishensu.html': 'bc', 'shuiwuwenshu.html': 'bc',
        'sheshuizhuanye.html': 'bc', 'sheshuifuwu.html': 'bc', 'weituodaili.html': 'bc',
        'jingyingsuode.html': 'bc', 'gerenyanglao.html': 'bc', 'gongyicishan.html': 'bc',
        'tax_benefit.html': 'bc', 'renzhi.html': 'bc'
    };

    function currentFile() {
        var p = location.pathname.split('/').pop() || 'shouye.html';
        return p.toLowerCase();
    }

    function activeKey() {
        var f = currentFile();
        if (OWNER[f]) return OWNER[f];
        var body = document.body.className || '';
        if (/page-index|mine/i.test(body)) return 'w';
        if (/page-bancha|chaxun/i.test(body)) return 'bc';
        if (/page-daiban/i.test(body)) return 'db';
        if (/page-message/i.test(body)) return 'xx';
        return 'sy';
    }

    /* ---------- 2. 重建底部导航（与源码一致：caidan/*.png 位图图标 + 文字） ---------- */
    function buildNav() {
        var nav = document.querySelector('.bottom-nav');
        if (!nav) return;
        var act = activeKey();
        var html = '';
        TABS.forEach(function (t) {
            var on = (t.key === act) ? ' active' : '';
            /* 源码 updateNavIcons()：选中 *1.png，未选中 *2.png */
            var icon = 'caidan/' + t.key + (on ? '1' : '2') + '.png';
            html += '<a href="' + t.href + '" class="nav-item' + on + '" data-icon="' + t.key + '">' +
                    '<div class="nav-icon"><img src="' + icon + '" width="19" height="19" alt="' + t.label + '"></div>' +
                    '<span class="nav-text">' + t.label + '</span></a>';
        });
        nav.innerHTML = html;
        nav.classList.add('sd-nav');
    }

    /* ---------- 3. 顶部搜索栏滚动渐变 ---------- */
    function bindSearchbar() {
        var bar = document.querySelector('.sd-searchbar, .search-bar-wrapper');
        if (!bar) return;
        function onScroll() {
            if ((window.scrollY || document.documentElement.scrollTop) > 6) bar.classList.add('scrolled');
            else bar.classList.remove('scrolled');
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ---------- 4. 兼容旧页面的图标刷新钩子 ---------- */
    window.__refreshNavFromMineUi = function () {
        var nav = document.querySelector('.bottom-nav');
        if (!nav) return;
        var act = activeKey();
        Array.prototype.forEach.call(nav.querySelectorAll('.nav-item'), function (it) {
            var key = it.getAttribute('data-icon');
            var on = (key === act);
            it.classList.toggle('active', on);
            var img = it.querySelector('.nav-icon img');
            if (img && key) img.src = 'caidan/' + key + (on ? '1' : '2') + '.png';
        });
    };

    /* ---------- 5. 启动 ---------- */
    function boot() {
        ensureTheme();
        buildNav();
        bindSearchbar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
