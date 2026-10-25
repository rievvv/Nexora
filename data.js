/* exported adminDB_Login, workersDB, customersDB, videosDB, productsDB, ordersDB, financeDB, bannersDB, chatsDB, payoutsDB, presenceDB, meetingRoomsDB, meetingsDB, calculateLevel, calculateCustomerLevel, levelIcon, levelIconNext, levelIconOk, LEVEL_ICON_DIR, formatRp */

// =========================================
// DATABASE & LOGIKA LEVELING NEXORA
// =========================================

const adminDB_Login = [ { username: "NEX-971610-001", password: "admin123" } ];

let workersDB = [
    { id: "NEXW-971016-001", name: "Arief Gunawan", ttl: "Tangerang Selatan, 16 Okt 1997", joined: "12 Jan 2026", balance: 5000000, income: 8500000, status: "Worker", freezeDate: "", project: "", customer: "", specs: "Web Dev, UI/UX Design", portfolio: "https://dribbble.com/arief", rekening: "BCA 12345678 A/N Arief", username: "NEXW-arief97", password: "123", wa: "+6281234567890", email: "arief@email.com", avatar: "" },
    { id: "NEXW-950212-002", name: "Budi Santoso", ttl: "Bandung, 12 Feb 1995", joined: "15 Feb 2026", balance: 12000000, income: 45000000, status: "On Progress", freezeDate: "", project: "Web E-Commerce", customer: "PT Maju Bersama", specs: "Web Dev", portfolio: "https://github.com/budis", rekening: "Mandiri 98765 A/N Budi", username: "NEXW-budis", password: "123", wa: "+6289876543210", email: "budi@email.com", avatar: "" }
];

// Folder gambar badge level (kosongkan bila PNG berada satu folder dengan index.html; isi mis. "img/" bila di dalam folder)
const LEVEL_ICON_DIR = "";

// Gambar badge level (PNG). Browser otomatis mencari file di beberapa folder umum & variasi huruf
// (mis. "", img/, images/, assets/, icons/, badge/ ...). Setelah ketemu, lokasinya diingat.
// Jika tetap tidak ada, tampil emoji.
var __lvlDirs = [LEVEL_ICON_DIR, "", "img/", "image/", "images/", "assets/", "asset/", "icons/", "icon/", "badge/", "badges/", "level/", "levels/", "Img/", "Image/", "Images/", "Assets/", "Icons/", "Badge/", "Badges/", "foto/", "gambar/"];
var __lvlFound = {};
function __lvlCands(file) {
    var base = file.replace(/\.png$/i, ""), names = [file, base.toLowerCase() + ".png", base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() + ".png"], out = [];
    names.forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); });
    var list = [];
    __lvlDirs.forEach(function (dir) { out.forEach(function (n) { var p = dir + n; if (list.indexOf(p) < 0) list.push(p); }); });
    return list;
}
function levelIconSrc(lvl) { return __lvlFound[lvl.file] || lvl.icon; }
function levelIconNext(img) {
    var file = img.getAttribute("data-file"), i = +img.getAttribute("data-i") + 1, list = __lvlCands(file);
    if (i >= list.length) { img.replaceWith(document.createTextNode(img.getAttribute("data-medal"))); return; }
    img.setAttribute("data-i", i); img.src = list[i];
}
function levelIconOk(img) { __lvlFound[img.getAttribute("data-file")] = img.getAttribute("src"); }
function levelIcon(lvl, px) {
    px = px || 20;
    return '<img class="lvl-ico" src="' + levelIconSrc(lvl) + '" data-file="' + lvl.file + '" data-i="-1" data-medal="' + lvl.medal + '" alt="' + lvl.name + '" title="' + lvl.name + '" width="' + px + '" height="' + px + '" style="width:' + px + 'px;height:' + px + 'px;" onload="levelIconOk(this)" onerror="levelIconNext(this)">';
}

