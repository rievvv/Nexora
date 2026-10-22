/* global workersDB, customersDB, videosDB, productsDB, ordersDB, financeDB, bannersDB, chatsDB, adminDB_Login, calculateLevel, calculateCustomerLevel, formatRp */

document.addEventListener('DOMContentLoaded', () => {

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

    window.navigateTo = function(targetPageId, direction = 'forward') {
        if (isAnimating || currentPageId === targetPageId) return;
        isAnimating = true;
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
            document.getElementById('login-error-admin').style.display = 'none';
            document.getElementById('admin-modal').classList.remove('active'); 
            
            document.getElementById('admin-carousel-view').style.display = 'flex';
            document.getElementById('admin-orders-view').style.display = 'none';
            document.getElementById('admin-data-worker-view').style.display = 'none';
            document.getElementById('admin-data-customer-view').style.display = 'none';
            document.getElementById('admin-manage-content-view').style.display = 'none'; document.getElementById('admin-finance-view').style.display = 'none'; document.getElementById('admin-chat-view').style.display = 'none';

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
        document.getElementById('admin-carousel-view').style.display = 'flex';
        document.getElementById('admin-orders-view').style.display = 'none';
        document.getElementById('admin-data-worker-view').style.display = 'none';
        document.getElementById('admin-data-customer-view').style.display = 'none';
        document.getElementById('admin-manage-content-view').style.display = 'none'; document.getElementById('admin-finance-view').style.display = 'none'; document.getElementById('admin-chat-view').style.display = 'none';
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

    document.addEventListener('click', function(e) {
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
    });

    /* =========================================
       REVISI 4, 5 & 6: PESANAN HANYA MASUK SAAT KLIK WA, DEADLINE & DROPDOWN STATUS
       ========================================= */
    let currentActiveOrder = null;

    window.buyProduct = function(id) {
        const p = productsDB.find(x => x.id === id);
        if(!p) return;
        if (!currentUser) { openUserLogin(); return; }
        if(p.link && p.link !== "") {
            window.open(p.link, '_blank');
        } else {
            let basePrice = p.price ? (parseInt(String(p.price).replace(/\D/g, ''), 10) || 500000) : 500000;
            let uniqueCode = Math.floor(100 + Math.random() * 900);
            let finalPrice = basePrice + uniqueCode;

            // REVISI 4: Objek pesanan disiapkan (akan dimasukkan ke database saat klik tombol WhatsApp)
            currentActiveOrder = {
                id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
                productName: p.name,
                productImg: p.imgUrl || '',
                nominal: finalPrice,
                status: "Pending",
                workerId: "-",
                startDate: new Date().toISOString().slice(0, 10),
                deadlineDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0, 10), // Default 7 hari ke depan
                completedDate: null,
                isRead: false,
                category: p.category,
                baseNominal: basePrice,
                uniqueCode: uniqueCode,
                customerId: currentUser.id,
                customerName: (getCurrentRecord() || {}).name || '',
                customerRole: currentUser.role
            };

            document.getElementById('qris-unique-amount').innerText = formatRp(finalPrice);

            // REVISI 5: Format pesan konfirmasi WhatsApp
            let waMsg = `*Konfirmasi Pembelian*%0ANama Produk : ${p.name}%0ANomimal Transfer : ${formatRp(finalPrice)}%0ABank Transfer : BCA%0AAtas Nama : Arief Gunawan`;
            
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
            const workerDisplay = (o.workerId && o.workerId !== '-') ? `<br><span style="font-size:0.75rem; color:#00f2fe;">Worker: ${escHtml(o.workerId)}</span>` : '';
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
                <td style="text-align:center;"><button type="button" class="btn-action-sm btn-view" onclick="event.stopPropagation(); openOrderDetailModal('${o.id}')">DETAIL</button></td>
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
                        <input type="text" id="od-worker-id" class="admin-input" placeholder="ID Nexora Worker (cth: NEXW-971016-001)" value="${hasWorker ? escHtml(o.workerId) : ''}" style="margin-bottom:10px;">
                        <button type="button" class="btn-futuristic" onclick="saveOrderWorker()" style="width:100%; padding:10px;">SIMPAN ON PROCESS</button>
                    </div>
                </div>`;
        }
        box.innerHTML = html;
    }

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
            ordersDB.forEach(o => o.isRead = true);
            updateOrderBadge();
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

    window.deleteFinanceRow = function(id) {
        customConfirm('Hapus transaksi manual ini?', () => {
            financeDB = financeDB.filter(f => f.id !== id);
            renderFinanceTable();
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
                <td>${f.kind === 'manual' ? `<button type="button" class="fin-del" onclick="deleteFinanceRow('${f.id}')" title="Hapus">✕</button>` : ''}</td>`;
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
        customConfirm("Apakah Anda yakin ingin menghapus video ini secara permanen?", () => {
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
                    <p class="price">${p.price ? formatRp(parseInt(String(p.price).replace(/\D/g, ''), 10)) : 'Harga Menyesuaikan'}</p>
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
            }
            customAlert("Produk berhasil diperbarui!");
        } else {
            productsDB.push({
                id: `PRD-${new Date().getTime()}`,
                category: currentCMSCategory,
                name: document.getElementById('up-prod-name').value.trim(),
                price: document.getElementById('up-prod-price').value.replace(/\D/g, ''),
                link: document.getElementById('up-prod-link').value.trim(),
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
        customConfirm("Hapus produk ini secara permanen?", () => {
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
        validateProductUpload();
    };

    // --- LOGIKA HALAMAN UTAMA (KLIK KATEGORI) ---
    let currentOpenMainCategory = "";

    window.openMainCategory = function(category) {
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
                    <p class="price">${p.price ? formatRp(parseInt(String(p.price).replace(/\D/g, ''), 10)) : 'Harga Menyesuaikan'}</p>
                    <button class="btn-buy ${isSold ? 'sold' : ''}" ${isSold ? 'disabled' : `onclick="buyProduct('${p.id}')"`}>
                        ${isSold ? 'SOLD OUT' : 'AKU MAU'}
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

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

    function setSession(role, id) { currentUser = { role: role, id: id }; updateUserTrigger(); }
    function clearSession() { currentUser = null; pendingCategory = ''; updateUserTrigger(); closeMainCategory(); }

    // Icon login -> foto profil (tanpa ikon gembok) setelah login
    function updateUserTrigger() {
        const btn = document.getElementById('user-btn');
        if (!btn) return;
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
            set('dash-w-id', rec.id); set('dash-w-nik', rec.nik || '-'); set('dash-w-level', `${lvl.medal} ${lvl.name} • Bonus ${lvl.bonus}`); set('dash-w-balance', formatRp(rec.balance || 0)); set('dash-w-status', st);
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
        if (isW) stats += `<div class="up-stat worker"><div class="lbl">Saldo Pendapatan</div><div class="val">${formatRp(rec.balance || 0)}</div><div class="sub">Setelah pembagian hasil</div></div>`;
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
            <div class="profile-label" style="margin-bottom:5px;">Aktivitas</div>
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
       SLIDING BANNER IKLAN
       ========================================= */
    let bannerIdx = 0, bannerTimer = null;
    function goBanner(i) {
        const n = bannersDB.length; if (!n) return;
        bannerIdx = ((i % n) + n) % n;
        const track = document.getElementById('banner-track');
        if (track) track.style.transform = `translateX(-${bannerIdx * 100}%)`;
        document.querySelectorAll('#banner-dots .banner-dot').forEach((d, k) => d.classList.toggle('active', k === bannerIdx));
    }
    function startBannerTimer() {
        clearInterval(bannerTimer);
        if (bannersDB.length > 1) bannerTimer = setInterval(() => goBanner(bannerIdx + 1), 4500);
    }
    window.renderBanners = function() {
        const track = document.getElementById('banner-track'), dots = document.getElementById('banner-dots');
        const prev = document.getElementById('banner-prev'), next = document.getElementById('banner-next');
        if (!track) return;
        clearInterval(bannerTimer);
        if (!bannersDB.length) {
            track.style.transform = 'none';
            track.innerHTML = `<div class="banner-slide banner-empty"><div>📢 SLOT IKLAN<small>Ruang banner promosi &bull; rekomendasi 1200 x 400 px</small></div></div>`;
            dots.innerHTML = ''; prev.style.display = 'none'; next.style.display = 'none';
            return;
        }
        track.innerHTML = bannersDB.map(b => b.link
            ? `<a class="banner-slide" href="${escHtml(b.link)}" target="_blank" rel="noopener"><img src="${b.imgUrl}" alt="Iklan" draggable="false"></a>`
            : `<div class="banner-slide"><img src="${b.imgUrl}" alt="Iklan" draggable="false"></div>`).join('');
        const multi = bannersDB.length > 1;
        prev.style.display = multi ? 'flex' : 'none'; next.style.display = multi ? 'flex' : 'none';
        dots.innerHTML = multi ? bannersDB.map((b, k) => `<button type="button" class="banner-dot" aria-label="Banner ${k + 1}"></button>`).join('') : '';
        dots.querySelectorAll('.banner-dot').forEach((d, k) => d.addEventListener('click', () => { goBanner(k); startBannerTimer(); }));
        goBanner(Math.min(bannerIdx, bannersDB.length - 1));
        startBannerTimer();
    };
    (function initBannerControls() {
        const slider = document.getElementById('banner-slider');
        if (!slider) return;
        document.getElementById('banner-prev').addEventListener('click', () => { goBanner(bannerIdx - 1); startBannerTimer(); });
        document.getElementById('banner-next').addEventListener('click', () => { goBanner(bannerIdx + 1); startBannerTimer(); });
        slider.addEventListener('mouseenter', () => clearInterval(bannerTimer));
        slider.addEventListener('mouseleave', startBannerTimer);
        let sx = 0;
        slider.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; clearInterval(bannerTimer); }, { passive: true });
        slider.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - sx;
            if (Math.abs(dx) > 40) goBanner(bannerIdx + (dx < 0 ? 1 : -1));
            startBannerTimer();
        }, { passive: true });
    })();

    window.renderAdminBanners = function() {
        const box = document.getElementById('admin-banner-list');
        if (!box) return;
        if (!bannersDB.length) { box.innerHTML = '<div class="empty-video-state" style="grid-column: 1 / -1;">BELUM ADA BANNER IKLAN</div>'; return; }
        box.innerHTML = bannersDB.map((b, i) => `<div class="banner-admin-item"><img src="${b.imgUrl}" alt="Banner ${i + 1}"><div class="meta"><span>${b.link ? escHtml(b.link) : 'Tanpa link'}</span><button type="button" class="btn-vid-action btn-vid-del" style="flex:0 0 auto;" onclick="deleteBanner('${b.id}')">HAPUS</button></div></div>`).join('');
    };
    window.deleteBanner = function(id) {
        customConfirm('Hapus banner iklan ini?', () => { bannersDB = bannersDB.filter(b => b.id !== id); renderAdminBanners(); renderBanners(); });
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
            return `<div class="chat-msg ${m.from === me ? 'mine' : 'theirs'}">${body}<span class="chat-time">${chatClock(m.ts)}</span></div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
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
        const fb = $id('chat-fab-badge');
        if (fb) {
            const n = currentUser ? chatsDB.filter(m => m.userId === currentUser.id && m.from === 'admin' && !m.readByUser).length : 0;
            fb.innerText = n; fb.style.display = n > 0 ? 'flex' : 'none';
        }
        const ab = $id('chat-badge-notif');
        if (ab) {
            const t = chatsDB.filter(m => m.from === 'user' && !m.readByAdmin).length;
            ab.innerText = t; ab.style.display = t > 0 ? 'flex' : 'none';
        }
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
    const chatCloseEl = $id('chat-close');
    if (chatCloseEl) chatCloseEl.addEventListener('click', () => $id('chat-panel').classList.remove('open'));

    // ----- Sisi admin -----
    window.renderAdminChatList = function() {
        const list = $id('admin-chat-list');
        if (!list) return;
        const convs = chatConversations();
        if (!convs.length) { list.innerHTML = '<div class="chat-empty">Belum ada pesan masuk.</div>'; return; }
        list.innerHTML = convs.map(cv => {
            const unread = cv.msgs.filter(m => m.from === 'user' && !m.readByAdmin).length;
            const rec = chatUserRecord(cv.userId);
            const av = renderAvatarHtml(rec ? rec.avatar : '', escHtml((cv.name || '?').trim().charAt(0).toUpperCase()));
            return `<div class="chat-conv ${cv.userId === activeAdminChatUser ? 'active' : ''}" data-uid="${escHtml(cv.userId)}"><div class="avatar-wrapper" style="width:40px; height:40px; flex:0 0 40px;"><div class="avatar-o" style="font-size:1rem;">${av}</div></div><div class="info"><div class="nm">${escHtml(cv.name)}</div><div class="idn">${escHtml(cv.userId)} &bull; ${escHtml(cv.role)}</div><div class="pv">${escHtml(msgPreview(cv.last))}</div></div>${unread ? `<div class="unread">${unread}</div>` : ''}</div>`;
        }).join('');
        list.querySelectorAll('.chat-conv').forEach(n => n.addEventListener('click', () => openAdminThread(n.dataset.uid)));
    };
    function renderAdminThreadBody() {
        if (!activeAdminChatUser) return;
        renderChatMessages($id('admin-chat-body'), chatsDB.filter(m => m.userId === activeAdminChatUser), 'admin');
    }
    function openAdminThread(userId) {
        activeAdminChatUser = userId;
        chatsDB.forEach(m => { if (m.userId === userId && m.from === 'user') m.readByAdmin = true; });
        const info = chatUserInfo(userId);
        const th = $id('admin-chat-thread');
        th.innerHTML = `<div class="chat-head"><div style="display:flex; align-items:center;"><button type="button" class="back-list" aria-label="Kembali ke daftar">&larr;</button><div><strong>${escHtml(info.name)}</strong><span>ID Nexora: ${escHtml(userId)} &bull; ${escHtml(info.role)}</span></div></div></div><div class="chat-body" id="admin-chat-body"></div><div id="admin-chat-composer"></div>`;
        th.querySelector('.back-list').addEventListener('click', () => $id('admin-chat-layout').classList.remove('show-thread'));
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
    window.openAdminChatFromNotif = function(userId) {
        viewCarousel.style.display = 'none';
        viewChat.style.display = 'flex';
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

        chatConversations().forEach(cv => {
            const unreadMsgs = cv.msgs.filter(m => m.from === 'user' && !m.readByAdmin);
            if (!unreadMsgs.length) return;
            hasNotif = true;
            const last = unreadMsgs[unreadMsgs.length - 1];
            const c = document.createElement('div'); c.className = 'notif-card chat-notif';
            c.innerHTML = `<div><span class="badge chat">NEW CHAT (${unreadMsgs.length})</span><br><strong>${escHtml(cv.name)}</strong><div class="notif-id">ID Nexora: ${escHtml(cv.userId)}</div><div style="font-size:0.8rem; color:rgba(255,255,255,0.7); margin-top:5px;">${escHtml(msgPreview(last))}</div></div><div class="notif-actions"><button type="button" class="btn-acc" style="color:#b388ff; border:1px solid #b388ff;" onclick="openAdminChatFromNotif('${cv.userId}')">Buka Chat</button></div>`;
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

            tr.innerHTML = `<td style="display:flex; justify-content:center;"><div class="avatar-wrapper"><div class="avatar-o">${avatarHtml}</div><div class="level-medal" style="background:${lvl.color}; border: 1px solid #000;" title="${lvl.name}">${lvl.medal}</div></div></td><td style="font-weight:700; color:#ffffff;">${w.id}</td><td style="color:#ffffff; font-weight:700;">${w.name}</td><td><span style="color:${lvl.color}; font-weight:800;">${lvl.name}</span></td><td>${w.status}${orderTag}</td><td style="text-align:center;"><button type="button" class="btn-action-sm btn-view" onclick="openWorkerDoc('${w.id}')">📄</button></td>`;
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

            tr.innerHTML = `<td style="display:flex; justify-content:center;"><div class="avatar-wrapper"><div class="avatar-o">${avatarHtml}</div><div class="level-medal" style="background:${lvl.color}; border: 1px solid #000;" title="${lvl.name}">${lvl.medal}</div></div></td><td style="font-weight:700; color:#ffffff;">${c.id}</td><td style="color:#ffffff; font-weight:700;">${c.name}</td><td><span style="color:${lvl.color}; font-weight:800;">${lvl.name}</span></td><td>${c.status}</td><td style="text-align:center;"><button type="button" class="btn-action-sm btn-view" onclick="openCustomerDetail('${c.id}')">DETAIL</button></td>`;
            tbodyCust.appendChild(tr);
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

        let tA = 0; let cA = 0; let isD = false; let sX = 0; let vel = 0; let lX = 0; let lT = 0;
        cards.forEach((c, i) => { 
            c.style.transform = `rotateY(${i*(360/cards.length)}deg) translateZ(${radius}px)`; c.dataset.angle = i*(360/cards.length); 
            
            c.addEventListener('click', () => {
                if (Math.abs(vel) < 0.1) {
                    if (carouselId === 'carousel') {
                        if (!currentUser) { pendingCategory = c.dataset.category; openUserLogin(); } else { openMainCategory(c.dataset.category); }
                    } else if (carouselId === 'admin-carousel') {
                        if (c.id === 'btn-menu-orders') { viewCarousel.style.display = 'none'; viewOrders.style.display = 'flex'; renderOrdersTable(); markOrdersAsRead(); }
                        if (c.id === 'btn-menu-worker') { viewCarousel.style.display = 'none'; viewDataWorker.style.display = 'flex'; renderWorkerTable(); }
                        if (c.id === 'btn-menu-customer') { viewCarousel.style.display = 'none'; viewDataCustomer.style.display = 'flex'; renderCustomerTable(); }
                        if (c.id === 'btn-menu-content') { viewCarousel.style.display = 'none'; viewManageContent.style.display = 'flex'; switchCMSTab('video'); }
                        if (c.id === 'btn-menu-finance') { viewCarousel.style.display = 'none'; viewFinance.style.display = 'flex'; renderFinanceTable(); }
                        if (c.id === 'btn-menu-chat') { viewCarousel.style.display = 'none'; viewChat.style.display = 'flex'; renderAdminChatList(); }
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
        function sD(cx) { isD=true; sX=cx; lX=cx; lT=Date.now(); vel=0; } function dD(cx) { if(!isD)return; const dt=Date.now()-lT; if(dt>0) vel=(cx-lX)/dt; cA+=(cx-lX)/3; tA=cA; lX=cx; lT=Date.now(); } function eD() { if(!isD)return; isD=false; tA=Math.round((cA+(vel*120))/(360/cards.length))*(360/cards.length); }
        scene.addEventListener('mousedown', (e)=>sD(e.pageX)); window.addEventListener('mousemove', (e)=>dD(e.pageX)); window.addEventListener('mouseup', eD);
        scene.addEventListener('touchstart', (e)=>sD(e.touches[0].pageX), {passive: true}); window.addEventListener('touchmove', (e)=>dD(e.touches[0].pageX), {passive: true}); window.addEventListener('touchend', eD);
        window.addEventListener('mouseleave', () => { if(isD) eD(); }); anim();
    }
    
    initCarousel('carousel', 'scene', 'card', null); 
    initCarousel('admin-carousel', 'admin-scene', 'admin-card', '#00f2fe');
    renderAdminNotifications();
    updateOrderBadge();
    updateUserTrigger();
    renderBanners();
    updateChatBadges();

});