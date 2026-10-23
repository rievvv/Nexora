/* =========================================================
   NEXORA - PENERJEMAH WEB OTOMATIS
   Bahasa: Indonesia (utama), English, العربية, 中文
   Memakai Google Website Translator (butuh koneksi internet).
   Pilihan bahasa tersimpan & dipakai lagi setelah refresh.
   ========================================================= */
(function () {
    'use strict';
    var LANGS = {
        'id':    { name: 'Bahasa Indonesia', code: 'ID' },
        'en':    { name: 'English',          code: 'EN' },
        'ar':    { name: 'العربية',           code: 'AR' },
        'zh-CN': { name: '中文 (简体)',        code: '中文' }
    };
    var KEY = 'nex_lang';
    var cur = 'id';
    try { var sv = localStorage.getItem(KEY); if (sv && LANGS[sv]) cur = sv; } catch (e) {}
    var scriptRequested = false, widgetReady = false, failed = false;

    var $ = function (id) { return document.getElementById(id); };

    function markNoTranslate() {
        document.querySelectorAll('.logo-crop, .logo-subtitle, .portal-logo-wrap, .portal-tagline, .footer-text strong, .social-links, .lang-switcher')
            .forEach(function (el) { el.setAttribute('translate', 'no'); el.classList.add('notranslate'); });
    }

    window.googleTranslateElementInit = function () {
        try {
            new google.translate.TranslateElement({
                pageLanguage: 'id',
                includedLanguages: 'id,en,ar,zh-CN',
                autoDisplay: false
            }, 'google_translate_element');
            widgetReady = true;
            if (cur !== 'id') applyWhenReady(cur, 0);
        } catch (e) { fail(); }
    };

    function loadWidget() {
        if (scriptRequested) return;
        scriptRequested = true;
        var s = document.createElement('script');
        s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        s.async = true;
        s.onerror = fail;
        document.head.appendChild(s);
    }

    function fail() {
        if (failed) return;
        failed = true;
        if (typeof window.customAlert === 'function') {
            window.customAlert('Fitur terjemahan membutuhkan koneksi internet. Periksa koneksi Anda lalu pilih bahasa lagi.');
        }
        scriptRequested = false; failed = false; // izinkan coba lagi
    }

    function combo() { return document.querySelector('select.goog-te-combo'); }
    function fire(el, ev) { var e = document.createEvent('HTMLEvents'); e.initEvent(ev, true, true); el.dispatchEvent(e); }
    function apply(lang) {
        var c = combo();
        if (!c) return false;
        c.value = lang;
        fire(c, 'change'); fire(c, 'change');
        return true;
    }
    function applyWhenReady(lang, n) {
        if (lang !== cur) return;                     // pengguna sudah memilih bahasa lain
        if (apply(lang)) return;
        if (n < 60) setTimeout(function () { applyWhenReady(lang, n + 1); }, 250);
    }

    function updateUI() {
        var label = $('lang-current'); if (label) label.textContent = LANGS[cur].code;
        document.querySelectorAll('#lang-menu li').forEach(function (li) {
            li.classList.toggle('active', li.getAttribute('data-lang') === cur);
            li.setAttribute('aria-selected', li.getAttribute('data-lang') === cur ? 'true' : 'false');
        });
        document.documentElement.setAttribute('data-lang', cur);
    }

    function setLang(lang) {
        if (!LANGS[lang]) return;
        cur = lang;
        try { localStorage.setItem(KEY, lang); } catch (e) {}
        updateUI();
        if (lang !== 'id' || widgetReady) {
            loadWidget();
            applyWhenReady(lang, 0);
        }
    }

    function init() {
        markNoTranslate();
        updateUI();
        var btn = $('lang-btn'), menu = $('lang-menu'), box = $('lang-switcher');
        if (btn && menu) {
            var close = function () { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = box.classList.toggle('open');
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            menu.addEventListener('click', function (e) {
                var li = e.target.closest('li[data-lang]');
                if (!li) return;
                setLang(li.getAttribute('data-lang'));
                close();
            });
            document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
        }
        if (cur !== 'id') { loadWidget(); }
    }

    window.NexLang = { set: setLang, get: function () { return cur; } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();