function calculateLevel(income) {
    if (income <= 10000000) return { name: "MicroXora", icon: LEVEL_ICON_DIR + "Microxora.png", file: "Microxora.png", bonus: "5%", max: 10000000, pct: (income/10000000)*100, medal: "🥉", color: "#cd7f32" };
    if (income <= 50000000) return { name: "MacroXora", icon: LEVEL_ICON_DIR + "Macroxora.png", file: "Macroxora.png", bonus: "6%", max: 50000000, pct: (income/50000000)*100, medal: "🥈", color: "#64748b" };
    if (income <= 100000000) return { name: "SuperXora", icon: LEVEL_ICON_DIR + "Superxora.png", file: "Superxora.png", bonus: "7%", max: 100000000, pct: (income/100000000)*100, medal: "🥇", color: "#d97706" };
    if (income <= 500000000) return { name: "MegaXora", icon: LEVEL_ICON_DIR + "Megaxora.png", file: "Megaxora.png", bonus: "8%", max: 500000000, pct: (income/500000000)*100, medal: "💎", color: "#00f2fe" };
    return { name: "UltraXora", icon: LEVEL_ICON_DIR + "Ultraxora.png", file: "Ultraxora.png", bonus: "10%", max: income, pct: 100, medal: "👑", color: "#ff0055" };
}

let customersDB = [
    { id: "NEXC-260112-001", name: "PT Maju Bersama", type: "Corporate", joined: "12 Jan 2026", spent: 15000000, status: "Active", project: "Web E-Commerce", workerAssigned: "Budi Santoso", email: "contact@majubersama.com", wa: "+6281234567890", username: "NEXC-maju", password: "123", avatar: "" },
    { id: "NEXC-260220-002", name: "Rina Melati", type: "Personal", joined: "20 Feb 2026", spent: 5000000, status: "Active", project: "UI/UX App Design", workerAssigned: "Arief Gunawan", email: "rina.m@email.com", wa: "+6289876543210", username: "NEXC-rina99", password: "123", avatar: "" }
];

function calculateCustomerLevel(spent) {
    if (spent <= 10000000) return { name: "NexMicro", icon: LEVEL_ICON_DIR + "Nexmicro.png", file: "NexMicro.png", discount: "1%", max: 10000000, pct: (spent/10000000)*100, medal: "🥉", color: "#cd7f32" };
    if (spent <= 50000000) return { name: "NexMacro", icon: LEVEL_ICON_DIR + "Nexmacro.png", file: "NexMacro.png", discount: "2%", max: 50000000, pct: (spent/50000000)*100, medal: "🥈", color: "#64748b" };
    if (spent <= 100000000) return { name: "NexSuper", icon: LEVEL_ICON_DIR + "Nexsuper.png", file: "NexSuper.png", discount: "3%", max: 100000000, pct: (spent/100000000)*100, medal: "🥇", color: "#d97706" };
    if (spent <= 500000000) return { name: "NexMega", icon: LEVEL_ICON_DIR + "Nexmega.png", file: "NexMega.png", discount: "4%", max: 500000000, pct: (spent/500000000)*100, medal: "💎", color: "#00f2fe" };
    return { name: "NexUltra", icon: LEVEL_ICON_DIR + "Nexultra.png", file: "NexUltra.png", discount: "5%", max: spent, pct: 100, medal: "👑", color: "#ff0055" };
}

// --- DATABASE KONTEN CMS ---
let videosDB = [];

// DATABASE PRODUK/JASA (Kategori: Design, Animasi, Pajak, Audit Finance, Produk Digital, E-Book, Pembuatan Website)
let productsDB = [];

const formatRp = (angka) => "Rp " + angka.toLocaleString('id-ID');
// Tambahkan di bagian bawah data_3.js Anda:
let ordersDB = [];

// DATABASE LAPORAN KEUANGAN (diisi otomatis dari Pesanan + transaksi manual Admin)
let financeDB = [];

// DATABASE BANNER IKLAN (sliding banner halaman utama)
let bannersDB = [];

// DATABASE CHAT USER <-> ADMIN
let chatsDB = [];

// DATABASE PENCAIRAN DANA WORKER (Pocket): diajukan Worker, diproses Admin
let payoutsDB = [];

// DATABASE KEHADIRAN (status online user): { id: ID Nexora, seen: waktu terakhir aktif (ms) }
let presenceDB = [];

// DATABASE MEETING ROOM: daftar room (aktif/selesai) & rekaman meeting (video + watermark ID Admin)
let meetingRoomsDB = [];
let meetingsDB = [];