/**
 * 本地数据层 - 完全离线版
 * 拦截所有 /api/* fetch 请求，用 localStorage 持久化，支持增删改查
 * 预置 2023-2025 年个税流水示例数据
 */
(function () {
    'use strict';

    var LS_KEY = 'geshui_local_db_v1';

    // ============ 预置数据（2023-2025 个税流水） ============
    function seedData() {
        return {
            user: {
                id: 1, username: 'admin', real_name: '张三',
                tax_id: '110101199001011234', gender: '1',
                employer_count: 0, family_count: 0, bank_card_count: 1,
                phone: '13800138000', address: '北京市朝阳区', watermark_enabled: 0
            },
            family: [
                { id: 1, name: '李四', relation: '配偶', id_number: '110101199202022345' },
                { id: 2, name: '张小明', relation: '子女', id_number: '110101201501015678' },
                { id: 3, name: '张小红', relation: '子女', id_number: '110101201701017890' }
            ],
            employers: [
                { id: 1, name: '北京九州华海科技有限公司', tax_id: '91110108MA01XXXXX', type: '任职受雇' },
                { id: 2, name: '上海天工开物信息技术有限公司', tax_id: '91310115MA1XXXXX', type: '任职受雇' },
                { id: 3, name: '广州云帆网络科技有限公司', tax_id: '91440101MA9XXXXX', type: '任职受雇' }
            ],
            banks: [
                { id: 1, bank_name: '中国工商银行', card_no: '6222020200112233445', type: '工资卡' },
                { id: 2, bank_name: '招商银行', card_no: '6225880100123456', type: '银行卡' }
            ],
            records: [
                // ===== 2023 年 =====
                { id: 1001, year: 2023, month: 1, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 38500.00, tax_reported: 1860.25, report_date: '2023-01-10' },
                { id: 1002, year: 2023, month: 2, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 39200.00, tax_reported: 1945.60, report_date: '2023-02-10' },
                { id: 1003, year: 2023, month: 3, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 40100.00, tax_reported: 2050.75, report_date: '2023-03-10' },
                { id: 1004, year: 2023, month: 4, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 39800.00, tax_reported: 2012.30, report_date: '2023-04-10' },
                { id: 1005, year: 2023, month: 5, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 40500.00, tax_reported: 2090.45, report_date: '2023-05-10' },
                { id: 1006, year: 2023, month: 6, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 41000.00, tax_reported: 2130.80, report_date: '2023-06-10' },
                { id: 1007, year: 2023, month: 7, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 41500.00, tax_reported: 2175.15, report_date: '2023-07-10' },
                { id: 1008, year: 2023, month: 8, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 42000.00, tax_reported: 2220.50, report_date: '2023-08-10' },
                { id: 1009, year: 2023, month: 9, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 42500.00, tax_reported: 2265.85, report_date: '2023-09-10' },
                { id: 1010, year: 2023, month: 10, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 43000.00, tax_reported: 2310.20, report_date: '2023-10-10' },
                { id: 1011, year: 2023, month: 11, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 43500.00, tax_reported: 2355.55, report_date: '2023-11-10' },
                { id: 1012, year: 2023, month: 12, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '上海天工开物信息技术有限公司', income: 50000.00, tax_reported: 3120.00, report_date: '2023-12-10' },
                // ===== 2024 年 =====
                { id: 2001, year: 2024, month: 1, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 52000.00, tax_reported: 3480.50, report_date: '2024-01-10' },
                { id: 2002, year: 2024, month: 2, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 53500.00, tax_reported: 3650.25, report_date: '2024-02-10' },
                { id: 2003, year: 2024, month: 3, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 54800.00, tax_reported: 3820.00, report_date: '2024-03-10' },
                { id: 2004, year: 2024, month: 4, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 56000.00, tax_reported: 3990.75, report_date: '2024-04-10' },
                { id: 2005, year: 2024, month: 5, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 57500.00, tax_reported: 4160.50, report_date: '2024-05-10' },
                { id: 2006, year: 2024, month: 6, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 59000.00, tax_reported: 4330.25, report_date: '2024-06-10' },
                { id: 2007, year: 2024, month: 7, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 60500.00, tax_reported: 4500.00, report_date: '2024-07-10' },
                { id: 2008, year: 2024, month: 8, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 62000.00, tax_reported: 4670.75, report_date: '2024-08-10' },
                { id: 2009, year: 2024, month: 9, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 63500.00, tax_reported: 4840.50, report_date: '2024-09-10' },
                { id: 2010, year: 2024, month: 10, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 65000.00, tax_reported: 5010.25, report_date: '2024-10-10' },
                { id: 2011, year: 2024, month: 11, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 66500.00, tax_reported: 5180.00, report_date: '2024-11-10' },
                { id: 2012, year: 2024, month: 12, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 78000.00, tax_reported: 6350.00, report_date: '2024-12-10' },
                // ===== 2025 年 =====
                { id: 3001, year: 2025, month: 1, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 81000.00, tax_reported: 6720.50, report_date: '2025-01-10' },
                { id: 3002, year: 2025, month: 2, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 82500.00, tax_reported: 6890.25, report_date: '2025-02-10' },
                { id: 3003, year: 2025, month: 3, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 84000.00, tax_reported: 7060.00, report_date: '2025-03-10' },
                { id: 3004, year: 2025, month: 4, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 86000.00, tax_reported: 7230.75, report_date: '2025-04-10' },
                { id: 3005, year: 2025, month: 5, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 87500.00, tax_reported: 7400.50, report_date: '2025-05-10' },
                { id: 3006, year: 2025, month: 6, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 89000.00, tax_reported: 7570.25, report_date: '2025-06-10' },
                { id: 3007, year: 2025, month: 7, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 90500.00, tax_reported: 7740.00, report_date: '2025-07-10' },
                { id: 3008, year: 2025, month: 8, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 92000.00, tax_reported: 7910.75, report_date: '2025-08-10' },
                { id: 3009, year: 2025, month: 9, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 93500.00, tax_reported: 8080.50, report_date: '2025-09-10' },
                { id: 3010, year: 2025, month: 10, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 95000.00, tax_reported: 8250.25, report_date: '2025-10-10' },
                { id: 3011, year: 2025, month: 11, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 96500.00, tax_reported: 8420.00, report_date: '2025-11-10' },
                { id: 3012, year: 2025, month: 12, income_type: '工资薪金', income_subtype: '正常工资薪金', company_name: '北京九州华海科技有限公司', income: 110000.00, tax_reported: 9800.00, report_date: '2025-12-10' }
            ],
            deductions: [
                { id: 1, deduction_type: '赡养老人', deduction_year: '2025', last_modified: '2025-01-15', source: '本人', amount: 3000 },
                { id: 2, deduction_type: '住房租金', deduction_year: '2025', last_modified: '2025-01-10', source: '本人', amount: 1500 },
                { id: 3, deduction_type: '子女教育', deduction_year: '2025', last_modified: '2025-01-12', source: '本人', amount: 2000 }
            ],
            messages: []
        };
    }

    // ============ 个税计算(国家标准) ============
    // 专项扣除(个人部分): 养老8% + 医疗2% + 失业0.5% + 公积金5% = 15.5%
    // 缴费基数: 按社保缴费基数, 与当月工资无关(取工资的 49%, 与官方页面比例一致)
    // 已申报税额: 工资薪金按累计预扣法(国家税务总局公告 2018 年第 61 号)
    // 缴费基数: 本人上年度月平均工资, 落在当地社平工资 60%~300% 之间(国发〔2019〕13 号)
    //   <上下限按参保地口径改写>
    var AVG_WAGE_MIN = 4800;    // 缴费基数下限 = 当地社平工资 × 60%
    var AVG_WAGE_MAX = 24000;   // 缴费基数上限 = 当地社平工资 × 300%
    var SOCIAL_BASE_RATE = 0.49;   // @deprecated 旧近似(基数=当月工资×49%), 已由下面的 clamp 取代
    var SOCIAL_RATE = 0.155;
    var TAX_VERSION = 4;   // 4: 统一社保基数口径为"当月工资 clamp 4800~24000"，并去掉预扣环节的专项附加扣除

    function round2(v) { return Math.round((parseFloat(v) || 0) * 100) / 100; }
    function socialBase(income) {
        var b = parseFloat(income) || 0;
        if (b < AVG_WAGE_MIN) b = AVG_WAGE_MIN;
        if (b > AVG_WAGE_MAX) b = AVG_WAGE_MAX;
        return round2(b);
    }
    function socialInsurance(income) { return round2(socialBase(income) * SOCIAL_RATE); }

    // 累计预扣率表(工资薪金所得)
    var WITHHOLD_TABLE = [
        { cap: 36000, rate: 0.03, ded: 0 },
        { cap: 144000, rate: 0.10, ded: 2520 },
        { cap: 300000, rate: 0.20, ded: 16920 },
        { cap: 420000, rate: 0.25, ded: 31920 },
        { cap: 660000, rate: 0.30, ded: 52920 },
        { cap: 960000, rate: 0.35, ded: 85920 },
        { cap: Infinity, rate: 0.45, ded: 181920 }
    ];

    function cumulativeTax(taxable) {
        if (taxable <= 0) return 0;
        for (var i = 0; i < WITHHOLD_TABLE.length; i++) {
            if (taxable <= WITHHOLD_TABLE[i].cap) {
                return Math.max(0, round2(taxable * WITHHOLD_TABLE[i].rate - WITHHOLD_TABLE[i].ded));
            }
        }
        return 0;
    }

    function taxOf(record) {
        if (!record) return 0;
        return record.income_type === '年终奖'
            ? calcBonusTaxLocal(parseFloat(record.income) || 0)
            : calcTax(parseFloat(record.income) || 0);
    }

    // 按累计预扣法重算某一年全部工资薪金记录的本期已申报税额
    function recalcYearTax(db, year) {
        var recs = (db.records || []).filter(function (r) { return String(r.year) === String(year); })
            .sort(function (a, b) {
                return (parseInt(a.month, 10) || 1) - (parseInt(b.month, 10) || 1)
                    || (a.income_type === '年终奖' ? 1 : -1);
            });
        // 该年第一个"工资薪金"月份 = 起算任职月(国家标准按"任职受雇月份数"扣 5000/月)
        var firstMonth = 1;
        for (var i = 0; i < recs.length; i++) {
            if (recs[i].income_type !== '年终奖') { firstMonth = parseInt(recs[i].month, 10) || 1; break; }
        }
        var cumIncome = 0, cumSocial = 0, cumTaxed = 0;
        recs.forEach(function (r) {
            var inc = parseFloat(r.income) || 0;
            if (r.income_type === '年终奖') { r.tax_reported = calcBonusTaxLocal(inc); return; }
            cumIncome += inc;
            cumSocial += socialInsurance(inc);
            var months = Math.max(1, (parseInt(r.month, 10) || 1) - firstMonth + 1);
            var taxable = cumIncome - 5000 * months - cumSocial;
            var cumTax = cumulativeTax(taxable);
            r.tax_reported = round2(Math.max(0, cumTax - cumTaxed));
            cumTaxed += r.tax_reported;
        });
    }

    // 一次性迁移: 按国家标准统一重算已申报税额
    function migrateTax(db) {
        if (!db || !db.records || db.__taxVersion === TAX_VERSION) return false;
        var years = {};
        db.records.forEach(function (r) { if (r.year) years[r.year] = true; });
        Object.keys(years).forEach(function (y) { recalcYearTax(db, y); });
        db.__taxVersion = TAX_VERSION;
        return true;
    }

    // 一次性修复: 旧版本曾把演示月收入统一改写成 25000（污染数据），识别后清空并按种子数据重建
    var _pollutionChecked = false;
    function purgePollutedDemoData() {
        if (_pollutionChecked) return;
        _pollutionChecked = true;
        try {
            var raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            var db = JSON.parse(raw);
            var recs = (db.records || []).filter(function (r) { return r.income_type !== '年终奖'; });
            if (recs.length && recs.every(function (r) { return Math.round((parseFloat(r.income) || 0) * 100) === 2500000; })) {
                localStorage.removeItem(LS_KEY);
                localStorage.removeItem('selected_year');
            }
        } catch (e) {}
    }

    function loadDB() {
        purgePollutedDemoData();
        try {
            var raw = localStorage.getItem(LS_KEY);
            if (raw) {
                var db = JSON.parse(raw);
                // 升级修正: 旧演示数据计数过高时重置
                if (db && db.user) {
                    if (db.user.family_count > 10 || db.user.employer_count > 10) {
                        db.user.family_count = 0;
                        db.user.employer_count = 0;
                        db.user.bank_card_count = 1;
                        saveDB(db);
                    }
                }
                // 迁移: 按标准算法统一重算已申报税额
                if (migrateTax(db)) saveDB(db);
                return db;
            }
        } catch (e) {}
        var db = seedData();
        migrateTax(db);
        saveDB(db);
        return db;
    }

    function saveDB(db) {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(db));
        } catch (e) { console.error('saveDB failed', e); }
    }

    function ok(data) {
        return Promise.resolve({ ok: true, status: 200, redirected: false, url: '',
            json: function () { return Promise.resolve({ code: 200, msg: '操作成功', data: data }); },
            text: function () { return Promise.resolve(JSON.stringify({ code: 200, msg: '操作成功', data: data })); },
            headers: { get: function () { return 'local-token'; } }
        });
    }

    function fail(msg, code) {
        return Promise.resolve({ ok: true, status: 200, redirected: false, url: '',
            json: function () { return Promise.resolve({ code: code || 400, msg: msg }); },
            text: function () { return Promise.resolve(JSON.stringify({ code: code || 400, msg: msg })); },
            headers: { get: function () { return null; } }
        });
    }

    // ============ API 路由 ============
    
    // ===== 个税计算(标准算法) =====
    // 应纳税所得额 = 税前工资 - 5000起征点 - 五险一金个人部分(15.5%)
    // 五险一金个人部分: 养老8% + 医疗2% + 失业0.5% + 公积金5%(国家规定下限)
    // 分段税率(月度等效): 3000以内3%, 3000~12000部分10%速扣210
    function calcTax(monthlyIncome) {
        var inc = parseFloat(monthlyIncome) || 0;
        var social = socialInsurance(inc);
        var taxable = inc - 5000 - social;
        if (taxable <= 0) return 0;
        if (taxable <= 3000) {
            return Math.max(0, Math.round(taxable * 0.03 * 100) / 100);
        }
        return Math.max(0, Math.round((taxable * 0.10 - 210) * 100) / 100);
    }
    // 年终奖单独计税(财税〔2018〕164号): 税 = 奖金 × 适用税率 - 速算扣除数(速算扣除数不乘12)
    function calcBonusTaxLocal(bonus) {
        if (bonus <= 0) return 0;
        var a = bonus / 12, rate, ded;
        if (a <= 3000) { rate = 0.03; ded = 0; }
        else if (a <= 12000) { rate = 0.10; ded = 210; }
        else if (a <= 25000) { rate = 0.20; ded = 1410; }
        else if (a <= 35000) { rate = 0.25; ded = 2660; }
        else if (a <= 55000) { rate = 0.30; ded = 4410; }
        else if (a <= 80000) { rate = 0.35; ded = 7160; }
        else { rate = 0.45; ded = 15160; }
        return Math.max(0, Math.round((bonus * rate - ded) * 100) / 100);
    }

    // ===== 金额随机浮动: 基础值 ±5% =====
    function jitterAmount(base) {
        var v = parseFloat(base) || 0;
        if (v <= 0) return 0;
        var delta = v * (Math.random() * 0.10 - 0.05);
        return Math.round((v + delta) * 100) / 100;
    }


