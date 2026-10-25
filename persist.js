/* global workersDB, customersDB, videosDB, productsDB, ordersDB, financeDB, bannersDB, chatsDB, payoutsDB, presenceDB, meetingRoomsDB, meetingsDB, vouchersDB */
/* =========================================================
   NEXORA - PENYIMPANAN PERMANEN + SINKRONISASI CLOUD
   - Semua database (user, produk, video, banner, pesanan, keuangan, chat)
     disimpan otomatis dan dimuat ulang saat halaman dibuka.
   - MODE LOKAL  : bila cloud-config.js kosong -> data hanya di browser
                   perangkat itu (IndexedDB). Perangkat lain TIDAK melihatnya.
   - MODE CLOUD  : bila cloud-config.js diisi (Supabase) -> data & file
                   (gambar/video/audio/dokumen) diunggah ke cloud dan
                   digabung otomatis antar perangkat (PC, HP, dll).
   - Aplikasi (script.js) baru dijalankan SETELAH data selesai dimuat.
   ========================================================= */
(function () {
    'use strict';

    var DB_NAME = 'nexora-storage', DB_VER = 1;
    var STATE_KEY = 'state';
    var COLS = ['workersDB', 'customersDB', 'videosDB', 'productsDB', 'ordersDB', 'financeDB', 'bannersDB', 'chatsDB', 'payoutsDB', 'presenceDB', 'meetingRoomsDB', 'meetingsDB', 'vouchersDB'];

    var CFG = window.NEX_CLOUD || {};
    var CLOUD = !!(CFG.url && CFG.anonKey && /^https?:\/\//.test(CFG.url));
    var BUCKET = CFG.bucket || 'nexora-files';
    var BASE = CLOUD ? String(CFG.url).replace(/\/+$/, '') : '';
    var POLL_MS = CFG.pollMs || 4000;

    var idb = null;
    var urlToKey = new Map();    // blob:URL -> kunci IndexedDB (mode lokal)
    var urlToCloud = new Map();  // blob:/data: -> URL publik cloud (mode cloud)
    var lastJson = '';
    var saving = false, again = false, saveTimer = null;
    var snap = {}, tombs = [], initialized = false;
    var lastSig = '', lastLocalSig = '', transient = false;

    /* ---------- state: baca & tulis variabel global dari data.js ---------- */
    function getState() {
        return {
            workersDB: workersDB, customersDB: customersDB, videosDB: videosDB,
            productsDB: productsDB, ordersDB: ordersDB, financeDB: financeDB,
            bannersDB: bannersDB, chatsDB: chatsDB,
            payoutsDB: (typeof payoutsDB !== 'undefined') ? payoutsDB : [],
            presenceDB: (typeof presenceDB !== 'undefined') ? presenceDB : [],
            meetingRoomsDB: (typeof meetingRoomsDB !== 'undefined') ? meetingRoomsDB : [],
            meetingsDB: (typeof meetingsDB !== 'undefined') ? meetingsDB : [],
            vouchersDB: (typeof vouchersDB !== 'undefined') ? vouchersDB : []
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
        if (Array.isArray(o.payoutsDB) && typeof payoutsDB !== 'undefined') payoutsDB = o.payoutsDB;
        if (Array.isArray(o.presenceDB) && typeof presenceDB !== 'undefined') presenceDB = o.presenceDB;
        if (Array.isArray(o.meetingRoomsDB) && typeof meetingRoomsDB !== 'undefined') meetingRoomsDB = o.meetingRoomsDB;
        if (Array.isArray(o.meetingsDB) && typeof meetingsDB !== 'undefined') meetingsDB = o.meetingsDB;
        if (Array.isArray(o.vouchersDB) && typeof vouchersDB !== 'undefined') vouchersDB = o.vouchersDB;
    }
    function liveSig() { try { return JSON.stringify(getState()); } catch (e) { return String(Math.random()); } }

    /* ---------- JSON kanonik (urutan key diabaikan; jsonb cloud mengacak urutan) ---------- */
    function canon(v) {
        if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
        if (v && typeof v === 'object') {
            return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
        }
        return JSON.stringify(v === undefined ? null : v);
    }

    /* ---------- penanda perubahan per-record (_u) & catatan penghapusan ---------- */
    function recJson(r) { return JSON.stringify(r, function (k, v) { return k === '_u' ? undefined : v; }); }
    function eachRec(fn) {
        var st = getState();
        COLS.forEach(function (c) {
            (st[c] || []).forEach(function (r) { if (r && typeof r === 'object' && r.id) fn(c, r); });
        });
    }
    function rebuildSnap() {
        snap = {};
        eachRec(function (c, r) { snap[c + ':' + r.id] = recJson(r); });
        initialized = true;
    }
    function stamp() {
        if (!initialized) return;
        var now = Date.now(), seen = {};
        eachRec(function (c, r) {
            var k = c + ':' + r.id, j = recJson(r);
            seen[k] = 1;
            if (snap[k] !== j) { r._u = now; snap[k] = j; }
        });
        Object.keys(snap).forEach(function (k) {
            if (!seen[k]) { tombs.push({ k: k, t: now }); delete snap[k]; }
        });
        if (tombs.length > 1500) tombs = tombs.slice(-1000);
    }

    /* ---------- gabung dua state (lokal + cloud) tanpa saling menimpa ---------- */
    function merge(a, b) {
        a = a || {}; b = b || {};
        var tomb = {};
        (a._tomb || []).concat(b._tomb || []).forEach(function (t) { if (!tomb[t.k] || tomb[t.k] < t.t) tomb[t.k] = t.t; });
        var out = {};
        COLS.forEach(function (c) {
            var m = {}, order = [];
            (b[c] || []).concat(a[c] || []).forEach(function (r) {
                if (!r || !r.id) return;
                var o = m[r.id];
                if (!o) { m[r.id] = r; order.push(r.id); }
                else if ((r._u || 0) > (o._u || 0)) m[r.id] = r;
            });
            var arr = [];
            order.forEach(function (id) {
                var r = m[id], t = tomb[c + ':' + id];
                if (t && t > (r._u || 0)) return;
                arr.push(r);
            });
            if (c === 'chatsDB') arr.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
            if (c === 'payoutsDB') arr.sort(function (x, y) { return (y.requestedAt || 0) - (x.requestedAt || 0); });
            if (c === 'ordersDB') arr.sort(function (x, y) { return (y.createdAt || 0) - (x.createdAt || 0); });
            out[c] = arr;
        });
        var tl = Object.keys(tomb).map(function (k) { return { k: k, t: tomb[k] }; });
        tl.sort(function (x, y) { return y.t - x.t; });
        out._tomb = tl.slice(0, 1000);
        return out;
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

    /* ---------- Cloud (Supabase REST + Storage) ---------- */
    function hdrs(extra) {
        var h = { apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey };
        if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
        return h;
    }
    var remoteAt = 0;   // waktu update terakhir data cloud yang sudah kita ketahui (ms)
    async function remoteGet() {
        var r = await fetch(BASE + '/rest/v1/nexora_kv?key=eq.' + STATE_KEY + '&select=value,updated_at', { headers: hdrs(), cache: 'no-store' });
        if (!r.ok) throw new Error('cloud get ' + r.status);
        var a = await r.json();
        if (a.length) remoteAt = Date.parse(a[0].updated_at) || remoteAt;
        return a.length ? a[0].value : null;
    }
    // Cek ringan (hanya kolom updated_at, beberapa byte) apakah ada perubahan dari perangkat lain
    async function remoteChanged() {
        var r = await fetch(BASE + '/rest/v1/nexora_kv?key=eq.' + STATE_KEY + '&select=updated_at', { headers: hdrs(), cache: 'no-store' });
        if (!r.ok) throw new Error('cloud stamp ' + r.status);
        var a = await r.json();
        if (!a.length) return false;
        return (Date.parse(a[0].updated_at) || 0) !== remoteAt;
    }
    async function remotePut(val) {
        var stampIso = new Date().toISOString();
        var r = await fetch(BASE + '/rest/v1/nexora_kv', {
            method: 'POST',
            headers: hdrs({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
            body: JSON.stringify([{ key: STATE_KEY, value: val, updated_at: stampIso }])
        });
        if (!r.ok) throw new Error('cloud put ' + r.status);
        remoteAt = Date.parse(stampIso) || remoteAt;
    }
    function extOf(blob) {
        var t = String(blob.type || '').split('/')[1] || '';
        t = t.split(/[;+]/)[0].replace(/[^a-z0-9]/gi, '');
        return t === 'jpeg' ? 'jpg' : t;
    }
    async function uploadBlob(blob) {
        var ext = extOf(blob);
        var path = 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + (ext ? '.' + ext : '');
        var r = await fetch(BASE + '/storage/v1/object/' + BUCKET + '/' + path, {
            method: 'POST',
            headers: hdrs({ 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true' }),
            body: blob
        });
        if (!r.ok) throw new Error('cloud upload ' + r.status);
        return BASE + '/storage/v1/object/public/' + BUCKET + '/' + path;
    }
    function withTimeout(p, ms) {
        return new Promise(function (resolve, reject) {
            var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
            p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
        });
    }

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

    /* ---------- SIMPAN: blob/data URL -> "idb:xxx" (lokal) atau URL cloud ---------- */
    async function freeze(v, used) {
        if (typeof v === 'string') {
            var isBlob = v.indexOf('blob:') === 0;
            var isData = CLOUD && v.indexOf('data:') === 0 && v.length > 200;
            if (CLOUD && (isBlob || isData)) {
                transient = true;
                var cu = urlToCloud.get(v);
                if (!cu) {
                    var blob;
                    try { blob = await (await fetch(v)).blob(); } catch (e) { return ''; }
                    cu = await uploadBlob(blob);   // gagal -> lempar error, dicoba lagi siklus berikut
                    urlToCloud.set(v, cu);
                }
                return cu;
            }
            if (isBlob) {
                var key = urlToKey.get(v);
                if (!key) {
                    try {
                        var b2 = await (await fetch(v)).blob();
                        key = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                        await idbPut('blobs', key, b2);
                        urlToKey.set(v, key);
                    } catch (e) { return ''; }
                }
                used[key] = 1;
                return 'idb:' + key;
            }
            return v;
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

    /* ---------- sinkronisasi cloud ---------- */
    async function syncCloud(force) {
        var sig0 = liveSig();
        if (!force && sig0 === lastSig) return;
        transient = false;
        var lf = await freeze(getState(), {});
        lf._tomb = tombs.slice();
        var remote = await remoteGet();
        var merged = merge(lf, remote);
        if (!remote || canon(remote) !== canon(merged)) await remotePut(merged);

        var changed = [];
        COLS.forEach(function (c) { if (canon(merged[c]) !== canon(lf[c])) changed.push(c); });

        // Terapkan hasil gabungan hanya jika pengguna tidak sedang mengubah data selama proses sinkron
        if (liveSig() === sig0) {
            if (changed.length || transient) { setState(merged); tombs = merged._tomb || []; rebuildSnap(); }
            lastSig = liveSig();
        }
        if (idb) {
            try {
                await idbPut('kv', STATE_KEY, merged);
                var ks = await idbKeys('blobs');
                for (var i = 0; i < ks.length; i++) await idbDel('blobs', ks[i]);
            } catch (e) { /* cache lokal opsional */ }
        }
        if (changed.length && typeof window.NexRefresh === 'function') {
            try { window.NexRefresh(changed); } catch (e) {}
        }
    }

    async function saveLocal() {
        var used = {};
        var frozen = await freeze(getState(), used);
        frozen._tomb = tombs.slice();
        var json = JSON.stringify(frozen);
        if (json !== lastJson) { await idbPut('kv', STATE_KEY, frozen); lastJson = json; }
        var keys = await idbKeys('blobs');
        for (var i = 0; i < keys.length; i++) { if (!used[keys[i]]) await idbDel('blobs', keys[i]); }
    }

    async function saveNow(force) {
        if (!idb && !CLOUD) return;
        if (saving) { again = true; return; }
        saving = true;
        try {
            stamp();
            if (CLOUD) await syncCloud(force);
            else {
                var sg = liveSig();
                if (force || sg !== lastLocalSig) { await saveLocal(); lastLocalSig = sg; }
            }
        } catch (e) { /* abaikan; coba lagi di siklus berikutnya */ }
        saving = false;
        if (again) { again = false; saveNow(); }
    }

    function scheduleSave(ms, force) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () { saveNow(force); }, ms == null ? 300 : ms);
    }

    function startAutoSave() {
        var evDelay = CLOUD ? 900 : 350;
        ['click', 'change', 'input', 'keyup', 'touchend'].forEach(function (ev) {
            document.addEventListener(ev, function () { scheduleSave(evDelay); }, true);
        });
        // Pengaman + penarik data terbaru dari perangkat lain.
        // Ringan: bila tidak ada perubahan lokal, hanya cek penanda waktu cloud (bukan seluruh data).
        // Ditunda saat transisi halaman / jari sedang menyentuh layar agar tidak patah di iPhone.
        var touching = false, lastRemoteCheck = 0;
        document.addEventListener('touchstart', function () { touching = true; }, { passive: true, capture: true });
        document.addEventListener('touchend', function () { touching = false; }, { passive: true, capture: true });
        document.addEventListener('touchcancel', function () { touching = false; }, { passive: true, capture: true });
        var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 60); };
        setInterval(function () {
            if (document.hidden || touching || saving || document.body.classList.contains('is-transitioning')) return;
            idle(async function () {
                if (!CLOUD) { scheduleSave(0, false); return; }
                if (liveSig() !== lastSig) { scheduleSave(0, false); return; }          // ada perubahan lokal
                var now = Date.now();
                if (now - lastRemoteCheck < POLL_MS - 200) return;
                lastRemoteCheck = now;
                try { if (await remoteChanged()) scheduleSave(0, true); } catch (e) { /* offline */ }
            });
        }, CLOUD ? POLL_MS : 3000);
        document.addEventListener('visibilitychange', function () { scheduleSave(0, true); });
        window.addEventListener('pagehide', function () { scheduleSave(0, true); });
        window.addEventListener('beforeunload', function () { scheduleSave(0, true); });
        scheduleSave(0, true);
    }

    /* ---------- BOOT ---------- */
    async function init() {
        var hadCache = false;
        try {
            idb = await openDB();
            var stored = await idbGet('kv', STATE_KEY);
            if (stored) {
                var live = await revive(stored);
                tombs = Array.isArray(live._tomb) ? live._tomb : [];
                setState(live);
                hadCache = true;
                lastJson = JSON.stringify(stored);
            }
            if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }
        } catch (e) {
            idb = null;
        }
        // Ada cache lokal -> langsung tampil (cloud digabung di latar belakang oleh sinkron pertama).
        // Belum ada cache (kunjungan pertama di perangkat ini) -> tunggu cloud paling lama 2,5 detik.
        if (CLOUD && !hadCache) {
            try {
                var remote = await withTimeout(remoteGet(), 2500);
                if (remote) {
                    var local = getState(); local._tomb = tombs;
                    var merged = merge(local, remote);
                    setState(merged); tombs = merged._tomb || [];
                }
            } catch (e) { /* offline / lambat: lanjut, sinkron menyusul */ }
        }
        rebuildSnap();
    }

    window.NexStore = {
        save: function () { return saveNow(true); },
        isCloud: function () { return CLOUD; },
        // Hapus data tersimpan DI PERANGKAT INI saja (data cloud tidak ikut terhapus)
        reset: async function () {
            if (idb) { await idbDel('kv', STATE_KEY); var k = await idbKeys('blobs'); for (var i = 0; i < k.length; i++) await idbDel('blobs', k[i]); }
            try { localStorage.removeItem('nex_session'); } catch (e) {}
            location.reload();
        }
    };

    function boot() {
        var run = function () {
            if (typeof window.NexBoot === 'function') window.NexBoot();
            if (idb || CLOUD) startAutoSave();
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
        else run();
    }

    init().then(boot, boot);
})();