/**
 * authFetch - 基于 Sa-Token 的认证 Fetch 包装
 * 确保请求带有认证信息
 */
(function () {
    'use strict';

    var SATOKEN_KEY = 'satoken';

    function getToken() {
        return localStorage.getItem(SATOKEN_KEY);
    }

    /**
     * 认证请求包装
     * @param {string} url - 请求URL
     * @param {object} options - fetch 选项
     * @returns {Promise}
     */
    window.authFetch = function authFetch(url, options) {
        var opts = options || {};
        opts.credentials = 'same-origin';

        var token = getToken();
        if (token && token !== 'null' && token !== 'undefined') {
            var separator = url.indexOf('?') !== -1 ? '&' : '?';
            url = url + separator + 'satoken=' + encodeURIComponent(token);
        }

        return window.fetch(url, opts).then(function (response) {
            var newToken = response.headers.get('satoken');
            if (newToken && newToken !== 'null' && newToken !== 'undefined') {
                localStorage.setItem(SATOKEN_KEY, newToken);
            }
            return response;
        });
    };
})();