function route(url, options) {
        var method = (options && options.method) || 'GET';
        var u = String(url);
        var path = u.split('?')[0];
        var qs = u.indexOf('?') > -1 ? u.substring(u.indexOf('?') + 1) : '';
        var params = {};
        qs.split('&').forEach(function (kv) {
            if (!kv) return;
            var p = kv.split('=');
            params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
        });

        var db = loadDB();
        var action = params.action || '';
        var body = {};
        try { body = options && options.body ? JSON.parse(options.body) : {}; } catch (e) {}

        // ---- 用户信息 ----
        if (path.indexOf('current_user.php') > -1) {
            return ok({ user_id: db.user.id, username: db.user.username, real_name: db.user.real_name, tax_id: db.user.tax_id });
        }
        if (path.indexOf('user.php') > -1) {
            if (action === 'info') {
                var y = parseInt(params.year || 0);
                return ok(db.user);
            }
            if (action === 'special_deduction_records') {
                var yearStr = params.year || '2025';
                return ok({ records: db.deductions.filter(function (d) { return String(d.deduction_year) === String(yearStr); }) });
            }
            if (method === 'POST') {
                // 保存用户信息
                if (body.action === 'save_profile') {
                    // 兼容两种格式: {profile:{...}} 嵌套 或 {real_name:...} 扁平
                    var profile = body.profile || {};
                    // 扁平字段(除action外)合并
                    Object.keys(body).forEach(function (k) {
                        if (k !== 'action' && k !== 'profile' && k !== 'id') {
                            profile[k] = body[k];
                        }
                    });
                    db.user = Object.assign(db.user, profile);
                    saveDB(db);
                    // 同步 localStorage(供 index 等页面直接读取)
                    if (db.user.real_name) localStorage.setItem('real_name', db.user.real_name);
                    if (db.user.tax_id) localStorage.setItem('tax_id', db.user.tax_id);
                    if (db.user.gender !== undefined && db.user.gender !== null) localStorage.setItem('gender', String(db.user.gender));
                    if (db.user.username) localStorage.setItem('username', db.user.username);
                    if (db.user.phone) localStorage.setItem('phone', db.user.phone);
                    return ok(db.user);
                }
                // 专项扣除增删改
                if (body.action === 'add_special_deduction_record') {
                    var nd = { id: Date.now(), deduction_type: body.deduction_type, deduction_year: body.deduction_year, last_modified: new Date().toISOString().substring(0, 10), source: '本人', amount: parseFloat(body.amount) || 0 };
                    db.deductions.push(nd); saveDB(db); return ok(nd);
                }
                if (body.action === 'delete_special_deduction_record') {
                    db.deductions = db.deductions.filter(function (d) { return d.id !== parseInt(body.record_id); });
                    saveDB(db); return ok({});
                }
                if (body.action === 'update_special_deduction_record') {
                    db.deductions = db.deductions.map(function (d) {
                        return d.id === parseInt(body.record_id) ? Object.assign(d, body) : d;
                    });
                    saveDB(db); return ok({});
                }
            }
            return ok(db.user);
        }
        if (path.indexOf('userinfo.php') > -1) {
            if (action === 'detail') {
                return ok({ user: db.user, family: db.family, employers: db.employers, banks: db.banks });
            }
        }

        // ---- 收入纳税明细（流水） ----
        if (path.indexOf('tax.php') > -1) {
            var yearN = parseInt(params.year) || new Date().getFullYear();
            var records = db.records.filter(function (r) { return r.year === yearN; });
            if (action === 'records') {
                // 直接返回用户保存的金额和税额(与编辑页同步)
                // 若税额为0或缺失, 则按收入自动计算
                var outRecords = records.map(function (r) {
                    var income = parseFloat(r.income) || 0;
                    var tax = (r.tax_reported === undefined || r.tax_reported === null) ? calcTax(income) : parseFloat(r.tax_reported) || 0;
                    return Object.assign({}, r, { income: income, tax_reported: tax });
                });
                var incomeTotal = outRecords.reduce(function (s, r) { return s + (r.income || 0); }, 0);
                var taxTotal = outRecords.reduce(function (s, r) { return s + (r.tax_reported || 0); }, 0);
                return ok({ income_total: Math.round(incomeTotal * 100) / 100, tax_total: Math.round(taxTotal * 100) / 100, records: outRecords });
            }
            if (action === 'save' || action === 'add') {
                var isBonusRec = (body.income_type || '') === '年终奖';
                var nr = {
                    id: parseInt(body.id) || Date.now(),
                    year: parseInt(body.year) || yearN,
                    month: parseInt(body.month) || 1,
                    income_type: body.income_type || '工资薪金',
                    income_subtype: body.income_subtype || '正常工资薪金',
                    company_name: body.company_name || '',
                    income: parseFloat(body.income) || 0,
                    tax_reported: isBonusRec ? calcBonusTaxLocal(parseFloat(body.income) || 0) : calcTax(parseFloat(body.income) || 0),
                    report_date: body.report_date || new Date().toISOString().substring(0, 10)
                };
                var existed = false;
                db.records = db.records.map(function (r) {
                    if (r.id === nr.id) { existed = true; return nr; }
                    return r;
                });
                if (!existed) db.records.push(nr);
                recalcYearTax(db, nr.year);
                saveDB(db); return ok(nr);
            }
            if (action === 'delete') {
                db.records = db.records.filter(function (r) { return r.id !== parseInt(body.id); });
                saveDB(db); return ok({});
            }
            return ok({ income_total: 0, tax_total: 0, records: records });
        }

        // ---- 消息 ----
        if (path.indexOf('message.php') > -1) {
            if (action === 'list') return ok({ list: db.messages });
            if (action === 'clear') { db.messages = []; saveDB(db); return ok({}); }
            return ok({ list: db.messages });
        }

        // ---- UI 配置 ----
        if (path.indexOf('mine-ui') > -1) {
            return ok({
                theme: 'blue', header_male: 'grdb.jpg', header_female: 'nx.jpg',
                icon_family: 'jtcy.jpg', icon_employer: 'rzsp.jpg', icon_bank: 'yhk.jpg',
                nav_sy_1: 'caidan/sy1.png', nav_sy_2: 'caidan/sy2.png',
                nav_db_1: 'caidan/db1.png', nav_db_2: 'caidan/db2.png',
                nav_bc_1: 'caidan/bc1.png', nav_bc_2: 'caidan/bc2.png',
                nav_xx_1: 'caidan/xx1.png', nav_xx_2: 'caidan/xx2.png',
                nav_w_1: 'caidan/w1.png', nav_w_2: 'caidan/w2.png',
                shouye_banner: 'sydb-v2.jpg', shouye_zdfwdb: 'zdfwdb.jpg', shouye_lb: 'lb.jpg'
            });
        }

        // ---- 登出 ----
        if (path.indexOf('doLogOut') > -1) {
            return ok({});
        }

        return fail('接口未实现: ' + path);
    }

    // ============ 覆盖 fetch ============
    var originalFetch = window.fetch;
    window.fetch = function (url, options) {
        var u = String(url);
        if (u.indexOf('/api/') > -1 || u.indexOf('api/') === 0) {
            return route(u, options);
        }
        return originalFetch.apply(this, arguments);
    };


    // ===== 拦截 XMLHttpRequest (watermark.js 等使用) =====
    if (window.XMLHttpRequest) {
        var OrigXHR = window.XMLHttpRequest;
        function LocalXHR() {
            var xhr = new OrigXHR();
            var openMethod = xhr.open;
            var sendMethod = xhr.send;
            var pendingUrl = null;
            var pendingMethod = 'GET';
            xhr.open = function (method, url, async, user, pass) {
                pendingMethod = String(method || 'GET').toUpperCase();
                pendingUrl = String(url);
                var u = pendingUrl;
                if (u.indexOf('/api/') > -1 || u.indexOf('api/') === 0) {
                    // 标记本地处理, 不真正打开
                    xhr.__local = true;
                    return;
                }
                return openMethod.apply(this, arguments);
            };
            xhr.send = function (body) {
                if (xhr.__local && pendingUrl) {
                    var opts = { method: pendingMethod, body: body ? String(body) : null };
                    try {
                        var p = route(pendingUrl, opts);
                        p.then(function (resp) {
                            return resp.json();
                        }).then(function (data) {
                            var text = JSON.stringify(data);
                            try {
                                Object.defineProperty(xhr, 'readyState', { get: function () { return 4; }, configurable: true });
                                Object.defineProperty(xhr, 'status', { get: function () { return 200; }, configurable: true });
                                Object.defineProperty(xhr, 'responseText', { get: function () { return text; }, configurable: true });
                                Object.defineProperty(xhr, 'response', { get: function () { return text; }, configurable: true });
                                if (xhr.onreadystatechange) xhr.onreadystatechange();
                                if (xhr.onload) xhr.onload();
                            } catch (e) {}
                        });
                    } catch (e) {
                        try {
                            Object.defineProperty(xhr, 'readyState', { get: function () { return 4; }, configurable: true });
                            Object.defineProperty(xhr, 'status', { get: function () { return 500; }, configurable: true });
                            if (xhr.onreadystatechange) xhr.onreadystatechange();
                        } catch (e2) {}
                    }
                    return;
                }
                return sendMethod.apply(this, arguments);
            };
            return xhr;
        }
        LocalXHR.prototype = OrigXHR.prototype;
        window.XMLHttpRequest = LocalXHR;
    }

    // 预置 localStorage 用户信息（兼容 ensureUserId / watermark）
    try {
        var db = loadDB();
        localStorage.setItem('user_id', String(db.user.id));
        localStorage.setItem('username', db.user.username);
        localStorage.setItem('real_name', db.user.real_name);
        localStorage.setItem('tax_id', db.user.tax_id);
        localStorage.setItem('satoken', 'local-token');
        localStorage.setItem('watermark_enabled', '0');
        localStorage.setItem('employer_count', String(db.user.employer_count || 0));
        localStorage.setItem('family_count', String(db.user.family_count || 0));
        localStorage.setItem('bank_card_count', String(db.user.bank_card_count || 1));
        localStorage.setItem('gender', String(db.user.gender || '1'));
    } catch (e) {}

    console.log('[local_api] 本地数据层已加载，完全离线模式');


// ===== 强制覆盖 authFetch (无论 auth.js 何时加载) =====
(function () {
    function localAuthFetch(url, options) {
        var u = String(url);
        if (u.indexOf('/api/') > -1 || u.indexOf('api/') === 0) {
            return route(u, options);
        }
        return originalFetch(u, options);
    }
    // 立即覆盖
    window.authFetch = localAuthFetch;
    // 供页面在本地改写记录后, 按累计预扣法重算某一年税额
    window.recalcYearTax = recalcYearTax;
    // 延迟覆盖(等 auth.js 加载后)
    setTimeout(function () { window.authFetch = localAuthFetch; }, 0);
    setTimeout(function () { window.authFetch = localAuthFetch; }, 500);
    setTimeout(function () { window.authFetch = localAuthFetch; }, 1500);
})();

})();
