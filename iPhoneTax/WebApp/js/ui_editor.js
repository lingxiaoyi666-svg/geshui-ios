/* ============================================================================
   ui_editor.js —— 全站 UI 可自定义系统：傻瓜版可视化编辑（无第三方依赖）
   ----------------------------------------------------------------------------
   依赖：js/ui_kit.js（window.UIKit）
   存储键：不变（geshui_ui_config）；UIKit 公开 API 签名不变。

   进入方式（对外只宣传第 1 条）：
     1) 任意页面长按 1.5 秒（唯一公开入口，手机端）
     2) URL 参数 ?edit=1 —— 调试用，不对外宣传；仅注入编辑器，不写任何配置
     3) window.UIEditor.open('shouye'|'daiban'|'bancha'|'message'|'mine')

   傻瓜版操作（用户视角，四步）：
     第 1 步  长按页面 1.5 秒 → 顶部出现工具条（退出 / 拖动元素改位置 · 页名 / 保存）
     第 2 步  直接用手指拖元素 → 位置即时预览（页面里所有可编辑元素都能拖，不用先选）
     第 3 步  点一下元素 → 元素下方弹出气泡菜单：
             改文字 / 字号− / 字号+ / 颜色 / 换图 / 跳转 / 删除 / 取消选中
     第 4 步  点右上「保存」；要换页/换背景/字号缩放/字体/增删/JSON → 点底部「更多设置」

   规则：
     · 选中＝唯一选中，选中态 outline:2px dashed #1677FF，元素右上角挂中文小标签
     · 气泡里只有中文，不出现 JSON、不出现英文字段名
     · 底部默认不展开抽屉，只留一个「更多设置」按钮
     · 绝对定位页面（shouye / index）拖动改 rect 百分比；
       文档流页面（daiban / bancha / message）拖动改像素偏移（不改兄弟节点布局）
     · 优先 Pointer Events，无 window.PointerEvent 时回退 touch 事件
   ========================================================================= */
