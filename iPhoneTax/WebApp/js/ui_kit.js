/* ============================================================================
   ui_kit.js —— 全站 UI 可自定义系统：配置模型 + 渲染引擎（无第三方依赖）
   ----------------------------------------------------------------------------
   唯一新增存储键：geshui_ui_config（localStorage，JSON）
   其它数据一律读 js/local_api.js 的 geshui_local_db_v1 与既有 localStorage 键，
   本文件不新建任何数据键。

   默认配置 DEFAULTS 逐值搬运自 shouye.html / index.html 现有写死节点：
     shouye.html:196-228  （#homeRoot / #homeBg / 8 个 .sd-hot）
     index.html:201-249   （#mineRoot / #mineBg / #mineAvatar / 文字层 / 11 个 .sd-hot）
   不配置时渲染结果与现状 DOM 等价（同 id、同 class、同百分比、同跳转、同 onclick）。

   导出：window.UIKit = {
     getConfig(), setConfig(patch), getPage(key), setPage(key, patch, opts),
     render(pageKey, rootEl), DEFAULTS, exportJSON(), importJSON(text),
     resetAll(), resolveText(tpl),
     isCustom(pageKey, elId), getBgSrc(pageKey, logged), getAspectRatio(pageKey, logged),
     currentPageKey(), applyGlobal(), refreshGuard(), stopGuard(), FONT_PRESETS
   }
   ========================================================================= */
