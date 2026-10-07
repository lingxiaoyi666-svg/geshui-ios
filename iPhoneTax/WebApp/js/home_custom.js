/* ============================================================
 * home_custom.js —— 「修改首页」自定义能力（首页背景图 + 8 个热区）
 * 无依赖、无网络请求、ES5 写法（兼容老 Android WebView）。
 *
 * 真值源（新版 RN 源码，1:1 还原）：
 *   D:\work\newapp\src\store\useHomeImageStore.ts
 *     :38-47   DEFAULT_HOTSPOTS（8 个热区的默认 top/left/width/height，单位 %）
 *     :50      STORAGE_KEY_IMAGE    = 'geshui_custom_home_image'
 *     :51      STORAGE_KEY_HOTSPOTS = 'geshui_custom_hotspots'
 *     :90-97   load()：读两键 → hotspots 命中存储时「直接替换」，不与默认值合并
 *     :68-87   setCustomImage / setHotspots / resetHotspots 的落盘语义
 *   D:\work\newapp\app\about\hotspots.tsx
 *     :41-50   HOTSPOT_DEFS（key/label/color/border，逐字照抄）
 *     :103-116 拖动换算与 clamp：h 兜底 width*2.57；top→clamp[0,95]；
 *              left 仅当原值存在时平移并 clamp[0,80]
 *     :158-160 渲染兜底：left 缺省 '2%'、width 缺省 '96%'
 *     :190     默认底图 = assets/images/home_logged_in_v3.png（1080×2774）
 *   D:\work\newapp\app\about\index.tsx
 *     :249-276 「上传替换 / 调整热区 / 恢复默认」文案与按钮
 *
 * 对外 API（供 shouye.html 等页面调用）：
 *   HomeCustom.getImage()             -> string | null   自定义图（原样字符串）
 *   HomeCustom.getHotspots()          -> object | null   命中存储的原始值（不合并默认）
 *   HomeCustom.getHotspotsOrDefault() -> object          缺键/读取失败时回落 DEFAULT_HOTSPOTS
 *   HomeCustom.applyToPage(selector)  -> {bg:boolean, hotspots:number}
 *                                       把自定义图与热区套用到页面节点上
 *   写入侧（供 help_center.html 的编辑器使用）：
 *   setImage(uri) / setHotspots(obj) / resetAll() / getImageUrl()
 *   几何工具：move(cur, dTopPct, dLeftPct) / clamp(v,min,max) / ASPECT_RATIO
 * ============================================================ */
