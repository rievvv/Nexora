/* global workersDB, customersDB, videosDB, productsDB, ordersDB, financeDB, bannersDB, chatsDB */
/* =========================================================
   NEXORA - PENYIMPANAN PERMANEN (IndexedDB)
   - Semua database (user, produk, video, banner, pesanan, keuangan, chat)
     disimpan otomatis di browser dan dimuat ulang saat halaman dibuka.
   - File upload (gambar, video, audio, dokumen) disimpan sebagai Blob,
     jadi tidak hilang walau halaman di-refresh.
   - Aplikasi (script.js) baru dijalankan SETELAH data selesai dimuat.
   ========================================================= */
(function () {
    'use strict';

    var DB_NAME = 'nexora-storage', DB_VER = 1;
    var STATE_KEY = 'state';
    var idb = null;
    var urlToKey = new Map();   // blob:URL  -> kunci di IndexedDB
    var lastJson = '';
    var saving = false, again = false, saveTimer = null;

    /* ---------- state: baca & tulis variabel global dari data.js ---------- */
    function getState() {
        return {
            workersDB: workersDB, customersDB: customersDB, videosDB: videosDB,
            productsDB: productsDB, ordersDB: ordersDB, financeDB: financeDB,
            bannersDB: bannersDB, chatsDB: chatsDB
        };
    }
    function setState(o) {
        if (Array.isArray(o.workersDB)) workersDB = o.workersDB;
        if (Array.isArray(o.customersDB)) customersDB = o.customersDB;
        if (Array.isArray(o.videosDB)) videosDB = o.videosDB;
        if (Array.isArray(o.productsDB)) productsDB = o.productsDB;
        if (Array.isArray(o.ordersDB)) ordersDB = o.ordersDB;
        if (Array.isArray(o.financeDB)) financeDB = o.financeDB;
        if (Array.isArray(o.bannersDB)) bannersDB = o.bannersDB;
        if (Array.isArray(o.chatsDB)) chatsDB = o.chatsDB;
    }

    /* ---------- IndexedDB helper ---------- */
    function openDB() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) { reject(new Error('IndexedDB tidak tersedia')); return; }
            var rq = indexedDB.open(DB_NAME, DB_VER);
            rq.onupgradeneeded = function () {
                var d = rq.result;
                if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
                if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
            };
            rq.onsuccess = function () { resolve(rq.result); };
            rq.onerror = function () { reject(rq.error); };
        });
    }
    function tx(store, mode, fn) {
        return new Promise(function (resolve, reject) {
            var t = idb.transaction(store, mode);
            var out = fn(t.objectStore(store));
            t.oncomplete = function () { resolve(out && out.result); };
            t.onerror = t.onabort = function () { reject(t.error); };
        });
    }
    function idbGet(store, key) { return tx(store, 'readonly', function (s) { return s.get(key); }); }
    function idbPut(store, key, val) { return tx(store, 'readwrite', function (s) { return s.put(val, key); }); }
    function idbDel(store, key) { return tx(store, 'readwrite', function (s) { return s.delete(key); }); }
    function idbKeys(store) { return tx(store, 'readonly', function (s) { return s.getAllKeys(); }); }

    /* ---------- MUAT: ganti "idb:xxx" menjadi blob URL baru ---------- */
    async function revive(v) {
        if (typeof v === 'string' && v.indexOf('idb:') === 0) {
            var key = v.slice(4);
            try {
                var blob = await idbGet('blobs', key);
                if (!blob) return '';
                var url = URL.createObjectURL(blob);
                urlToKey.set(url, key);
                return url;
            } catch (e) { return ''; }
        }
        if (Array.isArray(v)) {
            var arr = [];
            for (var i = 0; i < v.length; i++) arr.push(await revive(v[i]));
            return arr;
        }
        if (v && typeof v === 'object') {
            var obj = {};
            var ks = Object.keys(v);
            for (var j = 0; j < ks.length; j++) obj[ks[j]] = await revive(v[ks[j]]);
            return obj;
        }
        return v;
    }

    /* ---------- SIMPAN: ganti blob URL menjadi "idb:xxx" ---------- */
    async function freeze(v, used) {
        if (typeof v === 'string' && v.indexOf('blob:') === 0) {
            var key = urlToKey.get(v);
            if (!key) {
                try {
                    var blob = await (await fetch(v)).blob();
                    key = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                    await idbPut('blobs', key, blob);
                    urlToKey.set(v, key);
                } catch (e) { return ''; }
            }
            used[key] = 1;
            return 'idb:' + key;
        }
        if (Array.isArray(v)) {
            var arr = [];
            for (var i = 0; i < v.length; i++) arr.push(await freeze(v[i], used));
            return arr;
        }
        if (v && typeof v === 'object') {
            var obj = {};
            var ks = Object.keys(v);
            for (var j = 0; j < ks.length; j++) obj[ks[j]] = await freeze(v[ks[j]], used);
            return obj;
        }
        return v;
    }

    async function saveNow() {
        if (!idb) return;
        if (saving) { again = true; return; }
        saving = true;
        try {
            var used = {};
            var frozen = await freeze(getState(), used);
            var json = JSON.stringify(frozen);
            if (json !== lastJson) {
                await idbPut('kv', STATE_KEY, frozen);
                lastJson = json;
            }
            // bersihkan file yang sudah tidak dipakai
            var keys = await idbKeys('blobs');
            for (var i = 0; i < keys.length; i++) { if (!used[keys[i]]) await idbDel('blobs', keys[i]); }
        } catch (e) { /* abaikan; coba lagi di siklus berikutnya */ }
        saving = false;
        if (again) { again = false; saveNow(); }
    }

    function scheduleSave(ms) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, ms == null ? 300 : ms);
    }

    function startAutoSave() {
        // Setiap interaksi pengguna -> simpan sebentar kemudian
        ['click', 'change', 'input', 'keyup', 'touchend'].forEach(function (ev) {
            document.addEventListener(ev, function () { scheduleSave(350); }, true);
        });
        // Pengaman: cek berkala (menangkap perubahan dari timer/callback)
        setInterval(function () { scheduleSave(0); }, 2000);
        // Saat tab disembunyikan/ditutup, simpan segera
        document.addEventListener('visibilitychange', function () { if (document.hidden) scheduleSave(0); });
        window.addEventListener('pagehide', function () { scheduleSave(0); });
        window.addEventListener('beforeunload', function () { scheduleSave(0); });
        scheduleSave(0); // simpan kondisi awal (termasuk data bawaan data.js)
    }

    /* ---------- BOOT ---------- */
    async function init() {
        try {
            idb = await openDB();
            var stored = await idbGet('kv', STATE_KEY);
            if (stored) {
                var live = await revive(stored);
                setState(live);
                lastJson = JSON.stringify(stored);
            }
            if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }
        } catch (e) {
            idb = null; // penyimpanan tidak tersedia -> aplikasi tetap jalan tanpa penyimpanan
        }
    }

    window.NexStore = {
        save: function () { return saveNow(); },
        // Hapus SEMUA data tersimpan (kembali ke data awal data.js)
        reset: async function () {
            if (idb) { await idbDel('kv', STATE_KEY); var k = await idbKeys('blobs'); for (var i = 0; i < k.length; i++) await idbDel('blobs', k[i]); }
            try { localStorage.removeItem('nex_session'); } catch (e) {}
            location.reload();
        }
    };

    function boot() {
        var run = function () {
            if (typeof window.NexBoot === 'function') window.NexBoot();
            if (idb) startAutoSave();
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
        else run();
    }

    init().then(boot, boot);
})();