(function (global) {
    'use strict';

    var CONFIG_KEY = 'geshui_ui_config';
    var DB_KEY = 'geshui_local_db_v1';
    var SCHEMA_VERSION = 1;

    /* ---------------------------------------------------------------- 常量 */

    // shouye.html:196 aspect-ratio；index.html:201/317-319 登录态两套比例
    var ASPECT_HOME = 0.3893294881038212;      // 1080 / 2774
    var ASPECT_MINE_IN = 0.5473897617840852;   // 1080 / 1973  profile_loggedin.png
    var ASPECT_MINE_OUT = 0.5468354430379746;  // 1080 / 1975  profile_loggedout.png

    // 拖动边界（编辑器）：top 0..98 / left 0..95
    var CLAMP_TOP = [0, 98];
    var CLAMP_LEFT = [0, 95];

    var FONT_PRESETS = {
        system: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif",
        pingfang: "'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif",
        heiti: "'Heiti SC', 'Microsoft YaHei', 'SimHei', sans-serif",
        songti: "'Songti SC', 'STSong', 'SimSun', serif",
        kaiti: "'Kaiti SC', 'STKaiti', 'KaiTi', serif",
        mono: "'SFMono-Regular', Consolas, 'Courier New', monospace"
    };
    var FONT_LABELS = [
        ['system', '系统默认'], ['pingfang', '苹方 / 黑体'], ['heiti', '黑体'],
        ['songti', '宋体'], ['kaiti', '楷体'], ['mono', '等宽']
    ];

    var DEFAULT_ANNOUNCEMENT = '关于近期虚假退税宣传的温馨提示';

    /* ------------------------------------------------------- DEFAULTS 默认配置 */

    var DEFAULTS = {
        version: SCHEMA_VERSION,
        global: { fontFamily: 'system', scale: 1 },
        pages: {
            /* ============ 首页 shouye.html ============ */
            shouye: {
                title: '首页',
                containerId: 'homeRoot',
                aspectRatio: ASPECT_HOME,
                bg: {
                    id: 'homeBg',
                    kind: 'builtin',                 // builtin | upload
                    src: 'home_logged_in_v3.png',    // shouye.html:200
                    fit: 'cover',
                    attrs: { 'data-home-bg': '1' }
                },
                elements: [
                    // shouye.html:205-206
                    { id: 'huisuanHot', kind: 'hotspot', label: '汇算大卡', z: 3,
                      className: 'sd-hot', rect: { top: 10.8, left: 2, right: 2, height: 19.8 },
                      target: 'zonghe.html', attrs: { 'data-hotspot': 'huisuan' } },
                    // shouye.html:209-210
                    { id: 'zhuankouHot', kind: 'hotspot', label: '专项附加扣除', z: 3,
                      className: 'sd-hot', rect: { top: 39.7, left: 2, right: 2, height: 10.8 },
                      target: 'zxkouchu.html', attrs: { 'data-hotspot': 'zhuankou' } },
                    // shouye.html:213-214
                    { id: 'gridHot1', kind: 'hotspot', label: '宫格1', z: 3,
                      className: 'sd-hot', rect: { top: 57.7, left: 2, width: 22, height: 16.2 },
                      target: 'zonghe.html', attrs: { 'data-hotspot': 'grid1' } },
                    // shouye.html:215-216
                    { id: 'gridHot2', kind: 'hotspot', label: '宫格2', z: 3,
                      className: 'sd-hot', rect: { top: 57.7, left: 27, width: 22, height: 16.2 },
                      target: 'shuiming.html?reset=1', attrs: { 'data-hotspot': 'grid2' } },
                    // shouye.html:217-218
                    { id: 'gridHot3', kind: 'hotspot', label: '宫格3', z: 3,
                      className: 'sd-hot', rect: { top: 57.7, left: 52, width: 22, height: 16.2 },
                      target: 'javascript:void(0)',
                      onclick: "showHelpTip('仅对内购用户开放，不支持试用')",
                      attrs: { 'data-hotspot': 'grid3' } },
                    // shouye.html:219-220
                    { id: 'gridHot4', kind: 'hotspot', label: '宫格4', z: 3,
                      className: 'sd-hot', rect: { top: 57.7, left: 77, width: 22, height: 16.2 },
                      target: 'javascript:void(0)',
                      onclick: "showHelpTip('更多功能，敬请期待')",
                      attrs: { 'data-hotspot': 'grid4' } },
                    // shouye.html:223-224
                    { id: 'bannerHot', kind: 'hotspot', label: 'Banner', z: 3,
                      className: 'sd-hot', rect: { top: 75.7, left: 2, right: 2, height: 10.8 },
                      target: 'zxkouchu.html', attrs: { 'data-hotspot': 'banner' } },
                    // shouye.html:227-228
                    { id: 'newsHot', kind: 'hotspot', label: '资讯区', z: 3,
                      className: 'sd-hot', rect: { top: 88.3, left: 2, right: 2, height: 11.7 },
                      target: 'message.html', attrs: { 'data-hotspot': 'news' } }
                ]
            },

            /* ============ 我的 index.html ============ */
            mine: {
                title: '我的',
                containerId: 'mineRoot',
                aspectRatio: ASPECT_MINE_IN,
                aspectByAuth: { in: ASPECT_MINE_IN, out: ASPECT_MINE_OUT },
                bg: {
                    id: 'mineBg',
                    kind: 'builtin',
                    src: 'profile_loggedin.png',                       // index.html:204
                    byAuth: { in: 'profile_loggedin.png', out: 'profile_loggedout.png' }, // index.html:316
                    fit: 'cover'
                },
                elements: [
                    // index.html:208-209（性别头像叠加层）
                    { id: 'mineAvatar', kind: 'image', label: '性别头像', z: 4, className: 'sd-layer',
                      auth: 'in',
                      rect: { top: 7.45, left: 35.09, width: 29.81, aspectRatio: 1 },
                      src: 'avatar_male.png',
                      srcByGender: { '1': 'avatar_male.png', '2': 'avatar_female.png' },
                      style: { objectFit: 'contain' } },
                    // index.html:172-178 + 212（姓名）
                    { id: 'userName', kind: 'text', label: '姓名', z: 4, className: 'sd-layer',
                      auth: 'in', rect: { top: 28.5, left: 12.5 },
                      text: '{{real_name}}',
                      style: { fontSize: 36, color: '#191E26', fontWeight: 500 } },
                    // index.html:180-186 + 215（纳税人识别号）
                    { id: 'userTaxId', kind: 'text', label: '纳税人识别号', z: 4, className: 'sd-layer',
                      auth: 'in', rect: { top: 31.9, left: 12.5 },
                      text: '纳税人识别号  {{tax_id}}',
                      style: { fontSize: 29, color: '#C87930', fontWeight: 400 } },
                    // index.html:218（家庭成员数）
                    { id: 'familyCount', kind: 'text', label: '家庭成员数', z: 4, className: 'sd-layer sd-stat',
                      auth: 'in', rect: { top: 51.37, left: 17.69 },
                      text: '{{family_count}}',
                      style: { fontSize: 28, color: '#FFFFFF', fontWeight: 500, textAlign: 'center',
                               transform: 'translate(-50%, -50%)' } },
                    // index.html:219（任职受雇数）
                    { id: 'employerCount', kind: 'text', label: '任职受雇数', z: 4, className: 'sd-layer sd-stat',
                      auth: 'in', rect: { top: 51.37, left: 49.91 },
                      text: '{{employer_count}}',
                      style: { fontSize: 28, color: '#FFFFFF', fontWeight: 500, textAlign: 'center',
                               transform: 'translate(-50%, -50%)' } },
                    // index.html:220（银行卡数）
                    { id: 'bankCardCount', kind: 'text', label: '银行卡数', z: 4, className: 'sd-layer sd-stat',
                      auth: 'in', rect: { top: 51.37, left: 82.22 },
                      text: '{{bank_count}}',
                      style: { fontSize: 28, color: '#FFFFFF', fontWeight: 500, textAlign: 'center',
                               transform: 'translate(-50%, -50%)' } },

                    // index.html:225-226 注册/登录（未登录可见）
                    { id: 'loginHot', kind: 'hotspot', label: '注册/登录', z: 3, className: 'sd-hot',
                      auth: 'out', rect: { top: 27, left: 25, right: 25, height: 6 },
                      target: 'login.html' },
                    // index.html:229-230 个人信息（登录可见）
                    { id: 'infoHot', kind: 'hotspot', label: '个人信息入口', z: 3, className: 'sd-hot',
                      auth: 'in', rect: { top: 27, right: 5, width: 28, height: 6 },
                      target: 'javascript:void(0)', onclick: 'goPersonalInfo()' },
                    // index.html:233-234 退出登录（登录可见）
                    { id: 'logoutHot', kind: 'hotspot', label: '退出登录', z: 3, className: 'sd-hot',
                      auth: 'in', rect: { top: 90, left: 5, right: 5, height: 6 },
                      onclick: 'doLogout()' },
                    // index.html:237-242 统计热区 x3
                    { id: 'familyHot', kind: 'hotspot', label: '家庭成员热区', z: 3, className: 'sd-hot',
                      auth: 'in', rect: { top: 37, left: 3, width: 28, height: 16 },
                      target: 'javascript:void(0)', onclick: 'goFamilyList(event)' },
                    { id: 'employerHot', kind: 'hotspot', label: '任职受雇热区', z: 3, className: 'sd-hot',
                      auth: 'in', rect: { top: 37, left: 35, width: 28, height: 16 },
                      target: 'javascript:void(0)', onclick: 'goEmployer()' },
                    { id: 'bankHot', kind: 'hotspot', label: '银行卡热区', z: 3, className: 'sd-hot',
                      auth: 'in', rect: { top: 37, left: 67, width: 28, height: 16 },
                      target: 'javascript:void(0)', onclick: 'goBankCard()' },
                    // index.html:245-249 菜单热区 x5
                    { id: 'menuHot1', kind: 'hotspot', label: '菜单·关爱版', z: 3, className: 'sd-hot menu-hot',
                      auth: 'in', rect: { top: 56, left: 3, right: 3, height: 6 }, target: 'care_version.html' },
                    { id: 'menuHot2', kind: 'hotspot', label: '菜单·安全中心', z: 3, className: 'sd-hot menu-hot',
                      auth: 'in', rect: { top: 63, left: 3, right: 3, height: 6 }, target: 'aqzx.html' },
                    { id: 'menuHot3', kind: 'hotspot', label: '菜单·帮助中心', z: 3, className: 'sd-hot menu-hot',
                      auth: 'in', rect: { top: 70, left: 3, right: 3, height: 6 }, target: 'help_center.html' },
                    { id: 'menuHot4', kind: 'hotspot', label: '菜单·咨询', z: 3, className: 'sd-hot menu-hot',
                      auth: 'in', rect: { top: 77, left: 3, right: 3, height: 6 }, target: 'zixun.html' },
                    { id: 'menuHot5', kind: 'hotspot', label: '菜单·关于更新', z: 3, className: 'sd-hot menu-hot',
                      auth: 'in', rect: { top: 84, left: 3, right: 3, height: 6 }, target: 'about_update.html' }
                ]
            },

            /* ============ 待办 daiban.html ============
               layout:'flow' —— 整页按原 DOM 树渲染（不做整屏图 + 绝对定位叠加），
               逐值搬运自 daiban.html 改造前：
                 144-153  .daiban-page > .daiban-header(.header-title + img) + .daiban-content(.card.empty-card > .empty-text)
               id / class / 文案 / 跳转与原文件逐字一致；底栏 .bottom-nav 不在本页配置里（由页面自带、sdtab.js 填充）。 */
            daiban: {
                title: '待办',
                layout: 'flow',
                containerId: 'daibanPage',
                bg: null,
                elements: [
                    // daiban.html:144
                    { id: 'daibanPage', kind: 'block', tag: 'div', className: 'daiban-page', label: '待办页面', z: 1,
                      children: [
                        // daiban.html:145-148
                        { id: 'daibanHeader', kind: 'block', tag: 'div', className: 'daiban-header sd-keep-header',
                          label: '顶部栏', children: [
                            // daiban.html:146
                            { id: 'daibanHeaderTitle', kind: 'text', tag: 'div', className: 'header-title',
                              label: '顶部标题', text: '待办' },
                            // daiban.html:147（SPEC 对齐层 body .daiban-header img{display:none}）
                            { id: 'daibanHeaderImg', kind: 'image', tag: 'img', label: '顶部图',
                              src: 'daiban.jpg', alt: '待办' }
                          ] },
                        // daiban.html:149-152
                        { id: 'daibanContent', kind: 'block', tag: 'div', className: 'daiban-content', label: '内容区',
                          children: [
                            // daiban.html:150
                            { id: 'daibanEmptyCard', kind: 'block', tag: 'div', className: 'card empty-card',
                              label: '空态卡片', children: [
                                { id: 'daibanEmptyText', kind: 'text', tag: 'span', className: 'empty-text',
                                  label: '空态文字', text: '当前没有信息' }
                              ] }
                          ] }
                      ] }
                ]
            },

            /* ============ 办&查 bancha.html ============
               layout:'flow' —— 整图切片 + 14 个透明热区，逐值搬运自 bancha.html 改造前
               297-327 行（拓扑与 class 沿用原文件；热区 id 用约定命名 bancha-bs- / bancha-cx- / bancha-fp- 前缀）：
                 bs.jpg 8 热区（zonghe zxk yanglao jingying najilu gongyi weituo sheshui）
                 cx.jpg 5 热区（shuiming shenbao yiyi wenshu zhuanye）
                 fp.jpg 1 热区（piaojia）
               rect 原值全部写在 bancha.html 的 CSS 里（未搬进配置，保持逐像素一致）。 */
            bancha: {
                title: '办&查',
                layout: 'flow',
                containerId: 'banchaPage',
                bg: null,
                elements: [
                    // bancha.html:297
                    { id: 'banchaPage', kind: 'block', tag: 'div', className: 'bancha-page', label: '办查页面', z: 1,
                      children: [
                        // 蓝头 = 整张图（文字/渐变/白卡圆角/两侧蓝色护角），bancha_header_card.png 为 db.jpg 的无损重建版
                        { id: 'banchaHeader', kind: 'block', tag: 'div', className: 'bancha-header sd-keep-header',
                          label: '头部图', children: [
                            { id: 'banchaHeaderImg', kind: 'image', tag: 'img', className: 'bancha-header-img',
                              label: '蓝头图', src: 'bancha_header_card.png?v=20260602', alt: '办&查',
                              attrs: { id: 'assetBanchaHeader' } }
                          ] },
                        // bancha.html:302-326
                        { id: 'banchaContent', kind: 'block', tag: 'div', className: 'bancha-content', label: '内容区',
                          children: [
                            // bancha.html:303-313
                            { id: 'banchaBsWrap', kind: 'block', tag: 'div', className: 'bancha-bs-wrap', label: '办税区',
                              children: [
                                { id: 'banchaBsImg', kind: 'image', tag: 'img', label: '办税图',
                                  src: 'bs.jpg?v=20260523', alt: '办税' },
                                { id: 'bancha-bs-zonghe', kind: 'hotspot', tag: 'a', className: 'bancha-bs-hot-zonghe',
                                  label: '综合所得年度汇算', target: 'zonghe.html',
                                  attrs: { 'aria-label': '综合所得年度汇算' } },
                                { id: 'bancha-bs-zxk', kind: 'hotspot', tag: 'a', className: 'bancha-bs-hot-zxk',
                                  label: '专项附加扣除', target: 'zxkouchu.html',
                                  attrs: { 'aria-label': '专项附加扣除' } },
                                { id: 'bancha-bs-yanglao', kind: 'hotspot', tag: 'a', className: 'bancha-bs-hot-yanglao',
                                  label: '个人养老金扣除管理', target: 'gerenyanglao.html',
                                  attrs: { 'aria-label': '个人养老金扣除管理' } },
                                { id: 'bancha-bs-jingying', kind: 'hotspot', tag: 'a', className: 'bancha-bs-hot-jingying',
                                  label: '经营所得申报', target: 'jingyingsuode.html',
                                  attrs: { 'aria-label': '经营所得申报' } },
                                { id: 'bancha-bs-najilu', kind: 'hotspot', tag: 'a', className: 'bancha-bs-hot-najilu',
                                  label: '纳税记录开具', target: 'javascript:void(0)',
                                  onclick: "showHelpTip('仅对内购用户开放，不支持试用')",
                                  attrs: { 'aria-label': '纳税记录开具' } },
                                { id: 'bancha-bs-gongyi', kind: 'hotspot', tag: 'a', className: 'bancha-bs-hot-gongyi',
                                  label: '公益慈善捐赠扣除填报', target: 'gongyicishan.html',
                                  attrs: { 'aria-label': '公益慈善捐赠扣除填报' } },
                                { id: 'bancha-bs-weituo', kind: 'hotspot', tag: 'a', className: 'bancha-bs-hot-weituo',
                                  label: '委托代理关系管理', target: 'weituodaili.html',
                                  attrs: { 'aria-label': '委托代理关系管理' } },
                                { id: 'bancha-bs-sheshui', kind: 'hotspot', tag: 'a', className: 'bancha-bs-hot-sheshui',
                                  label: '涉税服务人员信息管理', target: 'sheshuifuwu.html',
                                  attrs: { 'aria-label': '涉税服务人员信息管理' } }
                              ] },
                            // bancha.html:314-321
                            { id: 'banchaCxWrap', kind: 'block', tag: 'div', className: 'bancha-cx-wrap', label: '查询区',
                              children: [
                                { id: 'banchaCxImg', kind: 'image', tag: 'img', label: '查询图',
                                  src: 'cx.jpg?v=20260523b', alt: '查询' },
                                { id: 'bancha-cx-shuiming', kind: 'hotspot', tag: 'a', className: 'bancha-cx-hot-shuiming',
                                  label: '收入纳税明细', target: 'shuiming.html',
                                  attrs: { 'aria-label': '收入纳税明细' } },
                                { id: 'bancha-cx-shenbao', kind: 'hotspot', tag: 'a', className: 'bancha-cx-hot-shenbao',
                                  label: '申报记录', target: 'shenbao_jilu.html',
                                  attrs: { 'aria-label': '申报记录' } },
                                { id: 'bancha-cx-yiyi', kind: 'hotspot', tag: 'a', className: 'bancha-cx-hot-yiyi',
                                  label: '异议申诉', target: 'yiyishensu.html',
                                  attrs: { 'aria-label': '异议申诉' } },
                                { id: 'bancha-cx-wenshu', kind: 'hotspot', tag: 'a', className: 'bancha-cx-hot-wenshu',
                                  label: '税务文书', target: 'shuiwuwenshu.html',
                                  attrs: { 'aria-label': '税务文书' } },
                                { id: 'bancha-cx-zhuanye', kind: 'hotspot', tag: 'a', className: 'bancha-cx-hot-zhuanye',
                                  label: '涉税专业服务机构', target: 'sheshuizhuanye.html',
                                  attrs: { 'aria-label': '涉税专业服务机构' } }
                              ] },
                            // bancha.html:322-325
                            { id: 'banchaFpWrap', kind: 'block', tag: 'div', className: 'bancha-fp-wrap', label: '发票区',
                              children: [
                                { id: 'banchaFpImg', kind: 'image', tag: 'img', label: '发票图',
                                  src: 'fp.jpg', alt: '发票' },
                                { id: 'bancha-fp-hot-piaojia', kind: 'hotspot', tag: 'a', className: 'bancha-fp-hot-piaojia',
                                  label: '我的票夹', target: 'wodepiaojia.html',
                                  attrs: { 'aria-label': '我的票夹' } }
                              ] }
                          ] }
                      ] }
                ]
            },

            /* ============ 消息 message.html ============
               layout:'flow' —— 逐值搬运自 message.html 改造前 252-274：
                 .message-page > .message-header-toolbar(.message-title + .message-toolbar > 2 个 button)
                               + .message-list#messageList(空态 .card.empty-card)
               #messageList 是业务 JS loadMessages() 的写入目标，id 原样保留；
               两个按钮的 svg 用 html 字段原样注入，文字用 text 字段（改字按钮 = 换 span 文本）。 */
            message: {
                title: '消息',
                layout: 'flow',
                containerId: 'messagePage',
                bg: null,
                elements: [
                    // message.html:252
                    { id: 'messagePage', kind: 'block', tag: 'div', className: 'message-page', label: '消息页面', z: 1,
                      children: [
                        // message.html:253-269
                        { id: 'messageHeader', kind: 'block', tag: 'div',
                          className: 'message-header-toolbar sd-keep-header', label: '顶部栏', children: [
                            // message.html:254
                            { id: 'messageTitle', kind: 'text', tag: 'div', className: 'message-title',
                              label: '顶部标题', text: '消息' },
                            // message.html:255-268
                            { id: 'messageToolbar', kind: 'block', tag: 'div', className: 'message-toolbar',
                              label: '工具按钮条', children: [
                                { id: 'messageFilterBtn', kind: 'button', tag: 'button', className: 'filter-btn',
                                  label: '筛选按钮', text: '筛选',
                                  html: '<span>筛选</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M3 4h18M6 9h12M9 14h6M11 19h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
                                { id: 'messageClearBtn', kind: 'button', tag: 'button', className: 'clear-btn',
                                  label: '清除未读按钮', text: '清除未读',
                                  html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>清除未读</span>' }
                              ] }
                          ] },
                        // message.html:270-273
                        { id: 'messageList', kind: 'block', tag: 'div', className: 'message-list',
                          label: '消息列表', children: [
                            { id: 'messageEmptyCard', kind: 'block', tag: 'div', className: 'card empty-card',
                              label: '空态卡片', children: [
                                { id: 'messageEmptyText', kind: 'text', tag: 'span', className: 'empty-text',
                                  label: '空态文字', text: '当前没有信息' }
                              ] }
                          ] }
                      ] }
                ]
            }
        }
    };

    /* 一级页面 → 文件名（编辑器「页面切换」用） */
    var PAGE_FILES = {
        shouye: 'shouye.html',
        daiban: 'daiban.html',
        bancha: 'bancha.html',
        message: 'message.html',
        mine: 'index.html'
    };
    var PAGE_ORDER = ['shouye', 'daiban', 'message', 'mine'];

    /* ------------------------------------------------------------- 基础工具 */

    function has(o, k) { return Object.prototype.hasOwnProperty.call(o || {}, k); }

    function isPlain(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    }

    function cloneVal(v) {
        if (Array.isArray(v)) return v.map(cloneVal);
        if (isPlain(v)) {
            var out = {}, k;
            for (k in v) { if (has(v, k)) out[k] = cloneVal(v[k]); }
            return out;
        }
        return v;
    }

    function shallowMerge(base, patch) {
        var out = {}, k;
        base = isPlain(base) ? base : {};
        for (k in base) { if (has(base, k)) out[k] = cloneVal(base[k]); }
        for (k in patch) {
            if (!has(patch, k)) continue;
            if (isPlain(patch[k]) && isPlain(base[k])) out[k] = shallowMerge(base[k], patch[k]);
            else out[k] = cloneVal(patch[k]);
        }
        return out;
    }

    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

    function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, num(v))); }

    function ls(key) {
        try { return global.localStorage.getItem(key); } catch (e) { return null; }
    }
    function lsSet(key, val) {
        try { global.localStorage.setItem(key, val); return { ok: true }; }
        catch (e) { return { ok: false, error: (e && e.name) || 'write-failed' }; }
    }
    function lsDel(key) {
        try { global.localStorage.removeItem(key); } catch (e) { }
    }

    function readDB() {
        var raw = ls(DB_KEY);
        if (!raw) return {};
        try { var o = JSON.parse(raw); return isPlain(o) ? o : {}; } catch (e) { return {}; }
    }

    function isLogged() { return !!ls('user_id'); }

    /* --------------------------------------------------- 变量解析 resolveText */

    function maskTaxId(s) {
        s = String(s == null ? '' : s);
        if (s.length <= 2) return s;
        // 掩码规则沿用 index.html:276（首位 + 15 星 + 末位）
        return s.substring(0, 1) + '***************' + s.substring(s.length - 1);
    }

    function countText(v, unit, zeroText) {
        var n = (v === null || v === undefined || v === '') ? 0 : Number(v);
        if (!isFinite(n)) n = 0;
        return n ? (n + unit) : zeroText;
    }

    function buildVars() {
        var db = readDB();
        var u = isPlain(db.user) ? db.user : {};
        var realName = ls('real_name') || u.real_name || '某某某';
        var taxRaw = ls('tax_id') || u.tax_id || '620000000000000000';
        var fam = ls('family_count'); if (fam === null || fam === undefined || fam === '') fam = u.family_count;
        var emp = ls('employer_count'); if (emp === null || emp === undefined || emp === '') emp = u.employer_count;
        var bank = ls('bank_card_count'); if (bank === null || bank === undefined || bank === '') bank = u.bank_card_count;
        var ann = ls('announcement') || db.announcement ||
            (Array.isArray(db.messages) && db.messages[0] && (db.messages[0].title || db.messages[0].content)) ||
            DEFAULT_ANNOUNCEMENT;

        return {
            real_name: realName,
            tax_id: maskTaxId(taxRaw),          // 页面显示形态（掩码）
            tax_id_masked: maskTaxId(taxRaw),
            tax_id_raw: String(taxRaw),
            family_count: countText(fam, '人', '添加'),     // index.html:409-414
            family_count_raw: String(num(fam)),
            employer_count: countText(emp, '家', '暂无'),   // index.html:402-407
            employer_count_raw: String(num(emp)),
            bank_count: countText(bank, '张', '添加'),      // index.html:416-421
            bank_count_raw: String(num(bank)),
            announcement: String(ann)
        };
    }

    var VARS = buildVars();

    function resolveText(tpl) {
        if (tpl === null || tpl === undefined) return '';
        return String(tpl).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, function (m, k) {
            return has(VARS, k) ? String(VARS[k]) : m;
        });
    }

    /* ------------------------------------------------------------ 配置读写 */

    function readStored() {
        var raw = ls(CONFIG_KEY);
        if (!raw) return null;
        try {
            var o = JSON.parse(raw);
            return isPlain(o) ? o : null;
        } catch (e) { return null; }
    }

    function writeStored(cfg) {
        var r = lsSet(CONFIG_KEY, JSON.stringify(cfg));
        if (!r.ok) {
            console.warn('[UIKit] 配置写入失败（可能超出 localStorage 配额）', r.error);
        }
        return r;
    }

    function emptyStored() {
        return { version: SCHEMA_VERSION, global: {}, pages: {} };
    }

    function mergePage(pageKey, storedPage) {
        var dp = DEFAULTS.pages[pageKey];
        if (!dp) return cloneVal(storedPage || {});
        if (!storedPage) return cloneVal(dp);
        var out = {}, k;
        for (k in dp) { if (has(dp, k) && k !== 'elements' && k !== 'bg' && k !== 'removed') out[k] = cloneVal(dp[k]); }
        for (k in storedPage) {
            if (!has(storedPage, k) || k === 'elements' || k === 'removed' || k === 'bg') continue;
            out[k] = cloneVal(storedPage[k]);
        }
        out.bg = storedPage.bg ? shallowMerge(dp.bg, storedPage.bg) : cloneVal(dp.bg);

        var removed = Array.isArray(storedPage.removed) ? storedPage.removed.slice() : [];
        var base = (dp.elements || []).map(function (e) { return cloneVal(e); });
        // 注意：必须按「下标」回写 base —— 若只改 byId 的对象引用，base 里仍是旧对象，
        // 补丁就会静默丢失（曾在此处踩坑）
        var idxById = {};
        base.forEach(function (e, i) { idxById[e.id] = i; });
        (storedPage.elements || []).forEach(function (se) {
            if (!se || !se.id) return;
            if (has(idxById, se.id)) {
                base[idxById[se.id]] = shallowMerge(base[idxById[se.id]], se);
            } else if (mergeIntoTree(base, se)) {
                /* 命中子元素（layout:'flow' 页面）：已在树内就地合并，不要另外新增 */
            } else if (removed.indexOf(se.id) < 0) {
                idxById[se.id] = base.length;
                base.push(cloneVal(se));
            }
        });
        out.elements = pruneRemoved(base, removed);
        out.removed = removed;
        return out;
    }

    /* 递归按 id 就地合并补丁（子元素支持）；返回是否命中 */
    function mergeIntoTree(list, se) {
        for (var i = 0; i < (list || []).length; i++) {
            var e = list[i];
            if (!e) continue;
            if (e.id === se.id) { list[i] = shallowMerge(e, se); return true; }
            if (e.children && e.children.length && mergeIntoTree(e.children, se)) return true;
        }
        return false;
    }

    /* 递归剔除已删除元素（对无 children 的页面 = 原顶层 filter 行为） */
    function pruneRemoved(list, removed) {
        var out = [];
        (list || []).forEach(function (e) {
            if (!e || !e.id) return;
            if (removed.indexOf(e.id) >= 0) return;
            if (e.children && e.children.length) {
                e = cloneVal(e);
                e.children = pruneRemoved(e.children, removed);
            }
            out.push(e);
        });
        return out;
    }

    /* 递归展开元素树（编辑器列表 / 保护层规则用） */
    function flatElements(list, out) {
        out = out || [];
        (list || []).forEach(function (e) {
            if (!e || !e.id) return;
            out.push(e);
            if (e.children && e.children.length) flatElements(e.children, out);
        });
        return out;
    }

    /* 在元素树里按 id 找元素（含子元素） */
    function findElDeep(list, id) {
        var flat = flatElements(list);
        for (var i = 0; i < flat.length; i++) if (flat[i].id === id) return flat[i];
        return null;
    }

    function getPage(pageKey) {
        var st = readStored() || {};
        return mergePage(pageKey, st.pages ? st.pages[pageKey] : null);
    }

    function getConfig() {
        var st = readStored() || emptyStored();
        var pages = {}, k;
        for (k in DEFAULTS.pages) { if (has(DEFAULTS.pages, k)) pages[k] = mergePage(k, (st.pages || {})[k]); }
        for (k in (st.pages || {})) { if (has(st.pages, k) && !pages[k]) pages[k] = cloneVal(st.pages[k]); }
        return {
            version: SCHEMA_VERSION,
            global: shallowMerge(DEFAULTS.global, st.global || {}),
            pages: pages
        };
    }

    function setPage(pageKey, patch, opts) {
        opts = opts || {};
        var st = readStored() || emptyStored();
        if (!st.pages) st.pages = {};
        var cur = st.pages[pageKey] || {};
        var next = shallowMerge(cur, patch || {});
        // elements 以 id 为键做浅合并（patch.elements 允许是数组）
        if (patch && Array.isArray(patch.elements)) {
            var map = {}, i, e;
            for (i = 0; i < (cur.elements || []).length; i++) {
                e = cur.elements[i]; if (e && e.id) map[e.id] = cloneVal(e);
            }
            for (i = 0; i < patch.elements.length; i++) {
                e = patch.elements[i]; if (!e || !e.id) continue;
                map[e.id] = map[e.id] ? shallowMerge(map[e.id], e) : cloneVal(e);
            }
            next.elements = Object.keys(map).map(function (id) { return map[id]; });
        }
        if (patch && Array.isArray(patch.removed)) next.removed = patch.removed.slice();
        st.version = SCHEMA_VERSION;
        st.pages[pageKey] = next;
        writeStored(st);
        if (opts.render !== false) refresh();
        else refreshGuard();
        return next;
    }

    function setConfig(patch) {
        patch = patch || {};
        var st = readStored() || emptyStored();
        var next = shallowMerge(st, patch);
        next.version = SCHEMA_VERSION;
        writeStored(next);
        applyGlobal(getConfig().global);
        if (patch.global) refresh();
        return getConfig();
    }

    function importJSON(text) {
        var o;
        try { o = JSON.parse(String(text || '')); }
        catch (e) { return { ok: false, msg: 'JSON 解析失败：' + (e && e.message) }; }
        if (!isPlain(o) || !isPlain(o.pages)) return { ok: false, msg: '结构不合法：缺少 pages 对象' };
        var st = emptyStored();
        st.version = SCHEMA_VERSION;
        st.global = isPlain(o.global) ? cloneVal(o.global) : {};
        var k;
        for (k in o.pages) { if (has(o.pages, k)) st.pages[k] = cloneVal(o.pages[k]); }
        writeStored(st);
        applyGlobal(getConfig().global);
        refresh();
        return { ok: true, msg: '导入成功（' + Object.keys(st.pages).join(' / ') + '）' };
    }

    function exportJSON() {
        var cfg = getConfig();
        cfg.exportedAt = new Date().toISOString();
        cfg.app = 'geshui-h5-ui';
        return JSON.stringify(cfg, null, 2);
    }

    function resetAll() {
        lsDel(CONFIG_KEY);
        applyGlobal(DEFAULTS.global);
        refresh();
        return { ok: true };
    }

    /* ---------------------------------------------------------- 全局字体/缩放 */

    function ensureGlobalStyleEl() {
        var el = document.getElementById('ui-global-style');
        if (!el) {
            el = document.createElement('style');
            el.id = 'ui-global-style';
            (document.head || document.documentElement).appendChild(el);
        }
        return el;
    }

    function ensureUnitVar() {
        var w = global.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 375;
        document.documentElement.style.setProperty('--ui-unit', (w / 1080) + 'px');
    }

    function applyGlobal(g) {
        g = shallowMerge(DEFAULTS.global, g || {});
        var ff = has(FONT_PRESETS, g.fontFamily) ? FONT_PRESETS[g.fontFamily] : String(g.fontFamily || FONT_PRESETS.system);
        var scale = clampNum(g.scale, 0.5, 2) || 1;
        var root = document.documentElement;
        root.style.setProperty('--ui-font-family', ff);
        root.style.setProperty('--ui-scale', String(scale));
        ensureUnitVar();
        ensureGlobalStyleEl().textContent =
            'body, body *:not(svg):not(path), body input, body textarea, body button, body select {' +
            '  font-family: var(--ui-font-family) !important;' +
            '}';
        return { fontFamily: g.fontFamily, scale: scale };
    }

    /* ------------------------------------------------------------- 渲染引擎 */

    function fontSizeCss(n) {
        return 'calc(var(--ui-unit, 1px) * ' + num(n) + ' * var(--ui-scale, 1))';
    }

    function getAspectRatio(pageKey, logged) {
        var page = getPage(pageKey);
        if (page.aspectByAuth) {
            var v = page.aspectByAuth[logged ? 'in' : 'out'];
            if (v) return v;
        }
        return page.aspectRatio || (pageKey === 'mine' ? ASPECT_MINE_IN : ASPECT_HOME);
    }

    function getBgSrc(pageKey, logged) {
        var bg = getPage(pageKey).bg || {};
        if (bg.kind === 'upload' && bg.src) return bg.src;
        if (bg.byAuth && bg.byAuth[logged ? 'in' : 'out']) return bg.byAuth[logged ? 'in' : 'out'];
        return bg.src || '';
    }

    function applyAttrs(node, attrs) {
        if (!isPlain(attrs)) return;
        Object.keys(attrs).forEach(function (k) {
            try { node.setAttribute(k, String(attrs[k] == null ? '' : attrs[k])); } catch (e) { }
        });
    }

    function applyRect(node, rect) {
        rect = rect || {};
        var s = node.style;
        s.position = 'absolute';
        s.top = num(rect.top) + '%';
        s.left = (rect.left === undefined || rect.left === null) ? '' : (num(rect.left) + '%');
        s.right = (rect.right === undefined || rect.right === null) ? '' : (num(rect.right) + '%');
        s.width = (rect.width === undefined || rect.width === null) ? '' : (num(rect.width) + '%');
        s.height = (rect.height === undefined || rect.height === null) ? '' : (num(rect.height) + '%');
        s.aspectRatio = rect.aspectRatio ? String(rect.aspectRatio) : '';
    }

    function applyStyle(node, st, kind) {
        st = st || {};
        var s = node.style;
        if (st.fontSize) s.fontSize = fontSizeCss(st.fontSize);
        if (st.color) s.color = String(st.color);
        if (st.fontWeight !== undefined && st.fontWeight !== null) s.fontWeight = String(st.fontWeight);
        if (st.textAlign) s.textAlign = String(st.textAlign);
        if (st.lineHeight !== undefined && st.lineHeight !== null) s.lineHeight = String(st.lineHeight);
        if (st.letterSpacing !== undefined && st.letterSpacing !== null) s.letterSpacing = String(st.letterSpacing);
        if (st.opacity !== undefined && st.opacity !== null) s.opacity = String(st.opacity);
        if (st.transform) s.transform = String(st.transform);
        else if (st.transform === null) s.transform = '';
        if (kind === 'image') s.objectFit = st.objectFit || 'contain';
    }

    function buildNode(el, pageKey, logged) {
        var kind = el.kind || 'hotspot';
        var tag = 'div';
        if (kind === 'hotspot') tag = (el.target || el.onclick) ? 'a' : 'div';
        else if (kind === 'image') tag = 'img';

        var node = document.createElement(tag);
        node.id = el.id;
        node.setAttribute('data-ui-el', el.id);
        node.setAttribute('data-ui-kind', kind);
        node.className = el.className || (kind === 'hotspot' ? 'sd-hot' : 'sd-layer');

        if (kind === 'hotspot' && tag === 'a') {
            node.setAttribute('href', el.target || 'javascript:void(0)');
        }
        if (el.onclick) node.setAttribute('onclick', el.onclick);
        if (kind === 'image') {
            node.setAttribute('alt', el.alt || '');
            var src = el.src || '';
            if (isPlain(el.srcByGender)) {
                var g = ls('gender');
                src = el.srcByGender[String(g == null ? '1' : g)] || src;
            }
            node.src = resolveText(src);
        }
        if (kind === 'text') node.textContent = resolveText(el.text || '');
        if (el.auth) node.setAttribute('data-auth', el.auth);

        applyAttrs(node, el.attrs);
        applyRect(node, el.rect);
        applyStyle(node, el.style, kind);
        node.style.zIndex = String(el.z || (kind === 'hotspot' ? 3 : 4));
        return node;
    }

    /* ---------------------------------------------- flow 渲染（一级页结构化页面）
       shouye / index 用的是「整屏图 + 绝对定位热区」模型；
       daiban / bancha / message 是普通文档流页面，配置里用 children 描述原 DOM 树，
       这里按原 tag/class/文案原样重建节点，样式全部沿用页面自带 CSS（不改一个字）。 */

    function applyFlowStyle(node, el, kind) {
        var st = el.style || {};
        var s = node.style;
        // 页面自带 CSS 里存在 `!important` 规则（如 daiban 的 .header-title、message 的
        // .message-title 都是 18px !important），inline 的非 important 声明会被压制。
        // 作者来源的 important 声明之间，内联样式优先 → 统一用 important 写入。
        if (st.fontSizePx) s.setProperty('font-size', num(st.fontSizePx) + 'px', 'important');
        if (st.fontSize) s.setProperty('font-size', fontSizeCss(st.fontSize), 'important');
        if (st.color) s.setProperty('color', String(st.color), 'important');
        if (st.fontWeight !== undefined && st.fontWeight !== null) s.fontWeight = String(st.fontWeight);
        if (st.textAlign) s.textAlign = String(st.textAlign);
        if (st.lineHeight !== undefined && st.lineHeight !== null) s.lineHeight = String(st.lineHeight);
        if (st.letterSpacing !== undefined && st.letterSpacing !== null) s.letterSpacing = String(st.letterSpacing);
        if (st.opacity !== undefined && st.opacity !== null) s.opacity = String(st.opacity);
        if (st.background) s.background = String(st.background);
        if (st.borderRadius !== undefined && st.borderRadius !== null) s.borderRadius = String(st.borderRadius);
        if (st.transform) s.transform = String(st.transform);
        if (kind === 'image') s.objectFit = st.objectFit || '';
        // 文档流内位移（编辑器拖动保存的像素偏移），不改兄弟节点布局
        var ox = num(st.offsetX), oy = num(st.offsetY);
        if (ox || oy) {
            s.position = 'relative';
            s.left = ox + 'px';
            s.top = oy + 'px';
        }
    }

    function buildFlowNode(el, pageKey, logged) {
        var kind = el.kind || 'block';
        var tag = el.tag || (kind === 'image' ? 'img' : (kind === 'hotspot' ? 'a' : 'div'));
        var node = document.createElement(tag);
        if (el.id) node.id = el.id;
        if (el.id) node.setAttribute('data-ui-el', el.id);
        node.setAttribute('data-ui-kind', kind);
        if (el.className) node.className = el.className;
        if (el.auth) node.setAttribute('data-auth', el.auth);
        applyAttrs(node, el.attrs);

        if (kind === 'hotspot') {
            if (tag === 'a') node.setAttribute('href', el.target || 'javascript:void(0)');
            if (el.onclick) node.setAttribute('onclick', el.onclick);
        }
        if (kind === 'image') {
            node.setAttribute('alt', el.alt || '');
            var src = el.src || '';
            if (isPlain(el.srcByGender)) {
                var g = ls('gender');
                src = el.srcByGender[String(g == null ? '1' : g)] || src;
            }
            node.src = resolveText(src);
        }
        if (el.html) {
            // 原始片段（含 svg 的按钮等）原样注入；text 字段存在时覆盖其中第一个 <span>
            node.innerHTML = el.html;
            if (el.text !== undefined && el.text !== null) {
                var sp = node.querySelector('span');
                if (sp) sp.textContent = resolveText(el.text);
            }
        } else if (el.text !== undefined && el.text !== null && !(el.children && el.children.length)) {
            node.textContent = resolveText(el.text);
        }
        if (el.visible === false) node.style.display = 'none';

        applyFlowStyle(node, el, kind);

        (el.children || []).forEach(function (c) {
            if (!c || c.visible === false) return;
            node.appendChild(buildFlowNode(c, pageKey, logged));
        });
        return node;
    }

    var RENDERED = { pageKey: null, root: null };

    function render(pageKey, rootEl) {
        var root = (typeof rootEl === 'string') ? document.querySelector(rootEl) : rootEl;
        if (!root) { console.warn('[UIKit] render: rootEl 不存在'); return null; }
        var page = getPage(pageKey);
        var logged = isLogged();

        /* ---- flow 页面（daiban / bancha / message）：按原 DOM 树重建，页面自带底栏不碰 ---- */
        if (page.layout === 'flow') {
            root.innerHTML = '';
            (page.elements || []).forEach(function (el) {
                if (!el || el.visible === false) return;
                root.appendChild(buildFlowNode(el, pageKey, logged));
            });
            applyGlobal(getConfig().global);
            RENDERED.pageKey = pageKey;
            RENDERED.root = root;
            startGuard(pageKey, root);
            return root.firstChild;
        }

        /* ---- 整屏图页面（shouye / index）----
           底栏规则：只搬 root 内的 .bottom-nav；页面自带（root 之外）的底栏一律保持原样，
           否则会凭空多出一个底栏节点（shouye / index 两页 render 时 body 里没有底栏，
           这里仍会创建空 <nav class="bottom-nav">，交给 js/sdtab.js 填充，行为与改造前一致）。 */
        var innerNav = root.querySelector('.bottom-nav');
        var bodyNav = document.querySelector('.bottom-nav');
        var hasOutsideNav = !!bodyNav && !root.contains(bodyNav);
        var navHTML = innerNav ? innerNav.innerHTML : '';
        var navClass = (innerNav && innerNav.className) ? innerNav.className : 'bottom-nav';

        root.innerHTML = '';
        var wrap = document.createElement('div');
        wrap.className = 'sd-fullpage';
        wrap.id = page.containerId || ('uiPage_' + pageKey);
        // 用 setAttribute 直写 style 字符串：浏览器 CSSOM 会把长小数序列化成 6 位
        // （0.3893294881038212 → 0.389329），这里保留与现有页面逐字相同的原值
        wrap.setAttribute('style', 'aspect-ratio:' + String(getAspectRatio(pageKey, logged)) + ';');

        var bg = document.createElement('img');
        bg.className = 'sd-bgimg';
        bg.id = (page.bg && page.bg.id) || ('uiBg_' + pageKey);
        bg.alt = '';
        bg.setAttribute('data-ui-el', '__bg__');
        applyAttrs(bg, page.bg && page.bg.attrs);
        bg.src = getBgSrc(pageKey, logged);
        wrap.appendChild(bg);

        (page.elements || []).forEach(function (el) {
            if (!el || el.visible === false) return;
            wrap.appendChild(buildNode(el, pageKey, logged));
        });

        root.appendChild(wrap);

        if (innerNav || !hasOutsideNav) {
            var nav = document.createElement('nav');
            nav.className = navClass || 'bottom-nav';
            nav.innerHTML = navHTML;
            root.appendChild(nav);
        }

        applyGlobal(getConfig().global);
        RENDERED.pageKey = pageKey;
        RENDERED.root = root;
        startGuard(pageKey, root);
        return wrap;
    }

    function refresh() {
        if (RENDERED.pageKey && RENDERED.root && document.body.contains(RENDERED.root)) {
            render(RENDERED.pageKey, RENDERED.root);
        } else {
            applyGlobal(getConfig().global);
        }
    }

    function currentPageKey() {
        var b = document.body;
        var f = (location.pathname.split('/').pop() || '').toLowerCase();
        if (b && b.getAttribute && b.getAttribute('data-ui-page')) return b.getAttribute('data-ui-page');
        var cls = (b && b.className) || '';
        if (/page-mine|page-index/.test(cls) || f === 'index.html' || f === 'mine.html') return 'mine';
        if (/page-daiban/.test(cls) || f === 'daiban.html') return 'daiban';
        if (/page-bancha/.test(cls) || f === 'bancha.html') return 'bancha';
        if (/page-message/.test(cls) || f === 'message.html') return 'message';
        if (/page-shouye/.test(cls) || f === 'shouye.html') return 'shouye';
        if (!f) return RENDERED.pageKey || 'mine';
        return RENDERED.pageKey || 'shouye';
    }

    /* ----------------------------------------------------------- 自定义保护层
       页面原有业务 JS（applyMineAuthState / updateTaxIdDisplay /
       updateCountsFromLocalStorage / api 回调）会写 mineBg.src、mineAvatar.src、
       文字层 textContent。默认配置下这些写入 = 现状行为，必须放行；
       一旦用户改过该字段，则用 MutationObserver 把用户值抢回来。            */

    function findEl(list, id) {
        list = list || [];
        for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
        return null;
    }

    function isCustom(pageKey, elId) {
        var st = readStored();
        var sp = st && st.pages ? (st.pages[pageKey] || null) : null;
        var dp = DEFAULTS.pages[pageKey];
        if (!sp || !dp) return false;
        if (elId === '__bg__') {
            return !!sp.bg && JSON.stringify(sp.bg) !== JSON.stringify(dp.bg);
        }
        var se = findEl(sp.elements, elId);
        var de = findEl(dp.elements, elId);
        if (!se) return false;                 // 未被改动过（不在补丁里）
        if (!de) return true;                  // 新增元素
        return JSON.stringify(se) !== JSON.stringify(de);
    }

    function buildGuardRules(pageKey, root) {
        var page = getPage(pageKey), dp = DEFAULTS.pages[pageKey] || {};
        var logged = isLogged();
        var rules = [];
        var bgNode = root.querySelector('img.sd-bgimg');
        if (bgNode && isCustom(pageKey, '__bg__')) {
            rules.push({ node: bgNode, attr: 'src', value: getBgSrc(pageKey, logged) });
        }
        (page.elements || []).forEach(function (el) {
            if (!el || !el.id) return;
            var de = findEl(dp.elements, el.id);
            var node = document.getElementById(el.id);
            if (!node || !root.contains(node)) return;
            if (el.kind === 'text' && (!de || el.text !== de.text)) {
                rules.push({ node: node, text: resolveText(el.text || '') });
            }
            if (el.kind === 'image' && (!de || el.src !== de.src)) {
                rules.push({ node: node, attr: 'src', value: resolveText(el.src || '') });
            }
        });
        return rules;
    }

    var GUARD = { mo: null, rules: [] };

    function stopGuard() {
        if (GUARD.mo) { try { GUARD.mo.disconnect(); } catch (e) { } }
        GUARD.mo = null;
        GUARD.rules = [];
    }

    function startGuard(pageKey, root) {
        stopGuard();
        if (!root) return;
        var rules = buildGuardRules(pageKey, root);
        GUARD.rules = rules;
        if (!rules.length) return;
        var applying = false;
        function apply() {
            if (applying) return;
            applying = true;
            for (var i = 0; i < rules.length; i++) {
                var r = rules[i];
                if (r.attr) {
                    if (r.node.getAttribute(r.attr) !== r.value) r.node.setAttribute(r.attr, r.value);
                } else if (r.node.textContent !== r.text) {
                    r.node.textContent = r.text;
                }
            }
            applying = false;
        }
        if (global.MutationObserver) {
            var mo = new MutationObserver(apply);
            mo.observe(root, {
                subtree: true, childList: true, characterData: true,
                attributes: true, attributeFilter: ['src']
            });
            GUARD.mo = mo;
        }
        apply();
    }

    function refreshGuard() {
        if (RENDERED.pageKey && RENDERED.root) startGuard(RENDERED.pageKey, RENDERED.root);
    }

    /* ------------------------------------------------------------- 自动初始化 */

    function boot() {
        VARS = buildVars();
        applyGlobal(getConfig().global);
        if (global.addEventListener) {
            var t = null;
            global.addEventListener('resize', function () {
                if (t) clearTimeout(t);
                t = setTimeout(ensureUnitVar, 120);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    global.UIKit = {
        KEYS: { CONFIG: CONFIG_KEY, DB: DB_KEY },
        VERSION: SCHEMA_VERSION,
        DEFAULTS: DEFAULTS,
        FONT_PRESETS: FONT_PRESETS,
        FONT_LABELS: FONT_LABELS,
        CLAMP: { top: CLAMP_TOP, left: CLAMP_LEFT },
        // 配置
        getConfig: getConfig,
        setConfig: setConfig,
        getPage: getPage,
        setPage: setPage,
        // 渲染
        render: render,
        refresh: refresh,
        resolveText: resolveText,
        // 元素树（layout:'flow' 页面用）
        flatElements: function (list) { return flatElements(list); },
        findElDeep: function (list, id) { return findElDeep(list, id); },
        PAGE_FILES: PAGE_FILES,
        PAGE_ORDER: PAGE_ORDER,
        pageFile: function (pageKey) { return PAGE_FILES[pageKey] || (pageKey + '.html'); },
        isFlowPage: function (pageKey) { return (getPage(pageKey) || {}).layout === 'flow'; },
        vars: function () { VARS = buildVars(); return cloneVal(VARS); },
        // 背景 / 比例（供页面业务 JS 回调，保持默认行为一致）
        getBgSrc: getBgSrc,
        getAspectRatio: getAspectRatio,
        currentPageKey: currentPageKey,
        isCustom: isCustom,
        // 备份
        exportJSON: exportJSON,
        importJSON: importJSON,
        resetAll: resetAll,
        // 全局
        applyGlobal: applyGlobal,
        // 保护层（编辑器内部用）
        refreshGuard: refreshGuard,
        stopGuard: stopGuard,
        rendered: function () { return { pageKey: RENDERED.pageKey, root: RENDERED.root }; }
    };
})(window);
