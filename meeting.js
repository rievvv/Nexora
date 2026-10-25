/* =========================================================
   NEXORA - MEETING ROOM
   Video/audio (WebRTC), share screen, whiteboard, chat, undang via ID Nexora,
   rekam (Admin) + watermark ID Admin, database rekaman, hapus (password).
   Sinyal antar peserta: Supabase Realtime Broadcast (antar-perangkat, memakai cloud-config.js)
   + BroadcastChannel (antar-tab di browser yang sama). Daftar room & rekaman disimpan di
   meetingRoomsDB / meetingsDB (ikut tersinkron lewat persist.js).
   ========================================================= */
(function () {
    'use strict';
    function boot() { try { run(); } catch (e) { console.error('Meeting Room error:', e); } }
    if (window.__nexAppReady) boot(); else document.addEventListener('nex:ready', boot, { once: true });

    function run() {
        const DELETE_PASSWORD = '070809';
        const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
        const $ = (id) => document.getElementById(id);
        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const pad = (n) => String(n).padStart(2, '0');
        const fmtDur = (s) => { s = Math.max(0, Math.floor(s)); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };
        const fmtSize = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
        const alertBox = (m) => window.customAlert ? window.customAlert(m) : alert(m);
        const adminIdNow = () => (window.__nexAdminId ? window.__nexAdminId() : '') || 'ADMIN';
        const loadReg = () => { const o = {}; (typeof meetingRoomsDB !== 'undefined' ? meetingRoomsDB : []).forEach(r => { o[r.id] = r; }); return o; };

        /* ---------- Transport sinyal: Realtime (antar-perangkat) + BroadcastChannel (antar-tab) ---------- */
        const CFG = window.NEX_CLOUD || {};
        const RT_URL = (function () {
            const u = CFG.realtimeUrl || CFG.url || '';
            if (!/^https?:\/\//.test(u) || !CFG.anonKey) return '';
            return u.replace(/\/+$/, '').replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(CFG.anonKey) + '&vsn=1.0.0';
        })();
        const seenIds = new Set();
        let wsRef = 1;
        function openChannel(name, onmsg) {
            const ch = { name: name, topic: 'realtime:nexmeet-' + name, ws: null, joined: false, queue: [], closed: false, bc: null, hb: null, onmsg: onmsg };
            const recv = (m) => {
                if (!m || !m._id || seenIds.has(m._id)) return;
                seenIds.add(m._id); if (seenIds.size > 800) { seenIds.delete(seenIds.values().next().value); }
                try { ch.onmsg(m); } catch (e) { console.warn('meeting recv', e); }
            };
            try { ch.bc = new BroadcastChannel('nexmeet-' + name); ch.bc.onmessage = (e) => recv(e.data); } catch (e) { ch.bc = null; }
            const connect = () => {
                if (!RT_URL || ch.closed) return;
                let ws;
                try { ws = new WebSocket(RT_URL); } catch (e) { return; }
                ch.ws = ws;
                ws.onopen = () => {
                    ws.send(JSON.stringify({ topic: ch.topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } }, ref: String(wsRef++), join_ref: '1' }));
                    ch.hb = setInterval(() => { try { ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(wsRef++) })); } catch (e) {} }, 25000);
                };
                ws.onmessage = (ev) => {
                    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
                    if (m.topic !== ch.topic) return;
                    if (m.event === 'phx_reply' && m.payload && m.payload.status === 'ok' && !ch.joined) { ch.joined = true; ch.queue.splice(0).forEach(q => sendWs(q)); }
                    else if (m.event === 'broadcast' && m.payload && m.payload.event === 'sig') recv(m.payload.payload);
                };
                ws.onclose = () => { clearInterval(ch.hb); ch.joined = false; if (!ch.closed) setTimeout(connect, 2500); };
                ws.onerror = () => {};
            };
            const sendWs = (msg) => { try { ch.ws.send(JSON.stringify({ topic: ch.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'sig', payload: msg }, ref: String(wsRef++) })); } catch (e) {} };
            ch.send = (msg) => {
                msg._id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
                seenIds.add(msg._id);
                if (ch.bc) { try { ch.bc.postMessage(msg); } catch (e) {} }
                if (RT_URL) { if (ch.joined) sendWs(msg); else if (ch.queue.length < 300) ch.queue.push(msg); }
            };
            ch.close = () => { ch.closed = true; clearInterval(ch.hb); try { ch.ws && ch.ws.close(); } catch (e) {} try { ch.bc && ch.bc.close(); } catch (e) {} };
            connect();
            return ch;
        }

        /* ---------- Lobi: upsert room + kehadiran (jumlah peserta) ---------- */
        const live = {};                       // roomId -> { peerId: lastSeenMs }
        let lobbyCh = null;
        function onLobby(m) {
            if (m.type === 'room' && m.data) upsertRoom(m.data);
            else if (m.type === 'presence') { live[m.room] = live[m.room] || {}; if (m.left) delete live[m.room][m.peer]; else live[m.room][m.peer] = Date.now(); }
            else if (m.type === 'end' && cur && m.room === cur.roomId) endedByAdmin(false);
        }
        function ensureLobby() { if (!lobbyCh) lobbyCh = openChannel('lobby', onLobby); return lobbyCh; }
        const lobbySend = (type, data, extra) => { try { ensureLobby().send(Object.assign({ type: type, data: data || null }, extra || {})); } catch (e) {} };
        function upsertRoom(r) {
            if (typeof meetingRoomsDB === 'undefined') return;
            const i = meetingRoomsDB.findIndex(x => x.id === r.id);
            if (i < 0) meetingRoomsDB.push(r); else if ((r.rev || 0) >= (meetingRoomsDB[i].rev || 0)) meetingRoomsDB[i] = r;
            refreshViews();
        }
        function patchRoom(id, fn) {
            const r = loadReg()[id]; if (!r) return null;
            fn(r); r.rev = (r.rev || 0) + 1;
            lobbySend('room', JSON.parse(JSON.stringify(r)));
            return r;
        }
        function refreshViews() {
            const v = $('admin-meeting-view');
            if ($('mt-room-list') && v && v.style.display !== 'none') renderRooms();
            checkInvites();
        }
        window.nexMeetingChanged = function () { refreshViews(); if ($('mt-rec-list') && $('mt-db-pane').style.display !== 'none') renderRecs(); };
        let cur = null;               // state ruang meeting yang sedang diikuti
        let lobbyTimer = null;
        const dismissedInvites = new Set();

        /* ======================= LOBI ADMIN ======================= */
        const liveCount = (r) => Object.values(live[r.id] || {}).filter(ts => Date.now() - ts < 12000).length;

        function renderRooms() {
            const box = $('mt-room-list'); if (!box) return;
            const rooms = Object.values(loadReg()).filter(r => !r.ended && Date.now() - r.createdAt < 3 * 86400000).sort((a, b) => b.createdAt - a.createdAt);
            if (!rooms.length) { box.innerHTML = '<div class="empty-video-state">BELUM ADA ROOM MEETING AKTIF</div>'; return; }
            box.innerHTML = rooms.map(r => `
                <div class="mt-card">
                    <div class="mt-card-main">
                        <div class="mt-card-title"><span class="meet-live"></span>${esc(r.title)}</div>
                        <div class="mt-card-meta">Dibuat oleh <b>${esc(r.adminId)}</b> &bull; ⏱ <b class="mt-elapsed" data-start="${r.createdAt}">${fmtDur((Date.now() - r.createdAt) / 1000)}</b> &bull; 👥 <b class="mt-count" data-room="${r.id}">${liveCount(r)}</b> di dalam</div>
                        <div class="mt-card-inv">${(r.invited || []).length ? (r.invited || []).map(i => `<span class="mt-chip">${esc(i.name)} <small>${esc(i.id)}</small></span>`).join('') : '<span class="mt-muted">Belum ada undangan</span>'}</div>
                    </div>
                    <div class="mt-card-act"><button type="button" class="btn-futuristic" style="padding:9px 22px; font-size:0.9rem;" data-join="${r.id}">JOIN</button><button type="button" class="btn-vid-action btn-vid-del" data-end="${r.id}">AKHIRI</button></div>
                </div>`).join('');
            box.querySelectorAll('[data-join]').forEach(b => b.addEventListener('click', () => joinRoom(b.dataset.join, true)));
            box.querySelectorAll('[data-end]').forEach(b => b.addEventListener('click', () => {
                customConfirm('Akhiri room meeting ini untuk semua peserta?', () => endRoom(b.dataset.end));
            }));
        }

        function endRoom(roomId) {
            patchRoom(roomId, r => { r.ended = true; });
            lobbySend('end', null, { room: roomId });
            if (cur && cur.roomId === roomId) send('end');
            if (cur && cur.roomId === roomId) endedByAdmin(true);
            renderRooms();
        }

        function renderRecs() {
            const box = $('mt-rec-list'); if (!box) return;
            if (!meetingsDB.length) { box.innerHTML = '<div class="empty-video-state">BELUM ADA REKAMAN MEETING</div>'; return; }
            box.innerHTML = meetingsDB.slice().sort((a, b) => b.startedAt - a.startedAt).map(m => `
                <div class="mt-card">
                    <div class="mt-card-main">
                        <div class="mt-card-title">🎞️ ${esc(m.title)}</div>
                        <div class="mt-card-meta">Admin: <b>${esc(m.adminId)}</b> &bull; ${new Date(m.startedAt).toLocaleString('id-ID')} &bull; Durasi <b>${fmtDur(m.durationSec)}</b> &bull; ${fmtSize(m.size || 0)}</div>
                    </div>
                    <div class="mt-card-act">
                        <button type="button" class="btn-vid-action btn-vid-edit" data-play="${m.id}">PUTAR</button>
                        <a class="btn-vid-action btn-vid-toggle" style="text-decoration:none; text-align:center;" href="${m.url}" download="${esc(recFileName(m))}">DOWNLOAD</a>
                        <button type="button" class="btn-vid-action btn-vid-del" data-del="${m.id}">HAPUS</button>
                    </div>
                </div>`).join('');
            box.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => {
                const m = meetingsDB.find(x => x.id === b.dataset.play); if (!m) return;
                $('meet-play-title').textContent = m.title; $('meet-play-video').src = m.url; $('meet-play-modal').classList.add('active');
            }));
            box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => askDelete(b.dataset.del)));
        }
        const recFileName = (m) => 'NEXORA_Meeting_' + String(m.title).replace(/[^a-z0-9]+/gi, '_').slice(0, 40) + '_' + m.adminId + '_' + new Date(m.startedAt).toISOString().slice(0, 10) + '.webm';

        let pendingDel = null;
        function askDelete(id) {
            const m = meetingsDB.find(x => x.id === id); if (!m) return;
            customConfirm('Hapus rekaman <strong>' + esc(m.title) + '</strong> secara permanen?', () => {
                pendingDel = id;
                $('meet-pass-input').value = ''; $('meet-pass-err').style.display = 'none';
                $('meet-pass-msg').textContent = 'Masukkan password untuk menghapus rekaman "' + m.title + '".';
                $('meet-pass-modal').classList.add('active');
                setTimeout(() => $('meet-pass-input').focus(), 60);
            });
        }
        $('meet-pass-cancel').addEventListener('click', () => { pendingDel = null; $('meet-pass-modal').classList.remove('active'); });
        const doDelete = () => {
            if ($('meet-pass-input').value !== DELETE_PASSWORD) { $('meet-pass-err').style.display = 'block'; return; }
            meetingsDB = meetingsDB.filter(x => x.id !== pendingDel);
            pendingDel = null; $('meet-pass-modal').classList.remove('active');
            renderRecs(); alertBox('Rekaman meeting berhasil dihapus.');
        };
        $('meet-pass-ok').addEventListener('click', doDelete);
        $('meet-pass-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doDelete(); });
        $('meet-play-close').addEventListener('click', () => { const v = $('meet-play-video'); v.pause(); v.removeAttribute('src'); $('meet-play-modal').classList.remove('active'); });

        window.openMeetingView = function () { ensureLobby(); switchMeetingTab('rooms'); renderRooms(); renderRecs(); };
        window.switchMeetingTab = function (t) {
            $('mt-rooms-pane').style.display = t === 'rooms' ? 'block' : 'none';
            $('mt-db-pane').style.display = t === 'db' ? 'block' : 'none';
            $('mt-tab-rooms').classList.toggle('active', t === 'rooms');
            $('mt-tab-db').classList.toggle('active', t === 'db');
            if (t === 'db') renderRecs();
        };
        $('mt-create-btn').addEventListener('click', () => {
            const title = $('mt-new-title').value.trim() || 'Meeting Room';
            const id = 'ROOM-' + Date.now().toString(36).toUpperCase();
            const rec = { id: id, title: title, adminId: adminIdNow(), createdAt: Date.now(), invited: [], ended: false, rev: 1 };
            meetingRoomsDB.push(rec);
            lobbySend('room', JSON.parse(JSON.stringify(rec)));
            $('mt-new-title').value = '';
            renderRooms();
            joinRoom(id, true);
        });

        /* ======================= UNDANGAN UNTUK USER ======================= */
        function checkInvites() {
            const toast = $('meet-invite-toast'); if (!toast) return;
            const u = window.__nexUser && window.__nexUser();
            if (!u || cur) { toast.style.display = 'none'; return; }
            const room = Object.values(loadReg()).find(r => !r.ended && (r.invited || []).some(i => i.id === u.id) && !dismissedInvites.has(r.id));
            if (!room) { toast.style.display = 'none'; return; }
            toast.innerHTML = `<div class="ico">📹</div><div class="txt"><strong>Undangan Meeting</strong><span>${esc(room.title)} &bull; oleh ${esc(room.adminId)}</span></div><button type="button" class="btn-futuristic" style="padding:8px 18px; font-size:0.85rem;" id="mi-join">GABUNG</button><button type="button" class="mi-x" id="mi-x" aria-label="Tutup">✕</button>`;
            toast.style.display = 'flex';
            $('mi-join').onclick = () => { toast.style.display = 'none'; joinRoom(room.id, false); };
            $('mi-x').onclick = () => { dismissedInvites.add(room.id); toast.style.display = 'none'; };
        }

        /* ======================= RUANG MEETING ======================= */
        const grid = $('meet-grid'), wbWrap = $('meet-wb'), wbCanvas = $('wb-canvas'), wbCtx = wbCanvas.getContext('2d');

        function myInfo() { return { name: cur.me.name, role: cur.me.role, uid: cur.me.uid }; }
        function send(type, data, to) { if (cur && cur.ch) cur.ch.send({ room: cur.roomId, type: type, from: cur.peerId, to: to || null, data: data || null }); }
        function broadcastState() { send('state', Object.assign({}, cur.state)); renderTile('self'); renderPeople(); }

        async function getMedia() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alertBox('Kamera/mikrofon memerlukan HTTPS atau localhost. Anda masuk tanpa kamera & mikrofon.'); return new MediaStream(); }
            const tries = [{ audio: true, video: { width: 1280, height: 720 } }, { audio: true, video: false }, { audio: false, video: { width: 1280, height: 720 } }];
            for (const c of tries) { try { return await navigator.mediaDevices.getUserMedia(c); } catch (e) {} }
            alertBox('Kamera/mikrofon tidak dapat diakses. Anda tetap bisa melihat & mendengar peserta lain.');
            return new MediaStream();
        }

        async function joinRoom(roomId, isAdmin) {
            if (cur) { alertBox('Anda sedang berada di ruang meeting.'); return; }
            const room = loadReg()[roomId];
            if (!room || room.ended) { alertBox('Room meeting sudah berakhir.'); renderRooms(); return; }
            let me;
            if (isAdmin) {
                me = { name: 'Admin ' + (adminIdNow()), role: 'Admin', uid: adminIdNow() };
            } else {
                const u = window.__nexUser && window.__nexUser();
                if (!u) { alertBox('Silakan login terlebih dahulu.'); return; }
                if (!(room.invited || []).some(i => i.id === u.id)) { alertBox('Anda tidak diundang ke room ini.'); return; }
                const rec = (u.role === 'worker' ? workersDB : customersDB).find(x => x.id === u.id);
                me = { name: rec ? rec.name : u.id, role: u.role === 'worker' ? 'Worker' : 'Customer', uid: u.id };
            }
            cur = { roomId: roomId, room: room, isAdmin: isAdmin, me: me, peerId: 'P' + Math.random().toString(36).slice(2, 10), peers: {}, tiles: {}, chatLog: [],
                local: { stream: null, a: null, v: null, screen: null }, state: { mic: true, cam: true, hand: false, share: false }, wb: { shapes: [], open: false }, rec: null, timers: [] };

            cur.ch = openChannel('room-' + roomId, onRoomMsg);
            ensureLobby();
            $('meet-room').style.display = 'flex';
            $('meet-room').classList.toggle('is-user', !isAdmin);
            $('meet-tab-invite').style.display = isAdmin ? '' : 'none';
            $('meet-room-title').textContent = room.title;
            $('meet-room-meta').textContent = 'Host: ' + room.adminId;
            $('meet-chat-log').innerHTML = ''; $('meet-rec-badge').style.display = 'none';
            document.body.classList.add('meet-open');
            setSideTab('people');
            if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) $('mc-share').style.display = 'none';

            const stream = await getMedia();
            if (!cur) { stream.getTracks().forEach(t => t.stop()); return; }
            cur.local.stream = stream;
            cur.local.a = stream.getAudioTracks()[0] || null;
            cur.local.v = stream.getVideoTracks()[0] || null;
            cur.state.mic = !!cur.local.a; cur.state.cam = !!cur.local.v;
            renderTile('self');
            updateControls();

            cur.timers.push(setInterval(heartbeat, 4000)); heartbeat();
            send('join', myInfo());
            renderInviteList(); renderPeople();
        }

        function heartbeat() {
            if (!cur) return;
            lobbySend('presence', null, { room: cur.roomId, peer: cur.peerId });
            send('presence', myInfo());
            const r = loadReg()[cur.roomId];
            if (r && r.ended && !cur.isAdmin) endedByAdmin(false);
        }

        /* ---------- WebRTC ---------- */
        const curVideoTrack = () => (cur.local.screen ? cur.local.screen.getVideoTracks()[0] : cur.local.v) || null;
        function newPeer(pid, info) {
            if (cur.peers[pid]) { if (info) cur.peers[pid].info = info; return cur.peers[pid]; }
            const p = { id: pid, info: info || { name: pid, role: '' }, pc: null, stream: new MediaStream(), state: { mic: true, cam: true, hand: false, share: false }, vSender: null, aSender: null, queue: [] };
            cur.peers[pid] = p; renderTile(pid); renderPeople();
            return p;
        }
        function createPC(p) {
            const pc = new RTCPeerConnection(ICE);
            p.pc = pc;
            pc.onicecandidate = (e) => { if (e.candidate) send('ice', e.candidate.toJSON(), p.id); };
            pc.ontrack = (e) => {
                p.stream.addTrack(e.track);
                const t = cur.tiles[p.id]; if (t) { t.video.srcObject = p.stream; t.video.play().catch(() => {}); }
                if (cur.rec && e.track.kind === 'audio') recAddAudio(p.id, p.stream);
            };
            pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch (er) {} } };
            return pc;
        }
        function bindSenders(p) {
            p.pc.getTransceivers().forEach(tr => {
                const kind = tr.receiver && tr.receiver.track ? tr.receiver.track.kind : null;
                if (!kind) return;
                try { tr.direction = 'sendrecv'; } catch (e) {}
                if (kind === 'video') { p.vSender = tr.sender; tr.sender.replaceTrack(curVideoTrack()).catch(() => {}); }
                if (kind === 'audio') { p.aSender = tr.sender; tr.sender.replaceTrack(cur.local.a).catch(() => {}); }
            });
        }
        async function makeOffer(pid) {
            const p = newPeer(pid); if (p.pc) return;
            const pc = createPC(p);
            pc.addTransceiver('audio', { direction: 'sendrecv' });
            pc.addTransceiver('video', { direction: 'sendrecv' });
            bindSenders(p);
            await pc.setLocalDescription(await pc.createOffer());
            send('offer', { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, info: myInfo(), state: cur.state }, pid);
        }
        async function onOffer(m) {
            const p = newPeer(m.from, m.data.info);
            if (m.data.state) p.state = m.data.state;
            if (p.pc) { try { p.pc.close(); } catch (e) {} p.pc = null; p.stream = new MediaStream(); }
            const pc = createPC(p);
            await pc.setRemoteDescription(m.data.sdp);
            bindSenders(p);
            await pc.setLocalDescription(await pc.createAnswer());
            send('answer', { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, state: cur.state }, m.from);
            p.queue.splice(0).forEach(c => pc.addIceCandidate(c).catch(() => {}));
            renderTile(m.from);
        }
        async function onAnswer(m) {
            const p = cur.peers[m.from]; if (!p || !p.pc) return;
            await p.pc.setRemoteDescription(m.data.sdp);
            if (m.data.state) p.state = m.data.state;
            p.queue.splice(0).forEach(c => p.pc.addIceCandidate(c).catch(() => {}));
            renderTile(m.from);
        }
        function onIce(m) {
            const p = cur.peers[m.from]; if (!p) return;
            if (p.pc && p.pc.remoteDescription) p.pc.addIceCandidate(m.data).catch(() => {}); else p.queue.push(m.data);
        }
        const maybeOffer = (pid) => { const p = cur.peers[pid]; if (p && p.pc) return; if (cur.peerId < pid) makeOffer(pid).catch(e => console.warn(e)); };
        function removePeer(pid) {
            const p = cur.peers[pid]; if (!p) return;
            try { p.pc && p.pc.close(); } catch (e) {}
            delete cur.peers[pid];
            if (cur.tiles[pid]) { cur.tiles[pid].el.remove(); delete cur.tiles[pid]; }
            if (cur.rec && cur.rec.srcs[pid]) { try { cur.rec.srcs[pid].disconnect(); } catch (e) {} delete cur.rec.srcs[pid]; }
            layoutGrid(); renderPeople();
        }

        /* ---------- Penanganan pesan sinyal ---------- */
        function onRoomMsg(m) {
            if (!cur || m.room !== cur.roomId || m.from === cur.peerId) return;
            if (m.to && m.to !== cur.peerId) return;
            try { handle(m); } catch (e) { console.warn('meeting handle', e); }
        }
        function sendWbSync(to) {
            const sh = cur.wb.shapes;
            if (!sh.length) { send('wb-sync', { shapes: [], open: cur.wb.open, first: true }, to); return; }
            for (let i = 0; i < sh.length; i += 12) send('wb-sync', { shapes: sh.slice(i, i + 12), open: cur.wb.open, first: i === 0 }, to);
        }
        function handle(m) {
            switch (m.type) {
                case 'join': newPeer(m.from, m.data); send('hello', myInfo(), m.from); maybeOffer(m.from); if (cur.isAdmin) sendWbSync(m.from); break;
                case 'hello': newPeer(m.from, m.data); maybeOffer(m.from); break;
                case 'presence': if (!cur.peers[m.from]) { newPeer(m.from, m.data); send('hello', myInfo(), m.from); maybeOffer(m.from); } break;
                case 'offer': onOffer(m); break;
                case 'answer': onAnswer(m); break;
                case 'ice': onIce(m); break;
                case 'state': { const p = cur.peers[m.from]; if (p) { p.state = m.data; renderTile(m.from); renderPeople(); layoutGrid(); } break; }
                case 'leave': removePeer(m.from); break;
                case 'chat': addChat(m.data, false); break;
                case 'end': endedByAdmin(false); break;
                case 'kick': alertBox('Anda dikeluarkan dari meeting oleh Admin.'); leaveRoom(); break;
                case 'mute-all': if (!cur.isAdmin) setMic(false); break;
                case 'wb-open': cur.wb.open = !!m.data; showWb(cur.wb.open, true); break;
                case 'wb-shape': cur.wb.shapes.push(m.data); drawWb(); break;
                case 'wb-undo': cur.wb.shapes = cur.wb.shapes.filter(s => s.id !== m.data); drawWb(); break;
                case 'wb-clear': cur.wb.shapes = []; drawWb(); break;
                case 'wb-sync': { if (m.data.first) cur.wb.shapes = []; (m.data.shapes || []).forEach(s => { if (!cur.wb.shapes.some(x => x.id === s.id)) cur.wb.shapes.push(s); }); cur.wb.open = !!m.data.open; showWb(cur.wb.open, true); drawWb(); break; }
            }
        }

        /* ---------- Tile video ---------- */
        function renderTile(pid) {
            if (!cur) return;
            const isSelf = pid === 'self';
            let t = cur.tiles[pid];
            if (!t) {
                const el = document.createElement('div');
                el.className = 'meet-tile' + (isSelf ? ' self' : '');
                el.innerHTML = '<video autoplay playsinline' + (isSelf ? ' muted' : '') + '></video><div class="tile-avatar"></div><div class="tile-label"></div><div class="tile-ico"></div>';
                el.addEventListener('click', () => { el.classList.toggle('pinned'); layoutGrid(); });
                grid.appendChild(el);
                t = cur.tiles[pid] = { el: el, video: el.querySelector('video'), label: el.querySelector('.tile-label'), ico: el.querySelector('.tile-ico'), av: el.querySelector('.tile-avatar') };
                if (isSelf) t.video.srcObject = cur.local.stream; else t.video.srcObject = cur.peers[pid].stream;
                layoutGrid();
            }
            const info = isSelf ? cur.me : (cur.peers[pid] ? cur.peers[pid].info : { name: pid, role: '' });
            const st = isSelf ? cur.state : (cur.peers[pid] ? cur.peers[pid].state : {});
            t.name = info.name;
            t.label.innerHTML = esc(info.name) + (isSelf ? ' (Anda)' : '') + (info.role ? ' <small>' + esc(info.role) + '</small>' : '');
            t.av.textContent = (info.name || '?').trim().charAt(0).toUpperCase();
            t.el.classList.toggle('no-cam', !st.cam && !st.share);
            t.el.classList.toggle('sharing', !!st.share);
            t.ico.innerHTML = (st.hand ? '✋' : '') + (st.mic === false ? '🔇' : '') + (st.share ? '🖥️' : '');
        }
        function layoutGrid() {
            const tiles = Object.values(cur ? cur.tiles : {});
            const n = tiles.length;
            grid.dataset.n = n;
            grid.classList.toggle('compact', !!(cur && cur.wb.open));
            const spot = tiles.some(t => t.el.classList.contains('sharing') || t.el.classList.contains('pinned'));
            grid.classList.toggle('has-spot', spot);
        }

        /* ---------- Panel samping ---------- */
        function setSideTab(name) {
            document.querySelectorAll('.meet-side-tabs button').forEach(b => b.classList.toggle('active', b.dataset.pane === name));
            ['people', 'chat', 'invite'].forEach(n => { $('meet-pane-' + n).style.display = n === name ? 'flex' : 'none'; });
        }
        document.querySelectorAll('.meet-side-tabs button').forEach(b => b.addEventListener('click', () => setSideTab(b.dataset.pane)));
        function renderPeople() {
            const box = $('meet-pane-people'); if (!box || !cur) return;
            const rows = [{ id: 'self', info: cur.me, st: cur.state, self: true }].concat(Object.values(cur.peers).map(p => ({ id: p.id, info: p.info, st: p.state })));
            box.innerHTML = '<div class="meet-people-head">' + rows.length + ' peserta' + (cur.isAdmin ? ' <button type="button" class="mt-mini" id="mt-muteall">🔇 Mute semua</button>' : '') + '</div>' +
                rows.map(r => `<div class="meet-person"><div class="pav">${esc((r.info.name || '?').charAt(0).toUpperCase())}</div><div class="pin"><strong>${esc(r.info.name)}${r.self ? ' (Anda)' : ''}</strong><small>${esc(r.info.role || '')} ${r.info.uid ? '• ' + esc(r.info.uid) : ''}</small></div><div class="pst">${r.st.hand ? '✋' : ''}${r.st.mic === false ? '🔇' : '🎤'}${r.st.cam === false ? '📷✕' : '📷'}${cur.isAdmin && !r.self ? `<button type="button" class="mt-mini danger" data-kick="${r.id}">Keluarkan</button>` : ''}</div></div>`).join('');
            const mu = $('mt-muteall'); if (mu) mu.onclick = () => { send('mute-all'); alertBox('Semua peserta dimute.'); };
            box.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { send('kick', null, b.dataset.kick); removePeer(b.dataset.kick); });
        }
        function addChat(m, mine) {
            const log = $('meet-chat-log'); if (!log) return;
            const d = document.createElement('div'); d.className = 'meet-msg' + (mine ? ' mine' : '');
            d.innerHTML = '<b>' + esc(m.name) + '</b><span>' + esc(m.text) + '</span><small>' + new Date(m.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '</small>';
            log.appendChild(d); log.scrollTop = log.scrollHeight;
        }
        const sendChat = () => { const i = $('meet-chat-input'); const t = i.value.trim(); if (!t || !cur) return; const m = { name: cur.me.name, text: t, ts: Date.now() }; send('chat', m); addChat(m, true); i.value = ''; };
        $('meet-chat-send').addEventListener('click', sendChat);
        $('meet-chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

        function renderInviteList() {
            const box = $('meet-invite-list'); if (!box || !cur) return;
            const r = loadReg()[cur.roomId]; const inv = (r && r.invited) || [];
            box.innerHTML = inv.length ? inv.map(i => `<div class="mt-chip">${esc(i.name)} <small>${esc(i.id)} • ${esc(i.role)}</small><button type="button" data-rm="${esc(i.id)}" aria-label="Hapus undangan">✕</button></div>`).join('') : '<div class="mt-muted">Belum ada yang diundang.</div>';
            box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { patchRoom(cur.roomId, rr => { rr.invited = (rr.invited || []).filter(x => x.id !== b.dataset.rm); }); renderInviteList(); });
        }
        function inviteById() {
            const raw = $('meet-invite-id').value.trim(); if (!raw || !cur) return;
            const key = raw.toLowerCase();
            const c = customersDB.find(x => x.id.toLowerCase() === key || (x.username || '').toLowerCase() === key);
            const w = workersDB.find(x => x.id.toLowerCase() === key || (x.username || '').toLowerCase() === key);
            const rec = c || w;
            if (!rec) { alertBox('ID Nexora <strong>' + esc(raw) + '</strong> tidak ditemukan.'); return; }
            const item = { id: rec.id, name: rec.name, role: c ? 'Customer' : 'Worker' };
            patchRoom(cur.roomId, rr => { rr.invited = rr.invited || []; if (!rr.invited.some(x => x.id === item.id)) rr.invited.push(item); });
            $('meet-invite-id').value = ''; renderInviteList();
            alertBox(esc(rec.name) + ' (' + esc(rec.id) + ') diundang. Undangan muncul otomatis saat mereka login.');
        }
        $('meet-invite-btn').addEventListener('click', inviteById);
        $('meet-invite-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') inviteById(); });

        /* ---------- Kontrol bawah ---------- */
        function updateControls() {
            if (!cur) return;
            $('mc-mic').classList.toggle('off', !cur.state.mic); $('mc-mic').firstChild.nodeValue = cur.state.mic ? '🎤' : '🔇';
            $('mc-cam').classList.toggle('off', !cur.state.cam);
            $('mc-share').classList.toggle('on', !!cur.local.screen);
            $('mc-wb').classList.toggle('on', cur.wb.open);
            $('mc-hand').classList.toggle('on', cur.state.hand);
            $('mc-rec').classList.toggle('on', !!cur.rec);
        }
        function setMic(on) { if (!cur || !cur.local.a) { if (on) alertBox('Mikrofon tidak tersedia.'); return; } cur.local.a.enabled = on; cur.state.mic = on; updateControls(); broadcastState(); }
        $('mc-mic').addEventListener('click', () => setMic(!cur.state.mic));
        $('mc-cam').addEventListener('click', () => {
            if (!cur.local.v) { alertBox('Kamera tidak tersedia.'); return; }
            cur.state.cam = !cur.state.cam; cur.local.v.enabled = cur.state.cam; updateControls(); broadcastState();
        });
        $('mc-hand').addEventListener('click', () => { cur.state.hand = !cur.state.hand; updateControls(); broadcastState(); });
        $('mc-people').addEventListener('click', () => $('meet-side').classList.toggle('open'));
        $('mc-share').addEventListener('click', async () => {
            if (cur.local.screen) { stopShare(); return; }
            try {
                const ds = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 20 }, audio: false });
                cur.local.screen = ds;
                const t = ds.getVideoTracks()[0];
                Object.values(cur.peers).forEach(p => p.vSender && p.vSender.replaceTrack(t).catch(() => {}));
                cur.tiles.self.video.srcObject = ds;
                t.onended = stopShare;
                cur.state.share = true; updateControls(); broadcastState(); layoutGrid();
            } catch (e) { /* dibatalkan */ }
        });
        function stopShare() {
            if (!cur || !cur.local.screen) return;
            cur.local.screen.getTracks().forEach(t => t.stop()); cur.local.screen = null;
            Object.values(cur.peers).forEach(p => p.vSender && p.vSender.replaceTrack(cur.local.v).catch(() => {}));
            cur.tiles.self.video.srcObject = cur.local.stream;
            cur.state.share = false; updateControls(); broadcastState(); layoutGrid();
        }
        $('mc-wb').addEventListener('click', () => { cur.wb.open = !cur.wb.open; showWb(cur.wb.open, false); send('wb-open', cur.wb.open); });
        $('mc-leave').addEventListener('click', () => {
            if (cur.isAdmin) customConfirm('Keluar dari meeting? Room tetap berjalan untuk peserta lain. Gunakan tombol "Akhiri" untuk menutup room.', () => leaveRoom());
            else leaveRoom();
        });
        $('mc-end').addEventListener('click', () => {
            customConfirm('Akhiri meeting untuk <strong>semua peserta</strong>?', () => { const id = cur.roomId; endRoom(id); });
        });

        function endedByAdmin(self) {
            if (!cur) return;
            if (!self && !cur.isAdmin) alertBox('Meeting telah diakhiri oleh Admin.');
            leaveRoom(true);
        }

        async function leaveRoom(ended) {
            if (!cur) return;
            const c = cur;
            if (c.rec) await stopRecording();
            try { send('leave'); } catch (e) {}
            c.timers.forEach(clearInterval);
            Object.values(c.peers).forEach(p => { try { p.pc && p.pc.close(); } catch (e) {} });
            if (c.local.screen) c.local.screen.getTracks().forEach(t => t.stop());
            if (c.local.stream) c.local.stream.getTracks().forEach(t => t.stop());
            lobbySend('presence', null, { room: c.roomId, peer: c.peerId, left: true });
            if (c.ch) setTimeout(() => c.ch.close(), 400);
            cur = null;
            grid.innerHTML = '';
            $('meet-room').style.display = 'none';
            document.body.classList.remove('meet-open');
            showWb(false, true);
            renderRooms(); renderRecs(); checkInvites();
        }
        window.addEventListener('beforeunload', () => { if (cur) { try { send('leave'); lobbySend('presence', null, { room: cur.roomId, peer: cur.peerId, left: true }); } catch (e) {} } });

        /* ======================= WHITEBOARD ======================= */
        let tool = 'pen', drawing = null;
        function showWb(open, silent) {
            wbWrap.style.display = open ? 'flex' : 'none';
            if (cur) { cur.wb.open = open; layoutGrid(); updateControls(); }
            if (open) drawWb();
        }
        document.querySelectorAll('.wb-tools [data-tool]').forEach(b => b.addEventListener('click', () => {
            tool = b.dataset.tool;
            document.querySelectorAll('.wb-tools [data-tool]').forEach(x => x.classList.toggle('active', x === b));
        }));
        function drawShape(c, s) {
            c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = s.color; c.fillStyle = s.color; c.lineWidth = s.size;
            if (s.tool === 'eraser') { c.globalCompositeOperation = 'destination-out'; c.lineWidth = s.size * 4; }
            if (s.tool === 'pen' || s.tool === 'eraser') {
                c.beginPath(); s.pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
                if (s.pts.length === 1) c.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
                c.stroke();
            } else if (s.tool === 'line' || s.tool === 'arrow') {
                c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke();
                if (s.tool === 'arrow') { const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), h = 14 + s.size * 2; c.beginPath(); c.moveTo(s.x2, s.y2); c.lineTo(s.x2 - h * Math.cos(a - 0.4), s.y2 - h * Math.sin(a - 0.4)); c.moveTo(s.x2, s.y2); c.lineTo(s.x2 - h * Math.cos(a + 0.4), s.y2 - h * Math.sin(a + 0.4)); c.stroke(); }
            } else if (s.tool === 'rect') { c.strokeRect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1)); }
            else if (s.tool === 'ellipse') { c.beginPath(); c.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, Math.abs(s.x2 - s.x1) / 2, Math.abs(s.y2 - s.y1) / 2, 0, 0, Math.PI * 2); c.stroke(); }
            else if (s.tool === 'text') { c.font = 'bold ' + (14 + s.size * 3) + 'px Plus Jakarta Sans, sans-serif'; c.fillText(s.text, s.x1, s.y1); }
            c.restore();
        }
        function drawWb() {
            wbCtx.fillStyle = '#0b1120'; wbCtx.fillRect(0, 0, wbCanvas.width, wbCanvas.height);
            // grid halus
            wbCtx.strokeStyle = 'rgba(255,255,255,0.04)'; wbCtx.lineWidth = 1;
            for (let x = 0; x < wbCanvas.width; x += 40) { wbCtx.beginPath(); wbCtx.moveTo(x, 0); wbCtx.lineTo(x, wbCanvas.height); wbCtx.stroke(); }
            for (let y = 0; y < wbCanvas.height; y += 40) { wbCtx.beginPath(); wbCtx.moveTo(0, y); wbCtx.lineTo(wbCanvas.width, y); wbCtx.stroke(); }
            const layer = document.createElement('canvas'); layer.width = wbCanvas.width; layer.height = wbCanvas.height;
            const lc = layer.getContext('2d');
            (cur ? cur.wb.shapes : []).forEach(s => drawShape(lc, s));
            if (drawing) drawShape(lc, drawing);
            wbCtx.drawImage(layer, 0, 0);
        }
        const wbPos = (e) => { const r = wbCanvas.getBoundingClientRect(); return [(e.clientX - r.left) * wbCanvas.width / r.width, (e.clientY - r.top) * wbCanvas.height / r.height]; };
        wbCanvas.addEventListener('pointerdown', (e) => {
            if (!cur) return;
            const p = wbPos(e);
            const base = { id: 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), peer: cur.peerId, tool: tool, color: $('wb-color').value, size: +$('wb-size').value };
            if (tool === 'text') {
                const t = prompt('Tulis teks:'); if (t) { const s = Object.assign(base, { x1: p[0], y1: p[1], text: t }); cur.wb.shapes.push(s); send('wb-shape', s); drawWb(); }
                return;
            }
            wbCanvas.setPointerCapture(e.pointerId);
            drawing = (tool === 'pen' || tool === 'eraser') ? Object.assign(base, { pts: [p] }) : Object.assign(base, { x1: p[0], y1: p[1], x2: p[0], y2: p[1] });
        });
        wbCanvas.addEventListener('pointermove', (e) => {
            if (!drawing) return;
            const p = wbPos(e);
            if (drawing.pts) drawing.pts.push(p); else { drawing.x2 = p[0]; drawing.y2 = p[1]; }
            drawWb();
        });
        const endDraw = () => { if (!drawing || !cur) return; const s = drawing; drawing = null; if (s.pts) s.pts = s.pts.map(p => [Math.round(p[0]), Math.round(p[1])]); cur.wb.shapes.push(s); send('wb-shape', s); drawWb(); };
        wbCanvas.addEventListener('pointerup', endDraw);
        wbCanvas.addEventListener('pointercancel', endDraw);
        $('wb-undo').addEventListener('click', () => {
            if (!cur) return;
            for (let i = cur.wb.shapes.length - 1; i >= 0; i--) if (cur.wb.shapes[i].peer === cur.peerId) { const id = cur.wb.shapes[i].id; cur.wb.shapes.splice(i, 1); send('wb-undo', id); break; }
            drawWb();
        });
        $('wb-clear').addEventListener('click', () => { if (!cur) return; customConfirm('Bersihkan seluruh whiteboard untuk semua peserta?', () => { cur.wb.shapes = []; send('wb-clear'); drawWb(); }); });
        $('wb-save').addEventListener('click', () => { const a = document.createElement('a'); a.download = 'whiteboard_' + Date.now() + '.png'; a.href = wbCanvas.toDataURL('image/png'); a.click(); });

        /* ======================= REKAM (ADMIN) ======================= */
        function recAddAudio(pid, stream) {
            const R = cur && cur.rec; if (!R || R.srcs[pid] || !stream.getAudioTracks().length) return;
            try { const s = R.ctx.createMediaStreamSource(stream); s.connect(R.dest); R.srcs[pid] = s; } catch (e) {}
        }
        function drawContain(c, v, x, y, w, h) {
            const vw = v.videoWidth || 640, vh = v.videoHeight || 360, r = Math.min(w / vw, h / vh);
            c.drawImage(v, x + (w - vw * r) / 2, y + (h - vh * r) / 2, vw * r, vh * r);
        }
        function recFrame() {
            const R = cur && cur.rec; if (!R) return;
            const c = R.c2d, W = 1280, H = 720;
            c.fillStyle = '#0b1120'; c.fillRect(0, 0, W, H);
            const list = Object.entries(cur.tiles).map(([pid, t]) => ({ pid: pid, t: t, sharing: t.el.classList.contains('sharing') }));
            const sharer = list.find(x => x.sharing);
            const label = (x, bx, by) => { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(bx, by - 26, Math.min(300, 14 + (x.t.name || '').length * 9), 26); c.fillStyle = '#fff'; c.font = '14px sans-serif'; c.fillText(x.t.name || '', bx + 8, by - 8); };
            const cell = (x, bx, by, w, h) => {
                c.fillStyle = '#111a2e'; c.fillRect(bx, by, w, h);
                if (x.t.video.readyState >= 2 && !x.t.el.classList.contains('no-cam')) drawContain(c, x.t.video, bx, by, w, h);
                else { c.fillStyle = '#00f2fe'; c.font = 'bold ' + Math.min(h, w) / 3 + 'px sans-serif'; c.textAlign = 'center'; c.fillText((x.t.name || '?').charAt(0).toUpperCase(), bx + w / 2, by + h / 2 + Math.min(h, w) / 9); c.textAlign = 'left'; }
                label(x, bx, by + h);
            };
            if (cur.wb.open || sharer) {
                const mw = Math.floor(W * 0.78);
                if (cur.wb.open) c.drawImage(wbCanvas, 0, 0, mw, H); else cell(sharer, 0, 0, mw, H);
                const others = list.filter(x => cur.wb.open || x !== sharer).slice(0, 5), n = Math.max(1, others.length), ch = Math.floor(H / n);
                others.forEach((x, i) => cell(x, mw + 6, i * ch, W - mw - 6, ch - 6));
            } else {
                const n = Math.max(1, list.length), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), cw = W / cols, chh = H / rows;
                list.forEach((x, i) => cell(x, (i % cols) * cw + 3, Math.floor(i / cols) * chh + 3, cw - 6, chh - 6));
            }
            // WATERMARK ID ADMIN
            c.save(); c.globalAlpha = 0.11; c.fillStyle = '#ffffff'; c.font = 'bold 58px sans-serif'; c.translate(W / 2, H / 2); c.rotate(-0.38); c.textAlign = 'center';
            c.fillText('NEXORA • ' + R.adminId, 0, -40); c.fillText('NEXORA • ' + R.adminId, 0, 60); c.restore();
            c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, H - 34, W, 34);
            c.fillStyle = '#00f2fe'; c.font = 'bold 15px sans-serif'; c.textAlign = 'left';
            c.fillText('NEXORA MEETING • ' + cur.room.title + ' • Admin bertugas: ' + R.adminId, 14, H - 12);
            c.fillStyle = '#fff'; c.textAlign = 'right'; c.fillText(new Date().toLocaleString('id-ID'), W - 14, H - 12); c.textAlign = 'left';
        }
        async function startRecording() {
            if (!cur || !cur.isAdmin || cur.rec) return;
            if (!window.MediaRecorder) { alertBox('Browser ini tidak mendukung perekaman.'); return; }
            const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
            const ctx = new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume();
            const dest = ctx.createMediaStreamDestination();
            const R = { cv: cv, c2d: cv.getContext('2d'), ctx: ctx, dest: dest, srcs: {}, chunks: [], start: Date.now(), adminId: adminIdNow() };
            cur.rec = R;
            if (cur.local.a) { try { const s = ctx.createMediaStreamSource(new MediaStream([cur.local.a])); s.connect(dest); R.srcs.self = s; } catch (e) {} }
            Object.values(cur.peers).forEach(p => recAddAudio(p.id, p.stream));
            const out = cv.captureStream(25);
            dest.stream.getAudioTracks().forEach(t => out.addTrack(t));
            const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
            R.mr = new MediaRecorder(out, mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined);
            R.mr.ondataavailable = (e) => { if (e.data && e.data.size) R.chunks.push(e.data); };
            R.mr.start(1000);
            R.draw = setInterval(recFrame, 40);
            R.tick = setInterval(() => { $('meet-rec-time').textContent = fmtDur((Date.now() - R.start) / 1000).slice(3); }, 1000);
            $('meet-rec-badge').style.display = 'inline-flex';
            updateControls();
        }
        function stopRecording() {
            return new Promise((resolve) => {
                const R = cur && cur.rec; if (!R) { resolve(); return; }
                cur.rec = null;
                clearInterval(R.draw); clearInterval(R.tick);
                R.mr.onstop = () => {
                    const blob = new Blob(R.chunks, { type: 'video/webm' });
                    try { R.ctx.close(); } catch (e) {}
                    if (blob.size > 0) {
                        meetingsDB.push({ id: 'REC-' + Date.now().toString(36).toUpperCase(), title: R.title || (cur ? cur.room.title : 'Meeting'), roomId: R.roomId, adminId: R.adminId, startedAt: R.start, durationSec: Math.round((Date.now() - R.start) / 1000), size: blob.size, url: URL.createObjectURL(blob) });
                        renderRecs();
                        alertBox('Rekaman meeting tersimpan di <strong>Database Meeting</strong>.');
                    }
                    $('meet-rec-badge').style.display = 'none';
                    resolve();
                };
                R.title = cur ? cur.room.title : 'Meeting'; R.roomId = cur ? cur.roomId : '';
                try { R.mr.stop(); } catch (e) { resolve(); }
                updateControls();
            });
        }
        $('mc-rec').addEventListener('click', () => {
            if (!cur) return;
            if (cur.rec) customConfirm('Hentikan rekaman dan simpan ke database meeting?', () => stopRecording()); else startRecording();
        });

        /* ======================= TIMER GLOBAL ======================= */
        setInterval(() => {
            document.querySelectorAll('.mt-elapsed').forEach(el => { el.textContent = fmtDur((Date.now() - (+el.dataset.start)) / 1000); });
            if (cur) $('meet-timer').textContent = fmtDur((Date.now() - cur.room.createdAt) / 1000);
        }, 1000);
        setInterval(() => {
            document.querySelectorAll('.mt-count').forEach(el => { const r = loadReg()[el.dataset.room]; if (r) el.textContent = liveCount(r); });
            checkInvites();
        }, 3000);
        document.addEventListener('nex:session', checkInvites);
        checkInvites();
    }
})();