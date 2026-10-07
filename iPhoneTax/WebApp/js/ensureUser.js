/**
 * Sa-Token fetch 包装 & 用户认证
 * 1. 包装 fetch，自动在 URL 参数中附加 satoken
 * 2. 响应时检查 satoken 响应头并更新 localStorage
 * 3. 确保用户已登录，如果 localStorage 中没有 user_id，则从服务端获取
 */
(function () {
    'use strict';

    var SATOKEN_KEY = 'satoken';
    var LOGIN_URL = 'login.html';

    // ========== Token 管理 ==========

    function getToken() {
        return localStorage.getItem(SATOKEN_KEY);
    }

    function setToken(token) {
        if (token && token !== 'null' && token !== 'undefined') {
            localStorage.setItem(SATOKEN_KEY, token);
        }
    }

    // 在 URL 中附加 token 参数
    function appendTokenToUrl(url) {
        var token = getToken();
        if (!token || url.indexOf('satoken=') !== -1) return url;
        var separator = url.indexOf('?') !== -1 ? '&' : '?';
        return url + separator + 'satoken=' + encodeURIComponent(token);
    }

    // ========== 包装 fetch ==========

    var originalFetch = window.fetch;
    window.fetch = function (url, options) {
        var opts = options || {};
        opts.credentials = 'same-origin';
        url = appendTokenToUrl(url);

        return originalFetch(url, opts).then(function (response) {
            // 检查响应头中的 satoken，更新本地存储
            var newToken = response.headers.get('satoken');
            if (newToken) {
                setToken(newToken);
            }

            // 401 或重定向到登录页，清理存储
            if (response.status === 401 || (response.redirected && response.url && response.url.indexOf(LOGIN_URL) !== -1)) {
                localStorage.removeItem('user_id');
                localStorage.removeItem('username');
                localStorage.removeItem('real_name');
                localStorage.removeItem('tax_id');
                localStorage.removeItem(SATOKEN_KEY);
                if (response.url && response.url.indexOf(LOGIN_URL) !== -1) {
                    window.location.href = response.url;
                }
            }

            return response;
        }).catch(function (error) {
            console.error('Fetch error:', error);
            return Promise.reject(error);
        });
    };

    // ========== 用户认证 ==========

    /**
     * 确保用户已登录，如果 localStorage 中没有 user_id，则从服务端获取
     * @param {function} callback - 回调函数，参数为 userId，获取失败则为 null
     */
    window.ensureUserId = function ensureUserId(callback) {
        var userId = localStorage.getItem('user_id');
        if (userId) {
            // 水印刷新
            if (typeof watermarkRefresh === 'function') {
                watermarkRefresh();
            }
            callback(userId);
            return;
        }
        fetch('api/current_user.php')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.code === 200) {
                    localStorage.setItem('user_id', data.data.user_id);
                    localStorage.setItem('username', data.data.username);
                    localStorage.setItem('real_name', data.data.real_name);
                    localStorage.setItem('tax_id', data.data.tax_id || '');
                    // 水印刷新
                    if (typeof watermarkRefresh === 'function') {
                        watermarkRefresh();
                    }
                    callback(data.data.user_id);
                } else {
                    window.location.href = LOGIN_URL;
                }
            })
            .catch(function () {
                window.location.href = LOGIN_URL;
            });
    };

    // 暴露方法
    window.getSaToken = getToken;
    window.setSaToken = setToken;
})();
