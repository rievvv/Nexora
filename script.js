/* global workersDB, customersDB, videosDB, productsDB, ordersDB, financeDB, bannersDB, chatsDB, adminDB_Login, calculateLevel, calculateCustomerLevel, formatRp */

window.NexBoot = function () {
    if (window.__nexBooted) return;
    window.__nexBooted = true;

    /* =========================================
       CUSTOM ALERTS & CONFIRMS
       ========================================= */
    window.customAlert = function(msg) {
        document.getElementById('custom-alert-msg').innerHTML = msg;
        document.getElementById('custom-alert-modal').classList.add('active');
    };

    window.customConfirm = function(msg, onConfirmCallback, onCancelCallback) {
        document.getElementById('custom-confirm-msg').innerHTML = msg;
        const modal = document.getElementById('custom-confirm-modal');
        const btnYes = document.getElementById('btn-custom-confirm-yes');
        const btnNo = modal.querySelector('button:not(#btn-custom-confirm-yes)');

        const newBtnYes = btnYes.cloneNode(true);
        btnYes.parentNode.replaceChild(newBtnYes, btnYes);
        newBtnYes.addEventListener('click', () => {
            modal.classList.remove('active');
            if(onConfirmCallback) onConfirmCallback();
        });

        const newBtnNo = btnNo.cloneNode(true);
        btnNo.parentNode.replaceChild(newBtnNo, btnNo);
        newBtnNo.addEventListener('click', () => {
            modal.classList.remove('active');
            if(onCancelCallback) onCancelCallback();
        });
        modal.classList.add('active');
    };

    // Penghapusan data apa pun wajib memakai sandi 6 digit
    const DELETE_PASS = '070809';
    window.askDeletePassword = function(msg, onOk) {
        const modal = document.getElementById('delete-pass-modal');
        const input = document.getElementById('dp-input');
        const err = document.getElementById('dp-error');
        const ok = document.getElementById('dp-ok');
        const no = document.getElementById('dp-cancel');
        document.getElementById('dp-msg').innerHTML = msg;
        input.value = ''; err.style.display = 'none';
        const close = () => { modal.classList.remove('active'); input.blur(); };
        const submit = () => {
            if (input.value.trim() === DELETE_PASS) { close(); if (onOk) onOk(); }
            else { err.style.display = 'block'; input.value = ''; input.focus(); }
        };
        ok.onclick = submit;
        no.onclick = close;
        input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
        input.oninput = () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); err.style.display = 'none'; };
        modal.classList.add('active');
        setTimeout(() => input.focus(), 60);
    };

    // REVISI 6: Fungsi Salin Teks (Clipboard)
    window.copyToClipboard = function(text) {
        const done = () => customAlert("Berhasil disalin ke clipboard: <strong>" + text + "</strong>");
        const fallback = () => {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (err) {}
            document.body.removeChild(ta);
            done();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
    };

    /* =========================================
       REVISI 1: LOGIKA SPA NAVIGASI (SLIDE GAUSSIAN BLUR)
       ========================================= */
    let currentPageId = 'page-1';
    let isAnimating = false;

    /* =========================================
       RIWAYAT NAVIGASI (Back / Forward browser & tombol samping mouse)
       ========================================= */
    let navIdx = 0;
    let restoringNav = false;
    let adminAuthed = false;
    let adminId = '';
    let navRetry = null;

    function pushNav(extra) {
        if (restoringNav) return;
        navIdx++;
        try { history.pushState(Object.assign({ nex: 1, idx: navIdx }, extra), '', '#' + (extra.page || 'page-1')); } catch (err) {}
    }

    function showAdminSub(key) {
        const views = { orders: viewOrders, worker: viewDataWorker, customer: viewDataCustomer, content: viewManageContent, finance: viewFinance, chat: viewChat, payout: viewPayout };
        Object.keys(views).forEach(k => { views[k].style.display = 'none'; });
        viewCarousel.style.display = 'none';
        if (!key || !views[key]) { viewCarousel.style.display = 'flex'; return; }
        views[key].style.display = 'flex';
        try {
            if (key === 'orders') { renderOrdersTable(); markOrdersAsRead(); }
            if (key === 'worker') renderWorkerTable();
            if (key === 'customer') renderCustomerTable();
            if (key === 'content') switchCMSTab('video');
            if (key === 'finance') renderFinanceTable();
            if (key === 'chat') renderAdminChatList();
            if (key === 'payout') renderPayoutTable();
        } catch (err) {}
    }

    function applyNav(st, tries) {
        if (isAnimating && (tries || 0) < 12) { clearTimeout(navRetry); navRetry = setTimeout(() => applyNav(st, (tries || 0) + 1), 250); return; }
        let target = st.page || 'page-1';
        if (target === 'page-3' && !adminAuthed) target = 'page-1';
        if (target === 'page-4' && !(currentUser && currentUser.role === 'customer')) target = 'page-1';
        if (target === 'page-5' && !(currentUser && currentUser.role === 'worker')) target = 'page-1';
        const dir = (st.idx || 0) >= navIdx ? 'forward' : 'backward';
        navIdx = st.idx || 0;
        restoringNav = true;
        try {
            if (target !== currentPageId) navigateTo(target, dir, true);
            if (target === 'page-1') {
                if (st.cat && currentUser) openMainCategory(st.cat); else closeMainCategory();
            }
            if (target === 'page-3' && adminAuthed) showAdminSub(st.adm || '');
        } finally { restoringNav = false; }
    }

    window.addEventListener('popstate', (e) => {
        const st = (e.state && e.state.nex) ? e.state : { nex: 1, idx: 0, page: 'page-1', cat: '', adm: '' };
        applyNav(st, 0);
    });

    window.navigateTo = function(targetPageId, direction = 'forward', fromHistory = false) {
        if (isAnimating || currentPageId === targetPageId) return;
        isAnimating = true;
        if (!fromHistory) pushNav({ page: targetPageId, cat: targetPageId === 'page-1' ? currentOpenMainCategory : '', adm: '' });
        if (typeof updateChatWidget === 'function') updateChatWidget(targetPageId);

        const pageOut = document.getElementById(currentPageId);
        const pageIn = document.getElementById(targetPageId);

        // Pangkas tinggi halaman selama animasi (layer lebih kecil = lebih ringan) & jeda animasi latar
        document.body.classList.add('is-transitioning');
        [pageOut, pageIn].forEach(pg => { pg.style.height = '100vh'; pg.style.overflow = 'hidden'; });
        
        document.querySelectorAll('.page-container').forEach(page => {
            if (page.id !== currentPageId && page.id !== targetPageId) {
                page.classList.add('page-hidden');
                page.className = 'page-container page-hidden';
            }
        });

        window.scrollTo({ top: 0, behavior: 'instant' });

        pageIn.classList.remove('page-hidden');
        
        if (direction === 'forward') {
            pageIn.className = 'page-container slide-in-right';
            void pageIn.offsetWidth;
            pageOut.className = 'page-container slide-out-left';
            pageIn.className = 'page-container slide-center-active';
        } else {
            pageIn.className = 'page-container slide-in-left';
            void pageIn.offsetWidth;
            pageOut.className = 'page-container slide-out-right';
            pageIn.className = 'page-container slide-center-active';
        }

        setTimeout(() => {
            pageOut.classList.add('page-hidden');
            pageOut.className = 'page-container page-hidden';
            [pageOut, pageIn].forEach(pg => { pg.style.height = ''; pg.style.overflow = ''; });
            document.body.classList.remove('is-transitioning');
            currentPageId = targetPageId;
            isAnimating = false;
        }, 1100); 
    };

    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'btn-regist') {
            navigateTo('page-2', 'forward');
        } else if (e.target && e.target.id === 'btn-back') {
            navigateTo('page-1', 'backward');
        }
    });

    // Klik logo Nexora / tombol Menu Utama -> kembali ke halaman utama
    function goHome() {
        if (currentPageId !== 'page-1') { navigateTo('page-1', 'backward'); }
        else { closeMainCategory(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
    document.querySelectorAll('.logo-crop, .portal-logo-wrap').forEach(el => { el.title = 'Kembali ke Menu Utama'; });
    document.addEventListener('click', function(e) {
        if (!e.target || !e.target.closest) return;
        if (e.target.closest('.logo-crop, .portal-logo-wrap') || e.target.closest('.btn-home')) goHome();
    });

    /* =========================================
       AUTHENTIKASI ADMIN & RESET VIEW LOGOUT
       ========================================= */
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) adminBtn.addEventListener('click', () => { 
        if (adminAuthed) { if (currentPageId !== 'page-3') navigateTo('page-3', 'forward'); return; }
        document.getElementById('admin-modal').classList.add('active'); 
        document.getElementById('login-error-admin').style.display = 'none';
    });

    const closeAdmin = document.getElementById('close-admin');
    if (closeAdmin) closeAdmin.addEventListener('click', () => { document.getElementById('admin-modal').classList.remove('active'); });

    const btnAuthAdmin = document.getElementById('btn-auth-admin');
    if (btnAuthAdmin) btnAuthAdmin.addEventListener('click', (e) => {
        e.preventDefault(); 
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();
        
        let isValidAdmin = false;
        if (typeof adminDB_Login !== 'undefined' && Array.isArray(adminDB_Login)) {
            isValidAdmin = adminDB_Login.some(a => a.username === user && a.password === pass);
        }
        if (user === 'admin' && pass === 'admin') isValidAdmin = true;

        if (isValidAdmin) {
            adminAuthed = true;
            if (currentUser) clearSession();
            updateAuthIcons();
            adminId = (user === 'admin') ? 'NEX-ADMIN' : user;
            document.getElementById('login-error-admin').style.display = 'none';
            document.getElementById('admin-modal').classList.remove('active'); 
            
            document.getElementById('admin-carousel-view').style.display = 'flex';
            document.getElementById('admin-orders-view').style.display = 'none';
            document.getElementById('admin-data-worker-view').style.display = 'none';
            document.getElementById('admin-data-customer-view').style.display = 'none';
            document.getElementById('admin-manage-content-view').style.display = 'none'; document.getElementById('admin-finance-view').style.display = 'none'; document.getElementById('admin-chat-view').style.display = 'none'; document.getElementById('admin-payout-view').style.display = 'none';

            try { renderAdminNotifications(); updateOrderBadge(); } catch(err) {}
            
            setTimeout(() => { navigateTo('page-3', 'forward'); }, 100);
        } else { 
            document.getElementById('login-error-admin').style.display = 'block'; 
        }
    });

    const adminPassInput = document.getElementById('admin-pass');
    if (adminPassInput) adminPassInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-auth-admin').click(); }
    });
    
    const btnLogoutAdmin = document.getElementById('btn-logout-admin');
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener('click', () => { 
        adminAuthed = false;
        updateAuthIcons();
        document.getElementById('admin-carousel-view').style.display = 'flex';
        document.getElementById('admin-orders-view').style.display = 'none';
        document.getElementById('admin-data-worker-view').style.display = 'none';
        document.getElementById('admin-data-customer-view').style.display = 'none';
        document.getElementById('admin-manage-content-view').style.display = 'none'; document.getElementById('admin-finance-view').style.display = 'none'; document.getElementById('admin-chat-view').style.display = 'none'; document.getElementById('admin-payout-view').style.display = 'none';
        navigateTo('page-1', 'backward'); 
    });

    // Navigasi Dalam Admin Portal (REVISI 7: Menu Pesanan)
    const viewCarousel = document.getElementById('admin-carousel-view');
    const viewOrders = document.getElementById('admin-orders-view');
    const viewDataWorker = document.getElementById('admin-data-worker-view');
    const viewDataCustomer = document.getElementById('admin-data-customer-view');
    const viewManageContent = document.getElementById('admin-manage-content-view');
    const viewFinance = document.getElementById('admin-finance-view');
    const viewChat = document.getElementById('admin-chat-view');
    const viewPayout = document.getElementById('admin-payout-view');

    document.addEventListener('click', function(e) {
        const mm = e.target && e.target.id && /^btn-menu-(orders|worker|customer|content|finance|chat|payout)$/.exec(e.target.id);
        if (mm) pushNav({ page: 'page-3', adm: mm[1], cat: '' });
        if (e.target && e.target.id === 'btn-menu-orders') { 
            viewCarousel.style.display = 'none'; 
            viewOrders.style.display = 'flex'; 
            renderOrdersTable(); 
            markOrdersAsRead();
        }
        if (e.target && e.target.id === 'btn-menu-worker') { viewCarousel.style.display = 'none'; viewDataWorker.style.display = 'flex'; renderWorkerTable(); }
        if (e.target && e.target.id === 'btn-menu-customer') { viewCarousel.style.display = 'none'; viewDataCustomer.style.display = 'flex'; renderCustomerTable(); }
        if (e.target && e.target.id === 'btn-menu-content') { viewCarousel.style.display = 'none'; viewManageContent.style.display = 'flex'; switchCMSTab('video'); }
        if (e.target && e.target.id === 'btn-menu-finance') { viewCarousel.style.display = 'none'; viewFinance.style.display = 'flex'; renderFinanceTable(); }
        if (e.target && e.target.id === 'btn-menu-chat') { viewCarousel.style.display = 'none'; viewChat.style.display = 'flex'; renderAdminChatList(); }
        if (e.target && e.target.id === 'btn-menu-payout') { viewCarousel.style.display = 'none'; viewPayout.style.display = 'flex'; renderPayoutTable(); }
    });

    /* =========================================
       REVISI 4, 5 & 6: PESANAN HANYA MASUK SAAT KLIK WA, DEADLINE & DROPDOWN STATUS
       ========================================= */
    let currentActiveOrder = null;

    window.buyProduct = function(id, opt) {
        opt = opt || {};
        const p = productsDB.find(x => x.id === id);
        if(!p) return;
        if (!currentUser) { openUserLogin(); return; }
        if(p.link && p.link !== "") {
            window.open(p.link, '_blank');
        } else {
            const pkList = productPackages(p);
            const chosen = (opt.pkgIdx !== null && opt.pkgIdx !== undefined && pkList[opt.pkgIdx]) ? pkList[opt.pkgIdx] : null;
            const reqW = (opt.workerId && JASA_CATEGORIES.includes(p.category)) ? workersDB.find(w => w.id === opt.workerId) : null;
            const orderName = chosen ? `${p.name} - Paket ${chosen.name}` : p.name;
            const extraWa = (chosen ? '%0APaket : ' + encodeURIComponent(chosen.name) : '') + (reqW ? '%0AWorker Pilihan : ' + encodeURIComponent(reqW.name + ' (' + reqW.id + ')') : '');
            let basePrice = (chosen && chosen.price) ? chosen.price : (p.price ? (parseInt(String(p.price).replace(/\D/g, ''), 10) || 500000) : 500000);
            let uniqueCode = Math.floor(100 + Math.random() * 900);
            let finalPrice = basePrice + uniqueCode;

            // REVISI 4: Objek pesanan disiapkan (akan dimasukkan ke database saat klik tombol WhatsApp)
            currentActiveOrder = {
                id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
                productName: orderName,
                productImg: p.imgUrl || '',
                nominal: finalPrice,
                status: "Pending",
                workerId: "-",
                startDate: new Date().toISOString().slice(0, 10),
                deadlineDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0, 10), // Default 7 hari ke depan
                completedDate: null,
                isRead: false,
                createdAt: Date.now(),
                category: p.category,
                baseNominal: basePrice,
                uniqueCode: uniqueCode,
                customerId: currentUser.id,
                customerName: (getCurrentRecord() || {}).name || '',
                customerRole: currentUser.role,
                packageName: chosen ? chosen.name : '',
                requestedWorkerId: reqW ? reqW.id : '',
                requestedWorkerName: reqW ? reqW.name : ''
            };

            document.getElementById('qris-unique-amount').innerText = formatRp(finalPrice);

            // REVISI 5: Format pesan konfirmasi WhatsApp
            let waMsg = `*Konfirmasi Pembelian*%0ANama Produk : ${orderName}${extraWa}%0ANomimal Transfer : ${formatRp(finalPrice)}%0ABank Transfer : BCA%0AAtas Nama : Arief Gunawan`;
            
            const waBtn = document.getElementById('btn-wa-order-confirm');
            waBtn.href = `https://wa.me/6285123532296?text=${waMsg}`;
            
            // REVISI 4: Pesanan HANYA masuk ke database admin ketika Customer klik Tombol Konfirmasi WhatsApp
            waBtn.onclick = function() {
                if (currentActiveOrder && typeof ordersDB !== 'undefined') {
                    // Cek agar tidak duplikat jika diklik berkali-kali
                    let exists = ordersDB.some(o => o.id === currentActiveOrder.id);
                    if (!exists) {
                        ordersDB.unshift(currentActiveOrder);
                        updateOrderBadge();
                        // Hubungkan admin dengan pemesan: pesan otomatis masuk ke chat
                        try {
                            addChatMessage(currentUser.id, 'user', { text: `🛒 Pesanan baru ${currentActiveOrder.id}\nProduk: ${currentActiveOrder.productName}${currentActiveOrder.requestedWorkerId ? '\nWorker pilihan: ' + currentActiveOrder.requestedWorkerName + ' (' + currentActiveOrder.requestedWorkerId + ')' : ''}\nNominal: ${formatRp(currentActiveOrder.nominal)}\nMohon konfirmasi pembayaran. Terima kasih.` });
                            onUserMessageSent(currentUser.id);
                        } catch (err) {}
                    }
                }
                document.getElementById('payment-modal').classList.remove('active');
                customAlert("Pesanan berhasil dikirim ke Admin!");
            };

            document.getElementById('payment-modal').classList.add('active');
        }
    }

    /* ---------- Helper tanggal & teks aman ---------- */
    const pad2 = n => String(n).padStart(2, '0');
    const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
    const dayDiff = (a, b) => { const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000); };
    const fmtDate = (s) => { if (!s) return '-'; const [y, m, d] = s.split('-'); const bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']; return `${d} ${bln[Number(m) - 1]} ${y}`; };
    const escHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const orderStatusColor = (st) => st === 'Complete' ? '#34A853' : (st === 'On Process' ? '#00f2fe' : '#ffaa00');

    // Evaluasi ketepatan waktu (dipakai saat pesanan Complete)
    function evaluateOrder(o) {
        if (!o.deadlineDate || !o.completedDate) return { color: '#34A853', text: 'Done' };
        const late = dayDiff(o.deadlineDate, o.completedDate);
        if (late <= 0) return { color: '#34A853', text: 'Done' };
        if (late === 1) return { color: '#ffaa00', text: 'Potongan 10% (H+1)' };
        if (late <= 3) return { color: '#ffaa00', text: `Potongan 50% (H+${late})` };
        return { color: '#ff0055', text: 'False' };
    }

    /* ---------- LIST PESANAN ---------- */
    window.renderOrdersTable = function() {
        const tbody = document.getElementById('orders-table-tbody');
        if (!tbody || typeof ordersDB === 'undefined') return;
        tbody.innerHTML = '';
        if (ordersDB.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Belum ada pesanan masuk.</td></tr>`;
            return;
        }
        ordersDB.forEach(o => {
            const locked = '';
            const inputStyle = 'background:#000; color:#fff; border:1px solid rgba(0,242,254,0.3); border-radius:4px; padding:3px 6px; font-family:inherit; color-scheme:dark;';
            const tr = document.createElement('tr');
            tr.className = 'data-row';
            tr.addEventListener('click', () => openOrderDetailModal(o.id));
            const workerDisplay = (o.workerId && o.workerId !== '-') ? `<br><span style="font-size:0.75rem; color:#00f2fe;">Worker: ${escHtml(o.workerId)}</span>` : (o.requestedWorkerId ? `<br><span style="font-size:0.75rem; color:#ffaa00;">Pilihan customer: ${escHtml(o.requestedWorkerName || '')} (${escHtml(o.requestedWorkerId)})</span>` : '');
            let evalBadge = '';
            if (o.status === 'Complete') { const ev = evaluateOrder(o); evalBadge = `<br><span style="font-size:0.75rem; font-weight:700; color:${ev.color};">${ev.text}</span>`; }
            tr.innerHTML = `
                <td style="font-weight:700; color:#00f2fe;">${escHtml(o.id)}</td>
                <td style="color:#fff; font-weight:700;">${escHtml(o.productName)}${workerDisplay}</td>
                <td style="color:#00f2fe; font-weight:800;">${formatRp(o.nominal)}</td>
                <td onclick="event.stopPropagation()">
                    <div style="font-size:0.75rem; color:rgba(255,255,255,0.6);">Mulai: <input type="date" value="${o.startDate || ''}" ${locked} onchange="updateOrderDate('${o.id}', 'start', this.value)" style="${inputStyle}"></div>
                    <div style="font-size:0.75rem; color:#ffaa00; margin-top:4px;">Deadline: <input type="date" value="${o.deadlineDate || ''}" ${locked} onchange="updateOrderDate('${o.id}', 'deadline', this.value)" style="${inputStyle} border-color:#ffaa00;"></div>
                </td>
                <td><span style="color:${orderStatusColor(o.status)}; font-weight:bold;">${escHtml(o.status)}</span>${evalBadge}</td>
                <td style="text-align:center;"><button type="button" class="btn-action-sm btn-view" onclick="event.stopPropagation(); openOrderDetailModal('${o.id}')">DETAIL</button><button type="button" class="btn-action-sm btn-view" title="Hubungi Customer" onclick="event.stopPropagation(); contactOrderCustomer('${o.id}')">💬</button><button type="button" class="btn-action-sm btn-del" title="Hapus Pesanan" onclick="event.stopPropagation(); deleteOrder('${o.id}')">🗑️</button></td>
            `;
            tbody.appendChild(tr);
        });
    };

    // Admin memilih tanggal mulai & tanggal deadline
    window.updateOrderDate = function(id, type, val) {
        const ord = ordersDB.find(x => x.id === id);
        if (!ord) return;
        if (!val) { renderOrdersTable(); return; }
        if (type === 'start') {
            ord.startDate = val;
            if (ord.deadlineDate && ord.deadlineDate < val) ord.deadlineDate = val; // deadline ikut menyesuaikan
        } else {
            ord.deadlineDate = val;
            if (ord.startDate && ord.startDate > val) ord.startDate = val; // tanggal mulai ikut menyesuaikan
        }
        renderOrdersTable();
        if (openOrderId === id) renderOrderDetail();
    };

    /* ---------- POP UP DETAIL PESANAN ---------- */
    let openOrderId = null;

    window.openOrderDetailModal = function(id) {
        if (!ordersDB.find(x => x.id === id)) return;
        openOrderId = id;
        renderOrderDetail();
        document.getElementById('order-detail-modal').classList.add('active');
    };

    window.closeOrderDetailModal = function() {
        document.getElementById('order-detail-modal').classList.remove('active');
        openOrderId = null;
        renderOrdersTable();
    };

    function odRow(label, valueHtml) {
        return `<div style="display:flex; justify-content:space-between; align-items:center; gap:15px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.08);"><span style="color:rgba(255,255,255,0.6); font-size:0.85rem;">${label}</span><span style="font-weight:700; text-align:right; color:#fff;">${valueHtml}</span></div>`;
    }

    function renderOrderDetail() {
        const o = ordersDB.find(x => x.id === openOrderId);
        const box = document.getElementById('order-detail-content');
        if (!o || !box) return;
        const hasWorker = o.workerId && o.workerId !== '-';
        const badge = `<span style="color:${orderStatusColor(o.status)};">${escHtml(o.status)}</span>`;
        let html = '';
        html += o.productImg
            ? `<div style="text-align:center; margin-bottom:15px;"><img src="${escHtml(o.productImg)}" alt="Foto Produk" style="width:160px; height:160px; object-fit:cover; border-radius:16px; border:1px solid rgba(0,242,254,0.3); box-shadow:0 0 20px rgba(0,242,254,0.15);"></div>`
            : `<div style="text-align:center; margin-bottom:15px;"><div style="width:160px; height:160px; margin:0 auto; border-radius:16px; border:1px dashed rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:2.5rem; color:rgba(255,255,255,0.3);">🖼️</div></div>`;
        html += odRow('ID Pesanan', `<span style="color:#00f2fe;">${escHtml(o.id)}</span>`);
        html += odRow('Nama Produk', escHtml(o.productName));
        if (o.packageName) html += odRow('Paket Dipilih', escHtml(o.packageName));
        if (o.requestedWorkerId && !hasWorker) html += odRow('Worker Pilihan Customer', escHtml(o.requestedWorkerName || '') + ' <span style="font-size:0.75rem; color:rgba(255,255,255,0.5);">(' + escHtml(o.requestedWorkerId) + ')</span>');
        if (o.customerName) html += odRow('Pemesan', escHtml(o.customerName) + ' <span style="font-size:0.75rem; color:rgba(255,255,255,0.5);">(' + escHtml(o.customerId) + ')</span>');
        html += odRow('Nominal', formatRp(o.nominal));
        html += odRow('Tanggal Mulai', fmtDate(o.startDate));

        if (o.status === 'Complete') {
            // Informasi tambahan setelah pesanan selesai
            const ev = evaluateOrder(o);
            html += odRow('ID Nexora Worker', escHtml(o.workerId));
            html += odRow('Deadline', `<span style="color:${ev.color};">${fmtDate(o.deadlineDate)}</span> <span style="color:${ev.color}; margin-left:6px;">${ev.text}</span>`);
            html += odRow('Diselesaikan Pada', fmtDate(o.completedDate));
            html += odRow('Status', badge);
        } else {
            html += odRow('Deadline', `<span style="color:#ffaa00;">${fmtDate(o.deadlineDate)}</span>`);
            html += odRow('Status Saat Ini', badge);
            if (hasWorker) html += odRow('ID Nexora Worker', escHtml(o.workerId));
            html += `
                <div style="margin-top:20px;">
                    <label style="display:block; font-size:0.8rem; color:rgba(255,255,255,0.6); margin-bottom:8px; letter-spacing:1px;">UBAH STATUS PESANAN</label>
                    <select id="od-status-select" class="admin-input" onchange="onOrderStatusSelect(this.value)" style="margin-bottom:10px;">
                        <option value="" disabled ${o.status === 'Pending' ? 'selected' : ''}>-- Pilih Status --</option>
                        <option value="On Process" ${o.status === 'On Process' ? 'selected' : ''}>On Process</option>
                        <option value="Complete">Complete</option>
                    </select>
                    <div id="od-worker-box" style="display:${o.status === 'On Process' ? 'block' : 'none'};">
                        <input type="text" id="od-worker-id" class="admin-input" placeholder="ID Nexora Worker (cth: NEXW-971016-001)" value="${hasWorker ? escHtml(o.workerId) : escHtml(o.requestedWorkerId || '')}" style="margin-bottom:10px;">
                        <button type="button" class="btn-futuristic" onclick="saveOrderWorker()" style="width:100%; padding:10px;">SIMPAN ON PROCESS</button>
                    </div>
                </div>`;
        }
        // Hubungi pemesan (Chat Nexora / WhatsApp / Email)
        const buyer = findBuyer(o);
        const waNum = waDigits(buyer && buyer.wa);
        const waMsgTxt = encodeURIComponent(`Halo ${(buyer && buyer.name) || o.customerName || ''}, saya Admin Nexora terkait pesanan ${o.id} (${o.productName}).`);
        html += `<div style="margin-top:18px;"><div class="profile-label">Hubungi Pemesan</div><div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">`
            + `<button type="button" class="contact-link" style="cursor:pointer; color:#b388ff; border-color:rgba(179,136,255,0.5); font-family:inherit;" onclick="contactOrderCustomer('${o.id}')">💬 Chat di Nexora</button>`
            + (waNum ? `<a class="contact-link contact-wa" href="https://wa.me/${waNum}?text=${waMsgTxt}" target="_blank" rel="noopener">WhatsApp</a>` : '')
            + (buyer && buyer.email ? `<a class="contact-link contact-email" href="mailto:${escHtml(buyer.email)}?subject=${encodeURIComponent('Pesanan Nexora ' + o.id)}">Email</a>` : '')
            + `</div></div>`;
        box.innerHTML = html;
    }

    function waDigits(wa) {
        let d = String(wa || '').replace(/\D/g, '');
        if (d.startsWith('0')) d = '62' + d.slice(1);
        return d;
    }

    // Admin langsung membuka chat dengan pemesan dari pesanan
    window.contactOrderCustomer = function(id) {
        const o = ordersDB.find(x => x.id === id);
        if (!o || !o.customerId) { customAlert('Data pemesan tidak ditemukan.'); return; }
        document.getElementById('order-detail-modal').classList.remove('active');
        openOrderId = null;
        pushNav({ page: 'page-3', adm: 'chat', cat: '' });
        openAdminChatFromNotif(o.customerId);
    };

    window.openOrderFromNotif = function(id) {
        pushNav({ page: 'page-3', adm: 'orders', cat: '' });
        showAdminSub('orders');
        openOrderDetailModal(id);
    };

    window.onOrderStatusSelect = function(val) {
        const o = ordersDB.find(x => x.id === openOrderId);
        if (!o) return;
        if (val === 'On Process') {
            // Langsung muncul input ID Nexora Worker
            const wb = document.getElementById('od-worker-box');
            if (wb) wb.style.display = 'block';
            const inp = document.getElementById('od-worker-id');
            if (inp) inp.focus();
        } else if (val === 'Complete') {
            if (!o.workerId || o.workerId === '-') {
                customAlert('Isi dulu <strong>ID Nexora Worker</strong> lewat status <strong>On Process</strong> sebelum menyelesaikan pesanan.');
                renderOrderDetail();
                return;
            }
            customConfirm('Apakah Kamu Yakin untuk menyelesaikan Pesanan ini?', () => {
                // YA: status menjadi Complete, kembali ke list
                o.status = 'Complete';
                o.completedDate = todayStr();
                finalizeOrder(o);
                closeOrderDetailModal();
                customAlert('Pesanan <strong>' + escHtml(o.id) + '</strong> berhasil diselesaikan!');
            }, () => {
                // TIDAK: kembali ke list pesanan
                closeOrderDetailModal();
            });
        }
    };

    window.saveOrderWorker = function() {
        const o = ordersDB.find(x => x.id === openOrderId);
        const inp = document.getElementById('od-worker-id');
        if (!o || !inp) return;
        const v = inp.value.trim();
        if (!v) { customAlert('ID Nexora Worker wajib diisi.'); return; }
        const w = (typeof workersDB !== 'undefined') ? workersDB.find(x => x.id.toLowerCase() === v.toLowerCase()) : null;
        const prevWorkerId = (o.workerId && o.workerId !== '-') ? o.workerId : null;
        o.workerId = w ? w.id : v;
        o.status = 'On Process';

        // Status Data Worker -> On Progress + ID Pesanan (worker lama dikembalikan bila diganti)
        if (prevWorkerId && prevWorkerId !== o.workerId) refreshWorkerStatus(prevWorkerId);
        refreshWorkerStatus(o.workerId);
        recordOrderFinance(o);

        renderOrdersTable();
        renderOrderDetail();
        renderWorkerTable();
        if (typeof renderFinanceTable === 'function') renderFinanceTable();

        if (!w) {
            customAlert('Pesanan diatur ke On Process. Perhatian: ID <strong>' + escHtml(v) + '</strong> tidak ditemukan di Data Worker.');
        } else if (w.status === 'On Progress') {
            customAlert('Pesanan diatur ke On Process.<br>Worker <strong>' + escHtml(w.name) + '</strong> (' + escHtml(w.id) + ') kini berstatus <strong>On Progress</strong> dengan ID Pesanan <strong>' + escHtml(o.id) + '</strong>.' + (w.availability === 'off' ? '<br><span style="color:#ffaa00;">Catatan: worker menandai dirinya Tidak Menerima Job.</span>' : ''));
        } else {
            customAlert('Pesanan diatur ke On Process. Status worker <strong>' + escHtml(w.name) + '</strong> tetap <strong>' + escHtml(w.status) + '</strong> (tidak diubah).');
        }
    };

    // Hitung ulang status worker berdasarkan pesanan On Process miliknya
    function refreshWorkerStatus(workerId) {
        const w = workersDB.find(x => x.id === workerId);
        if (!w) return;
        if (!['Worker', 'On Progress'].includes(w.status)) return;
        const act = ordersDB.filter(o => o.workerId === w.id && o.status === 'On Process');
        if (act.length) {
            w.status = 'On Progress';
            w.orderId = act.map(o => o.id).join(', ');
            w.project = act.map(o => o.productName).join(', ');
            w.customer = [...new Set(act.map(o => o.customerName).filter(Boolean))].join(', ');
        } else if (w.orderId) {
            w.status = 'Worker'; w.orderId = ''; w.project = ''; w.customer = '';
        }
    }

    // Badge Pesanan Admin & Tandai Dibaca (REVISI 7)
    window.updateOrderBadge = function() {
        if (typeof ordersDB === 'undefined') return;
        let unreadCount = ordersDB.filter(o => !o.isRead).length;
        const badge = document.getElementById('order-badge-notif');
        if (badge) {
            if (unreadCount > 0) {
                badge.innerText = unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    };

    window.markOrdersAsRead = function() {
        if (typeof ordersDB !== 'undefined') {
            ordersDB.forEach(o => { if (!o.isRead) o.isRead = true; });
            updateOrderBadge();
            try { renderAdminNotifications(); } catch (err) {}
        }
    };

    /* =========================================
       LAPORAN KEUANGAN
       ========================================= */
    const JASA_CATEGORIES = ['Design', 'Animasi', 'Pajak', 'Audit Finance', 'Pembuatan Website'];
    const FIN_TYPES = { '10': 'Pemasukan', '20': 'Pengeluaran', '30': 'Hutang', '40': 'Laba', '50': 'Bagi Hasil', '90': 'Lainnya' };
    const fmtLongDate = (iso) => {
        if (!iso) return '-';
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    // ID Keuangan: KEU- + 5 digit acak + 2 digit kode kategori (cth: KEU-1234510)
    function newFinanceId(code) {
        let id;
        do { id = `KEU-${Math.floor(10000 + Math.random() * 90000)}${code}`; } while (financeDB.some(f => f.id === id));
        return id;
    }

    // Total Income = nominal tanpa kode unik x persen Bagi Hasil
    function finTotalIncome(f) {
        if (!(f.masuk > 0) || f.pct === null || f.pct === undefined) return null;
        return Math.round((f.base || 0) * f.pct / 100);
    }

    function findBuyer(o) {
        return customersDB.find(c => c.id === o.customerId) || workersDB.find(w => w.id === o.customerId) || null;
    }

    // Dipanggil saat Admin mengkonfirmasi pesanan (On Process): catat uang masuk + tambah total belanja pembeli
    function recordOrderFinance(o) {
        const isJasa = JASA_CATEGORIES.includes(o.category);
        const ref = isJasa ? o.workerId : o.id;
        if (o.financeId) {
            const row = financeDB.find(f => f.id === o.financeId);
            if (row) { row.workerId = o.workerId; row.ref = ref; }
            return;
        }
        const base = (typeof o.baseNominal === 'number') ? o.baseNominal : Math.floor(o.nominal / 1000) * 1000; // buang 3 digit kode unik
        const row = {
            id: newFinanceId('10'), code: '10', kind: 'pemasukan', date: todayStr(),
            productName: o.productName, ref: ref, orderId: o.id, workerId: o.workerId,
            masuk: o.nominal, keluar: 0, base: base, pct: null
        };
        financeDB.push(row);
        o.financeId = row.id;
        const buyer = findBuyer(o);
        if (buyer) buyer.spent = (buyer.spent || 0) + o.nominal;
    }

    // Dipanggil saat pesanan Complete: worker bebas lagi + upah worker tercatat sebagai uang keluar
    function finalizeOrder(o) {
        if (o.workerId && o.workerId !== '-') refreshWorkerStatus(o.workerId);
        if (o.workerId && o.workerId !== '-' && o.financeId && !o.payrollId) {
            const row = {
                id: newFinanceId('20'), code: '20', kind: 'upah', date: todayStr(),
                productName: 'Upah Worker - ' + o.productName, ref: o.workerId, orderId: o.id, workerId: o.workerId,
                masuk: 0, keluar: 0, base: 0, pct: null, parent: o.financeId
            };
            financeDB.push(row);
            o.payrollId = row.id;
            recalcPayroll(o.financeId);
        }
        syncWorkerEarnings();
        renderWorkerTable();
        if (typeof renderFinanceTable === 'function') renderFinanceTable();
    }

    // Upah worker = Total Income baris pemasukan (setelah Bagi Hasil diatur Admin)
    function recalcPayroll(parentId) {
        const parent = financeDB.find(f => f.id === parentId);
        if (!parent) return;
        const t = finTotalIncome(parent) || 0;
        financeDB.filter(f => f.kind === 'upah' && f.parent === parentId).forEach(f => { f.keluar = t; });
    }

    // Saldo & income worker = nilai awal + seluruh upah (hasil bagi hasil) dari pesanan yang selesai
    function syncWorkerEarnings() {
        workersDB.forEach(w => {
            if (w._baseBalance === undefined) { w._baseBalance = w.balance || 0; w._baseIncome = w.income || 0; }
            const earned = financeDB.filter(f => f.kind === 'upah' && f.workerId === w.id).reduce((a, f) => a + (f.keluar || 0), 0);
            w.balance = w._baseBalance + earned;
            w.income = w._baseIncome + earned;
        });
    }

    window.updateFinancePct = function(id, val) {
        const f = financeDB.find(x => x.id === id);
        if (!f) return;
        const raw = String(val).replace(',', '.').trim();
        if (raw === '') { f.pct = null; }
        else {
            let n = parseFloat(raw);
            if (isNaN(n)) n = 0;
            f.pct = Math.min(100, Math.max(0, n));
        }
        recalcPayroll(id);
        syncWorkerEarnings();
        renderFinanceTable();
    };

    // Hapus baris keuangan + efek sampingnya (total belanja pembeli & penanda di pesanan)
    function purgeFinanceRows(rows) {
        rows.forEach(f => {
            if (f.kind === 'pemasukan' && f.orderId) {
                const o = ordersDB.find(x => x.id === f.orderId);
                const buyer = o ? findBuyer(o) : null;
                if (buyer) buyer.spent = Math.max(0, (buyer.spent || 0) - (f.masuk || 0));
                if (o) delete o.financeId;
            }
            if (f.kind === 'upah' && f.orderId) {
                const o = ordersDB.find(x => x.id === f.orderId);
                if (o) delete o.payrollId;
            }
        });
        const ids = new Set(rows.map(f => f.id));
        financeDB = financeDB.filter(f => !ids.has(f.id));
    }
    window.deleteFinanceRow = function(id) {
        const f = financeDB.find(x => x.id === id);
        if (!f) return;
        const kids = financeDB.filter(x => x.parent === id);
        askDeletePassword('Hapus transaksi <strong>' + escHtml(f.id) + '</strong> (' + escHtml(f.productName) + ')?' + (kids.length ? '<br>Catatan upah worker terkait ikut terhapus.' : ''), () => {
            purgeFinanceRows([f].concat(kids));
            syncWorkerEarnings();
            renderFinanceTable();
            try { renderWorkerTable(); renderAdminNotifications(); } catch (err) {}
        });
    };

    window.renderFinanceTable = function() {
        const tb = document.getElementById('finance-table-tbody');
        const tf = document.getElementById('finance-table-tfoot');
        const sm = document.getElementById('fin-summary');
        if (!tb) return;
        tb.innerHTML = '';
        let sumIn = 0, sumOut = 0, sumInc = 0;
        if (financeDB.length === 0) {
            tb.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 20px;">Belum ada data keuangan. Data masuk otomatis setelah pesanan dikonfirmasi (On Process).</td></tr>`;
        }
        financeDB.forEach((f, i) => {
            const inc = finTotalIncome(f);
            sumIn += f.masuk || 0; sumOut += f.keluar || 0; sumInc += inc || 0;
            const pctCell = f.masuk > 0
                ? `<input type="number" class="fin-pct-input" min="0" max="100" step="0.5" placeholder="%" value="${f.pct === null || f.pct === undefined ? '' : f.pct}" onchange="updateFinancePct('${f.id}', this.value)"> %`
                : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td style="font-weight:700; color:#00f2fe;">${escHtml(f.id)}<br><span class="fin-type t${f.code}">${FIN_TYPES[f.code] || 'Lainnya'}</span></td>
                <td>${fmtLongDate(f.date)}</td>
                <td style="font-weight:700;">${escHtml(f.productName)}</td>
                <td>${escHtml(f.ref || '-')}</td>
                <td style="color:#34A853; font-weight:700;">${f.masuk > 0 ? formatRp(f.masuk) : '-'}</td>
                <td style="color:#ff6b8a; font-weight:700;">${f.keluar > 0 ? formatRp(f.keluar) : '-'}</td>
                <td style="text-align:center;">${pctCell}</td>
                <td style="color:#00f2fe; font-weight:800;">${inc === null ? '-' : formatRp(inc)}</td>
                <td><button type="button" class="fin-del" onclick="deleteFinanceRow('${f.id}')" title="Hapus">✕</button></td>`;
            tb.appendChild(tr);
        });
        if (tf) tf.innerHTML = `<tr><td colspan="5" style="text-align:right;">TOTAL</td><td>${formatRp(sumIn)}</td><td>${formatRp(sumOut)}</td><td></td><td>${formatRp(sumInc)}</td><td></td></tr>`;
        if (sm) sm.innerHTML = `
            <div class="fin-card"><div class="lbl">Total Uang Masuk</div><div class="val">${formatRp(sumIn)}</div></div>
            <div class="fin-card out"><div class="lbl">Total Uang Keluar</div><div class="val">${formatRp(sumOut)}</div></div>
            <div class="fin-card inc"><div class="lbl">Total Income (Bagi Hasil)</div><div class="val">${formatRp(sumInc)}</div></div>
            <div class="fin-card"><div class="lbl">Selisih (Masuk - Keluar)</div><div class="val">${sumIn - sumOut < 0 ? '-' : ''}${formatRp(Math.abs(sumIn - sumOut))}</div></div>`;
    };

    // Transaksi manual (pengeluaran, hutang, laba, dll)
    const finCat = document.getElementById('fin-m-cat');
    const finDir = document.getElementById('fin-m-dir');
    if (finCat && finDir) finCat.addEventListener('change', () => { finDir.value = ['10', '40'].includes(finCat.value) ? 'masuk' : 'keluar'; });
    const btnFinAdd = document.getElementById('btn-fin-add');
    if (btnFinAdd) btnFinAdd.addEventListener('click', () => {
        finCat.value = '20'; finDir.value = 'keluar';
        document.getElementById('fin-m-name').value = ''; document.getElementById('fin-m-ref').value = ''; document.getElementById('fin-m-amount').value = '';
        document.getElementById('fin-manual-modal').classList.add('active');
    });
    const btnFinSave = document.getElementById('btn-fin-m-save');
    if (btnFinSave) btnFinSave.addEventListener('click', () => {
        const code = finCat.value;
        const name = document.getElementById('fin-m-name').value.trim();
        const ref = document.getElementById('fin-m-ref').value.trim();
        const amount = parseInt(document.getElementById('fin-m-amount').value.replace(/\D/g, ''), 10) || 0;
        if (!name || amount <= 0) { customAlert('Nama/keterangan dan nominal wajib diisi.'); return; }
        const masuk = finDir.value === 'masuk';
        financeDB.push({
            id: newFinanceId(code), code: code, kind: 'manual', date: todayStr(),
            productName: name, ref: ref || '-', orderId: '', workerId: '',
            masuk: masuk ? amount : 0, keluar: masuk ? 0 : amount, base: masuk ? amount : 0, pct: null
        });
        document.getElementById('fin-manual-modal').classList.remove('active');
        renderFinanceTable();
    });

    /* =========================================
       POCKET WORKER & PENCAIRAN DANA
       ========================================= */
    const byId = (x) => document.getElementById(x);
    const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const fmtDT = (ts) => { if (!ts) return '-'; const d = new Date(ts); return `${pad2(d.getDate())} ${BLN[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
    const PO_COLOR = { 'Pending': '#ffaa00', 'On Process': '#00f2fe', 'Success': '#34A853' };
    const PO_LABEL = { 'Pending': 'Menunggu Admin', 'On Process': 'On Process', 'Success': 'Success' };
    const PO_PROC_NOTE = 'Dana akan cair dalam 1x24 jam';

    // "BCA 12345678 A/N Nama" -> { bank, no, name }
    function parseRek(s) { const m = String(s || '').match(/^(.*?)\s+(\d+)\s+A\/N\s+(.*)$/i); return m ? { bank: m[1].trim(), no: m[2], name: m[3].trim() } : null; }
    // Saldo Pendapatan = w.balance (total yang masuk). Saldo Tersisa = Saldo Pendapatan - semua pencairan yang sudah diajukan.
    function pocketReserved(w) { return payoutsDB.filter(p => p.workerId === w.id).reduce((a, p) => a + (p.amount || 0), 0); }
    function pocketRemaining(w) { return Math.max(0, (w.balance || 0) - pocketReserved(w)); }
    function pocketWorker() { return (currentUser && currentUser.role === 'worker') ? getCurrentRecord() : null; }
    function newPayoutId() { let id; do { id = 'WD-' + Math.floor(100000 + Math.random() * 900000); } while (payoutsDB.some(p => p.id === id)); return id; }
    const amtDigits = () => parseInt(String(byId('pk-amount').value).replace(/\D/g, ''), 10) || 0;
    const fmtDots = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    /* ----- Sisi Worker ----- */
    function poRowW(l, v) { return `<div class="pk-row"><span>${l}</span><b>${v}</b></div>`; }
    function poCardWorker(p) {
        const col = PO_COLOR[p.status] || '#fff';
        let note = '';
        if (p.status === 'Pending') note = '<div class="pk-note wait">⏳ Permintaan terkirim. Menunggu Admin memproses.</div>';
        if (p.status === 'On Process') note = `<div class="pk-note proc">⏱️ Pencairan sedang diproses. ${PO_PROC_NOTE}.</div>`;
        if (p.status === 'Success') note = '<div class="pk-note ok">✅ Dana telah ditransfer ke rekening Anda.</div>';
        const proof = p.proofUrl ? `<a class="pk-proof" href="${escHtml(p.proofUrl)}" target="_blank" rel="noopener">🧾 Lihat Bukti Transfer</a>` : '';
        return `<div class="pk-card" style="border-color:${col}55;">
            <div class="pk-card-top"><div><div class="pk-id">${escHtml(p.id)}</div><div class="pk-amount-big">${formatRp(p.amount)}</div></div><span class="pk-chip" style="color:${col}; border-color:${col};">${PO_LABEL[p.status] || escHtml(p.status)}</span></div>
            ${note}
            ${poRowW('Rekening Tujuan', escHtml(p.bank) + ' &bull; ' + escHtml(p.accNo) + '<br><small>a.n. ' + escHtml(p.accName) + '</small>')}
            ${poRowW('Waktu Pengajuan', fmtDT(p.requestedAt))}
            ${poRowW('Waktu On Process', fmtDT(p.processAt))}
            ${poRowW('Waktu Success', fmtDT(p.successAt))}
            ${p.adminId ? poRowW('Diproses oleh Admin', escHtml(p.adminId)) : ''}
            ${poRowW('Saldo Tersisa Setelah Pengajuan', formatRp(p.balanceAfter || 0))}
            ${proof}
        </div>`;
    }

    function renderPocket() {
        const w = pocketWorker();
        if (!w || !byId('pk-hero')) return;
        const mine = payoutsDB.filter(p => p.workerId === w.id).sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
        const remaining = pocketRemaining(w);
        const inProc = mine.filter(p => p.status !== 'Success').reduce((a, p) => a + (p.amount || 0), 0);
        const done = mine.filter(p => p.status === 'Success').reduce((a, p) => a + (p.amount || 0), 0);
        byId('pk-hero').innerHTML = `<span>SALDO TERSISA</span><b>${formatRp(remaining)}</b><small>Dapat dicairkan sebagian atau seluruhnya</small>`;
        byId('pk-stats').innerHTML = `<div class="pk-stat"><span>Saldo Pendapatan</span><b>${formatRp(w.balance || 0)}</b></div><div class="pk-stat"><span>Dalam Proses</span><b style="color:#ffaa00;">${formatRp(inProc)}</b></div><div class="pk-stat"><span>Sudah Cair</span><b style="color:#34A853;">${formatRp(done)}</b></div>`;
        const rk = parseRek(w.rekening);
        byId('pk-dest').innerHTML = rk
            ? `<div class="pk-dest-l">REKENING TUJUAN (sesuai data profil Anda)</div><div class="pk-dest-v">${escHtml(rk.bank)} &bull; ${escHtml(rk.no)}</div><div class="pk-dest-s">a.n. ${escHtml(rk.name)}</div>`
            : '<div class="pk-dest-warn">⚠️ Rekening pencairan belum lengkap. Isi Bank, Nomor Rekening & Atas Nama pada profil Anda terlebih dahulu.</div>';
        byId('pk-submit').disabled = !rk || remaining <= 0;
        byId('pk-history').innerHTML = mine.length ? mine.map(poCardWorker).join('') : '<div class="pk-empty">Belum ada riwayat pencairan.</div>';
    }

    window.openPocket = function() {
        if (!pocketWorker()) { customAlert('Silakan login sebagai Worker terlebih dahulu.'); return; }
        byId('pk-amount').value = '';
        renderPocket();
        byId('worker-pocket-modal').classList.add('active');
    };
    window.closePocket = function() { byId('worker-pocket-modal').classList.remove('active'); };

    function refreshPocketFields() {
        const w = pocketWorker();
        if (!w) return;
        const a = byId('dash-w-balance'), b = byId('dash-w-remaining');
        if (a) a.value = formatRp(w.balance || 0);
        if (b) b.value = formatRp(pocketRemaining(w));
        if (byId('worker-pocket-modal') && byId('worker-pocket-modal').classList.contains('active')) renderPocket();
    }

    function requestPayout() {
        const w = pocketWorker();
        if (!w) return;
        const rk = parseRek(w.rekening);
        if (!rk) { customAlert('Rekening pencairan belum lengkap. Lengkapi Bank, Nomor Rekening, dan Atas Nama di profil Anda terlebih dahulu.'); return; }
        const amt = amtDigits(), remaining = pocketRemaining(w);
        if (amt <= 0) { customAlert('Masukkan nominal pencairan terlebih dahulu.'); return; }
        if (amt > remaining) { customAlert('Nominal melebihi Saldo Tersisa Anda (<strong>' + formatRp(remaining) + '</strong>).'); return; }
        customConfirm(
            `<div style="text-align:left;"><div style="font-size:0.9rem; margin-bottom:10px;">Dana sebesar <strong style="color:#00f2fe;">${formatRp(amt)}</strong> akan ditransfer ke rekening berikut:</div>` +
            `<div style="background:rgba(0,0,0,0.4); border:1px solid rgba(0,242,254,0.3); border-radius:12px; padding:12px 14px; line-height:1.6;"><div style="font-size:0.7rem; color:rgba(255,255,255,0.5); letter-spacing:1px;">BANK</div><strong>${escHtml(rk.bank)}</strong><div style="font-size:0.7rem; color:rgba(255,255,255,0.5); letter-spacing:1px; margin-top:6px;">NOMOR REKENING</div><strong>${escHtml(rk.no)}</strong><div style="font-size:0.7rem; color:rgba(255,255,255,0.5); letter-spacing:1px; margin-top:6px;">ATAS NAMA</div><strong>${escHtml(rk.name)}</strong></div>` +
            `<div style="font-size:0.8rem; color:#ffaa00; margin-top:10px;">Pastikan data rekening sudah benar. Lanjutkan pencairan?</div></div>`,
            () => {
                const w2 = pocketWorker();
                if (!w2) return;
                const rem2 = pocketRemaining(w2);
                if (amt > rem2) { customAlert('Saldo Tersisa berubah. Nominal melebihi saldo (<strong>' + formatRp(rem2) + '</strong>).'); renderPocket(); return; }
                const rk2 = parseRek(w2.rekening) || rk;
                payoutsDB.unshift({
                    id: newPayoutId(), workerId: w2.id, workerName: w2.name, amount: amt,
                    bank: rk2.bank, accNo: rk2.no, accName: rk2.name,
                    status: 'Pending', requestedAt: Date.now(), processAt: null, successAt: null,
                    adminId: '', proofUrl: '', proofName: '', proofMime: '', balanceAfter: rem2 - amt
                });
                byId('pk-amount').value = '';
                renderPocket(); refreshPocketFields(); updatePayoutBadge();
                try { if (adminAuthed) renderAdminNotifications(); } catch (err) {}
                customAlert('Permintaan pencairan <strong>' + formatRp(amt) + '</strong> terkirim ke Admin. Pantau statusnya di riwayat Pocket.');
            }
        );
    }

    (function bindPocket() {
        const amt = byId('pk-amount');
        if (!amt) return;
        amt.addEventListener('input', () => { const n = parseInt(amt.value.replace(/\D/g, ''), 10) || 0; amt.value = n ? fmtDots(n) : ''; });
        byId('pk-all').addEventListener('click', () => { const w = pocketWorker(); if (w) amt.value = fmtDots(pocketRemaining(w)); });
        byId('pk-half').addEventListener('click', () => { const w = pocketWorker(); if (w) amt.value = fmtDots(Math.floor(pocketRemaining(w) / 2)); });
        byId('pk-submit').addEventListener('click', requestPayout);
    })();

    // Pemberitahuan ke Worker saat status pencairan berubah (mis. dari perangkat Admin)
    let poSeen = {};
    function snapPayoutStatus() { poSeen = {}; payoutsDB.forEach(p => { poSeen[p.id] = p.status; }); }
    function notifyPayoutChanges() {
        const w = pocketWorker();
        payoutsDB.forEach(p => {
            const prev = poSeen[p.id]; poSeen[p.id] = p.status;
            if (!w || p.workerId !== w.id || prev === undefined || prev === p.status) return;
            if (p.status === 'On Process') customAlert('Pencairan <strong>' + escHtml(p.id) + '</strong> (' + formatRp(p.amount) + ') sedang diproses. <strong>' + PO_PROC_NOTE + '.</strong>');
            if (p.status === 'Success') customAlert('Pencairan <strong>' + escHtml(p.id) + '</strong> (' + formatRp(p.amount) + ') <strong>berhasil</strong> ditransfer. Bukti transfer tersedia di riwayat Pocket.');
        });
    }

    /* ----- Sisi Admin ----- */
    let openPayoutId = null;
    window.updatePayoutBadge = function() {
        const b = byId('payout-badge-notif'); if (!b) return;
        const n = payoutsDB.filter(p => p.status === 'Pending').length;
        b.innerText = n; b.style.display = n > 0 ? 'flex' : 'none';
    };

    window.renderPayoutTable = function() {
        const tb = byId('payout-table-tbody'); if (!tb) return;
        tb.innerHTML = '';
        if (!payoutsDB.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Belum ada permintaan pencairan.</td></tr>'; return; }
        const rank = { 'Pending': 0, 'On Process': 1, 'Success': 2 };
        payoutsDB.slice().sort((a, b) => (rank[a.status] - rank[b.status]) || ((b.requestedAt || 0) - (a.requestedAt || 0))).forEach(p => {
            const col = PO_COLOR[p.status] || '#fff';
            const tr = document.createElement('tr'); tr.className = 'data-row';
            tr.addEventListener('click', () => openPayoutDetail(p.id));
            tr.innerHTML = `
                <td data-label="ID PENCAIRAN" style="font-weight:700; color:#00f2fe;">${escHtml(p.id)}</td>
                <td data-label="WORKER" style="font-weight:700;">${escHtml(p.workerName)}<br><span style="font-size:0.75rem; color:#00f2fe;">${escHtml(p.workerId)}</span></td>
                <td data-label="NOMINAL" style="color:#34A853; font-weight:800;">${formatRp(p.amount)}</td>
                <td data-label="REKENING TUJUAN">${escHtml(p.bank)} ${escHtml(p.accNo)}<br><span style="font-size:0.75rem; color:rgba(255,255,255,0.6);">a.n. ${escHtml(p.accName)}</span></td>
                <td data-label="DIAJUKAN" style="font-size:0.85rem;">${fmtDT(p.requestedAt)}</td>
                <td data-label="STATUS"><span style="color:${col}; font-weight:bold;">${PO_LABEL[p.status] || escHtml(p.status)}</span></td>
                <td data-label="AKSI" style="text-align:center;"><button type="button" class="btn-action-sm btn-view" onclick="event.stopPropagation(); openPayoutDetail('${p.id}')">DETAIL</button><button type="button" class="btn-action-sm btn-del" title="Hapus" onclick="event.stopPropagation(); deletePayout('${p.id}')">🗑️</button></td>`;
            tb.appendChild(tr);
        });
    };

    window.openPayoutDetail = function(id) {
        if (!payoutsDB.find(x => x.id === id)) return;
        openPayoutId = id;
        renderPayoutDetail();
        byId('payout-detail-modal').classList.add('active');
    };
    window.closePayoutDetail = function() {
        byId('payout-detail-modal').classList.remove('active');
        openPayoutId = null;
        renderPayoutTable();
    };
    window.openPayoutFromNotif = function(id) {
        pushNav({ page: 'page-3', adm: 'payout', cat: '' });
        showAdminSub('payout');
        openPayoutDetail(id);
    };

    function renderPayoutDetail() {
        const p = payoutsDB.find(x => x.id === openPayoutId);
        const box = byId('payout-detail-content');
        if (!p || !box) return;
        const col = PO_COLOR[p.status] || '#fff';
        let h = '';
        h += odRow('ID Pencairan', `<span style="color:#00f2fe;">${escHtml(p.id)}</span>`);
        h += odRow('Worker', escHtml(p.workerName) + '<br><small style="color:#00f2fe;">' + escHtml(p.workerId) + '</small>');
        h += odRow('Nominal Pencairan', `<span style="color:#34A853; font-size:1.1rem;">${formatRp(p.amount)}</span>`);
        h += odRow('Bank', escHtml(p.bank));
        h += odRow('Nomor Rekening', escHtml(p.accNo) + ` <button type="button" class="mt-copy" onclick="copyToClipboard('${escHtml(p.accNo)}')">Salin</button>`);
        h += odRow('Atas Nama', escHtml(p.accName));
        h += odRow('Waktu Pengajuan', fmtDT(p.requestedAt));
        h += odRow('Waktu On Process', fmtDT(p.processAt));
        h += odRow('Waktu Success', fmtDT(p.successAt));
        if (p.adminId) h += odRow('Diproses oleh', escHtml(p.adminId));
        h += odRow('Status', `<span style="color:${col};">${PO_LABEL[p.status] || escHtml(p.status)}</span>`);

        if (p.proofUrl) {
            const isImg = /^image\//.test(p.proofMime || '') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(p.proofUrl);
            h += `<div style="margin-top:14px; text-align:center;"><div style="font-size:0.75rem; color:rgba(255,255,255,0.55); margin-bottom:6px; letter-spacing:1px;">BUKTI TRANSFER</div>` +
                 (isImg ? `<a href="${escHtml(p.proofUrl)}" target="_blank" rel="noopener"><img src="${escHtml(p.proofUrl)}" alt="Bukti Transfer" style="max-width:100%; max-height:240px; border-radius:12px; border:1px solid rgba(52,168,83,0.5);"></a>`
                        : `<a class="pk-proof" href="${escHtml(p.proofUrl)}" target="_blank" rel="noopener">🧾 Buka Bukti Transfer${p.proofName ? ' (' + escHtml(p.proofName) + ')' : ''}</a>`) + `</div>`;
        }

        if (p.status !== 'Success') {
            h += `<div style="margin-top:20px;">
                <label style="display:block; font-size:0.8rem; color:rgba(255,255,255,0.6); margin-bottom:8px; letter-spacing:1px;">UBAH STATUS PENCAIRAN</label>
                <select id="po-status-select" class="admin-input" onchange="onPayoutStatusSelect(this.value)" style="margin-bottom:10px;">
                    <option value="" disabled ${p.status === 'Pending' ? 'selected' : ''}>-- Pilih Status --</option>
                    <option value="On Process" ${p.status === 'On Process' ? 'selected' : ''}>On Process</option>
                    <option value="Success" ${p.status === 'Pending' ? 'disabled' : ''}>Success${p.status === 'Pending' ? ' (proses dulu)' : ''}</option>
                </select>
                <div id="po-box-proc" style="display:none;">
                    <div class="pk-note proc" style="margin-bottom:10px;">Worker akan menerima pemberitahuan: ${PO_PROC_NOTE}.</div>
                    <button type="button" class="btn-futuristic" style="width:100%; padding:10px;" onclick="savePayoutStatus('On Process')">SIMPAN ON PROCESS</button>
                </div>
                <div id="po-box-success" style="display:none;">
                    <label style="display:block; font-size:0.8rem; color:#ffaa00; margin-bottom:6px; letter-spacing:1px;">UPLOAD BUKTI TRANSFER (WAJIB)</label>
                    <input type="file" id="po-proof" class="setup-input" accept="image/*,application/pdf" onchange="previewPayoutProof(this)" style="margin-bottom:8px;">
                    <div id="po-proof-prev" style="text-align:center; margin-bottom:10px;"></div>
                    <button type="button" class="btn-futuristic" style="width:100%; padding:10px; border-color:#34A853; color:#34A853;" onclick="savePayoutStatus('Success')">SIMPAN SUCCESS</button>
                </div>
            </div>`;
        }
        box.innerHTML = h;
    }

    window.onPayoutStatusSelect = function(val) {
        const p = payoutsDB.find(x => x.id === openPayoutId);
        if (!p) return;
        byId('po-box-proc').style.display = (val === 'On Process' && p.status === 'Pending') ? 'block' : 'none';
        byId('po-box-success').style.display = (val === 'Success') ? 'block' : 'none';
    };

    window.previewPayoutProof = function(input) {
        const prev = byId('po-proof-prev'); if (!prev) return;
        const f = input.files && input.files[0];
        if (!f) { prev.innerHTML = ''; return; }
        if (/^image\//.test(f.type)) {
            const u = URL.createObjectURL(f);
            prev.innerHTML = `<img src="${u}" alt="Pratinjau" style="max-width:100%; max-height:180px; border-radius:10px; border:1px solid rgba(255,255,255,0.2);">`;
        } else { prev.innerHTML = `<span style="font-size:0.8rem; color:rgba(255,255,255,0.7);">📄 ${escHtml(f.name)}</span>`; }
    };

    window.savePayoutStatus = function(target) {
        const p = payoutsDB.find(x => x.id === openPayoutId);
        if (!p) return;
        const done = (msg) => {
            updatePayoutBadge();
            try { renderAdminNotifications(); } catch (err) {}
            renderPayoutTable(); renderPayoutDetail();
            customAlert(msg);
        };
        if (target === 'On Process') {
            if (p.status !== 'Pending') return;
            p.status = 'On Process'; p.processAt = Date.now(); p.adminId = adminId || 'ADMIN';
            done('Pencairan <strong>' + escHtml(p.id) + '</strong> diubah ke <strong>On Process</strong>. Worker diberi tahu: ' + PO_PROC_NOTE + '.');
            return;
        }
        if (target === 'Success') {
            if (p.status !== 'On Process') { customAlert('Ubah status ke <strong>On Process</strong> terlebih dahulu.'); return; }
            const inp = byId('po-proof');
            const f = inp && inp.files && inp.files[0];
            if (!f) { customAlert('Wajib upload <strong>bukti transfer</strong> sebelum mengubah status menjadi Success.'); return; }
            if (!/^image\//.test(f.type) && f.type !== 'application/pdf') { customAlert('Bukti transfer harus berupa gambar (JPG/PNG) atau PDF.'); return; }
            if (f.size > 10 * 1024 * 1024) { customAlert('Ukuran bukti transfer maksimal 10 MB.'); return; }
            customConfirm('Pastikan dana <strong>' + formatRp(p.amount) + '</strong> sudah ditransfer ke <strong>' + escHtml(p.bank) + ' ' + escHtml(p.accNo) + '</strong> a.n. ' + escHtml(p.accName) + '. Ubah status menjadi Success?', () => {
                p.proofUrl = URL.createObjectURL(f); p.proofName = f.name; p.proofMime = f.type;
                p.status = 'Success'; p.successAt = Date.now(); p.adminId = p.adminId || adminId || 'ADMIN';
                done('Pencairan <strong>' + escHtml(p.id) + '</strong> berstatus <strong>Success</strong>. Bukti transfer tersimpan dan tampil di riwayat Pocket Worker.');
            });
        }
    };

    /* =========================================
       LOGIKA CMS VIDEO & PRODUK
       ========================================= */
    let currentCMSCategory = 'video';
    let editVideoId = null;
    let editProductId = null;

    window.switchCMSTab = function(category) {
        currentCMSCategory = category;
        document.querySelectorAll('.cms-cat-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`cms-tab-${category}`).classList.add('active');

        document.getElementById('content-upload-view').style.display = 'none';
        document.getElementById('product-upload-view').style.display = 'none';
        document.getElementById('banner-manage-view').style.display = 'none';

        if(category === 'banner') {
            document.getElementById('content-list-view').style.display = 'none';
            document.getElementById('product-list-view').style.display = 'none';
            document.getElementById('banner-manage-view').style.display = 'block';
            renderAdminBanners();
            return;
        }

        if(category === 'video') {
            document.getElementById('content-list-view').style.display = 'block';
            document.getElementById('product-list-view').style.display = 'none';
            renderAdminVideoList();
        } else {
            document.getElementById('content-list-view').style.display = 'none';
            document.getElementById('product-list-view').style.display = 'block';
            document.getElementById('lbl-active-product-cat').innerText = category.toUpperCase();
            renderAdminProductList(category);
        }
    }

    function getSortedVideos() {
        const now = new Date().getTime();
        return videosDB.map(v => {
            const isPinActive = v.isPinned && new Date(v.pinStart).getTime() <= now && new Date(v.pinEnd).getTime() >= now;
            return { ...v, isPinActive };
        }).sort((a, b) => {
            if (a.isPinActive && !b.isPinActive) return -1;
            if (!a.isPinActive && b.isPinActive) return 1;
            return b.createdAt - a.createdAt;
        });
    }

    window.renderMainVideos = function() {
        const grid = document.getElementById('main-video-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const sorted = getSortedVideos();
        
        if (sorted.length === 0) {
            grid.innerHTML = `<div class="empty-video-state" style="grid-column: 1 / -1;">BELUM ADA KONTEN VIDEO TERSEDIA</div>`;
            return;
        }

        const videosToShow = sorted.slice(0, 9);
        videosToShow.forEach(v => {
            let badgeHTML = '';
            if (v.badge === "NEW") badgeHTML = `<span class="badge-new">NEW</span>`;
            else if (v.badge === "1") badgeHTML = `<span class="badge-new badge-fire-1">🔥 HOT</span>`;
            else if (v.badge === "2") badgeHTML = `<span class="badge-new badge-fire-2">🔥🔥 TRENDING</span>`;
            else if (v.badge === "3") badgeHTML = `<span class="badge-new badge-fire-3">🔥🔥🔥 VIRAL</span>`;
            
            const card = document.createElement('div'); card.className = 'video-card';
            card.innerHTML = `
                ${badgeHTML}
                <div class="video-title">${v.title}</div>
                <video controls ${v.url ? `src="${v.url}"` : `poster="https://via.placeholder.com/600x337/1a2235/00f2fe?text=Nexora+Video"`}></video>
            `;
            grid.appendChild(card);
        });
    };

    window.renderAdminVideoList = function() {
        const grid = document.getElementById('admin-video-list');
        if(!grid) return;
        grid.innerHTML = '';
        const sorted = getSortedVideos();
        
        sorted.forEach(v => {
            const card = document.createElement('div'); card.className = 'video-card';
            card.style.transform = "none"; 
            card.innerHTML = `
                <div class="video-title" style="font-size:0.6rem;">${v.isPinActive ? '📌 ' : ''}${v.title}</div>
                <video ${v.url ? `src="${v.url}"` : `poster="https://via.placeholder.com/600x337/1a2235/00f2fe?text=Nexora+Video"`}></video>
                <div class="admin-vid-actions">
                    <button class="btn-vid-action btn-vid-edit" onclick="startEditVideo('${v.id}')">EDIT</button>
                    <button class="btn-vid-action btn-vid-del" onclick="deleteVideo('${v.id}')">HAPUS</button>
                </div>
            `;
            grid.appendChild(card);
        });
    };

    window.deleteVideo = function(id) {
        askDeletePassword("Hapus <strong>video</strong> ini secara permanen?", () => {
            videosDB = videosDB.filter(v => v.id !== id);
            renderAdminVideoList(); renderMainVideos();
        });
    };

    window.startEditVideo = function(id) {
        const v = videosDB.find(x => x.id === id);
        if(!v) return;
        editVideoId = id;
        document.getElementById('content-list-view').style.display = 'none';
        document.getElementById('content-upload-view').style.display = 'block';
        document.getElementById('form-vid-title').innerText = "EDIT KONTEN VIDEO";
        document.getElementById('up-vid-filename').innerText = "(Abaikan jika tidak ingin mengganti file video)";
        document.getElementById('up-vid-file').value = '';
        document.getElementById('up-vid-title').value = v.title;
        document.getElementById('up-vid-badge').value = v.badge;
        document.getElementById('up-vid-ispin').checked = v.isPinned;
        
        if (v.isPinned) {
            document.querySelectorAll('.pin-date-group').forEach(el => el.style.display = 'block');
            document.getElementById('up-vid-start').value = v.pinStart;
            document.getElementById('up-vid-end').value = v.pinEnd;
        } else {
            document.querySelectorAll('.pin-date-group').forEach(el => el.style.display = 'none');
            document.getElementById('up-vid-start').value = '';
            document.getElementById('up-vid-end').value = '';
        }
        validateVideoUpload();
        document.getElementById('btn-submit-video').innerText = "UPDATE VIDEO KONTEN";
    };

    const btnAddVideo = document.getElementById('btn-add-video');
    if(btnAddVideo) btnAddVideo.addEventListener('click', () => {
        editVideoId = null;
        document.getElementById('content-list-view').style.display = 'none';
        document.getElementById('content-upload-view').style.display = 'block';
        document.getElementById('form-vid-title').innerText = "UPLOAD VIDEO BARU";
        document.getElementById('up-vid-filename').innerText = "Klik disini untuk memilih File MP4";
        document.getElementById('up-vid-file').value = '';
        document.getElementById('up-vid-title').value = '';
        document.getElementById('up-vid-badge').value = '';
        document.getElementById('up-vid-ispin').checked = false;
        document.getElementById('up-vid-start').value = '';
        document.getElementById('up-vid-end').value = '';
        document.querySelectorAll('.pin-date-group').forEach(el => el.style.display = 'none');
        validateVideoUpload();
        
        const nowStr = new Date().toISOString().slice(0, 16);
        document.getElementById('up-vid-start').min = nowStr;
        document.getElementById('up-vid-end').min = nowStr;
        document.getElementById('btn-submit-video').innerText = "SIMPAN VIDEO KONTEN";
    });

    const isPinCheckbox = document.getElementById('up-vid-ispin');
    if(isPinCheckbox) isPinCheckbox.addEventListener('change', function() {
        const d = this.checked ? 'block' : 'none';
        document.querySelectorAll('.pin-date-group').forEach(el => el.style.display = d);
        validateVideoUpload();
    });

    function validateVideoUpload() {
        const fileHasValue = document.getElementById('up-vid-file').files.length > 0;
        const isEditing = editVideoId !== null;
        const title = document.getElementById('up-vid-title').value.trim();
        const isPin = document.getElementById('up-vid-ispin').checked;
        const start = document.getElementById('up-vid-start').value;
        const end = document.getElementById('up-vid-end').value;
        
        let valid = (fileHasValue || isEditing) && title !== "";
        if (isPin) { if(!start || !end || new Date(start) >= new Date(end)) valid = false; }
        document.getElementById('btn-submit-video').disabled = !valid;
    }
    
    const contentUploadView = document.getElementById('content-upload-view');
    if(contentUploadView) {
        contentUploadView.addEventListener('input', validateVideoUpload);
        contentUploadView.addEventListener('change', validateVideoUpload);
    }

    const btnSubmitVideo = document.getElementById('btn-submit-video');
    if(btnSubmitVideo) btnSubmitVideo.addEventListener('click', () => {
        const fileObj = document.getElementById('up-vid-file').files[0];
        if (editVideoId) {
            const vIndex = videosDB.findIndex(v => v.id === editVideoId);
            if(vIndex > -1) {
                if (fileObj) { videosDB[vIndex].url = URL.createObjectURL(fileObj); }
                videosDB[vIndex].title = document.getElementById('up-vid-title').value.trim();
                videosDB[vIndex].badge = document.getElementById('up-vid-badge').value;
                videosDB[vIndex].isPinned = document.getElementById('up-vid-ispin').checked;
                videosDB[vIndex].pinStart = document.getElementById('up-vid-start').value;
                videosDB[vIndex].pinEnd = document.getElementById('up-vid-end').value;
            }
            customAlert("Video konten berhasil diperbarui!");
        } else {
            const localUrl = fileObj ? URL.createObjectURL(fileObj) : '';
            videosDB.push({
                id: `VID-${new Date().getTime()}`,
                title: document.getElementById('up-vid-title').value.trim(),
                url: localUrl,
                badge: document.getElementById('up-vid-badge').value,
                isPinned: document.getElementById('up-vid-ispin').checked,
                pinStart: document.getElementById('up-vid-start').value,
                pinEnd: document.getElementById('up-vid-end').value,
                createdAt: new Date().getTime()
            });
            customAlert("Video berhasil diunggah ke katalog!");
        }
        document.getElementById('content-upload-view').style.display = 'none';
        document.getElementById('content-list-view').style.display = 'block';
        renderAdminVideoList(); renderMainVideos();     
    });


    // --- LOGIKA CMS PRODUK ---
    window.renderAdminProductList = function(category) {
        const grid = document.getElementById('admin-product-list');
        if(!grid) return;
        grid.innerHTML = '';
        const prods = productsDB.filter(p => p.category === category);
        
        if (prods.length === 0) { grid.innerHTML = `<div class="empty-video-state" style="grid-column: 1 / -1;">BELUM ADA PRODUK/JASA PADA KATEGORI INI</div>`; return; }

        prods.forEach(p => {
            const card = document.createElement('div'); card.className = 'product-card';
            card.innerHTML = `
                <div class="product-img-wrap">
                    ${p.status === 'Sold' ? `<div class="product-sold-overlay">SOLD</div>` : ''}
                    <img src="${p.imgUrl}">
                </div>
                <div class="product-info">
                    <h4>${p.name}</h4>
                    <p class="price">${productPriceLabel(p)}</p>
                </div>
                <div class="admin-vid-actions">
                    <button class="btn-vid-action btn-vid-toggle" onclick="toggleProductStatus('${p.id}', '${category}')">${p.status === 'Available' ? 'MARK SOLD' : 'MARK AVAIL'}</button>
                    <button class="btn-vid-action btn-vid-edit" onclick="startEditProduct('${p.id}')">EDIT</button>
                    <button class="btn-vid-action btn-vid-del" onclick="deleteProduct('${p.id}', '${category}')">HAPUS</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    const btnAddProduct = document.getElementById('btn-add-product');
    if(btnAddProduct) btnAddProduct.addEventListener('click', () => {
        editProductId = null;
        document.getElementById('product-list-view').style.display = 'none';
        document.getElementById('product-upload-view').style.display = 'block';
        document.getElementById('form-prod-title').innerText = `UPLOAD PRODUK BARU (${currentCMSCategory.toUpperCase()})`;
        
        document.getElementById('up-prod-filename').innerText = "Pilih Foto Produk (Wajib 1:1 / Kotak)";
        document.getElementById('up-prod-file').value = '';
        document.getElementById('up-prod-name').value = '';
        document.getElementById('up-prod-price').value = '';
        document.getElementById('up-prod-link').value = '';
        document.getElementById('up-prod-desc').value = '';
        setPkgRows([]); showPkgWrap(currentCMSCategory);
        validateProductUpload();
    });

    function validateProductUpload() {
        const file = document.getElementById('up-prod-file').files.length > 0;
        const isEditing = editProductId !== null;
        const name = document.getElementById('up-prod-name').value.trim();
        document.getElementById('btn-submit-product').disabled = !((file || isEditing) && name !== "");
    }
    
    const prodUploadView = document.getElementById('product-upload-view');
    if(prodUploadView) {
        prodUploadView.addEventListener('input', validateProductUpload);
        prodUploadView.addEventListener('change', validateProductUpload);
    }

    const btnSubmitProd = document.getElementById('btn-submit-product');
    if(btnSubmitProd) btnSubmitProd.addEventListener('click', () => {
        const fileObj = document.getElementById('up-prod-file').files[0];
        if (editProductId) {
            const pIndex = productsDB.findIndex(p => p.id === editProductId);
            if(pIndex > -1) {
                if(fileObj) productsDB[pIndex].imgUrl = URL.createObjectURL(fileObj);
                productsDB[pIndex].name = document.getElementById('up-prod-name').value.trim();
                productsDB[pIndex].price = document.getElementById('up-prod-price').value.replace(/\D/g, '');
                productsDB[pIndex].link = document.getElementById('up-prod-link').value.trim();
                productsDB[pIndex].desc = document.getElementById('up-prod-desc').value.trim();
                productsDB[pIndex].packages = JASA_CATEGORIES.includes(productsDB[pIndex].category) ? readPkgRows() : [];
            }
            customAlert("Produk berhasil diperbarui!");
        } else {
            productsDB.push({
                id: `PRD-${new Date().getTime()}`,
                category: currentCMSCategory,
                name: document.getElementById('up-prod-name').value.trim(),
                price: document.getElementById('up-prod-price').value.replace(/\D/g, ''),
                link: document.getElementById('up-prod-link').value.trim(),
                desc: document.getElementById('up-prod-desc').value.trim(),
                packages: JASA_CATEGORIES.includes(currentCMSCategory) ? readPkgRows() : [],
                imgUrl: fileObj ? URL.createObjectURL(fileObj) : '',
                status: 'Available'
            });
            customAlert("Produk berhasil diunggah ke kategori!");
        }
        document.getElementById('product-upload-view').style.display = 'none';
        document.getElementById('product-list-view').style.display = 'block';
        renderAdminProductList(currentCMSCategory);
        if(currentOpenMainCategory === currentCMSCategory) renderMainProducts(currentCMSCategory); 
    });

    window.deleteProduct = function(id, cat) {
        askDeletePassword("Hapus <strong>produk</strong> ini secara permanen?", () => {
            productsDB = productsDB.filter(p => p.id !== id);
            renderAdminProductList(cat);
            if(currentOpenMainCategory === cat) renderMainProducts(cat);
        });
    }

    window.toggleProductStatus = function(id, cat) {
        const p = productsDB.find(x => x.id === id);
        if(p) {
            p.status = p.status === 'Available' ? 'Sold' : 'Available';
            renderAdminProductList(cat);
            if(currentOpenMainCategory === cat) renderMainProducts(cat);
        }
    }

    window.startEditProduct = function(id) {
        const p = productsDB.find(x => x.id === id);
        if(!p) return;
        editProductId = id;

        document.getElementById('product-list-view').style.display = 'none';
        document.getElementById('product-upload-view').style.display = 'block';
        document.getElementById('form-prod-title').innerText = "EDIT PRODUK";
        
        document.getElementById('up-prod-filename').innerText = "(Abaikan jika tidak ingin mengganti foto)";
        document.getElementById('up-prod-file').value = '';
        document.getElementById('up-prod-name').value = p.name;
        document.getElementById('up-prod-price').value = String(p.price || '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        document.getElementById('up-prod-link').value = p.link;
        document.getElementById('up-prod-desc').value = p.desc || '';
        setPkgRows(productPackages(p)); showPkgWrap(p.category);
        validateProductUpload();
    };

    // --- LOGIKA HALAMAN UTAMA (KLIK KATEGORI) ---
    let currentOpenMainCategory = "";

    window.openMainCategory = function(category) {
        if (currentOpenMainCategory !== category) pushNav({ page: 'page-1', cat: category, adm: '' });
        currentOpenMainCategory = category;
        document.getElementById('main-view-default').style.display = 'none';
        document.getElementById('main-view-category').style.display = 'flex';
        document.getElementById('main-cat-title').innerText = `KATEGORI: ${category}`;
        renderMainProducts(category);
    }

    window.closeMainCategory = function() {
        currentOpenMainCategory = "";
        document.getElementById('main-view-category').style.display = 'none';
        document.getElementById('main-view-default').style.display = 'block';
    }

    window.renderMainProducts = function(category) {
        const grid = document.getElementById('main-product-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const prods = productsDB.filter(p => p.category === category);
        
        if (prods.length === 0) { grid.innerHTML = `<div class="empty-video-state" style="grid-column: 1 / -1;">KATEGORI INI SEDANG KOSONG</div>`; return; }

        prods.forEach(p => {
            const card = document.createElement('div'); card.className = 'product-card';
            const isSold = p.status === 'Sold';
            card.innerHTML = `
                <div class="product-img-wrap">
                    ${isSold ? `<div class="product-sold-overlay">SOLD</div>` : ''}
                    <img src="${p.imgUrl}">
                </div>
                <div class="product-info">
                    <h4>${p.name}</h4>
                    <p class="price">${productPriceLabel(p)}</p>
                    <button class="btn-buy ${isSold ? 'sold' : ''}" ${isSold ? 'disabled' : `onclick="event.stopPropagation(); openProductDetail('${p.id}')"`}>
                        ${isSold ? 'SOLD OUT' : 'AKU MAU'}
                    </button>
                </div>
            `;
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => openProductDetail(p.id));
            grid.appendChild(card);
        });
    }

    /* =========================================
       EDITOR PAKET (ADMIN) + DETAIL PRODUK (USER)
       ========================================= */
    function productNum(v) { return v ? (parseInt(String(v).replace(/\D/g, ''), 10) || 0) : 0; }
    function productPackages(p) { return (Array.isArray(p.packages) ? p.packages : []).filter(k => k && k.name); }
    function productPriceLabel(p) {
        const prices = productPackages(p).map(k => k.price || 0).filter(n => n > 0);
        if (prices.length) return 'Mulai ' + formatRp(Math.min.apply(null, prices));
        const n = productNum(p.price);
        return n ? formatRp(n) : 'Harga Menyesuaikan';
    }

    function showPkgWrap(cat) {
        const w = document.getElementById('up-prod-pkg-wrap');
        if (w) w.style.display = JASA_CATEGORIES.includes(cat) ? 'flex' : 'none';
    }
    function fmtThousands(v) { return String(v || '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function addPkgRow(d) {
        d = d || {};
        const list = document.getElementById('up-prod-pkg-list'); if (!list) return;
        const row = document.createElement('div'); row.className = 'pkg-row';
        row.innerHTML = '<input type="text" class="setup-input pkg-name" placeholder="Nama paket (cth: Basic)"><input type="text" inputmode="numeric" class="setup-input pkg-price" placeholder="Harga (Rp)"><textarea class="setup-input pkg-desc" rows="2" placeholder="Isi paket (cth: 2 revisi, 3 hari kerja, file PNG+PDF)"></textarea><button type="button" class="pkg-del" title="Hapus paket">✕</button>';
        row.querySelector('.pkg-name').value = d.name || '';
        row.querySelector('.pkg-price').value = d.price ? fmtThousands(d.price) : '';
        row.querySelector('.pkg-desc').value = d.desc || '';
        list.appendChild(row);
    }
    function setPkgRows(arr) {
        const list = document.getElementById('up-prod-pkg-list'); if (!list) return;
        list.innerHTML = '';
        (arr || []).forEach(addPkgRow);
    }
    function readPkgRows() {
        const out = [];
        document.querySelectorAll('#up-prod-pkg-list .pkg-row').forEach(r => {
            const name = r.querySelector('.pkg-name').value.trim();
            if (!name) return;
            out.push({ name: name, price: parseInt(r.querySelector('.pkg-price').value.replace(/\D/g, ''), 10) || 0, desc: r.querySelector('.pkg-desc').value.trim() });
        });
        return out;
    }
    const pkgList = document.getElementById('up-prod-pkg-list');
    if (pkgList) {
        pkgList.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.pkg-del'); if (b) b.closest('.pkg-row').remove(); });
        pkgList.addEventListener('input', (e) => { if (e.target.classList.contains('pkg-price')) e.target.value = fmtThousands(e.target.value); });
    }
    const btnAddPkg = document.getElementById('btn-add-pkg');
    if (btnAddPkg) btnAddPkg.addEventListener('click', () => addPkgRow());

    let pdState = null;
    function pickableWorkers() {
        return workersDB.filter(w => ['Worker', 'On Progress'].includes(w.status) && w.availability !== 'off' && !(currentUser && currentUser.id === w.id));
    }
    function workerOptHtml(w, selected, isStatic) {
        const av = renderAvatarHtml(w.avatar, escHtml((w.name || '?').trim().charAt(0).toUpperCase()));
        return `<div class="pd-wopt ${selected ? 'sel' : ''} ${isStatic ? 'static' : ''}" ${isStatic ? '' : `data-wid="${escHtml(w.id)}"`}><div class="avatar-wrapper pd-wav"><div class="avatar-o">${av}</div></div><div class="pd-winfo"><div class="nm">${escHtml(w.name)}</div><div class="idn">${escHtml(w.id)}</div></div>${w.status === 'On Progress' ? '<span class="pd-wtag">Sedang mengerjakan</span>' : ''}</div>`;
    }
    function anyWorkerHtml(selected, isStatic) {
        return `<div class="pd-wopt ${selected ? 'sel' : ''} ${isStatic ? 'static' : ''}" ${isStatic ? '' : 'data-wid=""'}><div class="avatar-wrapper pd-wav"><div class="avatar-o">🎲</div></div><div class="pd-winfo"><div class="nm">Serahkan ke Admin</div><div class="idn">Admin yang menentukan worker terbaik</div></div></div>`;
    }

    window.openProductDetail = function(id) {
        const p = productsDB.find(x => x.id === id);
        if (!p) return;
        pdState = { id: id, pkg: productPackages(p).length ? 0 : -1, wid: '', open: false };
        renderProductDetail();
        document.getElementById('product-detail-modal').classList.add('active');
    };
    window.closeProductDetail = function() {
        document.getElementById('product-detail-modal').classList.remove('active');
        pdState = null;
    };
    function renderProductDetail() {
        if (!pdState) return;
        const p = productsDB.find(x => x.id === pdState.id);
        if (!p) { closeProductDetail(); return; }
        const box = document.getElementById('pd-body');
        const isJasa = JASA_CATEGORIES.includes(p.category);
        const pk = productPackages(p);
        const chosen = pk[pdState.pkg] || null;
        const sold = p.status === 'Sold';
        const unit = chosen ? (chosen.price || 0) : productNum(p.price);
        const priceTxt = chosen ? (chosen.price ? formatRp(chosen.price) : 'Harga Menyesuaikan') : productPriceLabel(p);
        let h = '';
        if (p.imgUrl) h += `<div class="pd-img"><img src="${escHtml(p.imgUrl)}" alt=""></div>`;
        h += `<div class="pd-cat">${escHtml(p.category)}${isJasa ? ' &bull; JASA' : ''}</div><h3 class="pd-title">${escHtml(p.name)}</h3><div class="pd-price">${priceTxt}</div>`;
        h += `<div class="pd-section">Deskripsi</div><div class="pd-desc">${p.desc ? escHtml(p.desc).replace(/\n/g, '<br>') : '<span style="color:rgba(255,255,255,0.45);">Belum ada deskripsi untuk produk ini.</span>'}</div>`;
        if (isJasa && pk.length) {
            h += '<div class="pd-section">Pilih Paket</div><div class="pd-pkgs">';
            pk.forEach((k, i) => {
                h += `<div class="pd-pkg ${i === pdState.pkg ? 'sel' : ''}" data-pkg="${i}"><div class="pd-pkg-top"><b>${escHtml(k.name)}</b><span>${k.price ? formatRp(k.price) : 'Custom'}</span></div>${k.desc ? `<div class="pd-pkg-desc">${escHtml(k.desc).replace(/\n/g, '<br>')}</div>` : ''}</div>`;
            });
            h += '</div>';
        }
        if (isJasa) {
            const ws = pickableWorkers();
            const sel = ws.find(w => w.id === pdState.wid) || null;
            h += `<div class="pd-section">Pilih Worker</div><div class="pd-wdd ${pdState.open ? 'open' : ''}" id="pd-wdd"><div class="pd-wsel" id="pd-wsel">${sel ? workerOptHtml(sel, false, true) : anyWorkerHtml(false, true)}<span class="pd-caret">▾</span></div><div class="pd-wlist">${anyWorkerHtml(!sel)}${ws.map(w => workerOptHtml(w, sel && sel.id === w.id)).join('')}${ws.length ? '' : '<div class="pd-wempty">Belum ada worker yang tersedia saat ini. Admin akan menentukan worker untuk Anda.</div>'}</div></div>`;
        }
        if (unit > 0) h += `<div class="pd-total"><span>Total (sebelum kode unik)</span><b>${formatRp(unit)}</b></div>`;
        h += `<button type="button" class="btn-futuristic" id="pd-order" ${sold ? 'disabled' : ''} style="width:100%; margin-top:18px;">${sold ? 'SOLD OUT' : (p.link ? 'BUKA LINK PEMBELIAN' : 'LANJUT KE PEMBAYARAN')}</button>`;
        box.innerHTML = h;
    }
    const pdBody = document.getElementById('pd-body');
    if (pdBody) pdBody.addEventListener('click', (e) => {
        if (!pdState) return;
        const t = e.target;
        const pkg = t.closest('.pd-pkg');
        if (pkg) { pdState.pkg = parseInt(pkg.dataset.pkg, 10); renderProductDetail(); return; }
        if (t.closest('#pd-wsel')) { pdState.open = !pdState.open; document.getElementById('pd-wdd').classList.toggle('open', pdState.open); return; }
        const wo = t.closest('.pd-wopt[data-wid]');
        if (wo) { pdState.wid = wo.dataset.wid; pdState.open = false; renderProductDetail(); return; }
        if (t.closest('#pd-order')) {
            const id = pdState.id;
            const opt = { pkgIdx: pdState.pkg >= 0 ? pdState.pkg : null, workerId: pdState.wid || '' };
            closeProductDetail();
            buyProduct(id, opt);
        }
    });
    const pdClose = document.getElementById('pd-close');
    if (pdClose) pdClose.addEventListener('click', () => closeProductDetail());
    const pdModal = document.getElementById('product-detail-modal');
    if (pdModal) pdModal.addEventListener('click', (e) => { if (e.target === pdModal) closeProductDetail(); });

    renderMainVideos();

    /* =========================================
       FUNGSI AVATAR GLOBAL (UPLOAD & SAVE)
       ========================================= */
    let currentTempAvatarUrl = ""; 

    function setAvatarPreview(previewId, textId, url) {
        const box = document.getElementById(previewId);
        if (!box) return;
        let img = box.querySelector('img.avatar-image-fill');
        const t = document.getElementById(textId);
        if (url) {
            if (!img) { img = document.createElement('img'); img.className = 'avatar-image-fill'; box.insertBefore(img, box.firstChild); }
            img.src = url; box.style.borderStyle = 'solid'; if (t) t.style.display = 'none';
        } else {
            if (img) img.remove();
            box.style.borderStyle = ''; if (t) t.style.display = '';
        }
    }

    window.handleAvatarUpload = function(input, previewId, textId) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentTempAvatarUrl = e.target.result;
                setAvatarPreview(previewId, textId, currentTempAvatarUrl);
                const btn = document.getElementById(previewId === 'c-avatar-preview' ? 'btn-dash-save-cust' : 'btn-dash-save-worker');
                if (btn) btn.disabled = false;
            };
            reader.readAsDataURL(input.files[0]);
        }
    };

    // Simpan profil (Customer & Worker) ke database -> terlihat juga di Admin Portal
    window.saveProfileChanges = function(role) {
        const rec = getCurrentRecord();
        if (!rec) { customAlert('Sesi login tidak ditemukan. Silakan login ulang.'); return; }
        const r = currentUser.role;
        const pre = r === 'worker' ? 'dash-w-' : 'dash-c-';
        const v = (id) => { const el = document.getElementById(pre + id); return el ? el.value.trim() : ''; };
        const name = v('name'), email = v('email'), wa = v('wa');
        if (!name) { customAlert('Nama lengkap wajib diisi.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { customAlert('Format email tidak valid.'); return; }
        const waDigits = wa.replace(/\D/g, '');
        if (waDigits.length < 8 || waDigits.length > 15) { customAlert('Nomor WhatsApp tidak valid.'); return; }
        const np = v('newpass'), np2 = v('newpass2');
        if (np || np2) {
            if (np.length < 4) { customAlert('Password baru minimal 4 karakter.'); return; }
            if (np !== np2) { customAlert('Konfirmasi password baru tidak sama.'); return; }
        }
        const oldName = rec.name;
        rec.name = name; rec.email = email; rec.wa = wa;
        rec.address = v('address'); rec.city = v('city'); rec.zip = v('zip'); rec.bio = v('bio');
        if (r === 'customer') {
            rec.type = v('type') || rec.type; rec.business = v('business'); rec.bizField = v('field');
            rec.dob = v('dob'); rec.website = v('website');
        } else {
            rec.nickname = v('nick'); rec.ttl = v('ttl'); rec.specs = v('specs'); rec.experience = v('exp');
            rec.availability = v('avail') || 'on'; rec.tools = v('tools'); rec.portfolio = v('port');
            const bank = v('bank'), no = v('rek'), an = v('rekname');
            if (bank && no && an) rec.rekening = `${bank} ${no} A/N ${an}`;
        }
        if (np) rec.password = np;
        if (currentTempAvatarUrl) rec.avatar = currentTempAvatarUrl;
        if (oldName !== name) ordersDB.forEach(o => { if (o.customerId === rec.id) o.customerName = name; });
        currentTempAvatarUrl = "";
        updateUserTrigger();
        fillDashboard(r, rec);
        try { renderAdminNotifications(); } catch (err) {}
        customAlert('Profil berhasil disimpan dan tersinkron ke Admin Portal!');
    };

    function renderAvatarHtml(url, fallbackChar) {
        if(url && url.trim() !== "") { return `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`; }
        return fallbackChar;
    }


    /* =========================================
       LOGIN USER (WORKER & CUSTOMER) + PROFIL & AKTIVITAS
       ========================================= */
    let currentUser = null;      // { role: 'customer' | 'worker', id }
    let pendingCategory = '';    // kategori yang ingin dibuka setelah login
    const PERSON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';

    function getCurrentRecord() {
        if (!currentUser) return null;
        const db = currentUser.role === 'worker' ? workersDB : customersDB;
        return db.find(x => x.id === currentUser.id) || null;
    }

    function setSession(role, id) {
        currentUser = { role: role, id: id };
        adminAuthed = false;
        try { localStorage.setItem('nex_session', JSON.stringify(currentUser)); } catch (err) {}
        updateUserTrigger();
    }
    function clearSession() {
        currentUser = null; pendingCategory = '';
        try { localStorage.removeItem('nex_session'); } catch (err) {}
        updateUserTrigger(); closeMainCategory();
    }
    function restoreSession() {
        try {
            const sv = JSON.parse(localStorage.getItem('nex_session') || 'null');
            if (!sv || !sv.role || !sv.id) return;
            const rec = (sv.role === 'worker' ? workersDB : customersDB).find(x => x.id === sv.id);
            if (!rec || rec.status === 'Declined') { localStorage.removeItem('nex_session'); return; }
            currentUser = { role: sv.role, id: sv.id };
            try { fillDashboard(sv.role, rec); } catch (err) {}
        } catch (err) {}
    }

    // Icon login -> foto profil (tanpa ikon gembok) setelah login
    // Ikon header: gembok tertutup + profil (belum login) | gembok terbuka saja (Admin) | profil saja (Worker/Customer)
    const LOCK_CLOSED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
    const LOCK_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
    function updateAuthIcons() {
        const ab = document.getElementById('admin-btn'), ub = document.getElementById('user-btn');
        if (!ab || !ub) return;
        const userIn = !!getCurrentRecord();
        if (adminAuthed) {
            ab.innerHTML = LOCK_OPEN; ab.title = 'Sedang login sebagai Admin'; ab.classList.add('unlocked'); ab.style.display = '';
            ub.style.display = 'none';
            return;
        }
        ab.innerHTML = LOCK_CLOSED; ab.title = 'System Access'; ab.classList.remove('unlocked');
        ab.style.display = userIn ? 'none' : '';
        ub.style.display = '';
        ub.style.right = userIn ? '5%' : '';
    }

    function updateUserTrigger() {
        const btn = document.getElementById('user-btn');
        if (!btn) return;
        updateAuthIcons();
        const rec = getCurrentRecord();
        if (!rec) { btn.className = 'user-trigger'; btn.title = 'Login'; btn.innerHTML = PERSON_SVG; updateChatWidget(); return; }
        btn.className = 'user-trigger logged-in ' + (currentUser.role === 'worker' ? 'is-worker' : 'is-customer');
        btn.title = rec.name;
        btn.innerHTML = rec.avatar ? `<img src="${rec.avatar}" alt="">` : escHtml((rec.name || '?').trim().charAt(0).toUpperCase());
        updateChatWidget();
    }

    // Cari akun lewat ID Nexora (username atau ID), boleh tanpa prefix
    function findAccountByLogin(input) {
        const v = input.trim().toLowerCase();
        if (!v) return null;
        const cands = [v];
        if (!v.startsWith('nexc-') && !v.startsWith('nexw-')) cands.push('nexc-' + v, 'nexw-' + v);
        for (const c of cands) {
            const cu = customersDB.find(x => String(x.username).toLowerCase() === c || String(x.id).toLowerCase() === c);
            if (cu) return { role: 'customer', rec: cu };
            const wk = workersDB.find(x => String(x.username).toLowerCase() === c || String(x.id).toLowerCase() === c);
            if (wk) return { role: 'worker', rec: wk };
        }
        return null;
    }

    // Progres EXP menuju level berikutnya (Worker: total pendapatan, Customer: total belanja)
    function levelProgressHtml(isW, value) {
        value = value || 0;
        const calc = isW ? calculateLevel : calculateCustomerLevel;
        const lvl = calc(value);
        const maxName = isW ? 'UltraXora' : 'NexUltra';
        const perk = (l) => isW ? 'bonus ' + l.bonus : 'diskon ' + l.discount;
        if (lvl.name === maxName) {
            return `<div class="lvl-prog"><div class="lvl-prog-top"><span>${lvl.medal} ${escHtml(lvl.name)}</span><span>LEVEL TERTINGGI</span></div><div class="progress-container"><div class="progress-fill" style="width:100%;"></div></div><div class="lvl-prog-note">Selamat! Anda sudah mencapai level tertinggi (${perk(lvl)}). EXP Anda: <b>${formatRp(value)}</b></div></div>`;
        }
        const next = calc(lvl.max + 1);
        const need = lvl.max + 1 - value;
        const pct = Math.max(0, Math.min(100, Math.round(value / lvl.max * 100)));
        return `<div class="lvl-prog"><div class="lvl-prog-top"><span>${lvl.medal} ${escHtml(lvl.name)}</span><span>${next.medal} ${escHtml(next.name)}</span></div><div class="progress-container"><div class="progress-fill" style="width:${pct}%;"></div></div><div class="progress-info"><span>EXP ${formatRp(value)}</span><span>Target ${formatRp(lvl.max + 1)}</span></div><div class="lvl-prog-note">Butuh <b>${formatRp(need)}</b> EXP lagi untuk naik ke <b>${escHtml(next.name)}</b> (${perk(next)})</div></div>`;
    }
    function refreshLevelProg() {
        if (!currentUser) return;
        const rec = getCurrentRecord(); if (!rec) return;
        const isW = currentUser.role === 'worker';
        const el = document.getElementById(isW ? 'dash-w-levelprog' : 'dash-c-levelprog');
        if (el) el.innerHTML = '<label>Progres Level (EXP)</label>' + levelProgressHtml(isW, isW ? rec.income : rec.spent);
        const m = document.getElementById('user-profile-modal');
        if (m && m.classList.contains('active')) renderUserProfile();
    }

    function fillDashboard(role, rec) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val === undefined || val === null) ? '' : val; };
        const statusMap = { Waiting: 'Menunggu Tinjauan Admin', Active: 'Aktif', Hold: 'Hold', Worker: 'Worker Aktif', 'On Progress': 'On Progress', Freeze: 'Freeze', Declined: 'Ditolak' };
        const st = statusMap[rec.status] || rec.status || '-';
        if (role === 'customer') {
            const lvl = calculateCustomerLevel(rec.spent || 0);
            set('dash-c-id', rec.id); set('dash-c-nik', rec.nik || '-'); set('dash-c-level', `${lvl.medal} ${lvl.name} • Diskon ${lvl.discount}`); set('dash-c-status', st);
            set('dash-c-type', rec.type || 'Personal'); set('dash-c-name', rec.name); set('dash-c-business', rec.business); set('dash-c-field', rec.bizField);
            set('dash-c-dob', rec.dob); set('dash-c-email', rec.email); set('dash-c-wa', rec.wa); set('dash-c-website', rec.website);
            set('dash-c-address', rec.address); set('dash-c-city', rec.city); set('dash-c-zip', rec.zip); set('dash-c-bio', rec.bio);
            set('dash-c-newpass', ''); set('dash-c-newpass2', '');
            setAvatarPreview('c-avatar-preview', 'c-avatar-text', rec.avatar);
            const b = document.getElementById('btn-dash-save-cust'); if (b) b.disabled = true;
        } else {
            const lvl = calculateLevel(rec.income || 0);
            set('dash-w-id', rec.id); set('dash-w-nik', rec.nik || '-'); set('dash-w-level', `${lvl.medal} ${lvl.name} • Bonus ${lvl.bonus}`); set('dash-w-balance', formatRp(rec.balance || 0)); set('dash-w-remaining', formatRp(pocketRemaining(rec))); set('dash-w-status', st);
            set('dash-w-name', rec.name); set('dash-w-nick', rec.nickname); set('dash-w-ttl', rec.ttl);
            set('dash-w-email', rec.email); set('dash-w-wa', rec.wa); set('dash-w-address', rec.address); set('dash-w-city', rec.city); set('dash-w-zip', rec.zip);
            set('dash-w-specs', rec.specs); set('dash-w-exp', rec.experience); set('dash-w-avail', rec.availability || 'on'); set('dash-w-tools', rec.tools); set('dash-w-port', rec.portfolio); set('dash-w-bio', rec.bio);
            const m = String(rec.rekening || '').match(/^(.*?)\s+(\d+)\s+A\/N\s+(.*)$/i);
            set('dash-w-bank', m ? m[1] : ''); set('dash-w-rek', m ? m[2] : ''); set('dash-w-rekname', m ? m[3] : '');
            set('dash-w-newpass', ''); set('dash-w-newpass2', '');
            setAvatarPreview('w-avatar-preview', 'w-avatar-text', rec.avatar);
            const b = document.getElementById('btn-dash-save-worker'); if (b) b.disabled = true;
        }
        currentTempAvatarUrl = "";
        try { refreshLevelProg(); } catch (err) {}
    }

    // Aktifkan tombol simpan saat ada perubahan di form profil
    [['page-4', 'btn-dash-save-cust'], ['page-5', 'btn-dash-save-worker']].forEach(([pid, bid]) => {
        const pg = document.getElementById(pid);
        if (!pg) return;
        ['input', 'change'].forEach(ev => pg.addEventListener(ev, (e) => {
            if (e.target.closest && e.target.closest('.profile-dashboard')) { const b = document.getElementById(bid); if (b) b.disabled = false; }
        }));
    });

    window.openUserLogin = function() {
        document.getElementById('user-login-error').style.display = 'none';
        document.getElementById('user-login-id').value = '';
        document.getElementById('user-login-pass').value = '';
        document.getElementById('user-login-modal').classList.add('active');
    };

    function attemptUserLogin() {
        const acc = findAccountByLogin(document.getElementById('user-login-id').value);
        const pass = document.getElementById('user-login-pass').value.trim();
        if (!acc || acc.rec.password !== pass || acc.rec.status === 'Declined') {
            document.getElementById('user-login-error').style.display = 'block';
            return;
        }
        setSession(acc.role, acc.rec.id);
        document.getElementById('user-login-modal').classList.remove('active');
        document.getElementById('user-login-id').value = '';
        document.getElementById('user-login-pass').value = '';
        if (pendingCategory) { const c = pendingCategory; pendingCategory = ''; openMainCategory(c); }
    }

    const userBtn = document.getElementById('user-btn');
    if (userBtn) userBtn.addEventListener('click', () => { if (currentUser) openUserProfile(); else { pendingCategory = ''; openUserLogin(); } });
    const btnUserLogin = document.getElementById('btn-user-login');
    if (btnUserLogin) btnUserLogin.addEventListener('click', attemptUserLogin);
    ['user-login-id', 'user-login-pass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); attemptUserLogin(); } });
    });
    const closeUserLogin = document.getElementById('close-user-login');
    if (closeUserLogin) closeUserLogin.addEventListener('click', () => { pendingCategory = ''; document.getElementById('user-login-modal').classList.remove('active'); });
    const userLoginForgot = document.getElementById('user-login-forgot');
    if (userLoginForgot) userLoginForgot.addEventListener('click', () => {
        document.getElementById('user-login-modal').classList.remove('active');
        document.getElementById('forgot-pass-modal').classList.add('active');
    });
    const userLoginSignup = document.getElementById('user-login-signup');
    if (userLoginSignup) userLoginSignup.addEventListener('click', () => {
        pendingCategory = '';
        document.getElementById('user-login-modal').classList.remove('active');
        navigateTo('page-2', 'forward'); // menu Choose Your Role
    });

    // Reset password (Lupa Password): Nama + NIK harus cocok
    const btnSubmitFp = document.getElementById('btn-submit-fp');
    if (btnSubmitFp) btnSubmitFp.addEventListener('click', () => {
        const name = document.getElementById('fp-name').value.trim().toLowerCase();
        const nik = document.getElementById('fp-nik').value.trim();
        const np = document.getElementById('fp-new-pass').value.trim();
        const err = document.getElementById('fp-error');
        const rec = (name && nik && np) ? [...customersDB, ...workersDB].find(x => x.nik && String(x.nik) === nik && String(x.name).toLowerCase() === name) : null;
        if (!rec) { err.style.display = 'block'; return; }
        rec.password = np;
        err.style.display = 'none';
        document.getElementById('fp-name').value = ''; document.getElementById('fp-nik').value = ''; document.getElementById('fp-new-pass').value = '';
        document.getElementById('forgot-pass-modal').classList.remove('active');
        customAlert('Password berhasil direset. Silakan login dengan password baru.');
    });

    // ---------- Profil & aktivitas ----------
    function renderUserProfile() {
        const rec = getCurrentRecord();
        if (!rec) return;
        const isW = currentUser.role === 'worker';
        const lvl = isW ? calculateLevel(rec.income || 0) : calculateCustomerLevel(rec.spent || 0);
        document.getElementById('up-avatar').innerHTML = renderAvatarHtml(rec.avatar, escHtml((rec.name || '?').trim().charAt(0).toUpperCase()));
        document.getElementById('up-name').innerText = rec.name;
        document.getElementById('up-id').innerText = rec.id;
        const roleEl = document.getElementById('up-role');
        roleEl.innerText = (isW ? 'WORKER' : 'CUSTOMER') + ' • ' + lvl.medal + ' ' + lvl.name;
        roleEl.style.color = isW ? '#ff0055' : '#00f2fe';
        roleEl.style.borderColor = isW ? '#ff0055' : '#00f2fe';

        let stats = `<div class="up-stat"><div class="lbl">Total Pengeluaran Pembelian</div><div class="val">${formatRp(rec.spent || 0)}</div><div class="sub">Dari pesanan yang sudah dikonfirmasi</div></div>`;
        if (isW) stats += `<div class="up-stat worker"><div class="lbl">Saldo Pendapatan</div><div class="val">${formatRp(rec.balance || 0)}</div><div class="sub">Setelah pembagian hasil</div></div>` + `<div class="up-stat worker"><div class="lbl">Saldo Tersisa</div><div class="val">${formatRp(pocketRemaining(rec))}</div><div class="sub">Siap dicairkan lewat Pocket</div></div>`;
        else stats += `<div class="up-stat"><div class="lbl">Level & Diskon</div><div class="val">${escHtml(lvl.name)}</div><div class="sub">Diskon ${lvl.discount}</div></div>`;

        const stLabel = (st) => st === 'Pending' ? 'Menunggu Konfirmasi Admin' : st;
        const acts = [];
        ordersDB.filter(o => o.customerId === rec.id).slice(0, 10).forEach(o => acts.push({ ic: '🛒', t: 'Memesan ' + o.productName, s: `${o.id} • ${formatRp(o.nominal)} • ${stLabel(o.status)}` }));
        if (isW) {
            ordersDB.filter(o => o.workerId === rec.id).slice(0, 10).forEach(o => acts.push({ ic: '🛠️', t: 'Mengerjakan ' + o.productName, s: `${o.id} • ${o.status}` }));
            financeDB.filter(f => f.kind === 'upah' && f.workerId === rec.id && f.keluar > 0).slice(0, 10).forEach(f => acts.push({ ic: '💰', t: 'Pendapatan: ' + f.productName.replace('Upah Worker - ', ''), s: '+' + formatRp(f.keluar) + ' (setelah bagi hasil)' }));
        }
        if (rec.joined) acts.push({ ic: '🎉', t: 'Bergabung di Nexora', s: rec.joined });
        const actHtml = acts.map(a => `<div class="up-act-item"><div class="ic">${a.ic}</div><div><div class="t">${escHtml(a.t)}</div><div class="s">${escHtml(a.s)}</div></div></div>`).join('');

        document.getElementById('up-body').innerHTML = `
            <div class="up-stat-grid">${stats}</div>
            <div class="profile-label" style="margin-bottom:5px;">Progres Level (EXP)</div>
            ${levelProgressHtml(isW, isW ? (rec.income || 0) : (rec.spent || 0))}
            <div class="profile-label" style="margin-bottom:5px; margin-top:14px;">Aktivitas</div>
            <div class="up-activity">${actHtml || '<div style="color:rgba(255,255,255,0.5); font-size:0.85rem; padding:10px 0;">Belum ada aktivitas.</div>'}</div>`;
    }

    function openUserProfile() {
        if (!currentUser) return;
        renderUserProfile();
        document.getElementById('user-profile-modal').classList.add('active');
    }

    const closeUserProfile = document.getElementById('close-user-profile');
    if (closeUserProfile) closeUserProfile.addEventListener('click', () => document.getElementById('user-profile-modal').classList.remove('active'));
    const btnUpLogout = document.getElementById('btn-up-logout');
    if (btnUpLogout) btnUpLogout.addEventListener('click', () => { document.getElementById('user-profile-modal').classList.remove('active'); clearSession(); });
    const btnUpDash = document.getElementById('btn-up-dashboard');
    if (btnUpDash) btnUpDash.addEventListener('click', () => {
        const rec = getCurrentRecord();
        if (!rec) return;
        document.getElementById('user-profile-modal').classList.remove('active');
        fillDashboard(currentUser.role, rec);
        navigateTo(currentUser.role === 'worker' ? 'page-5' : 'page-4', 'forward');
    });

    /* =========================================
       DETAIL CUSTOMER (ADMIN)
       ========================================= */
    window.openCustomerDetail = function(id) {
        const c = customersDB.find(x => x.id === id);
        if (!c) return;
        const biz = c.business || c.name;
        document.getElementById('cd-avatar').innerHTML = renderAvatarHtml(c.avatar, escHtml((c.name || 'C').trim().charAt(0).toUpperCase()));
        document.getElementById('cd-biz').innerText = biz;
        document.getElementById('cd-id').innerText = c.id;
        document.getElementById('cd-id2').innerText = c.id;
        document.getElementById('cd-biz2').innerHTML = escHtml(biz) + (c.business && c.business !== c.name ? `<div style="font-size:0.8rem; color:rgba(255,255,255,0.55); margin-top:3px;">Atas nama: ${escHtml(c.name)}</div>` : '');
        document.getElementById('cd-photo-note').innerHTML = c.avatar
            ? `<img src="${c.avatar}" alt="Foto Profile" style="width:110px; height:110px; border-radius:16px; object-fit:cover; border:1px solid rgba(0,242,254,0.4);">`
            : 'Belum mengunggah foto profile.';
        const orders = ordersDB.filter(o => o.customerId === c.id);
        let html = '';
        orders.forEach(o => {
            const hasW = o.workerId && o.workerId !== '-';
            html += `<div class="cd-project"><strong>${escHtml(o.productName)}</strong> <span style="color:#00f2fe;">(${escHtml(o.id)})</span><br>Status: <span style="color:${orderStatusColor(o.status)}; font-weight:700;">${escHtml(o.status)}</span><br>Mulai: ${fmtDate(o.startDate)} &bull; Deadline: <span style="color:#ffaa00; font-weight:700;">${fmtDate(o.deadlineDate)}</span>${hasW ? `<br>Worker: ${escHtml(o.workerId)}` : ''}</div>`;
        });
        if (!orders.length) {
            html = c.project
                ? `<div class="cd-project"><strong>${escHtml(c.project)}</strong><br>Worker: ${escHtml(c.workerAssigned && c.workerAssigned !== '-' ? c.workerAssigned : 'Belum ditentukan')}<br>Deadline: <span style="color:#ffaa00;">Belum ditetapkan</span></div>`
                : '<div style="color:rgba(255,255,255,0.5); font-size:0.85rem;">Belum ada project.</div>';
        }
        document.getElementById('cd-projects').innerHTML = html;
        document.getElementById('customer-detail-modal').classList.add('active');
    };

    /* =========================================
       SLIDING BANNER IKLAN (loop mulus, tanpa lompatan, ikut geseran jari/mouse)
       ========================================= */
    let bannerIdx = 0, bannerPos = 0, bannerTimer = null, bannerBusy = false, bannerSig = '', bannerDrag = null;
    const BANNER_MS = 900, BANNER_EASE = 'cubic-bezier(0.65, 0.05, 0.36, 1)';
    function bannerTrack() { return document.getElementById('banner-track'); }
    function setBannerDots() { document.querySelectorAll('#banner-dots .banner-dot').forEach((d, k) => d.classList.toggle('active', k === bannerIdx)); }
    function bannerSet(pos, animate, extraPx) {
        const track = bannerTrack(); if (!track) return;
        track.style.transition = animate ? `transform ${BANNER_MS}ms ${BANNER_EASE}` : 'none';
        track.style.transform = extraPx ? `translate3d(calc(${-pos * 100}% + ${extraPx}px),0,0)` : `translate3d(${-pos * 100}%,0,0)`;
    }
    function bannerMove(dir) {            // dir: +1 maju, -1 mundur
        const n = bannersDB.length; if (n < 2 || bannerBusy) return;
        const track = bannerTrack(); if (!track) return;
        bannerBusy = true;
        if (dir > 0) {
            bannerPos = bannerPos + 1;
            bannerIdx = bannerPos % n;
        } else {
            if (bannerPos === 0) { bannerPos = n; bannerSet(n, false); void track.offsetWidth; }  // lompat tak terlihat ke klon
            bannerPos -= 1; bannerIdx = bannerPos % n;
        }
        setBannerDots();
        bannerSet(bannerPos, true);
        clearTimeout(bannerMove._t);
        bannerMove._t = setTimeout(bannerSettle, BANNER_MS + 80);
    }
    function bannerSettle() {
        const n = bannersDB.length, track = bannerTrack();
        if (!track || !bannerBusy && bannerPos < n) return;
        if (bannerPos >= n) { bannerPos = 0; bannerSet(0, false); void track.offsetWidth; }
        bannerBusy = false;
    }
    function goBanner(i) {                // lompat langsung ke banner ke-i (titik navigasi)
        const n = bannersDB.length; if (!n) return;
        i = ((i % n) + n) % n;
        if (i === bannerIdx && !bannerBusy) return;
        bannerIdx = i; bannerPos = i; bannerBusy = true; setBannerDots();
        bannerSet(i, true);
        clearTimeout(bannerMove._t);
        bannerMove._t = setTimeout(() => { bannerBusy = false; }, BANNER_MS + 80);
    }
    function startBannerTimer() {
        clearInterval(bannerTimer);
        if (bannersDB.length > 1) bannerTimer = setInterval(() => { if (!document.hidden && !bannerDrag) bannerMove(1); }, 5000);
    }
    window.renderBanners = function() {
        const track = bannerTrack(), dots = document.getElementById('banner-dots');
        const prev = document.getElementById('banner-prev'), next = document.getElementById('banner-next');
        if (!track) return;
        const sig = JSON.stringify(bannersDB.map(b => [b.id, b.imgUrl, b.link]));
        if (sig === bannerSig && track.children.length) return;      // tidak berubah -> jangan render ulang (mencegah patah saat sinkron)
        bannerSig = sig;
        clearInterval(bannerTimer); clearTimeout(bannerMove._t); bannerBusy = false;
        if (!bannersDB.length) {
            bannerIdx = 0; bannerPos = 0;
            track.style.transition = 'none'; track.style.transform = 'none';
            track.innerHTML = `<div class="banner-slide banner-empty"><div>📢 SLOT IKLAN<small>Ruang banner promosi &bull; rekomendasi 1200 x 400 px</small></div></div>`;
            dots.innerHTML = ''; prev.style.display = 'none'; next.style.display = 'none';
            return;
        }
        const slide = (b, eager) => b.link
            ? `<a class="banner-slide" href="${escHtml(b.link)}" target="_blank" rel="noopener"><img src="${b.imgUrl}" alt="Iklan" draggable="false" decoding="async"${eager ? '' : ' loading="eager"'}></a>`
            : `<div class="banner-slide"><img src="${b.imgUrl}" alt="Iklan" draggable="false" decoding="async"${eager ? '' : ' loading="eager"'}></div>`;
        const multi = bannersDB.length > 1;
        track.innerHTML = bannersDB.map(b => slide(b)).join('') + (multi ? slide(bannersDB[0]) : '');   // klon slide pertama di ujung
        bannersDB.forEach(b => { const im = new Image(); im.src = b.imgUrl; });                          // pra-muat
        prev.style.display = multi ? 'flex' : 'none'; next.style.display = multi ? 'flex' : 'none';
        dots.innerHTML = multi ? bannersDB.map((b, k) => `<button type="button" class="banner-dot" aria-label="Banner ${k + 1}"></button>`).join('') : '';
        dots.querySelectorAll('.banner-dot').forEach((d, k) => d.addEventListener('click', () => { goBanner(k); startBannerTimer(); }));
        bannerIdx = Math.min(bannerIdx, bannersDB.length - 1); bannerPos = bannerIdx;
        bannerSet(bannerPos, false); setBannerDots();
        startBannerTimer();
    };
    (function initBannerControls() {
        const slider = document.getElementById('banner-slider');
        if (!slider) return;
        document.getElementById('banner-prev').addEventListener('click', () => { bannerMove(-1); startBannerTimer(); });
        document.getElementById('banner-next').addEventListener('click', () => { bannerMove(1); startBannerTimer(); });
        slider.addEventListener('mouseenter', () => clearInterval(bannerTimer));
        slider.addEventListener('mouseleave', startBannerTimer);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) startBannerTimer(); });
        // geser mengikuti jari / mouse
        let sx = 0, sy = 0, dx = 0, locked = '', t0 = 0;
        slider.addEventListener('pointerdown', (e) => {
            if (bannersDB.length < 2 || bannerBusy || e.target.closest('.banner-nav, .banner-dot')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            bannerDrag = true; sx = e.clientX; sy = e.clientY; dx = 0; locked = ''; t0 = Date.now(); clearInterval(bannerTimer);
        });
        slider.addEventListener('pointermove', (e) => {
            if (!bannerDrag) return;
            const mx = e.clientX - sx, my = e.clientY - sy;
            if (!locked) { if (Math.abs(mx) < 6 && Math.abs(my) < 6) return; locked = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; if (locked === 'x') { try { slider.setPointerCapture(e.pointerId); } catch (er) {} } }
            if (locked !== 'x') return;
            dx = mx;
            let pos = bannerPos; const n = bannersDB.length;
            if (pos === 0 && dx > 0) { pos = n; bannerSet(n, false); bannerPos = n; }   // tarik ke kanan dari awal -> pakai klon
            bannerSet(bannerPos, false, dx);
        });
        const end = () => {
            if (!bannerDrag) return;
            const moved = locked === 'x', w = slider.clientWidth || 1, fast = Math.abs(dx) / Math.max(1, Date.now() - t0) > 0.4;
            bannerDrag = null;
            if (moved) {
                const n = bannersDB.length;
                let dir = 0; if (Math.abs(dx) > w * 0.18 || (fast && Math.abs(dx) > 20)) dir = dx < 0 ? 1 : -1;
                const track = bannerTrack();
                // posisi saat ini (bannerPos) dengan offset dx -> animasikan ke target
                bannerBusy = true;
                const target = bannerPos + dir;
                bannerPos = Math.max(0, Math.min(n, target)); bannerIdx = bannerPos % n; setBannerDots();
                bannerSet(bannerPos, true);
                clearTimeout(bannerMove._t); bannerMove._t = setTimeout(bannerSettle, BANNER_MS + 80);
                slider.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });   // cegah klik link setelah geser
            }
            startBannerTimer();
        };
        slider.addEventListener('pointerup', end); slider.addEventListener('pointercancel', end);
    })();

    window.renderAdminBanners = function() {
        const box = document.getElementById('admin-banner-list');
        if (!box) return;
        if (!bannersDB.length) { box.innerHTML = '<div class="empty-video-state" style="grid-column: 1 / -1;">BELUM ADA BANNER IKLAN</div>'; return; }
        box.innerHTML = bannersDB.map((b, i) => `<div class="banner-admin-item"><img src="${b.imgUrl}" alt="Banner ${i + 1}"><div class="meta"><span>${b.link ? escHtml(b.link) : 'Tanpa link'}</span><button type="button" class="btn-vid-action btn-vid-del" style="flex:0 0 auto;" onclick="deleteBanner('${b.id}')">HAPUS</button></div></div>`).join('');
    };
    window.deleteBanner = function(id) {
        askDeletePassword('Hapus <strong>banner iklan</strong> ini?', () => { bannersDB = bannersDB.filter(b => b.id !== id); renderAdminBanners(); renderBanners(); });
    };
    const btnAddBanner = document.getElementById('btn-add-banner');
    if (btnAddBanner) btnAddBanner.addEventListener('click', () => {
        const f = document.getElementById('up-banner-file').files[0];
        const link = document.getElementById('up-banner-link').value.trim();
        if (!f) { customAlert('Pilih gambar banner terlebih dahulu.'); return; }
        if (link && !/^https?:\/\//i.test(link)) { customAlert('Link harus diawali http:// atau https://'); return; }
        bannersDB.push({ id: 'BNR-' + Date.now(), imgUrl: URL.createObjectURL(f), link: link });
        document.getElementById('up-banner-file').value = '';
        document.getElementById('up-banner-link').value = '';
        document.getElementById('up-banner-filename').innerText = 'Pilih Gambar Banner';
        renderAdminBanners(); renderBanners();
        customAlert('Banner iklan berhasil ditambahkan!');
    });

    /* =========================================
       CHAT USER <-> ADMIN (teks, file, foto, video, voice)
       ========================================= */
    const CHAT_MAX_BYTES = 25 * 1024 * 1024;
    let activeAdminChatUser = null;
    const $id = (x) => document.getElementById(x);
    const fmtSize = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
    const chatClock = (ts) => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

    function chatUserRecord(userId) { return customersDB.find(x => x.id === userId) || workersDB.find(x => x.id === userId) || null; }
    function chatUserInfo(userId) {
        const isC = customersDB.some(x => x.id === userId);
        const rec = chatUserRecord(userId);
        if (rec) return { name: rec.name, role: isC ? 'Customer' : 'Worker' };
        const m = chatsDB.find(x => x.userId === userId);
        return { name: m ? m.userName : userId, role: m ? m.userRole : '' };
    }
    const MON_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    function userBirthDate(rec) {
        if (!rec) return '';
        let raw = rec.dob || '';
        if (!raw && rec.ttl) { const p = String(rec.ttl).split(','); raw = p.length > 1 ? p[p.length - 1] : p[0]; }
        raw = String(raw || '').trim();
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return parseInt(iso[3], 10) + ' ' + MON_ID[parseInt(iso[2], 10) - 1] + ' ' + iso[1];
        return raw;
    }
    const badgeNum = (n) => n > 99 ? '99+' : String(n);
    function unreadFromUser(userId) { return chatsDB.filter(m => m.userId === userId && m.from === 'user' && !m.readByAdmin).length; }
    function chatDot(id) { const n = unreadFromUser(id); return n ? `<span class="row-dot">${badgeNum(n)}</span>` : ''; }
    function msgPreview(m) {
        if (m.type === 'text') return m.text;
        if (m.type === 'image') return '🖼️ Foto';
        if (m.type === 'video') return '🎬 Video';
        if (m.type === 'voice' || m.type === 'audio') return '🎤 Pesan suara';
        return '📄 ' + (m.fileName || 'File');
    }
    function addChatMessage(userId, from, payload) {
        const info = chatUserInfo(userId);
        const m = { id: 'MSG-' + Date.now() + '-' + Math.floor(Math.random() * 1000), userId: userId, userName: info.name, userRole: info.role, from: from, type: 'text', text: '', ts: Date.now(), readByAdmin: from === 'admin', readByUser: from === 'user' };
        if (payload.file) {
            const f = payload.file;
            m.url = URL.createObjectURL(f); m.fileName = f.name; m.size = f.size; m.mime = f.type || '';
            m.type = payload.voice ? 'voice' : (m.mime.startsWith('image/') ? 'image' : m.mime.startsWith('video/') ? 'video' : m.mime.startsWith('audio/') ? 'audio' : 'file');
        } else { m.text = payload.text; }
        chatsDB.push(m);
        return m;
    }
    function chatConversations() {
        const map = {};
        chatsDB.forEach(m => { (map[m.userId] = map[m.userId] || { userId: m.userId, msgs: [] }).msgs.push(m); });
        return Object.values(map).map(cv => { const i = chatUserInfo(cv.userId); cv.name = i.name; cv.role = i.role; cv.last = cv.msgs[cv.msgs.length - 1]; return cv; }).sort((a, b) => b.last.ts - a.last.ts);
    }

    function renderChatMessages(container, msgs, me) {
        if (!container) return;
        if (!msgs.length) { container.innerHTML = '<div class="chat-empty">Belum ada pesan.<br>Tulis pesan atau kirim file untuk memulai chat.</div>'; return; }
        container.innerHTML = msgs.map(m => {
            let body;
            if (m.type === 'text') body = escHtml(m.text).replace(/\n/g, '<br>');
            else if (m.type === 'image') body = `<a href="${m.url}" target="_blank" rel="noopener"><img src="${m.url}" alt="${escHtml(m.fileName)}"></a>`;
            else if (m.type === 'video') body = `<video src="${m.url}" controls preload="metadata" playsinline></video>`;
            else if (m.type === 'voice' || m.type === 'audio') body = `<audio src="${m.url}" controls preload="metadata"></audio>`;
            else body = `<a class="chat-file" href="${m.url}" download="${escHtml(m.fileName)}"><span class="ic">📄</span><span><span class="nm">${escHtml(m.fileName)}</span><br><span class="sz">${fmtSize(m.size || 0)} &bull; ketuk untuk unduh</span></span></a>`;
            return `<div class="chat-msg ${m.from === me ? 'mine' : 'theirs'}" data-mid="${escHtml(m.id)}">${body}<span class="chat-time">${chatClock(m.ts)}</span></div>`;
        }).join('');
        bindChatLongPress(container);
        container.scrollTop = container.scrollHeight;
    }

    // ----- Hapus chat: tahan bubble (atau klik kanan) -> pilihan Hapus -----
    function closeChatCtx() { const old = document.getElementById('chat-ctx'); if (old) old.remove(); }
    function showChatCtx(mid, x, y) {
        closeChatCtx();
        const box = document.createElement('div');
        box.id = 'chat-ctx';
        box.innerHTML = '<button type="button">🗑️ Hapus pesan</button>';
        box.dataset.t = String(Date.now());
        document.body.appendChild(box);
        const w = box.offsetWidth, h = box.offsetHeight;
        box.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
        box.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
        box.querySelector('button').addEventListener('click', () => {
            closeChatCtx();
            const adminView = adminAuthed && $id('admin-chat-view') && $id('admin-chat-view').style.display !== 'none';
            if (adminView) askDeletePassword('Hapus <strong>pesan</strong> ini?', () => deleteChatMessage(mid));
            else deleteChatMessage(mid);
        });
    }
    ['click', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, (e) => {
        const c = document.getElementById('chat-ctx');
        if (!c || c.contains(e.target)) return;
        if (Date.now() - Number(c.dataset.t || 0) < 500) return;
        closeChatCtx();
    }, true));

    function bindChatLongPress(container) {
        if (!container || container._lp) return;
        container._lp = true;
        let timer = null, sx = 0, sy = 0, fired = false;
        const cancel = () => { clearTimeout(timer); timer = null; };
        const bubble = (e) => (e.target && e.target.closest) ? e.target.closest('.chat-msg') : null;
        const begin = (e, p) => {
            const b = bubble(e); if (!b) return;
            sx = p.clientX; sy = p.clientY; fired = false; cancel();
            timer = setTimeout(() => { fired = true; showChatCtx(b.dataset.mid, p.clientX, p.clientY); }, 500);
        };
        container.addEventListener('touchstart', (e) => begin(e, e.touches[0]), { passive: true });
        container.addEventListener('touchmove', (e) => { const p = e.touches[0]; if (Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) cancel(); }, { passive: true });
        ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(ev => container.addEventListener(ev, cancel));
        container.addEventListener('mousedown', (e) => { if (e.button === 0) begin(e, e); });
        container.addEventListener('contextmenu', (e) => { const b = bubble(e); if (!b) return; e.preventDefault(); fired = true; showChatCtx(b.dataset.mid, e.clientX, e.clientY); });
        // cegah link/gambar terbuka setelah tahan lama
        container.addEventListener('click', (e) => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
    }

    function refreshChatViews() {
        try {
            if ($id('chat-panel') && $id('chat-panel').classList.contains('open')) renderUserChat();
            if ($id('admin-chat-view') && $id('admin-chat-view').style.display !== 'none') { renderAdminChatList(); renderAdminThreadBody(); }
            updateChatBadges();
            renderAdminNotifications();
        } catch (err) {}
    }
    window.deleteChatMessage = function(mid) {
        chatsDB = chatsDB.filter(m => m.id !== mid);
        refreshChatViews();
    };
    function clearChatFor(userId) {
        chatsDB = chatsDB.filter(m => m.userId !== userId);
        refreshChatViews();
    }

    // Komposer pesan (dipakai user & admin): teks, lampiran foto/video/file, rekam suara
    function buildComposer(root, onSend) {
        root.innerHTML = `<div class="chat-composer">
            <div class="chat-attach-menu"><button type="button" data-k="image">🖼️ Foto</button><button type="button" data-k="video">🎬 Video</button><button type="button" data-k="file">📄 File / Dokumen</button></div>
            <button type="button" class="chat-ic chat-attach" title="Lampirkan" aria-label="Lampirkan">📎</button>
            <textarea class="chat-input" rows="1" placeholder="Tulis pesan..."></textarea>
            <button type="button" class="chat-ic chat-mic" title="Rekam suara" aria-label="Rekam suara">🎤</button>
            <button type="button" class="chat-ic chat-send" title="Kirim" aria-label="Kirim">&#10148;</button>
            <input type="file" class="in-image" accept="image/*" multiple hidden>
            <input type="file" class="in-video" accept="video/*" multiple hidden>
            <input type="file" class="in-file" multiple hidden>
            <div class="chat-recbar"><span class="rec-dot"></span><span class="rec-time">0:00</span><button type="button" class="rec-cancel">✕ Batal</button><button type="button" class="rec-ok">✓ Kirim</button></div>
        </div>`;
        const q = (sel) => root.querySelector(sel);
        const input = q('.chat-input'), menu = q('.chat-attach-menu');
        const sendText = () => { const t = input.value.trim(); if (!t) return; onSend({ text: t }); input.value = ''; input.style.height = 'auto'; };
        q('.chat-send').addEventListener('click', sendText);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } });
        input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 90) + 'px'; });
        q('.chat-attach').addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
        document.addEventListener('click', () => menu.classList.remove('open'));
        menu.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { q('.in-' + b.dataset.k).click(); menu.classList.remove('open'); }));
        ['.in-image', '.in-video', '.in-file'].forEach(sel => q(sel).addEventListener('change', function() {
            Array.from(this.files).forEach(f => {
                if (f.size > CHAT_MAX_BYTES) customAlert('File <strong>' + escHtml(f.name) + '</strong> melebihi batas 25 MB.');
                else onSend({ file: f });
            });
            this.value = '';
        }));

        // Rekam suara
        let recorder = null, chunks = [], stream = null, tick = null, t0 = 0;
        const bar = q('.chat-recbar'), timeEl = q('.rec-time');
        const stopRec = (send) => {
            if (!recorder) return;
            clearInterval(tick);
            const rc = recorder, dur = Math.round((Date.now() - t0) / 1000);
            recorder = null;
            rc.onstop = () => {
                if (stream) stream.getTracks().forEach(t => t.stop());
                if (send && chunks.length) {
                    const type = rc.mimeType || 'audio/webm';
                    const ext = type.includes('mp4') ? 'm4a' : (type.includes('ogg') ? 'ogg' : 'webm');
                    onSend({ file: new File([new Blob(chunks, { type: type })], 'voice-' + Date.now() + '.' + ext, { type: type }), voice: true, duration: dur });
                }
                chunks = [];
            };
            try { rc.stop(); } catch (err) {}
            bar.classList.remove('on');
        };
        q('.chat-mic').addEventListener('click', async () => {
            if (recorder) return;
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { customAlert('Browser ini belum mendukung rekam suara.'); return; }
            try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
            catch (err) { customAlert('Izin mikrofon ditolak. Aktifkan izin mikrofon di browser untuk mengirim voice.'); return; }
            chunks = []; recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
            recorder.start(); t0 = Date.now(); timeEl.innerText = '0:00'; bar.classList.add('on');
            tick = setInterval(() => { const s2 = Math.floor((Date.now() - t0) / 1000); timeEl.innerText = Math.floor(s2 / 60) + ':' + pad2(s2 % 60); }, 500);
        });
        q('.rec-cancel').addEventListener('click', () => stopRec(false));
        q('.rec-ok').addEventListener('click', () => stopRec(true));
    }

    // ----- Sisi user -----
    let userComposerBuilt = false;
    function markUserRead() { if (currentUser) chatsDB.forEach(m => { if (m.userId === currentUser.id && m.from === 'admin') m.readByUser = true; }); }
    function renderUserChat() {
        if (!currentUser) return;
        renderChatMessages($id('chat-user-body'), chatsDB.filter(m => m.userId === currentUser.id), 'user');
    }
    function updateChatBadges() {
        const fb = $id('chat-fab-badge'), fab = $id('chat-fab');
        if (fb) {
            const n = currentUser ? chatsDB.filter(m => m.userId === currentUser.id && m.from === 'admin' && !m.readByUser).length : 0;
            fb.innerText = badgeNum(n); fb.style.display = n > 0 ? 'flex' : 'none';
            if (fab) fab.classList.toggle('has-unread', n > 0);
        }
        const ab = $id('chat-badge-notif'), card = $id('btn-menu-chat');
        if (ab) {
            const t = chatsDB.filter(m => m.from === 'user' && !m.readByAdmin).length;
            ab.innerText = badgeNum(t); ab.style.display = t > 0 ? 'flex' : 'none';
            if (card) card.classList.toggle('has-unread', t > 0);
        }
        try {   // segarkan ikon pesan di tabel Data Worker / Customer bila sedang terbuka
            const vw = $id('admin-data-worker-view'), vc = $id('admin-data-customer-view');
            if (vw && vw.style.display !== 'none') renderWorkerTable();
            if (vc && vc.style.display !== 'none') renderCustomerTable();
        } catch (err) {}
    }
    function updateChatWidget(pageId) {
        const fab = $id('chat-fab'), panel = $id('chat-panel');
        if (!fab) return;
        const page = pageId || currentPageId;
        const show = !!currentUser && page !== 'page-3';
        fab.style.display = show ? 'flex' : 'none';
        if (!show && panel) panel.classList.remove('open');
        updateChatBadges();
    }
    function openUserChat() {
        if (!currentUser) return;
        if (!userComposerBuilt) {
            buildComposer($id('chat-user-composer'), (payload) => {
                if (!currentUser) return;
                addChatMessage(currentUser.id, 'user', payload);
                renderUserChat();
                onUserMessageSent(currentUser.id);
            });
            userComposerBuilt = true;
        }
        $id('chat-panel').classList.add('open');
        markUserRead(); renderUserChat(); updateChatBadges();
    }
    // Dipanggil setiap user mengirim pesan -> notifikasi admin (Nama + ID Nexora)
    function onUserMessageSent(userId) {
        if (activeAdminChatUser === userId && $id('admin-chat-view') && $id('admin-chat-view').style.display !== 'none') {
            chatsDB.forEach(m => { if (m.userId === userId && m.from === 'user') m.readByAdmin = true; });
            renderAdminThreadBody();
        }
        renderAdminChatList(); updateChatBadges();
        try { renderAdminNotifications(); } catch (err) {}
    }
    const chatFabEl = $id('chat-fab');
    if (chatFabEl) chatFabEl.addEventListener('click', () => { const p = $id('chat-panel'); if (p.classList.contains('open')) p.classList.remove('open'); else openUserChat(); });
    const chatClearEl = $id('chat-clear');
    if (chatClearEl) chatClearEl.addEventListener('click', () => {
        if (!currentUser) return;
        customConfirm('Hapus <strong>semua chat</strong> Anda dengan Admin? Tindakan ini tidak dapat dibatalkan.', () => clearChatFor(currentUser.id));
    });
    const chatCloseEl = $id('chat-close');
    if (chatCloseEl) chatCloseEl.addEventListener('click', () => $id('chat-panel').classList.remove('open'));

    // ----- Sisi admin -----
    let adminChatTab = 'all';
    function syncAdminChatTabs() {
        ['all', 'worker', 'customer'].forEach(t => { const b = $id('achat-tab-' + t); if (b) b.classList.toggle('active', adminChatTab === t); });
    }
    window.switchAdminChatTab = function(t) {
        adminChatTab = t === 'customer' ? 'customer' : (t === 'all' ? 'all' : 'worker');
        syncAdminChatTabs();
        renderAdminChatList();
    };
    function resetAdminThread() {
        activeAdminChatUser = null;
        const th = $id('admin-chat-thread');
        if (th) th.innerHTML = '<div class="chat-empty">Pilih percakapan di sebelah kiri.</div>';
        const lay = $id('admin-chat-layout'); if (lay) lay.classList.remove('show-thread');
    }
    window.renderAdminChatList = function() {
        const list = $id('admin-chat-list');
        if (!list) return;
        const q = (($id('admin-chat-search') || {}).value || '').trim().toLowerCase();

        // lencana belum dibaca per tab
        const wIds = new Set(workersDB.map(x => x.id)), cIds = new Set(customersDB.map(x => x.id));
        let uw = 0, uc = 0;
        chatsDB.forEach(m => { if (m.from === 'user' && !m.readByAdmin) { if (wIds.has(m.userId)) uw++; else if (cIds.has(m.userId)) uc++; } });
        [['all', uw + uc], ['worker', uw], ['customer', uc]].forEach(([t, n]) => { const bd = $id('achat-badge-' + t); if (bd) { bd.innerText = badgeNum(n); bd.style.display = n > 0 ? 'inline-flex' : 'none'; } });
        syncAdminChatTabs();

        const byUser = {};
        chatsDB.forEach(m => { (byUser[m.userId] = byUser[m.userId] || []).push(m); });
        const pool = []
            .concat(adminChatTab !== 'customer' ? workersDB.map(r => ({ r: r, role: 'Worker' })) : [])
            .concat(adminChatTab !== 'worker' ? customersDB.map(r => ({ r: r, role: 'Customer' })) : []);
        const people = pool
            .filter(x => x.r.status !== 'Declined')
            .filter(x => !q || [x.r.name, x.r.id, x.r.business, x.r.nickname, userBirthDate(x.r)].some(v => String(v || '').toLowerCase().includes(q)))
            .map(x => { const msgs = byUser[x.r.id] || []; return { rec: x.r, role: x.role, msgs: msgs, last: msgs[msgs.length - 1] || null }; })
            .sort((a, b) => (b.last ? b.last.ts : 0) - (a.last ? a.last.ts : 0) || String(a.rec.name).localeCompare(String(b.rec.name)));

        if (!people.length) { list.innerHTML = '<div class="chat-empty">' + (q ? 'Tidak ada hasil pencarian.' : 'Belum ada user terdaftar.') + '</div>'; return; }
        list.innerHTML = people.map(pp => {
            const r = pp.rec;
            const unread = pp.msgs.filter(m => m.from === 'user' && !m.readByAdmin).length;
            const av = renderAvatarHtml(r.avatar, escHtml((r.name || '?').trim().charAt(0).toUpperCase()));
            const pv = pp.last ? escHtml(msgPreview(pp.last)) : '<i style="opacity:0.7;">Belum ada chat - klik untuk memulai</i>';
            return `<div class="chat-conv ${r.id === activeAdminChatUser ? 'active' : ''} ${unread ? 'has-unread' : ''}" data-uid="${escHtml(r.id)}"><div class="avatar-wrapper" style="width:40px; height:40px; flex:0 0 40px;"><div class="avatar-o" style="font-size:1rem;">${av}</div></div><div class="info"><div class="nm">${escHtml(r.name)}</div><div class="idn">ID Nexora: ${escHtml(r.id)} &bull; ${pp.role}</div><div class="dobl">🎂 ${escHtml(userBirthDate(r) || 'Tanggal lahir belum diisi')}</div><div class="pv">${pv}</div></div>${unread ? `<div class="unread" title="${unread} pesan baru">${badgeNum(unread)}</div>` : ''}</div>`;
        }).join('');
        list.querySelectorAll('.chat-conv').forEach(n => n.addEventListener('click', () => openAdminThread(n.dataset.uid)));
    };
    const adminChatSearch = $id('admin-chat-search');
    if (adminChatSearch) adminChatSearch.addEventListener('input', () => renderAdminChatList());
    function renderAdminThreadBody() {
        if (!activeAdminChatUser) return;
        renderChatMessages($id('admin-chat-body'), chatsDB.filter(m => m.userId === activeAdminChatUser), 'admin');
    }
    function openAdminThread(userId) {
        activeAdminChatUser = userId;
        chatsDB.forEach(m => { if (m.userId === userId && m.from === 'user') m.readByAdmin = true; });
        const info = chatUserInfo(userId);
        const th = $id('admin-chat-thread');
        th.innerHTML = `<div class="chat-head"><div style="display:flex; align-items:center;"><button type="button" class="back-list" aria-label="Kembali ke daftar">&larr;</button><div><strong>${escHtml(info.name)}</strong><span>ID Nexora: ${escHtml(userId)} &bull; ${escHtml(info.role)}</span><span>🎂 ${escHtml(userBirthDate(chatUserRecord(userId)) || 'Tanggal lahir belum diisi')}</span></div></div><button type="button" class="clear-all" title="Hapus semua chat" aria-label="Hapus semua chat">⚙️</button></div><div class="chat-body" id="admin-chat-body"></div><div id="admin-chat-composer"></div>`;
        th.querySelector('.back-list').addEventListener('click', () => $id('admin-chat-layout').classList.remove('show-thread'));
        th.querySelector('.clear-all').addEventListener('click', () => {
            askDeletePassword('Hapus <strong>semua chat</strong> dengan <strong>' + escHtml(info.name) + '</strong> (' + escHtml(userId) + ')?', () => clearChatFor(userId));
        });
        $id('admin-chat-layout').classList.add('show-thread');
        buildComposer($id('admin-chat-composer'), (payload) => {
            addChatMessage(activeAdminChatUser, 'admin', payload);
            renderAdminThreadBody(); renderAdminChatList();
            if (currentUser && currentUser.id === activeAdminChatUser && $id('chat-panel').classList.contains('open')) { markUserRead(); renderUserChat(); }
            updateChatBadges();
        });
        renderAdminThreadBody(); renderAdminChatList(); updateChatBadges();
        try { renderAdminNotifications(); } catch (err) {}
    }
    window.chatWithUser = function(userId) {
        try { pushNav({ page: 'page-3', adm: 'chat', cat: '' }); } catch (err) {}
        openAdminChatFromNotif(userId);
    };
    window.openAdminChatFromNotif = function(userId) {
        showAdminSub('chat');
        openAdminThread(userId);
    };

    /* =========================================
       CUSTOMER AUTHENTIKASI & FORM MANUAL
       ========================================= */
    const cModal = document.getElementById('customer-modal'); const cLogin = document.getElementById('customer-login-view'); const cSignup = document.getElementById('customer-signup-view'); const cTitle = document.getElementById('customer-modal-title');
    
    const cardCustomer = document.getElementById('card-customer');
    if(cardCustomer) cardCustomer.addEventListener('click', () => { cModal.classList.add('active'); cLogin.style.display='block'; cSignup.style.display='none'; cTitle.innerText="CUSTOMER LOGIN"; document.getElementById('login-c-error').style.display='none'; });
    
    const closeCustomer = document.getElementById('close-customer');
    if(closeCustomer) closeCustomer.addEventListener('click', () => cModal.classList.remove('active'));

    const btnLogoutCustomer = document.getElementById('btn-logout-customer');
    if(btnLogoutCustomer) btnLogoutCustomer.addEventListener('click', () => { clearSession(); navigateTo('page-1', 'backward'); });

    const btnLoginCustomer = document.getElementById('btn-login-customer');
    if(btnLoginCustomer) btnLoginCustomer.addEventListener('click', () => {
        const user = document.getElementById('login-c-user').value.trim();
        const pass = document.getElementById('login-c-pass').value.trim();
        
        const fullUser = user.startsWith('NEXC-') ? user : `NEXC-${user}`;
        const cust = customersDB.find(c => c.username === fullUser && c.password === pass);
        
        if (cust) {
            cModal.classList.remove('active');
            setSession('customer', cust.id);
            fillDashboard('customer', cust);
            navigateTo('page-4', 'forward');
        } else { document.getElementById('login-c-error').style.display = 'block'; }
    });

    const btnRegCust = document.getElementById('btn-reg-cust-submit');
    function validateCustForm() {
        const nik = document.getElementById('reg-c-nik').value.trim();
        const n = document.getElementById('reg-c-name').value.trim(); 
        const e = document.getElementById('reg-c-email').value.trim(); 
        const w = document.getElementById('reg-c-wa-num').value.trim(); 
        const m = document.getElementById('reg-c-minat').value; 
        const p = document.getElementById('reg-c-pass').value.trim(); 
        const a = document.getElementById('reg-c-agree').checked;
        if(btnRegCust) btnRegCust.disabled = !(nik && n && e && w && m && p && a);
    }
    const custSignupView = document.getElementById('customer-signup-view');
    if(custSignupView) {
        custSignupView.addEventListener('input', validateCustForm);
        custSignupView.addEventListener('change', validateCustForm);
    }
    
    let pendingRedirect = '';
    if(btnRegCust) btnRegCust.addEventListener('click', () => {
        const nik = document.getElementById('reg-c-nik').value.trim();
        const cID = `NEXC-${Math.floor(100000 + Math.random() * 900000)}`;
        const fullWA = `+${document.getElementById('reg-c-wa-code').value}${document.getElementById('reg-c-wa-num').value.trim()}`;
        
        customersDB.push({
            id: cID, nik: nik, name: document.getElementById('reg-c-name').value.trim(), type: "Personal", joined: new Date().toLocaleDateString('id-ID'), spent: 0, status: "Waiting", project: document.getElementById('reg-c-minat').value, workerAssigned: "-", email: document.getElementById('reg-c-email').value.trim(), wa: fullWA, username: cID, password: document.getElementById('reg-c-pass').value.trim(), avatar: ""
        });

        cModal.classList.remove('active');
        setSession('customer', cID);
        document.getElementById('success-msg-text').innerHTML = `Pendaftaran Berhasil.<br><br>ID Login Anda: <strong style="color:#00f2fe; font-size: 1.2rem;">${cID}</strong><br><br>Status: <span style="color:#ffaa00; font-weight:700;">Menunggu Review Admin</span>`;
        document.getElementById('success-modal').classList.add('active');
        renderAdminNotifications();
        pendingRedirect = 'page-4';
    });

    /* =========================================
       WORKER AUTHENTIKASI & FORM MANUAL
       ========================================= */
    const wModal = document.getElementById('worker-modal'); const wLogin = document.getElementById('worker-login-view'); const wSignup = document.getElementById('worker-signup-view'); const wTitle = document.getElementById('worker-modal-title');
    
    const cardWorker = document.getElementById('card-worker');
    if(cardWorker) cardWorker.addEventListener('click', () => { wModal.classList.add('active'); wLogin.style.display='block'; wSignup.style.display='none'; wTitle.innerText="WORKER LOGIN"; document.getElementById('login-w-error').style.display='none'; });
    
    const closeWorker = document.getElementById('close-worker');
    if(closeWorker) closeWorker.addEventListener('click', () => wModal.classList.remove('active'));

    const btnLogoutWorker = document.getElementById('btn-logout-worker');
    if(btnLogoutWorker) btnLogoutWorker.addEventListener('click', () => { clearSession(); navigateTo('page-1', 'backward'); });

    const specLainnyaCb = document.getElementById('spec-lainnya-cb');
    if(specLainnyaCb) specLainnyaCb.addEventListener('change', function() { 
        document.getElementById('spec-lainnya-text').style.display = this.checked ? 'block' : 'none'; 
        validateWorkerForm(); 
    });

    const btnLoginWorker = document.getElementById('btn-login-worker');
    if(btnLoginWorker) btnLoginWorker.addEventListener('click', () => {
        const user = document.getElementById('login-w-user').value.trim();
        const pass = document.getElementById('login-w-pass').value.trim();
        
        const fullUser = user.startsWith('NEXW-') ? user : `NEXW-${user}`;
        const worker = workersDB.find(w => w.username === fullUser && w.password === pass);
        
        if (worker) {
            wModal.classList.remove('active');
            setSession('worker', worker.id);
            fillDashboard('worker', worker);
            navigateTo('page-5', 'forward');
        } else { document.getElementById('login-w-error').style.display = 'block'; }
    });

    const btnRegWorker = document.getElementById('btn-reg-worker-submit');
    function validateWorkerForm() {
        const nik = document.getElementById('reg-w-nik').value.trim(); 
        const n = document.getElementById('reg-w-name').value.trim(); 
        const e = document.getElementById('reg-w-email').value.trim(); 
        const w = document.getElementById('reg-w-wa-num').value.trim(); 
        const temp = document.getElementById('reg-w-tempat').value.trim(); 
        const tang = document.getElementById('reg-w-dob').value; 
        const port = document.getElementById('reg-w-port').value.trim(); 
        const b = document.getElementById('reg-w-bank').value; 
        const rek = document.getElementById('reg-w-rek').value.trim(); 
        const rekName = document.getElementById('reg-w-rek-name').value.trim();
        const pw = document.getElementById('reg-w-pass').value.trim(); 
        const a = document.getElementById('reg-w-agree').checked;
        
        let specsChecked = false; let lainnyaValid = true;
        document.querySelectorAll('.spec-checkbox').forEach(cb => { if(cb.checked) specsChecked = true; });
        if (document.getElementById('spec-lainnya-cb').checked && document.getElementById('spec-lainnya-text').value.trim() === '') lainnyaValid = false;
        
        if(btnRegWorker) btnRegWorker.disabled = !(nik && n && e && w && temp && tang && port && b && rek && rekName && pw && a && specsChecked && lainnyaValid);
    }
    
    const workerSignupView = document.getElementById('worker-signup-view');
    if(workerSignupView) {
        workerSignupView.addEventListener('input', validateWorkerForm);
        workerSignupView.addEventListener('change', validateWorkerForm);
    }

    if(btnRegWorker) btnRegWorker.addEventListener('click', () => {
        const nik = document.getElementById('reg-w-nik').value.trim();
        const workerID = `NEXW-${Math.floor(100000 + Math.random() * 900000)}`;
        
        let specs = []; document.querySelectorAll('.spec-checkbox').forEach(cb => { if(cb.checked && cb.value !== "Lainnya") specs.push(cb.value); });
        if(document.getElementById('spec-lainnya-cb').checked) specs.push(document.getElementById('spec-lainnya-text').value.trim());
        
        const fullWA = `+${document.getElementById('reg-w-wa-code').value}${document.getElementById('reg-w-wa-num').value.trim()}`;
        const fullRek = `${document.getElementById('reg-w-bank').value} ${document.getElementById('reg-w-rek').value.trim()} A/N ${document.getElementById('reg-w-rek-name').value.trim()}`;
        const ttlCombo = `${document.getElementById('reg-w-tempat').value.trim()}, ${document.getElementById('reg-w-dob').value}`;

        workersDB.push({
            id: workerID, nik: nik, name: document.getElementById('reg-w-name').value.trim(), email: document.getElementById('reg-w-email').value.trim(), wa: fullWA, ttl: ttlCombo, joined: new Date().toLocaleDateString('id-ID'), balance: 0, income: 0, status: "Waiting", freezeDate: "", project: "", customer: "", specs: specs.join(", "), portfolio: document.getElementById('reg-w-port').value.trim(), rekening: fullRek, username: workerID, password: document.getElementById('reg-w-pass').value.trim(), avatar: ""
        });

        wModal.classList.remove('active');
        setSession('worker', workerID);
        document.getElementById('success-msg-text').innerHTML = `Pendaftaran Mitra Berhasil.<br><br>ID Login Anda: <strong style="color:#ff0055; font-size: 1.2rem;">${workerID}</strong><br><br>Status: <span style="color:#ffaa00; font-weight:700;">Menunggu Review Admin</span>`;
        document.getElementById('success-modal').classList.add('active');
        renderAdminNotifications(); 
        pendingRedirect = 'page-5';
    });

    const btnCloseSuccess = document.getElementById('btn-close-success');
    if(btnCloseSuccess) btnCloseSuccess.addEventListener('click', () => {
        document.getElementById('success-modal').classList.remove('active');
        if(pendingRedirect) { const rr = getCurrentRecord(); if (rr) fillDashboard(currentUser.role, rr); navigateTo(pendingRedirect, 'forward'); pendingRedirect = ''; }
    });

    /* =========================================
       NOTIFIKASI ADMIN GABUNGAN & KONTAK
       ========================================= */
    const notifArea = document.getElementById('admin-notifications'); const notifList = document.getElementById('notif-list');
    
    window.renderAdminNotifications = function() {
        const waitWorkers = workersDB.filter(w => w.status === 'Waiting');
        const waitCusts = customersDB.filter(c => c.status === 'Waiting');
        
        if(notifList) notifList.innerHTML = '';
        let hasNotif = false;

        waitWorkers.forEach(w => {
            hasNotif = true;
            const c = document.createElement('div'); c.className = 'notif-card';
            c.innerHTML = `<div><span class="badge worker">NEW WORKER</span><br><strong>${escHtml(w.name)}</strong><div class="notif-id">ID Nexora: ${escHtml(w.id)}</div><div style="font-size:0.8rem; color:rgba(255,255,255,0.7); margin-top:5px;">Specs: ${escHtml(w.specs)}</div></div><div class="notif-actions"><button type="button" class="btn-acc" style="color:#00f2fe; border:1px solid #00f2fe;" onclick="reviewWorker('${w.id}')">Review</button><button type="button" class="btn-acc acc" onclick="acceptWorkerNotif('${w.id}')">Accept</button><button type="button" class="btn-acc dec" onclick="declineWorkerNotif('${w.id}')">Decline</button></div>`;
            if(notifList) notifList.appendChild(c);
        });

        waitCusts.forEach(cu => {
            hasNotif = true;
            const c = document.createElement('div'); c.className = 'notif-card cust-notif';
            c.innerHTML = `<div><span class="badge customer">NEW CUSTOMER</span><br><strong style="color:#ffaa00;">${cu.name}</strong><div style="font-size:0.8rem; color:rgba(255,255,255,0.7); margin-top:5px;">Project: ${cu.project}</div></div><div><button type="button" class="btn-acc" style="color:#ffaa00; border:1px solid #ffaa00;" onclick="reviewCustomer('${cu.id}')">Review</button></div>`;
            if(notifList) notifList.appendChild(c);
        });

        ordersDB.filter(o => !o.isRead).forEach(o => {
            hasNotif = true;
            const c = document.createElement('div'); c.className = 'notif-card order-notif';
            c.innerHTML = `<div><span class="badge order">PESANAN BARU</span><br><strong>${escHtml(o.productName)}</strong><div class="notif-id">${escHtml(o.id)} &bull; ${formatRp(o.nominal)}</div><div style="font-size:0.8rem; color:rgba(255,255,255,0.7); margin-top:5px;">Pemesan: ${escHtml(o.customerName || '-')} (${escHtml(o.customerId || '-')})</div></div><div class="notif-actions"><button type="button" class="btn-acc" style="color:#b388ff; border:1px solid #b388ff;" onclick="contactOrderCustomer('${o.id}')">Chat Customer</button><button type="button" class="btn-acc acc" onclick="openOrderFromNotif('${o.id}')">Lihat</button></div>`;
            if(notifList) notifList.appendChild(c);
        });

        chatConversations().forEach(cv => {
            const unreadMsgs = cv.msgs.filter(m => m.from === 'user' && !m.readByAdmin);
            if (!unreadMsgs.length) return;
            hasNotif = true;
            const last = unreadMsgs[unreadMsgs.length - 1];
            const c = document.createElement('div'); c.className = 'notif-card chat-notif';
            c.innerHTML = `<div><span class="badge chat">NEW CHAT (${unreadMsgs.length})</span><br><strong>${escHtml(cv.name)}</strong><div class="notif-id">ID Nexora: ${escHtml(cv.userId)}</div><div style="font-size:0.8rem; color:rgba(255,255,255,0.7); margin-top:5px;">${escHtml(msgPreview(last))}</div></div><div class="notif-actions"><button type="button" class="btn-acc" style="color:#b388ff; border:1px solid #b388ff;" onclick="openAdminChatFromNotif('${cv.userId}')">Buka Chat</button></div>`;
            if(notifList) notifList.appendChild(c);
        });
        payoutsDB.filter(p => p.status === 'Pending').forEach(p => {
            hasNotif = true;
            const c = document.createElement('div'); c.className = 'notif-card payout-notif';
            c.innerHTML = `<div><span class="badge payout">PENCAIRAN DANA</span><br><strong>${escHtml(p.workerName)}</strong><div class="notif-id">${escHtml(p.workerId)} &bull; ${formatRp(p.amount)}</div><div style="font-size:0.8rem; color:rgba(255,255,255,0.7); margin-top:5px;">Ke: ${escHtml(p.bank)} ${escHtml(p.accNo)} a.n. ${escHtml(p.accName)}</div></div><div><button type="button" class="btn-acc acc" onclick="openPayoutFromNotif('${p.id}')">Proses</button></div>`;
            if(notifList) notifList.appendChild(c);
        });
        if(notifArea) notifArea.style.display = hasNotif ? 'block' : 'none';
    }

    window.reviewWorker = function(id) { openWorkerDoc(id, true); };
    window.acceptWorkerNotif = function(id) {
        const w = workersDB.find(x => x.id === id); if (!w) return;
        customConfirm('Terima <strong>' + escHtml(w.name) + '</strong> (' + escHtml(w.id) + ') sebagai Worker Nexora?', () => {
            accWorker(id);
            document.getElementById('worker-document-modal').classList.remove('active');
            customAlert('Worker <strong>' + escHtml(w.name) + '</strong> (' + escHtml(w.id) + ') telah di-<strong>Accept</strong>.');
        });
    };
    window.declineWorkerNotif = function(id) {
        const w = workersDB.find(x => x.id === id); if (!w) return;
        customConfirm('Tolak pendaftaran <strong>' + escHtml(w.name) + '</strong> (' + escHtml(w.id) + ')?', () => {
            decWorker(id);
            document.getElementById('worker-document-modal').classList.remove('active');
            customAlert('Pendaftaran <strong>' + escHtml(w.name) + '</strong> (' + escHtml(w.id) + ') telah di-<strong>Decline</strong>.');
        });
    };
    window.accWorker = function(id) { const w = workersDB.find(x => x.id === id); if(w) w.status = "Worker"; renderAdminNotifications(); renderWorkerTable(); };
    window.decWorker = function(id) { const w = workersDB.find(x => x.id === id); if(w) w.status = "Declined"; renderAdminNotifications(); renderWorkerTable(); };

    window.reviewCustomer = function(id) {
        const cu = customersDB.find(x => x.id === id);
        if(cu) { cu.status = "Active"; renderAdminNotifications(); renderCustomerTable(); customAlert(`Customer ${cu.name} telah di-Approve menjadi Active!`); }
    };

    /* =========================================
       TABEL DATA WORKER & CUSTOMER
       ========================================= */
    const tbody = document.getElementById('worker-list-tbody'); let currentTab = 'active';
    window.switchWorkerTab = function(tabName) {
        currentTab = tabName;
        document.querySelectorAll('#admin-data-worker-view .admin-tab').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        renderWorkerTable();
    };

    window.renderWorkerTable = function() {
        if(!tbody) return;
        tbody.innerHTML = '';
        let db = currentTab === 'active' ? workersDB.filter(w => ['Worker','On Progress','Freeze'].includes(w.status)) : workersDB.filter(w => w.status === 'Declined');
        if(db.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Tidak ada data.</td></tr>`; return; }

        db.forEach(w => {
            const lvl = calculateLevel(w.income);
            const tr = document.createElement('tr'); tr.className = "data-row";
            const avatarHtml = renderAvatarHtml(w.avatar, "O");
            const orderTag = (w.status === 'On Progress' && w.orderId) ? `<br><span style="font-size:0.75rem; color:#00f2fe; font-weight:700;">ID Pesanan: ${escHtml(w.orderId)}</span>` : '';

            tr.innerHTML = `<td style="display:flex; justify-content:center;"><div class="avatar-wrapper"><div class="avatar-o">${avatarHtml}</div><div class="level-medal" style="background:${lvl.color}; border: 1px solid #000;" title="${lvl.name}">${lvl.medal}</div></div></td><td style="font-weight:700; color:#ffffff;">${w.id}</td><td style="color:#ffffff; font-weight:700;">${w.name}</td><td><span style="color:${lvl.color}; font-weight:800;">${lvl.name}</span></td><td>${w.status}${orderTag}</td><td style="text-align:center;"><button type="button" class="btn-action-sm btn-chat" title="Kirim pesan" onclick="chatWithUser('${w.id}')">💬${chatDot(w.id)}</button><button type="button" class="btn-action-sm btn-view" onclick="openWorkerDoc('${w.id}')">📄</button><button type="button" class="btn-action-sm btn-del" title="Hapus Worker" onclick="deleteWorker('${w.id}')">🗑️</button></td>`;
            tbody.appendChild(tr);
        });
    }

    const tbodyCust = document.getElementById('customer-list-tbody'); let currentCustTab = 'active';
    window.switchCustTab = function(tabName) {
        currentCustTab = tabName;
        document.querySelectorAll('#admin-data-customer-view .admin-tab').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-cust-${tabName}`).classList.add('active');
        renderCustomerTable();
    };

    window.renderCustomerTable = function() {
        if(!tbodyCust) return;
        tbodyCust.innerHTML = '';
        let db = currentCustTab === 'active' ? customersDB.filter(c => ['Active','Hold'].includes(c.status)) : customersDB.filter(c => ['Completed','Cancelled'].includes(c.status));
        if(db.length === 0) { tbodyCust.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Tidak ada data pelanggan.</td></tr>`; return; }

        db.forEach(c => {
            const lvl = calculateCustomerLevel(c.spent);
            const tr = document.createElement('tr'); tr.className = "data-row";
            const avatarHtml = renderAvatarHtml(c.avatar, "C");

            tr.innerHTML = `<td style="display:flex; justify-content:center;"><div class="avatar-wrapper"><div class="avatar-o">${avatarHtml}</div><div class="level-medal" style="background:${lvl.color}; border: 1px solid #000;" title="${lvl.name}">${lvl.medal}</div></div></td><td style="font-weight:700; color:#ffffff;">${c.id}</td><td style="color:#ffffff; font-weight:700;">${c.name}</td><td><span style="color:${lvl.color}; font-weight:800;">${lvl.name}</span></td><td>${c.status}</td><td style="text-align:center;"><button type="button" class="btn-action-sm btn-chat" title="Kirim pesan" onclick="chatWithUser('${c.id}')">💬${chatDot(c.id)}</button><button type="button" class="btn-action-sm btn-view" onclick="openCustomerDetail('${c.id}')">DETAIL</button><button type="button" class="btn-action-sm btn-del" title="Hapus Customer" onclick="deleteCustomer('${c.id}')">🗑️</button></td>`;
            tbodyCust.appendChild(tr);
        });
    };

    function afterDataDelete() {
        try { renderAdminChatList(); updateChatBadges(); renderAdminNotifications(); updatePayoutBadge(); updateOrderBadge(); refreshPocketFields(); } catch (err) {}
    }
    window.deleteWorker = function(id) {
        const w = workersDB.find(x => x.id === id);
        if (!w) return;
        askDeletePassword('Hapus worker <strong>' + escHtml(w.name) + '</strong> (' + escHtml(w.id) + ') beserta chat dan data pencairan Pocket miliknya secara permanen?', () => {
            workersDB = workersDB.filter(x => x.id !== id);
            chatsDB = chatsDB.filter(m => m.userId !== id);
            payoutsDB = payoutsDB.filter(x => x.workerId !== id);
            if (currentUser && currentUser.id === id) clearSession();
            if (activeAdminChatUser === id) resetAdminThread();
            renderWorkerTable(); afterDataDelete();
        });
    };
    window.deleteCustomer = function(id) {
        const c = customersDB.find(x => x.id === id);
        if (!c) return;
        askDeletePassword('Hapus customer <strong>' + escHtml(c.name) + '</strong> (' + escHtml(c.id) + ') beserta chat-nya secara permanen?<br><span style="font-size:0.8rem; color:#ffaa00;">Pesanan & catatan keuangan tidak ikut terhapus (hapus terpisah di menu Pesanan / Keuangan).</span>', () => {
            customersDB = customersDB.filter(x => x.id !== id);
            chatsDB = chatsDB.filter(m => m.userId !== id);
            if (currentUser && currentUser.id === id) clearSession();
            if (activeAdminChatUser === id) resetAdminThread();
            renderCustomerTable(); afterDataDelete();
        });
    };
    window.deleteOrder = function(id) {
        const o = ordersDB.find(x => x.id === id);
        if (!o) return;
        askDeletePassword('Hapus pesanan <strong>' + escHtml(o.id) + '</strong> (' + escHtml(o.productName) + ') beserta catatan keuangannya?', () => {
            purgeFinanceRows(financeDB.filter(f => f.orderId === id || f.id === o.financeId || f.id === o.payrollId));
            ordersDB = ordersDB.filter(x => x.id !== id);
            if (o.workerId && o.workerId !== '-') refreshWorkerStatus(o.workerId);
            syncWorkerEarnings();
            renderOrdersTable();
            try { renderWorkerTable(); renderFinanceTable(); } catch (err) {}
            afterDataDelete();
        });
    };
    window.deletePayout = function(id) {
        const p = payoutsDB.find(x => x.id === id);
        if (!p) return;
        askDeletePassword('Hapus data pencairan <strong>' + escHtml(p.id) + '</strong> (' + escHtml(p.workerName || '') + ', ' + formatRp(p.amount || 0) + ')?', () => {
            payoutsDB = payoutsDB.filter(x => x.id !== id);
            renderPayoutTable();
            afterDataDelete();
        });
    };

    window.openWorkerDoc = function(id, isReview = false) {
        const w = workersDB.find(x => x.id === id);
        document.getElementById('doc-avatar-img').innerHTML = renderAvatarHtml(w.avatar, "O");
        document.getElementById('doc-name').innerText = w.name;
        document.getElementById('doc-specs').innerText = w.specs || "-";
        document.getElementById('doc-port').innerText = w.portfolio || "-";
        document.getElementById('doc-rek').innerText = w.rekening || "-";
        document.getElementById('doc-user').innerText = w.username || "-";
        const row = (lbl, val) => val ? `<div class="profile-section"><div class="profile-label">${lbl}</div><div class="profile-value">${escHtml(val)}</div></div>` : '';
        const extra = document.getElementById('doc-extra');
        if (extra) extra.innerHTML = row('ID Nexora', w.id) + row('Nama Panggilan', w.nickname) + row('Alamat', [w.address, w.city, w.zip].filter(Boolean).join(', ')) + row('Pengalaman', w.experience) + row('Penerimaan Job', w.availability === 'off' ? 'Tidak Menerima Job' : (w.availability === 'on' ? 'Menerima Job' : '')) + row('Software / Tools', w.tools) + row('Bio', w.bio);
        const bar = document.getElementById('doc-action-bar');
        if (bar) {
            if (isReview) {
                bar.innerHTML = `<button type="button" class="btn-acc acc" onclick="acceptWorkerNotif('${w.id}')">Accept</button><button type="button" class="btn-acc dec" onclick="declineWorkerNotif('${w.id}')">Decline</button>`;
                bar.style.display = 'flex';
            } else { bar.innerHTML = ''; bar.style.display = 'none'; }
        }
        document.getElementById('worker-document-modal').classList.add('active');
    };
    document.getElementById('close-worker-document').addEventListener('click', () => { document.getElementById('worker-document-modal').classList.remove('active'); });

    // CAROUSEL SETUP (MEMUTAR 3D SEMPURNA)
    function initCarousel(carouselId, sceneId, cardClass, activeBorderColor) {
        const carousel = document.getElementById(carouselId); const scene = document.getElementById(sceneId); const cards = document.querySelectorAll(`#${carouselId} .${cardClass}`);
        if(cards.length === 0 || !carousel || !scene) return;
        
        let radius = Math.round((260 / 2) / Math.tan(Math.PI / cards.length)) + 60;
        if (carouselId === 'admin-carousel') radius = Math.max(260, radius);

        let tA = 0; let cA = 0; let isD = false; let sX = 0; let vel = 0; let lX = 0; let lT = 0; let moved = 0;
        cards.forEach((c, i) => { 
            c.style.transform = `rotateY(${i*(360/cards.length)}deg) translateZ(${radius}px)`; c.dataset.angle = i*(360/cards.length); 
            
            c.addEventListener('click', () => {
                if (moved < 6) {
                    if (carouselId === 'carousel') {
                        if (!currentUser) { pendingCategory = c.dataset.category; openUserLogin(); } else { openMainCategory(c.dataset.category); }
                    } else if (carouselId === 'admin-carousel') {
                        if (c.id === 'btn-menu-orders') { viewCarousel.style.display = 'none'; viewOrders.style.display = 'flex'; renderOrdersTable(); markOrdersAsRead(); }
                        if (c.id === 'btn-menu-worker') { viewCarousel.style.display = 'none'; viewDataWorker.style.display = 'flex'; renderWorkerTable(); }
                        if (c.id === 'btn-menu-customer') { viewCarousel.style.display = 'none'; viewDataCustomer.style.display = 'flex'; renderCustomerTable(); }
                        if (c.id === 'btn-menu-content') { viewCarousel.style.display = 'none'; viewManageContent.style.display = 'flex'; switchCMSTab('video'); }
                        if (c.id === 'btn-menu-finance') { viewCarousel.style.display = 'none'; viewFinance.style.display = 'flex'; renderFinanceTable(); }
                        if (c.id === 'btn-menu-chat') { viewCarousel.style.display = 'none'; viewChat.style.display = 'flex'; renderAdminChatList(); }
                        if (c.id === 'btn-menu-payout') { viewCarousel.style.display = 'none'; viewPayout.style.display = 'flex'; renderPayoutTable(); }
                    }
                }
            });
        });
        let lastCA = null;
        const kScale = carouselId === 'admin-carousel' ? (360 / 7) / (360 / cards.length) : 1;
        function anim() {
            if (!isD) { const dA = tA - cA; cA = Math.abs(dA) < 0.01 ? tA : cA + dA * 0.09; }
            // Lewati render jika carousel tersembunyi (halaman lain) atau sudah berhenti
            if (scene.offsetParent === null || cA === lastCA) { requestAnimationFrame(anim); return; }
            lastCA = cA;
            carousel.style.transform = `translateZ(${-radius}px) rotateY(${cA}deg)`;
            
            cards.forEach((c) => {
                let diff = Math.abs((((cA % 360) + 360) % 360) - (((-parseFloat(c.dataset.angle) % 360) + 360) % 360)); 
                if (diff > 180) diff = 360 - diff;
                
                let calcBlur = Math.max(0, (diff * kScale) / 8); 
                let calcOpacity = Math.max(0.1, 1 - ((diff * kScale) / 60));
                
                c.style.filter = `blur(${calcBlur}px)`; 
                c.style.opacity = calcOpacity;
                
                if (diff < 15) { 
                    if (!c.classList.contains('active')) c.classList.add('active'); 
                } else { 
                    if (c.classList.contains('active')) c.classList.remove('active'); 
                }
            }); 
            requestAnimationFrame(anim);
        }
        function sD(cx) { isD=true; sX=cx; lX=cx; lT=Date.now(); vel=0; moved=0; } function dD(cx) { if(!isD)return; moved=Math.max(moved, Math.abs(cx-sX)); if(moved>=6) scene.classList.add('dragging'); const dt=Date.now()-lT; if(dt>0) vel=(cx-lX)/dt; cA+=(cx-lX)/3; tA=cA; lX=cx; lT=Date.now(); } function eD() { if(!isD)return; isD=false; scene.classList.remove('dragging'); tA=Math.round((cA+(vel*120))/(360/cards.length))*(360/cards.length); }
        scene.addEventListener('mousedown', (e)=>sD(e.pageX)); window.addEventListener('mousemove', (e)=>dD(e.pageX)); window.addEventListener('mouseup', eD);
        scene.addEventListener('touchstart', (e)=>sD(e.touches[0].pageX), {passive: true}); window.addEventListener('touchmove', (e)=>dD(e.touches[0].pageX), {passive: true}); window.addEventListener('touchend', eD);
        window.addEventListener('mouseleave', () => { if(isD) eD(); }); anim();
    }
    
    initCarousel('carousel', 'scene', 'card', null); 
    initCarousel('admin-carousel', 'admin-scene', 'admin-card', '#00f2fe');
    restoreSession();
    renderAdminNotifications();
    updateOrderBadge();
    updateUserTrigger();
    renderBanners();
    updateChatBadges();
    updatePayoutBadge(); snapPayoutStatus();
    try { history.replaceState({ nex: 1, idx: 0, page: 'page-1', cat: '', adm: '' }, '', location.pathname + location.search); } catch (err) {}

    // Dipanggil persist.js saat data dari perangkat lain masuk -> segarkan tampilan yang relevan
    window.NexRefresh = function(cols) {
        const has = (c) => !cols || cols.indexOf(c) > -1;
        const shown = (el) => el && el.style.display !== 'none';
        const typing = () => { const a = document.activeElement; return a && a.closest && a.closest('#admin-orders-view, #admin-finance-view') && /INPUT|SELECT|TEXTAREA/.test(a.tagName); };
        try {
            if (has('videosDB')) { renderMainVideos(); if (shown(viewManageContent) && currentCMSCategory === 'video' && $id('content-list-view').style.display !== 'none') renderAdminVideoList(); }
            if (has('bannersDB')) { renderBanners(); if (shown(viewManageContent) && currentCMSCategory === 'banner') renderAdminBanners(); }
            if (has('productsDB')) {
                if (currentOpenMainCategory) renderMainProducts(currentOpenMainCategory);
                if (shown(viewManageContent) && currentCMSCategory !== 'video' && currentCMSCategory !== 'banner' && $id('product-list-view').style.display !== 'none') renderAdminProductList(currentCMSCategory);
            }
            if (has('workersDB') || has('customersDB')) {
                updateUserTrigger();
                refreshLevelProg();
                if (shown(viewDataWorker)) renderWorkerTable();
                if (shown(viewDataCustomer)) renderCustomerTable();
            }
            if (has('ordersDB') || has('workersDB') || has('customersDB') || has('financeDB')) {
                if (adminAuthed) { renderAdminNotifications(); updateOrderBadge(); }
                if (shown(viewOrders) && !openOrderId && !typing()) renderOrdersTable();
                if (shown(viewFinance) && !typing()) renderFinanceTable();
            }
            if (has('payoutsDB') || has('workersDB') || has('financeDB')) {
                updatePayoutBadge();
                if (adminAuthed) renderAdminNotifications();
                if (shown(viewPayout) && !openPayoutId) renderPayoutTable();
                if (has('payoutsDB')) notifyPayoutChanges();
                refreshPocketFields();
            }
            if (has('chatsDB')) {
                if (currentUser && $id('chat-panel') && $id('chat-panel').classList.contains('open')) { markUserRead(); renderUserChat(); }
                if (shown(viewChat)) {
                    if (activeAdminChatUser) { chatsDB.forEach(m => { if (m.userId === activeAdminChatUser && m.from === 'user' && !m.readByAdmin) m.readByAdmin = true; }); renderAdminThreadBody(); }
                    renderAdminChatList();
                }
                updateChatBadges();
                if (adminAuthed) renderAdminNotifications();
            }
        } catch (err) {}
    };

};