(function (global) {
    'use strict';

    /* ---------- 1. 常量（与新版一一对应） ---------- */

    // useHomeImageStore.ts:50-51
    var KEY_IMAGE = 'geshui_custom_home_image';
    var KEY_HOTSPOTS = 'geshui_custom_hotspots';

    // hotspots.tsx:190 —— 默认底图（工程内同名资源，1080×2774）
    var DEFAULT_IMAGE = 'home_logged_in_v3.png';
    var DEFAULT_IMAGE_WIDTH = 1080;
    var DEFAULT_IMAGE_HEIGHT = 2774;
    // hotspots.tsx:221 imageWrap { width:'100%', aspectRatio: 1080/2774 }
    var ASPECT_RATIO = 0.3893294881038212;

    // useHomeImageStore.ts:38-47（键名/数值逐字照抄）
    var DEFAULT_HOTSPOTS = {
        huisuan: { top: 10.8, height: 19.8 },
        zhuankou: { top: 39.7, height: 10.8 },
        grid1: { top: 57.7, left: 2, width: 22, height: 16.2 },
        grid2: { top: 57.7, left: 27, width: 22, height: 16.2 },
        grid3: { top: 57.7, left: 52, width: 22, height: 16.2 },
        grid4: { top: 57.7, left: 77, width: 22, height: 16.2 },
        banner: { top: 75.7, height: 10.8 },
        news: { top: 88.3, height: 11.7 }
    };

    // hotspots.tsx:41-50（label / color / border 逐字照抄）
    var HOTSPOT_DEFS = [
        { key: 'huisuan', label: '汇算卡', color: 'rgba(255,0,0,0.2)', border: '#ff0000' },
        { key: 'zhuankou', label: '专扣卡', color: 'rgba(0,255,0,0.2)', border: '#00aa00' },
        { key: 'grid1', label: '宫格1', color: 'rgba(0,0,255,0.2)', border: '#0000ff' },
        { key: 'grid2', label: '宫格2', color: 'rgba(255,165,0,0.2)', border: '#ff8c00' },
        { key: 'grid3', label: '宫格3', color: 'rgba(128,0,128,0.2)', border: '#800080' },
        { key: 'grid4', label: '宫格4', color: 'rgba(0,128,128,0.2)', border: '#008080' },
        { key: 'banner', label: 'Banner', color: 'rgba(255,0,255,0.2)', border: '#ff00ff' },
        { key: 'news', label: '资讯区', color: 'rgba(128,128,0,0.2)', border: '#808000' }
    ];

    var HOTSPOT_KEYS = ['huisuan', 'zhuankou', 'grid1', 'grid2', 'grid3', 'grid4', 'banner', 'news'];
    var RECT_FIELDS = ['top', 'left', 'width', 'height'];

    // hotspots.tsx:109-113 的 clamp 边界
    var TOP_MIN = 0, TOP_MAX = 95, LEFT_MIN = 0, LEFT_MAX = 80;
    // hotspots.tsx:158-159 的渲染兜底（left/width 缺失时用）
    var FALLBACK_LEFT = 2, FALLBACK_WIDTH = 96;

    /* ---------- 2. 存储读写（全部 try/catch，隐私模式下也不炸） ---------- */

    function store() {
        try { return global.localStorage || null; } catch (e) { return null; }
    }
    function readRaw(key) {
        var s = store();
        if (!s) return null;
        try { return s.getItem(key); } catch (e) { return null; }
    }
    function writeRaw(key, value) {
        var s = store();
        if (!s) return { ok: false, error: 'no-storage' };
        try { s.setItem(key, value); return { ok: true }; }
        catch (e) { return { ok: false, error: (e && e.name) || 'write-failed' }; }
    }
    function removeRaw(key) {
        var s = store();
        if (!s) return;
        try { s.removeItem(key); } catch (e) { /* ignore */ }
    }

    /* ---------- 3. 几何工具 ---------- */

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj || {}, key); }

    function clone(obj) {
        var out = {}, k;
        for (k in obj) { if (hasOwn(obj, k)) { out[k] = {}; for (var i = 0; i < RECT_FIELDS.length; i++) { var f = RECT_FIELDS[i]; if (obj[k][f] !== undefined) out[k][f] = obj[k][f]; } } }
        return out;
    }

    /**
     * 拖动换算（与 hotspots.tsx:103-116 等价）
     * @param {object} cur       该热区当前值 {top, left?, width?, height?}
     * @param {number} dTopPct   ΔY / 容器高 * 100
     * @param {number} dLeftPct  ΔX / 容器宽 * 100
     * @returns {object}        只含被改动的键 {top[, left]}（调用方需自行 merge）
     * 说明：left 仅在 cur 原本存在 left 时才输出 —— 与新版 panResponder 行为一致
     *      （huisuan/zhuankou/banner/news 默认无 left，为全宽带状热区，不参与水平平移）。
     */
    function move(cur, dTopPct, dLeftPct) {
        cur = cur || {};
        var next = { top: clamp(num(cur.top) + num(dTopPct), TOP_MIN, TOP_MAX) };
        if (hasOwn(cur, 'left') && cur.left !== null && cur.left !== undefined) {
            next.left = clamp(num(cur.left) + num(dLeftPct), LEFT_MIN, LEFT_MAX);
        }
        return next;
    }

    /* ---------- 4. 读接口 ---------- */

    function getImage() {
        var v = readRaw(KEY_IMAGE);
        return (v && v.length) ? v : null;
    }

    /**
     * 命中存储则返回归一化后的原始值（不做默认合并，同 useHomeImageStore.ts:95）；
     * 未命中 / JSON 坏 / 非对象 → null。
     */
    function getHotspots() {
        var raw = readRaw(KEY_HOTSPOTS);
        if (!raw) return null;
        var parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { return null; }
        if (!parsed || typeof parsed !== 'object' || parsed.length !== undefined) return null;
        var out = {}, any = false, i, k, f, v;
        for (i = 0; i < HOTSPOT_KEYS.length; i++) {
            k = HOTSPOT_KEYS[i];
            v = parsed[k];
            if (!v || typeof v !== 'object') continue;
            out[k] = {};
            for (f = 0; f < RECT_FIELDS.length; f++) {
                if (v[RECT_FIELDS[f]] !== undefined && v[RECT_FIELDS[f]] !== null) out[k][RECT_FIELDS[f]] = num(v[RECT_FIELDS[f]]);
            }
            any = true;
        }
        return any ? out : null;
    }

    /** 存储缺键时逐键回落 DEFAULT_HOTSPOTS（UI 用；与 getHotspots 的严格语义分开） */
    function getHotspotsOrDefault() {
        var stored = getHotspots();
        if (!stored) return clone(DEFAULT_HOTSPOTS);
        var out = {}, i, k, f;
        for (i = 0; i < HOTSPOT_KEYS.length; i++) {
            k = HOTSPOT_KEYS[i];
            out[k] = {};
            for (f = 0; f < RECT_FIELDS.length; f++) {
                var field = RECT_FIELDS[f];
                if (stored[k] && stored[k][field] !== undefined) out[k][field] = stored[k][field];
                else if (hasOwn(DEFAULT_HOTSPOTS[k], field)) out[k][field] = DEFAULT_HOTSPOTS[k][field];
            }
        }
        return out;
    }

    function getImageUrl() { return getImage() || DEFAULT_IMAGE; }

    /* ---------- 5. 写接口 ---------- */

    /** uri 为 null/空 → 删除键（同 setCustomImage(null)） */
    function setImage(uri) {
        if (uri === null || uri === undefined || uri === '') { removeRaw(KEY_IMAGE); return { ok: true }; }
        return writeRaw(KEY_IMAGE, String(uri));
    }

    /** 整表落盘（同 setHotspots(next)）：JSON.stringify 全量 8 键 */
    function setHotspots(next) {
        if (!next) { removeRaw(KEY_HOTSPOTS); return { ok: true }; }
        return writeRaw(KEY_HOTSPOTS, JSON.stringify(next));
    }

    /** 清两个键（同 setCustomImage(null) + resetHotspots()） */
    function resetAll() {
        removeRaw(KEY_IMAGE);
        removeRaw(KEY_HOTSPOTS);
        return { ok: true };
    }

    /* ---------- 6. 套用到页面（shouye.html 用） ---------- */

    /**
     * applyToPage(rootSelector) —— 把自定义图与热区套到页面节点上。
     * 约定（shouye.html 需按此埋点）：
     *   背景图节点  : [data-home-bg]        （<img> 或带 background-image 的块）
     *   热区节点    : [data-hotspot="huisuan"] / "zhuankou" / "grid1"…"grid4" / "banner" / "news"
     * 只写 position/top/left/width/height（%），不改动其它样式；
     * 找不到的节点静默跳过，返回值里可看到实际套用数量。
     * @returns {{bg:boolean, hotspots:number, missing:string[]}}
     */
    function applyToPage(rootSelector) {
        var root = null;
        if (typeof rootSelector === 'string') root = document.querySelector(rootSelector);
        else if (rootSelector && rootSelector.nodeType === 1) root = rootSelector;
        if (!root) root = document.body || document.documentElement;

        var result = { bg: false, hotspots: 0, missing: [] };
        if (!root) return result;

        // 6.1 背景图
        var uri = getImage();
        if (uri) {
            var bg = root.querySelector('[data-home-bg]');
            if (bg) {
                if (bg.tagName && bg.tagName.toLowerCase() === 'img') bg.src = uri;
                else bg.style.backgroundImage = 'url("' + uri + '")';
                bg.setAttribute('data-home-bg-custom', '1');
                result.bg = true;
            }
        }

        // 6.2 8 个热区（用 getHotspotsOrDefault → 存储缺键时仍能得到完整布局）
        var hs = getHotspotsOrDefault();
        for (var i = 0; i < HOTSPOT_KEYS.length; i++) {
            var key = HOTSPOT_KEYS[i];
            var el = root.querySelector('[data-hotspot="' + key + '"]');
            if (!el) { result.missing.push(key); continue; }
            var r = hs[key] || {};
            el.style.position = 'absolute';
            if (r.top !== undefined) el.style.top = r.top + '%';
            if (r.height !== undefined) el.style.height = r.height + '%';
            /* left/width 策略（兼容 shouye.html 的 .sd-hot 用 right 定位）：
               - 值里带 left/width（宫格 4 键）→ 直接写，并清掉对侧的 right 以免冲突；
               - 不带 left/width（汇算卡/专扣卡/Banner/资讯区这些「贴边全宽」热区）→
                 节点自身已用 right 定位就保持原样；否则按 hotspots.tsx:158-159 兜底补 left 2% / width 96%。 */
            if (r.left !== undefined) {
                el.style.left = r.left + '%';
                if (el.style.right) el.style.right = '';
            } else if (!el.style.right) {
                el.style.left = FALLBACK_LEFT + '%';        // hotspots.tsx:158
            }
            if (r.width !== undefined) {
                el.style.width = r.width + '%';
                if (el.style.right) el.style.right = '';
            } else if (!el.style.right) {
                el.style.width = FALLBACK_WIDTH + '%';      // hotspots.tsx:159
            }
            result.hotspots++;
        }
        return result;
    }

    /* ---------- 7. 导出 ---------- */

    global.HomeCustom = {
        // 键与默认值（只读参考）
        KEYS: { IMAGE: KEY_IMAGE, HOTSPOTS: KEY_HOTSPOTS },
        DEFAULT_IMAGE: DEFAULT_IMAGE,
        DEFAULT_IMAGE_WIDTH: DEFAULT_IMAGE_WIDTH,
        DEFAULT_IMAGE_HEIGHT: DEFAULT_IMAGE_HEIGHT,
        DEFAULT_HOTSPOTS: clone(DEFAULT_HOTSPOTS),
        HOTSPOT_DEFS: HOTSPOT_DEFS,
        HOTSPOT_KEYS: HOTSPOT_KEYS,
        ASPECT_RATIO: ASPECT_RATIO,
        CLAMP: { TOP_MIN: TOP_MIN, TOP_MAX: TOP_MAX, LEFT_MIN: LEFT_MIN, LEFT_MAX: LEFT_MAX },
        FALLBACK: { LEFT: FALLBACK_LEFT, WIDTH: FALLBACK_WIDTH },
        // 读
        getImage: getImage,
        getImageUrl: getImageUrl,
        getHotspots: getHotspots,
        getHotspotsOrDefault: getHotspotsOrDefault,
        // 写
        setImage: setImage,
        setHotspots: setHotspots,
        resetAll: resetAll,
        // 几何 / 套用
        move: move,
        clamp: clamp,
        clone: clone,
        applyToPage: applyToPage
    };
})(window);