(function (global) {
    'use strict';

    var K = global.UIKit;
    if (!K) {
        console.warn('[UIEditor] 请先加载 js/ui_kit.js');
        return;
    }

    /* 事件族：优先 Pointer Events，无则回退 touch（真机 WebView 兜底） */
    var HAS_POINTER = !!global.PointerEvent;
    var EV_DOWN = HAS_POINTER ? 'pointerdown' : 'touchstart';
    var EV_MOVE = HAS_POINTER ? 'pointermove' : 'touchmove';
    var EV_UP = HAS_POINTER ? 'pointerup' : 'touchend';
    var EV_CANCEL = HAS_POINTER ? 'pointercancel' : 'touchcancel';

    var S = {
        open: false,
        pageKey: null,
        root: null,
        diffEls: {},        // id -> 补丁对象（只存改动字段）
        removed: [],
        selId: null,
        drag: null,
        bubble: null,
        fx: null,
        sheetOpen: false,
        suppressUntil: 0,
        toastTimer: null,
        els: {}
    };

    /* 预设颜色（气泡「颜色」一排） */
    var PRESET_COLORS = [
        '#1A1A1A', '#666666', '#999999', '#FFFFFF',
        '#1677FF', '#00B578', '#FF4D4F', '#FF8F1F',
        '#FAAD14', '#722ED1', '#C87930', '#8B572A'
    ];

    /* 常用跳转目标（气泡「跳转」下拉） */
    var TARGETS = [
        ['shouye.html', '首页'],
        ['daiban.html', '待办'],
        ['message.html', '消息'],
        ['index.html', '我的'],
        ['zonghe.html', '综合所得年度汇算'],
        ['zxkouchu.html', '专项附加扣除'],
        ['shuiming.html', '收入纳税明细'],
        ['wodepiaojia.html', '我的票夹'],
        ['help_center.html', '帮助中心'],
        ['login.html', '登录页']
    ];

    /* --------------------------------------------------------------- 工具 */

    function has(o, k) { return Object.prototype.hasOwnProperty.call(o || {}, k); }

    function mergeInto(dst, src) {
        var k;
        dst = dst || {};
        for (k in src) { if (has(src, k)) dst[k] = src[k]; }
        return dst;
    }

    function toArray(map) {
        var out = [];
        for (var k in map) { if (has(map, k)) out.push(map[k]); }
        return out;
    }

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, num(v))); }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function pt(e) {
        if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: num(e.clientX), y: num(e.clientY) };
    }
    function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }

    /* --------------------------------------------------------- 页面/元素访问 */

    function page() { return K.getPage(S.pageKey) || {}; }
    function pageDefaults() { return K.DEFAULTS.pages[S.pageKey] || { elements: [] }; }
    function pageTitle() { return pageDefaults().title || S.pageKey; }
    function isFlow() { return page().layout === 'flow'; }
    function flatList() { return K.flatElements(page().elements || []); }
    function getEl(id) { return K.findElDeep(page().elements || [], id); }
    function node(id) { return document.getElementById(id); }
    function inEditorUI(t) {
        return !!(t && t.closest && t.closest(
            '.ui-ed-bar, .ui-ed-sheet, .ui-ed-more, .ui-ed-bubble, .ui-ed-toast'));
    }

    /* ------------------------------------------------------- 补丁 / 落盘 */

    function patchEl(id, patch) {
        var p = S.diffEls[id] || (S.diffEls[id] = { id: id });
        for (var k in patch) {
            if (!has(patch, k)) continue;
            if (k === 'rect') p.rect = mergeInto(p.rect || {}, patch.rect);
            else if (k === 'style') p.style = mergeInto(p.style || {}, patch.style);
            else if (k === 'attrs') p.attrs = mergeInto(p.attrs || {}, patch.attrs);
            else p[k] = patch[k];
        }
        return p;
    }

    function commit(opts) {
        opts = opts || {};
        K.setPage(S.pageKey, { elements: toArray(S.diffEls), removed: S.removed.slice() },
            { render: false });
        if (opts.rerender) {
            K.render(S.pageKey, S.root);
            afterRender();
        } else {
            K.refreshGuard();
        }
        if (opts.toast) toast(opts.toast);
    }

    function afterRender() {
        K.stopGuard();
        applyActiveClass();
        renderList();
        renderProps();
        bindNodes();
        if (S.selId) drawTag(S.selId);
    }

    /* ------------------------------------------------------------ 样式注入 */

    function injectStyle() {
        if (document.getElementById('ui-ed-style')) return;
        var css = [
            /* 顶部极简工具条（高 56） */
            '.ui-ed-bar{position:fixed;top:0;left:0;right:0;height:56px;z-index:100001;display:flex;',
            'align-items:center;gap:8px;padding:0 12px;background:#fff;border-bottom:1px solid #F0F0F0;',
            'box-shadow:0 2px 10px rgba(0,0,0,.06);box-sizing:border-box;font-size:13px;color:#1A1A1A;}',
            '.ui-ed-bartitle{flex:1;min-width:0;text-align:center;font-size:13px;color:#1A1A1A;line-height:1.15;}',
            '.ui-ed-bartitle em{display:block;font-style:normal;font-size:11px;color:#999;margin-top:2px;}',
            '.ui-ed-btn{appearance:none;border:1px solid #F0F0F0;background:#fff;color:#1677FF;',
            'border-radius:12px;padding:8px 12px;font-size:13px;line-height:1;font-weight:500;flex:none;}',
            '.ui-ed-btn.primary{background:#1677FF;color:#fff;border-color:#1677FF;}',
            '.ui-ed-btn.danger{color:#FF4D4F;}',
            /* 底部「更多设置」按钮（默认只有一个） */
            '.ui-ed-more{position:fixed;left:50%;transform:translateX(-50%);',
            'bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:100001;',
            'background:#1677FF;color:#fff;border:none;border-radius:24px;padding:11px 20px;',
            'font-size:13px;font-weight:500;box-shadow:0 6px 18px rgba(22,119,255,.35);}',
            /* 抽屉（点「更多设置」才出现） */
            '.ui-ed-sheet{position:fixed;left:0;right:0;bottom:0;z-index:100002;background:#fff;',
            'border-radius:16px 16px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.16);',
            'max-height:72vh;overflow:auto;-webkit-overflow-scrolling:touch;',
            'padding:10px 12px calc(74px + env(safe-area-inset-bottom,0px));font-size:13px;color:#1A1A1A;}',
            '.ui-ed-sheet::-webkit-scrollbar{width:4px;}',
            '.ui-ed-h{display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px;',
            'font-size:13px;font-weight:600;color:#1A1A1A;}',
            '.ui-ed-h span{font-weight:400;color:#999;font-size:11px;}',
            '.ui-ed-hr{height:1px;background:#F0F0F0;margin:10px 0;}',
            '.ui-ed-chips{display:flex;flex-wrap:wrap;gap:6px;max-height:92px;overflow-y:auto;-webkit-overflow-scrolling:touch;}',
            '.ui-ed-chip{border:1px solid #F0F0F0;background:#FAFAFA;border-radius:12px;',
            'padding:5px 9px;font-size:12px;color:#333;max-width:46%;overflow:hidden;',
            'text-overflow:ellipsis;white-space:nowrap;}',
            '.ui-ed-chip.sel{border-color:#1677FF;background:#E6F4FF;color:#1677FF;font-weight:600;}',
            '.ui-ed-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
            '.ui-ed-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;}',
            '.ui-ed-row{display:flex;align-items:center;gap:8px;margin:6px 0;}',
            '.ui-ed-row>span{width:64px;flex:none;color:#666;font-size:12px;}',
            '.ui-ed-in,.ui-ed-sheet select,.ui-ed-sheet textarea,.ui-ed-bub-in{flex:1;min-width:0;height:32px;',
            'border:1px solid #F0F0F0;border-radius:8px;padding:0 8px;font-size:13px;color:#1A1A1A;',
            'background:#fff;box-sizing:border-box;outline:none;}',
            '.ui-ed-sheet textarea{height:82px;padding:6px 8px;line-height:16px;resize:vertical;}',
            '.ui-ed-in:focus,.ui-ed-sheet select:focus,.ui-ed-sheet textarea:focus,.ui-ed-bub-in:focus{border-color:#1677FF;}',
            '.ui-ed-in[type=color]{padding:0 4px;}',
            '.ui-ed-toast{position:fixed;left:50%;top:74px;transform:translateX(-50%);z-index:100004;',
            'background:rgba(0,0,0,.82);color:#fff;font-size:12px;padding:8px 14px;',
            'border-radius:12px;max-width:82vw;text-align:center;}',
            '.ui-ed-note{font-size:11px;color:#999;line-height:16px;margin:6px 0 0;}',
            /* 气泡菜单（贴在元素下方，圆角 12、白底、阴影） */
            '.ui-ed-bubble{position:fixed;z-index:100003;background:#fff;border-radius:12px;',
            'box-shadow:0 8px 28px rgba(0,0,0,.18);border:1px solid #F0F0F0;padding:8px;',
            'max-width:min(92vw,420px);box-sizing:border-box;}',
            '.ui-ed-bub-row{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;}',
            '.ui-ed-bub-btn{appearance:none;border:1px solid #F0F0F0;background:#FAFAFA;color:#1A1A1A;',
            'border-radius:10px;padding:8px 11px;font-size:13px;line-height:1;font-weight:500;}',
            '.ui-ed-bub-btn.primary{background:#1677FF;color:#fff;border-color:#1677FF;}',
            '.ui-ed-bub-btn.danger{color:#FF4D4F;}',
            '.ui-ed-bub-pane{margin-top:8px;display:none;align-items:center;gap:6px;flex-wrap:wrap;}',
            '.ui-ed-bub-pane.show{display:flex;}',
            '.ui-ed-sw{width:26px;height:26px;border-radius:8px;border:1px solid #F0F0F0;box-sizing:border-box;}',
            /* 选中态：唯一选中，2px 虚线蓝；元素右上角中文小标签 */
            'body.ui-ed-active [data-ui-el]:not([data-ui-el="__bg__"]){outline:1px dashed rgba(22,119,255,.38);}',
            'body.ui-ed-active .ui-ed-sel{outline:2px dashed #1677FF !important;outline-offset:0 !important;}',
            'body.ui-ed-active [data-ui-el]{pointer-events:auto !important;touch-action:none;}',
            'body.ui-ed-active{overflow-x:hidden;}',
            '.ui-ed-fx{position:fixed;left:0;top:0;right:0;bottom:0;z-index:100005;pointer-events:none;}',
            '.ui-ed-tag{position:absolute;background:#1677FF;color:#fff;font-size:11px;line-height:1;',
            'padding:4px 7px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 8px rgba(22,119,255,.35);}'
        ].join('');
        var el = document.createElement('style');
        el.id = 'ui-ed-style';
        el.textContent = css;
        (document.head || document.documentElement).appendChild(el);
    }

    /* --------------------------------------------------- 选中态 + 小标签 */

    function ensureFx() {
        if (S.fx && document.body.contains(S.fx)) return S.fx;
        var d = document.createElement('div');
        d.className = 'ui-ed-fx';
        document.body.appendChild(d);
        S.fx = d;
        return d;
    }

    function drawTag(id) {
        var fx = ensureFx();
        fx.innerHTML = '';
        if (!id) return;
        var n = node(id);
        if (!n) return;
        var r = n.getBoundingClientRect();
        var el = getEl(id) || {};
        var t = document.createElement('div');
        t.className = 'ui-ed-tag';
        t.textContent = el.label || id;
        t.style.left = '0px';
        t.style.top = '0px';
        fx.appendChild(t);
        var tw = t.offsetWidth, th = t.offsetHeight;
        var left = Math.max(4, Math.min(r.right - tw, (document.documentElement.clientWidth || 9999) - tw - 4));
        var top = r.top - th - 2;
        if (top < 58) top = Math.max(58, Math.min(r.top + 2, 9999));
        t.style.left = left + 'px';
        t.style.top = top + 'px';
    }

    function select(id) {
        S.selId = id || null;
        var prev = document.querySelectorAll('.ui-ed-sel');
        for (var i = 0; i < prev.length; i++) prev[i].classList.remove('ui-ed-sel');
        var n = id ? node(id) : null;
        if (n) n.classList.add('ui-ed-sel');
        drawTag(id);
        renderList();
        renderProps();
        if (!id) closeBubble();
    }

    /* ------------------------------------------------------------ 气泡菜单 */

    function bubbleBtn(act, label, cls) {
        return '<button class="ui-ed-bub-btn ' + (cls || '') + '" data-bub="' + act + '">' + label + '</button>';
    }

    function canEditText(el) {
        if (!el || el.id === '__bg__') return false;
        if (el.kind === 'image') return false;
        if (el.children && el.children.length) return false;
        return true;
    }
    function canJump(el) {
        return !!(el && (el.kind === 'hotspot' || el.tag === 'a'));
    }
    function canPickImg(el) {
        return !!(el && el.kind === 'image');
    }

    function closeBubble() {
        var b = S.bubble && S.bubble.el;
        if (b && b.parentNode) b.parentNode.removeChild(b);
        S.bubble = null;
    }

    function openBubble(id) {
        closeBubble();
        var n = node(id), el = getEl(id);
        if (!n || !el) return;
        var b = document.createElement('div');
        b.className = 'ui-ed-bubble';
        var row = '<div class="ui-ed-bub-row">';
        if (canEditText(el)) row += bubbleBtn('text', '改文字');
        row += bubbleBtn('fs-', '字号−') + bubbleBtn('fs+', '字号+');
        row += bubbleBtn('color', '颜色');
        if (canPickImg(el)) row += bubbleBtn('img', '换图');
        if (canJump(el)) row += bubbleBtn('jump', '跳转');
        row += bubbleBtn('del', '删除', 'danger') + bubbleBtn('none', '取消选中');
        row += '</div><div class="ui-ed-bub-pane" id="uiEdBubPane"></div>';
        b.innerHTML = row;
        document.body.appendChild(b);
        S.bubble = { id: id, el: b };
        positionBubble(b, n);
    }

    function positionBubble(b, n) {
        if (!b || !n || !b.parentNode) return;
        var r = n.getBoundingClientRect();
        var vw = document.documentElement.clientWidth || 390;
        var vh = document.documentElement.clientHeight || 690;
        b.style.visibility = 'hidden';
        b.style.left = '0px';
        b.style.top = '0px';
        var bw = b.offsetWidth, bh = b.offsetHeight;
        var left = r.left + r.width / 2 - bw / 2;
        left = Math.max(8, Math.min(vw - bw - 8, left));
        var top = r.bottom + 8;
        if (top + bh > vh - 8) top = Math.max(64, r.top - bh - 8);
        b.style.left = left + 'px';
        b.style.top = top + 'px';
        b.style.visibility = 'visible';
    }

    function pane() { return document.getElementById('uiEdBubPane'); }

    function showPane(html) {
        var p = pane();
        if (!p) return null;
        p.innerHTML = html;
        p.classList.add('show');
        if (S.bubble) positionBubble(S.bubble.el, node(S.bubble.id));
        return p;
    }

    function paneText() {
        var el = getEl(S.selId);
        if (!el) return;
        var cur = (el.text !== undefined && el.text !== null) ? String(el.text) : '';
        var p = showPane(
            '<input class="ui-ed-bub-in" id="uiEdBubText" value="' + esc(cur) + '" placeholder="输入新的文字">' +
            '<button class="ui-ed-bub-btn primary" data-bub="text-ok">完成</button>');
        if (!p) return;
        var i = p.querySelector('#uiEdBubText');
        if (i) {
            i.focus();
            try { i.setSelectionRange(0, i.value.length); } catch (e) { }
            i.addEventListener('input', function () { setText(S.selId, i.value); });
            i.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); commit({ toast: '文字已更新' }); closeBubble(); }
            });
        }
    }

    function paneColor() {
        var el = getEl(S.selId) || {};
        var cur = (el.style || {}).color || '';
        var html = '';
        PRESET_COLORS.forEach(function (c) {
            html += '<button class="ui-ed-sw" data-bub="c:' + c + '" title="' + c + '" ' +
                'style="background:' + c + '"></button>';
        });
        html += '<input class="ui-ed-in" type="color" id="uiEdBubColor" value="' +
            esc(/^#[0-9a-fA-F]{6}$/.test(cur) ? cur : '#1677FF') + '" style="width:46px;flex:none;height:26px">';
        showPane(html);
    }

    function paneJump() {
        var el = getEl(S.selId) || {};
        var cur = el.target || '';
        var known = TARGETS.some(function (t) { return t[0] === cur; });
        var opts = '<option value="">（不跳转）</option>';
        TARGETS.forEach(function (t) {
            opts += '<option value="' + esc(t[0]) + '"' + (t[0] === cur ? ' selected' : '') + '>' + esc(t[1]) + '</option>';
        });
        showPane(
            '<select class="ui-ed-in" id="uiEdBubTarget">' + opts + '</select>' +
            '<input class="ui-ed-in" id="uiEdBubTargetCustom" placeholder="或填页面文件名" value="' +
            esc(known ? '' : cur) + '">' +
            '<button class="ui-ed-bub-btn primary" data-bub="jump-ok">确定</button>');
    }

    /* -------------------------------------------------- 文字 / 字号 / 颜色 / 跳转 */

    function setText(id, v) {
        var el = getEl(id), n = node(id);
        if (!el || !n) return;
        if (el.html) {
            var sp = n.querySelector('span');
            if (sp) sp.textContent = v;
        } else {
            n.textContent = v;
        }
        patchEl(id, { text: v });
        commit({});
        drawTag(id);
    }

    function currentFontSize(id) {
        var n = node(id);
        if (!n) return 0;
        var cs = global.getComputedStyle ? global.getComputedStyle(n) : null;
        var px = cs ? parseFloat(cs.fontSize) : 0;
        return isFinite(px) ? px : 0;
    }

    function bumpFont(id, dir) {
        var el = getEl(id), n = node(id);
        if (!el || !n) return;
        if (isFlow()) {
            var cur = currentFontSize(id) || 16;
            var step = Math.max(1, Math.round(cur * 0.1));
            var next = Math.max(8, Math.round(cur + dir * step));
            // flow 页自带 CSS 常用 `!important` 锁字号，非 important 的 inline 无效
            n.style.setProperty('font-size', next + 'px', 'important');
            patchEl(id, { style: { fontSizePx: next } });
            toast('字号 ' + next + ' px');
        } else {
            var cur2 = num((el.style || {}).fontSize) || 28;
            var next2 = Math.max(8, cur2 + dir * 2);
            n.style.setProperty('font-size', 'calc(var(--ui-unit, 1px) * ' + next2 + ' * var(--ui-scale, 1))', 'important');
            patchEl(id, { style: { fontSize: next2 } });
            toast('字号 ' + next2);
        }
        commit({});
        drawTag(id);
        if (S.bubble) positionBubble(S.bubble.el, node(id));
    }

    function setColor(id, c) {
        var n = node(id);
        if (!n) return;
        n.style.setProperty('color', c, 'important');
        patchEl(id, { style: { color: c } });
        commit({});
        toast('颜色已更新');
    }

    function setTarget(id, t) {
        var n = node(id);
        patchEl(id, { target: t });
        if (n && n.tagName === 'A') n.setAttribute('href', t || 'javascript:void(0)');
        commit({});
        toast(t ? '跳转已更新' : '已取消跳转');
    }

    /* ---------------------------------------------------------- 选中 / 拖动 */

    function normRect(r) {
        r = r || {};
        var out = {
            top: (r.top === undefined || r.top === null) ? 0 : num(r.top),
            left: (r.left === undefined || r.left === null) ? null : num(r.left),
            right: (r.right === undefined || r.right === null) ? null : num(r.right),
            width: (r.width === undefined || r.width === null) ? null : num(r.width),
            height: (r.height === undefined || r.height === null) ? null : num(r.height)
        };
        if (out.left === null) {
            out.left = out.right !== null ? clamp(100 - out.right - (out.width || 0), 0, 95) : 0;
            out.right = null;
        }
        if (out.width === null && out.right !== null) {
            out.width = Math.max(0, 100 - out.left - out.right);
            out.right = null;
        }
        return out;
    }

    function applyRectToNode(id, rect) {
        var n = node(id);
        if (!n) return;
        n.style.top = num(rect.top) + '%';
        n.style.left = (rect.left === null || rect.left === undefined) ? '' : (num(rect.left) + '%');
        n.style.right = (rect.right === null || rect.right === undefined) ? '' : (num(rect.right) + '%');
        n.style.width = (rect.width === null || rect.width === undefined) ? '' : (num(rect.width) + '%');
        n.style.height = (rect.height === null || rect.height === undefined) ? '' : (num(rect.height) + '%');
    }

    function bindNodes() {
        if (S._onDown) document.removeEventListener(EV_DOWN, S._onDown, true);
        S._onDown = function (e) {
            if (!S.open) return;
            var t = e.target;
            if (inEditorUI(t)) return;
            var n = t && t.closest ? t.closest('[data-ui-el]') : null;
            if (!n) { select(null); return; }
            var id = n.getAttribute('data-ui-el');
            if (!id || id === '__bg__') {
                select(null);
                var nowT = Date.now();
                if (!S.bgTipAt || nowT - S.bgTipAt > 6000) {
                    S.bgTipAt = nowT;
                    toast('这里整页背景：点下方「更多设置」→「换背景图」可替换');
                }
                return;
            }
            select(id);
            startDrag(e, n, id);
        };
        document.addEventListener(EV_DOWN, S._onDown, true);
    }

    function startDrag(e, n, id) {
        var wrap = n.parentNode;
        if (!wrap || !wrap.getBoundingClientRect) return;
        var br = wrap.getBoundingClientRect();
        if (!br.width || !br.height) return;
        var p = pt(e);
        var el = getEl(id) || {};
        var d = {
            id: id, node: n, startX: p.x, startY: p.y, moved: false,
            flow: isFlow(), br: br,
            base: null, baseOff: null, cur: null, curOff: null
        };
        if (d.flow) {
            var st = el.style || {};
            d.baseOff = { x: num(st.offsetX), y: num(st.offsetY) };
            // 固定定位元素（如待办顶部栏）无法用偏移移动
            var cs = global.getComputedStyle ? global.getComputedStyle(n) : null;
            d.fixed = !!(cs && cs.position === 'fixed');
        } else {
            d.base = normRect(el.rect);
            applyRectToNode(id, d.base);
        }
        S.drag = d;
        try {
            if (HAS_POINTER && n.setPointerCapture && e.pointerId !== undefined) {
                n.setPointerCapture(e.pointerId);
            }
        } catch (err) { }
        document.addEventListener(EV_MOVE, onDragMove, { capture: true, passive: false });
        document.addEventListener(EV_UP, onDragEnd, true);
        document.addEventListener(EV_CANCEL, onDragEnd, true);
    }

    function onDragMove(e) {
        var d = S.drag;
        if (!d) return;
        var p = pt(e);
        var dxPx = p.x - d.startX, dyPx = p.y - d.startY;
        if (!d.moved && (Math.abs(dxPx) + Math.abs(dyPx)) < 3) return;
        if (d.fixed) return;                     // 固定定位元素：只选中，不拖动
        if (!d.moved) {
            d.moved = true;
            closeBubble();
        }
        if (e.cancelable !== false) e.preventDefault();
        if (d.flow) {
            var nx = Math.round(d.baseOff.x + dxPx);
            var ny = Math.round(d.baseOff.y + dyPx);
            d.curOff = { x: nx, y: ny };
            d.node.style.position = 'relative';
            d.node.style.left = nx + 'px';
            d.node.style.top = ny + 'px';
        } else {
            var dx = dxPx / d.br.width * 100;
            var dy = dyPx / d.br.height * 100;
            var top = clamp(d.base.top + dy, 0, 200);
            var left = clamp(d.base.left + dx, 0, 95);
            d.cur = { top: top, left: left };
            applyRectToNode(d.id, { top: top, left: left, right: null, width: d.base.width, height: d.base.height });
        }
        drawTag(d.id);
        var host = document.getElementById('uiEdProps');
        if (host) {
            var ti = host.querySelector('[data-f="rect.top"]');
            var li = host.querySelector('[data-f="rect.left"]');
            if (ti && d.cur) ti.value = Math.round(d.cur.top * 10) / 10;
            if (li && d.cur) li.value = Math.round(d.cur.left * 10) / 10;
        }
    }

    function onDragEnd() {
        var d = S.drag;
        document.removeEventListener(EV_MOVE, onDragMove, true);
        document.removeEventListener(EV_UP, onDragEnd, true);
        document.removeEventListener(EV_CANCEL, onDragEnd, true);
        S.drag = null;
        if (!d) return;
        if (d.fixed) { toast('该元素固定在屏幕上，位置不可拖动'); return; }
        if (!d.moved) { openBubble(d.id); return; }     // 没移动 = 点了一下
        if (d.flow) {
            patchEl(d.id, { style: { offsetX: d.curOff.x, offsetY: d.curOff.y } });
            commit({});
            drawTag(d.id);
            openBubble(d.id);
        } else {
            var rect = mergeInto(mergeInto({}, d.base), d.cur || {});
            delete rect.right;
            patchEl(d.id, { rect: rect });
            commit({});
            drawTag(d.id);
            openBubble(d.id);
        }
    }

    /* ------------------------------------------------------- 属性面板入口 */

    function onFieldChange(e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var f = t.getAttribute('data-f');
        if (!f) return;
        var id = S.selId;
        if (!id) return;
        var el = getEl(id);
        if (!el) return;
        var v = (t.type === 'checkbox') ? t.checked : t.value;

        if (f.indexOf('rect.') === 0) {
            var key = f.slice(5);
            var val = (v === '' || v === null) ? null : num(v);
            if (key === 'top') val = (val === null) ? 0 : clamp(val, 0, 200);
            if (key === 'left' && val !== null) val = clamp(val, 0, 95);
            var rect = mergeInto({}, el.rect || {});
            rect[key] = val;
            applyRectToNode(id, rect);
            patchEl(id, { rect: rect });
        } else if (f.indexOf('style.') === 0) {
            var sk = f.slice(6);
            var sv = (sk === 'fontSize' || sk === 'fontSizePx') ? num(v) : v;
            var n = node(id);
            if (n) {
                if (sk === 'fontSize') n.style.fontSize = 'calc(var(--ui-unit, 1px) * ' + sv + ' * var(--ui-scale, 1))';
                else if (sk === 'fontSizePx') n.style.fontSize = sv + 'px';
                else if (sk === 'color') n.style.color = sv;
                else if (sk === 'fontWeight') n.style.fontWeight = String(sv);
                else if (sk === 'textAlign') n.style.textAlign = String(sv);
                else if (sk === 'objectFit') n.style.objectFit = String(sv);
            }
            var sp = {};
            sp[sk] = sv;
            patchEl(id, { style: sp });
        } else if (f === 'text') {
            setText(id, v);
            return;
        } else if (f === 'src') {
            var in2 = node(id);
            if (in2) in2.src = v;
            patchEl(id, { src: v });
        } else if (f === 'z') {
            var zn = node(id);
            if (zn) zn.style.zIndex = String(num(v));
            patchEl(id, { z: num(v) });
        } else if (f === 'visible') {
            patchEl(id, { visible: !!v });
            commit({ rerender: true });
            return;
        } else if (f === 'target' || f === 'onclick') {
            var p = {};
            p[f] = v;
            patchEl(id, p);
            var an = node(id);
            if (an) {
                if (f === 'target' && an.tagName === 'A') an.setAttribute('href', v || 'javascript:void(0)');
                if (f === 'onclick') {
                    if (v) an.setAttribute('onclick', v); else an.removeAttribute('onclick');
                }
            }
        }
        commit({});
        drawTag(id);
    }

    /* ---------------------------------------------------------- 增删复制 */

    function newId(prefix) {
        var i = 1, id;
        do { id = prefix + 'Custom' + i; i++; } while (getEl(id));
        return id;
    }

    function addElement(kind) {
        var id = newId(kind === 'text' ? 'text' : (kind === 'image' ? 'img' : 'hot'));
        var def;
        if (kind === 'text') {
            def = { id: id, kind: 'text', tag: 'div', label: '自定文字', z: 4, className: 'sd-layer',
                rect: { top: 20, left: 10 }, text: '自定文案',
                style: { fontSize: 32, color: '#191E26', fontWeight: 500 } };
        } else if (kind === 'image') {
            def = { id: id, kind: 'image', tag: 'img', label: '自定图片', z: 4, className: 'sd-layer',
                rect: { top: 30, left: 10, width: 30 }, src: '',
                style: { objectFit: 'contain' } };
        } else {
            def = { id: id, kind: 'hotspot', tag: 'a', label: '自定入口', z: 3, className: 'sd-hot',
                rect: { top: 50, left: 10, width: 30, height: 8 }, target: '' };
        }
        if (isFlow()) {
            // 文档流页面：不写 rect，位置由像素偏移控制（拖动即可移动）
            def.rect = undefined;
            def.className = '';
            def.style = mergeInto(def.style || {}, { offsetX: 0, offsetY: 12 });
        }
        patchEl(id, def);
        S.selId = id;
        commit({ rerender: true, toast: '已新增：' + def.label });
        drawTag(id);
    }

    function delElement(skipConfirm) {
        if (!S.selId) { toast('先选中一个元素'); return; }
        var id = S.selId;
        var el = getEl(id);
        if (!skipConfirm && !confirm('删除元素「' + ((el && el.label) || id) + '」？')) return;
        if (S.removed.indexOf(id) < 0) S.removed.push(id);
        delete S.diffEls[id];
        S.selId = null;
        closeBubble();
        commit({ rerender: true, toast: '已删除' });
    }

    function dupElement() {
        if (!S.selId) { toast('先选中一个元素'); return; }
        var el = getEl(S.selId);
        if (!el) return;
        var id = newId('copy');
        var copy = JSON.parse(JSON.stringify(el));
        copy.id = id;
        copy.label = (el.label || el.id) + ' 副本';
        copy.rect = mergeInto({}, copy.rect || {});
        copy.rect.top = clamp(num(copy.rect.top) + 3, 0, 200);
        patchEl(id, copy);
        S.selId = id;
        commit({ rerender: true, toast: '已复制' });
    }

    /* --------------------------------------------------------- 图片 / 背景 */

    // canvas 压缩：宽度 ≤ maxW，JPEG q=0.85 → dataURL
    function compressImage(file, maxW, cb) {
        var fr = new FileReader();
        fr.onload = function () {
            var img = new Image();
            img.onload = function () {
                try {
                    var w = img.naturalWidth || img.width;
                    var h = img.naturalHeight || img.height;
                    var tw = Math.min(w, maxW || 1080);
                    var th = Math.max(1, Math.round(h * tw / w));
                    var c = document.createElement('canvas');
                    c.width = tw; c.height = th;
                    var ctx = c.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, tw, th);
                    ctx.drawImage(img, 0, 0, tw, th);
                    cb(c.toDataURL('image/jpeg', 0.85), tw, th);
                } catch (err) { cb(null); }
            };
            img.onerror = function () { cb(null); };
            img.src = fr.result;
        };
        fr.onerror = function () { cb(null); };
        fr.readAsDataURL(file);
    }

    function pickFile(input, cb) {
        input.value = '';
        input.onchange = function () {
            var f = input.files && input.files[0];
            if (f) cb(f);
        };
        input.click();
    }

    function pickBgImage(after) {
        var input = document.getElementById('uiEdImgFile');
        if (!input) return;
        pickFile(input, function (file) {
            toast('正在压缩…');
            compressImage(file, 1080, function (dataUrl, w, h) {
                if (!dataUrl) { toast('图片读取失败'); return; }
                K.setPage(S.pageKey, { bg: { kind: 'upload', src: dataUrl, fit: 'cover' } }, { render: false });
                commit({ rerender: true });
                renderBgName();
                toast('背景已替换（' + w + '×' + h + '）');
                if (after) after();
            });
        });
    }

    function pickElementImage() {
        if (!S.selId) { toast('先选中一个图片元素'); return; }
        var input = document.getElementById('uiEdImgFile');
        if (!input) return;
        var id = S.selId;
        pickFile(input, function (file) {
            toast('正在压缩…');
            compressImage(file, 1080, function (dataUrl) {
                if (!dataUrl) { toast('图片读取失败'); return; }
                patchEl(id, { src: dataUrl });
                var n = node(id);
                if (n) n.src = dataUrl;
                commit({});
                renderProps();
                if (S.bubble) positionBubble(S.bubble.el, node(id));
                toast('图片已替换');
            });
        });
    }

    function resetBg() {
        var d = pageDefaults().bg || {};
        var bg = { kind: d.kind || 'builtin' };
        if (d.src) bg.src = d.src;
        if (d.byAuth) bg.byAuth = JSON.parse(JSON.stringify(d.byAuth));
        K.setPage(S.pageKey, { bg: bg }, { render: false });
        commit({ rerender: true });
        renderBgName();
        toast('已恢复默认背景');
    }

    /* --------------------------------------------------------- 导入 / 导出 */

    function doExport() {
        var text = K.exportJSON();
        var ta = document.getElementById('uiEdJSON');
        if (ta) ta.value = text;
        toast('已生成配置文本（' + text.length + ' 字节）');
        return text;
    }

    function download(filename, text) {
        try {
            var blob = new Blob([text], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);
            return true;
        } catch (e) { return false; }
    }

    function doExportFile() {
        var text = doExport();
        var d = new Date();
        var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
            '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
        if (download('geshui-ui-config-' + stamp + '.json', text)) toast('已下载配置文件');
        else toast('下载失败，请用文本框复制');
    }

    function doImportJSON() {
        var ta = document.getElementById('uiEdJSON');
        if (!ta || !ta.value.trim()) { toast('文本框为空'); return; }
        var r = K.importJSON(ta.value);
        if (!r.ok) { toast(r.msg); return; }
        S.diffEls = {}; S.removed = []; S.selId = null;
        closeBubble();
        K.render(S.pageKey, S.root);
        afterRender();
        renderBgName();
        syncGlobalInputs();
        toast(r.msg);
    }

    function doImportFile() {
        var input = document.getElementById('uiEdJsonFile');
        if (!input) return;
        pickFile(input, function (file) {
            var fr = new FileReader();
            fr.onload = function () {
                var ta = document.getElementById('uiEdJSON');
                if (ta) ta.value = fr.result;
                doImportJSON();
            };
            fr.readAsText(file);
        });
    }

    function syncGlobalInputs() {
        var g = K.getConfig().global || {};
        var sel = document.getElementById('uiEdFont');
        if (sel) sel.value = (K.FONT_PRESETS && has(K.FONT_PRESETS, g.fontFamily)) ? g.fontFamily : '__custom__';
        var sc = document.getElementById('uiEdScale');
        if (sc) sc.value = String(g.scale || 1);
        var sv = document.getElementById('uiEdScaleVal');
        if (sv) sv.textContent = (g.scale || 1) + '×';
    }

    function resetPage() {
        if (!confirm('恢复本页默认布局（含背景）？')) return;
        var raw = null;
        try { raw = JSON.parse(lsGet(K.KEYS.CONFIG) || '{}'); } catch (e) { raw = {}; }
        if (raw && raw.pages) { delete raw.pages[S.pageKey]; }
        try { global.localStorage.setItem(K.KEYS.CONFIG, JSON.stringify(raw || {})); } catch (e) { }
        S.diffEls = {}; S.removed = []; S.selId = null;
        closeBubble();
        K.render(S.pageKey, S.root);
        afterRender();
        renderBgName();
        toast('本页已恢复默认');
    }

    function resetAll() {
        if (!confirm('恢复全站出厂默认（等于删除配置键 geshui_ui_config）？')) return;
        K.resetAll();
        S.diffEls = {}; S.removed = []; S.selId = null;
        closeBubble();
        K.render(S.pageKey, S.root);
        afterRender();
        renderBgName();
        syncGlobalInputs();
        toast('已恢复出厂默认');
    }

    /* ---------------------------------------------------------------- 抽屉 */

    function btn(act, label, cls) {
        return '<button class="ui-ed-btn ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>';
    }

    function pageOptions() {
        var keys = K.PAGE_ORDER || ['shouye', 'daiban', 'message', 'mine'];
        return keys.map(function (k) {
            var t = (K.DEFAULTS.pages[k] || {}).title || k;
            return '<option value="' + esc(k) + '"' + (k === S.pageKey ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('');
    }

    function buildBar() {
        var bar = document.createElement('div');
        bar.className = 'ui-ed-bar';
        bar.innerHTML =
            '<button class="ui-ed-btn" data-act="close">退出</button>' +
            '<div class="ui-ed-bartitle">拖动元素改位置<em>' + esc(pageTitle()) + '</em></div>' +
            '<button class="ui-ed-btn primary" data-act="save">保存</button>';
        document.body.appendChild(bar);
        S.els.bar = bar;

        var more = document.createElement('button');
        more.className = 'ui-ed-more';
        more.setAttribute('data-act', 'toggle-sheet');
        more.textContent = '更多设置';
        document.body.appendChild(more);
        S.els.more = more;
    }

    function buildSheet() {
        var sheet = document.createElement('div');
        sheet.className = 'ui-ed-sheet';
        sheet.innerHTML = [
            '<div class="ui-ed-h">页面切换 <span>改完这页可接着改下一页</span></div>',
            '<div class="ui-ed-row"><span>当前页</span><select id="uiEdPageSwitch">' + pageOptions() + '</select></div>',
            '<div class="ui-ed-hr"></div>',
            '<div class="ui-ed-h">页面背景 <span id="uiEdBgName"></span></div>',
            '<div class="ui-ed-acts">',
            btn('pickbg', '换背景图', 'primary'),
            btn('resetbg', '恢复默认背景'),
            '</div>',
            '<div class="ui-ed-hr"></div>',
            '<div class="ui-ed-h">元素列表 <span id="uiEdListCount"></span></div>',
            '<div class="ui-ed-chips" id="uiEdList"></div>',
            '<div class="ui-ed-acts">',
            btn('add-hotspot', '+ 入口'),
            btn('add-text', '+ 文字'),
            btn('add-image', '+ 图片'),
            btn('dup', '复制'),
            btn('del', '删除选中', 'danger'),
            '</div>',
            '<div class="ui-ed-hr"></div>',
            '<div class="ui-ed-h">整页字号缩放 <span>整体放大 / 缩小</span></div>',
            '<div class="ui-ed-row"><span>缩放</span>' +
                '<input class="ui-ed-in" id="uiEdScale" type="range" min="0.8" max="1.5" step="0.02">' +
                '<b id="uiEdScaleVal" style="width:38px;text-align:right;color:#1677FF"></b></div>',
            '<div class="ui-ed-row"><span>字体</span><select id="uiEdFont"></select></div>',
            '<div class="ui-ed-hr"></div>',
            '<div class="ui-ed-h">选中元素属性 <span id="uiEdSelName">未选中</span></div>',
            '<div id="uiEdProps"></div>',
            '<details class="ui-ed-adv" style="margin-top:10px;border-top:1px solid #F0F0F0;padding-top:2px">',
            '<summary style="list-style:none;padding:10px 0 6px;font-size:12px;color:#999">配置备份（导出 / 导入 / 恢复出厂）</summary>',
            '<textarea id="uiEdJSON" spellcheck="false" placeholder="点「导出」生成配置文本，或粘贴后点「导入」"></textarea>',
            '<div class="ui-ed-acts">',
            btn('export', '导出到文本框'),
            btn('exportfile', '下载文件'),
            btn('importjson', '从文本框导入'),
            btn('importfile', '从文件导入'),
            btn('resetall', '全站恢复出厂', 'danger'),
            '</div>',
            '</details>',
            '<div class="ui-ed-acts" style="margin-top:10px">',
            btn('resetpage', '本页恢复默认', 'danger'),
            btn('toggle-sheet', '收起设置'),
            '</div>',
            '<input type="file" id="uiEdJsonFile" accept=".json,application/json" style="display:none">',
            '<input type="file" id="uiEdImgFile" accept="image/*" style="display:none">'
        ].join('');
        document.body.appendChild(sheet);
        S.els.sheet = sheet;

        var sel = sheet.querySelector('#uiEdFont');
        (K.FONT_LABELS || []).forEach(function (p) {
            var o = document.createElement('option');
            o.value = p[0]; o.textContent = p[1];
            sel.appendChild(o);
        });
        var o2 = document.createElement('option');
        o2.value = '__custom__'; o2.textContent = '自定义…';
        sel.appendChild(o2);
        var g = K.getConfig().global || {};
        sel.value = (K.FONT_PRESETS && has(K.FONT_PRESETS, g.fontFamily)) ? g.fontFamily : '__custom__';
        var sc = sheet.querySelector('#uiEdScale');
        sc.value = String(g.scale || 1);
        sheet.querySelector('#uiEdScaleVal').textContent = (g.scale || 1) + '×';
    }

    function toggleSheet(force) {
        var sheet = S.els.sheet;
        if (!sheet) return;
        var want = (force === undefined) ? !S.sheetOpen : !!force;
        S.sheetOpen = want;
        sheet.style.display = want ? 'block' : 'none';
        if (want) {
            renderList();
            renderProps();
            renderBgName();
            syncGlobalInputs();
        }
    }

    function buildUI() {
        injectStyle();
        closeUI(true);
        buildBar();
        buildSheet();
        toggleSheet(false);
        bindUI();
        bindNodes();
        renderList();
        renderProps();
        renderBgName();
        applyActiveClass();
        global.addEventListener('scroll', onViewportChange, true);
        global.addEventListener('resize', onViewportChange);
    }

    function onViewportChange() {
        if (S.selId) drawTag(S.selId);
        if (S.bubble) positionBubble(S.bubble.el, node(S.bubble.id));
    }

    function closeUI(keepState) {
        ['ui-ed-bar', 'ui-ed-sheet', 'ui-ed-more', 'ui-ed-bubble'].forEach(function (cls) {
            var n = document.querySelector('.' + cls);
            while (n && n.parentNode) { n.parentNode.removeChild(n); n = document.querySelector('.' + cls); }
        });
        var t = document.querySelector('.ui-ed-toast');
        if (t && t.parentNode) t.parentNode.removeChild(t);
        if (S.fx && S.fx.parentNode) S.fx.parentNode.removeChild(S.fx);
        S.fx = null;
        S.bubble = null;
        S.sheetOpen = false;
        global.removeEventListener('scroll', onViewportChange, true);
        global.removeEventListener('resize', onViewportChange);
        if (!keepState) S.els = {};
    }

    function applyActiveClass() {
        if (S.open) document.body.classList.add('ui-ed-active');
        else document.body.classList.remove('ui-ed-active');
    }

    function renderBgName() {
        var n = document.getElementById('uiEdBgName');
        if (!n) return;
        var bg = page().bg || {};
        if (page().layout === 'flow') { n.textContent = '本页无整屏背景'; return; }
        n.textContent = (bg.kind === 'upload')
            ? ('已自定义（' + String(bg.src || '').slice(0, 22) + '…）')
            : ('内置 ' + (bg.src || ''));
    }

    function renderList() {
        var host = document.getElementById('uiEdList');
        if (!host) return;
        var list = flatList();
        var html = '';
        list.forEach(function (el) {
            html += '<div class="ui-ed-chip' + (el.id === S.selId ? ' sel' : '') + '" data-el="' + esc(el.id) + '">' +
                esc(el.label || el.id) + '</div>';
        });
        if (!list.length) html = '<div style="color:#999;font-size:12px">本页暂无可编辑元素，点“+ 文字”新增</div>';
        host.innerHTML = html;
        var h = document.getElementById('uiEdListCount');
        if (h) h.textContent = '共 ' + list.length + ' 个';
    }

    function opt(v, cur, label) {
        return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }
    function row(label, inputHtml) {
        return '<div class="ui-ed-row"><span>' + label + '</span>' + inputHtml + '</div>';
    }
    function inp(f, step, val) {
        return '<input class="ui-ed-in" type="number" step="' + step + '" data-f="' + f + '" value="' +
            ((val === undefined || val === null) ? '' : esc(val)) + '">';
    }

    function renderProps() {
        var host = document.getElementById('uiEdProps');
        var nameEl = document.getElementById('uiEdSelName');
        if (!host) return;
        var el = S.selId ? getEl(S.selId) : null;
        if (nameEl) nameEl.textContent = el ? (el.label || el.id) : '未选中';
        if (!el) {
            host.innerHTML = '<div style="color:#999;font-size:12px">在页面上点一个元素，或用上面的列表选中</div>';
            return;
        }
        var st = el.style || {};
        var html = '';
        if (!isFlow()) {
            var r = el.rect || {};
            html += '<div class="ui-ed-grid">';
            html += row('top %', inp('rect.top', 0.1, r.top));
            html += row('left %', inp('rect.left', 0.1, r.left));
            html += row('right %', inp('rect.right', 0.1, r.right));
            html += row('width %', inp('rect.width', 0.1, r.width));
            html += row('height %', inp('rect.height', 0.1, r.height));
            html += row('层级 z', inp('z', 1, el.z));
            html += '</div>';
        } else {
            html += '<div class="ui-ed-grid">';
            html += row('横向偏移', inp('style.offsetX', 1, st.offsetX));
            html += row('纵向偏移', inp('style.offsetY', 1, st.offsetY));
            html += row('层级 z', inp('z', 1, el.z));
            html += '</div>';
            html += '<div class="ui-ed-note">文档流页面：位置用像素偏移微调（拖动也会自动写入这里）。</div>';
        }

        if (canEditText(el)) {
            html += '<div class="ui-ed-row" style="align-items:flex-start"><span>文字</span>' +
                '<textarea data-f="text" spellcheck="false">' + esc(el.text) + '</textarea></div>';
        }
        html += '<div class="ui-ed-grid">';
        if (isFlow()) html += row('字号 px', inp('style.fontSizePx', 1, st.fontSizePx));
        else html += row('字号', inp('style.fontSize', 1, st.fontSize));
        html += row('颜色', '<input class="ui-ed-in" type="color" data-f="style.color" value="' +
            esc(/^#[0-9a-fA-F]{6}$/.test(st.color || '') ? st.color : '#191E26') + '">');
        html += row('字重', '<select data-f="style.fontWeight">' +
            ['300', '400', '500', '600', '700'].map(function (w) { return opt(w, st.fontWeight, w); }).join('') + '</select>');
        html += row('对齐', '<select data-f="style.textAlign">' +
            opt('left', st.textAlign, '左对齐') + opt('center', st.textAlign, '居中') + opt('right', st.textAlign, '右对齐') + '</select>');
        html += '</div>';

        if (el.kind === 'hotspot' || el.tag === 'a') {
            html += '<div class="ui-ed-row"><span>跳转</span>' +
                '<input class="ui-ed-in" data-f="target" value="' + esc(el.target || '') + '" placeholder="zonghe.html"></div>';
        }
        if (el.kind === 'image') {
            var preview = el.src || '';
            var isData = preview.indexOf('data:') === 0;
            html += '<div class="ui-ed-row"><span>图片源</span>' +
                '<input class="ui-ed-in" data-f="src" value="' + esc(isData ? '' : preview) + '" placeholder="图片文件名或自定义图">' +
                '</div>';
            html += '<div class="ui-ed-row"><span>预览</span><img src="' + esc(preview) + '" alt="" ' +
                'style="height:34px;max-width:50%;object-fit:contain;border:1px solid #F0F0F0;border-radius:8px">' +
                btn('pickimg', '换图') + '</div>';
        }
        html += '<div class="ui-ed-row"><span>显隐</span>' +
            '<label style="color:#666;font-size:12px"><input type="checkbox" data-f="visible"' +
            (el.visible === false ? '' : ' checked') + '> 显示</label></div>';
        html += '<div class="ui-ed-row"><span>元素 id</span>' +
            '<input class="ui-ed-in" value="' + esc(el.id) + '" readonly style="color:#999"></div>';
        host.innerHTML = html;
    }

    function toast(msg) {
        var t = document.querySelector('.ui-ed-toast');
        if (!t) {
            t = document.createElement('div');
            t.className = 'ui-ed-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        if (S.toastTimer) clearTimeout(S.toastTimer);
        S.toastTimer = setTimeout(function () {
            if (t.parentNode) t.parentNode.removeChild(t);
        }, 1800);
    }

    /* --------------------------------------------------------------- 事件 */

    function switchPage(key) {
        if (!key || key === S.pageKey) return;
        location.href = K.pageFile(key) + '?edit=1';
    }

    function handleAct(act) {
        switch (act) {
            case 'save': commit({ toast: '已保存（重开 App 仍生效）' }); break;
            case 'close': close(); break;
            case 'toggle-sheet': toggleSheet(); break;
            case 'add-hotspot': addElement('hotspot'); break;
            case 'add-text': addElement('text'); break;
            case 'add-image': addElement('image'); break;
            case 'dup': dupElement(); break;
            case 'del': delElement(); break;
            case 'pickbg': pickBgImage(); break;
            case 'resetbg': resetBg(); break;
            case 'pickimg': pickElementImage(); break;
            case 'export': doExport(); break;
            case 'exportfile': doExportFile(); break;
            case 'importjson': doImportJSON(); break;
            case 'importfile': doImportFile(); break;
            case 'resetpage': resetPage(); break;
            case 'resetall': resetAll(); break;
            default: break;
        }
    }

    function handleBub(act) {
        if (!act) return;
        if (act.indexOf('c:') === 0) { setColor(S.selId, act.slice(2)); return; }
        switch (act) {
            case 'text': paneText(); break;
            case 'text-ok': commit({ toast: '文字已更新' }); closeBubble(); break;
            case 'fs-': bumpFont(S.selId, -1); break;
            case 'fs+': bumpFont(S.selId, 1); break;
            case 'color': paneColor(); break;
            case 'img': pickElementImage(); break;
            case 'jump': paneJump(); break;
            case 'jump-ok': {
                var sel = document.getElementById('uiEdBubTarget');
                var cus = document.getElementById('uiEdBubTargetCustom');
                var v = (cus && cus.value.trim()) ? cus.value.trim() : (sel ? sel.value : '');
                setTarget(S.selId, v);
                closeBubble();
                break;
            }
            case 'del': delElement(true); break;
            case 'none': select(null); closeBubble(); break;
            default: break;
        }
    }

    function bindUI() {
        if (S._onClick) document.removeEventListener('click', S._onClick, true);
        S._onClick = function (e) {
            var t = e.target;
            if (Date.now() < S.suppressUntil) { e.preventDefault(); e.stopPropagation(); return; }
            if (!S.open) return;
            if (inEditorUI(t)) return;
            // 编辑模式下不触发页面跳转 / onclick
            e.preventDefault();
            e.stopPropagation();
        };
        document.addEventListener('click', S._onClick, true);

        if (S._onUIClick) return;
        S._onUIClick = true;

        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            var chip = t.closest('.ui-ed-chip');
            if (chip && S.open) { select(chip.getAttribute('data-el')); return; }
            var bub = t.closest('[data-bub]');
            if (bub && S.open) { e.preventDefault(); handleBub(bub.getAttribute('data-bub')); return; }
            var b = t.closest('[data-act]');
            if (!b || !S.open) return;
            e.preventDefault();
            handleAct(b.getAttribute('data-act'));
        }, false);

        document.addEventListener('input', function (e) {
            var t = e.target;
            if (!t || !t.getAttribute || !S.open) return;
            if (t.id === 'uiEdScale') {
                var v = Number(t.value) || 1;
                var sv = document.getElementById('uiEdScaleVal');
                if (sv) sv.textContent = v + '×';
                K.setConfig({ global: { scale: v } });
                return;
            }
            if (t.id === 'uiEdFontCustom') {
                K.setConfig({ global: { fontFamily: t.value || 'system' } });
                return;
            }
            if (t.id === 'uiEdBubColor') { setColor(S.selId, t.value); return; }
            if (t.id === 'uiEdBubText' || t.id === 'uiEdBubTargetCustom') return;
            if (t.getAttribute('data-f')) onFieldChange(e);
        }, false);

        document.addEventListener('change', function (e) {
            var t = e.target;
            if (!t || !t.getAttribute || !S.open) return;
            if (t.id === 'uiEdPageSwitch') { switchPage(t.value); return; }
            if (t.id === 'uiEdFont') {
                if (t.value === '__custom__') {
                    var ci = document.getElementById('uiEdFontCustom');
                    if (!ci) {
                        ci = document.createElement('input');
                        ci.className = 'ui-ed-in';
                        ci.id = 'uiEdFontCustom';
                        ci.style.marginTop = '6px';
                        ci.placeholder = '自定义字体名';
                        t.parentNode.parentNode.insertBefore(ci, t.parentNode.nextSibling);
                    }
                    ci.focus();
                    return;
                }
                var c2 = document.getElementById('uiEdFontCustom');
                if (c2 && c2.parentNode) c2.parentNode.removeChild(c2);
                K.setConfig({ global: { fontFamily: t.value } });
                toast('字体已切换');
                return;
            }
            if (t.id === 'uiEdBubColor') { setColor(S.selId, t.value); return; }
            if (t.id === 'uiEdBubTarget') {
                var cus = document.getElementById('uiEdBubTargetCustom');
                if (cus) cus.value = '';
                setTarget(S.selId, t.value);
                closeBubble();
                return;
            }
            if (t.getAttribute('data-f')) onFieldChange(e);
        }, false);
    }

    /* -------------------------------------------------------- 长按隐藏入口 */

    function installLongPress() {
        var timer = null, sx = 0, sy = 0, active = false;
        document.addEventListener(EV_DOWN, function (e) {
            if (S.open) return;
            var t = e.target;
            if (inEditorUI(t) || (t && t.closest && t.closest('input, textarea'))) return;
            var p = pt(e);
            active = true; sx = p.x; sy = p.y;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () {
                timer = null;
                if (!active) return;
                S.suppressUntil = Date.now() + 900;
                open();
            }, 1500);
        }, true);
        function cancel(e) {
            if (!timer) return;
            if (e.type === EV_MOVE) {
                var p = pt(e);
                if (Math.abs(p.x - sx) > 12 || Math.abs(p.y - sy) > 12) { clearTimeout(timer); timer = null; active = false; }
                return;
            }
            clearTimeout(timer); timer = null; active = false;
        }
        [EV_UP, EV_CANCEL, EV_MOVE].forEach(function (ev) {
            document.addEventListener(ev, cancel, true);
        });
        global.addEventListener('scroll', function () { if (timer) { clearTimeout(timer); timer = null; } }, true);
    }

    /* ------------------------------------------------------------- 开关 */

    /* 从当前 DOM 里的 UIKit 元素反查它属于哪个页面（防止 URL/文件名猜错页时点选元素无反应） */
    function detectPageKeyFromDom() {
        var first = document.querySelector('#uiRoot [data-ui-el]') || document.querySelector('[data-ui-el]');
        if (!first) return null;
        var id = first.getAttribute('data-ui-el');
        if (!id || id === '__bg__') return null;
        var pages = (K.DEFAULTS && K.DEFAULTS.pages) || {};
        var order = K.PAGE_ORDER || Object.keys(pages);
        for (var i = 0; i < order.length; i++) {
            var pk = order[i];
            var els = K.flatElements(((pages[pk] || {}).elements) || []);
            for (var j = 0; j < els.length; j++) if (els[j].id === id) return pk;
        }
        return null;
    }

    function open(pageKey) {
        if (S.open) return;
        S.pageKey = pageKey || detectPageKeyFromDom() || K.currentPageKey();
        S.root = document.getElementById('uiRoot') || (K.rendered() && K.rendered().root) || document.body;
        S.diffEls = {}; S.removed = []; S.selId = null; S.drag = null;
        S.open = true;
        K.stopGuard();
        buildUI();
        toast('拖动元素改位置 · 点一下元素改文字/颜色/字号');
    }

    function close() {
        if (!S.open) return;
        S.open = false;
        S.drag = null;
        closeBubble();
        closeUI(false);
        applyActiveClass();
        K.refreshGuard();
    }

    global.UIEditor = {
        open: function (pageKey) { open(pageKey); },
        close: close,
        toggle: function (pageKey) { S.open ? close() : open(pageKey); },
        isOpen: function () { return S.open; },
        state: function () {
            return { pageKey: S.pageKey, selId: S.selId, diff: toArray(S.diffEls), removed: S.removed.slice() };
        },
        pageKeys: function () { return Object.keys(K.DEFAULTS.pages || {}); },
        // 傻瓜版：给外部/自检用的探针
        hasBubble: function () { return !!document.querySelector('.ui-ed-bubble'); },
        hasSheet: function () { return !!document.querySelector('.ui-ed-sheet'); },
        select: function (id) { select(id); }
    };

    /* ----------------------------------------------------------- 自动启动 */

    function boot() {
        installLongPress();   /* 唯一公开入口：长按页面 1.5 秒 */
        /* ?edit=1 —— 调试用（不对外宣传）：只注入编辑器，不写入任何配置 */
        if (/(^|[?&])edit=1(&|$)/.test(global.location.search)) {
            open();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
