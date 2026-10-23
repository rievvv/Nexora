/* exported adminDB_Login, workersDB, customersDB, videosDB, productsDB, ordersDB, financeDB, bannersDB, chatsDB, payoutsDB, calculateLevel, calculateCustomerLevel, formatRp */

// =========================================
// DATABASE & LOGIKA LEVELING NEXORA
// =========================================

const adminDB_Login = [ { username: "NEX-971610-001", password: "admin123" } ];

let workersDB = [
    { id: "NEXW-971016-001", name: "Arief Gunawan", ttl: "Tangerang Selatan, 16 Okt 1997", joined: "12 Jan 2026", balance: 5000000, income: 8500000, status: "Worker", freezeDate: "", project: "", customer: "", specs: "Web Dev, UI/UX Design", portfolio: "https://dribbble.com/arief", rekening: "BCA 12345678 A/N Arief", username: "NEXW-arief97", password: "123", wa: "+6281234567890", email: "arief@email.com", avatar: "" },
    { id: "NEXW-950212-002", name: "Budi Santoso", ttl: "Bandung, 12 Feb 1995", joined: "15 Feb 2026", balance: 12000000, income: 45000000, status: "On Progress", freezeDate: "", project: "Web E-Commerce", customer: "PT Maju Bersama", specs: "Web Dev", portfolio: "https://github.com/budis", rekening: "Mandiri 98765 A/N Budi", username: "NEXW-budis", password: "123", wa: "+6289876543210", email: "budi@email.com", avatar: "" }
];

function calculateLevel(income) {
    if (income <= 10000000) return { name: "MicroXora", bonus: "5%", max: 10000000, pct: (income/10000000)*100, medal: "🥉", color: "#cd7f32" };
    if (income <= 50000000) return { name: "MacroXora", bonus: "6%", max: 50000000, pct: (income/50000000)*100, medal: "🥈", color: "#64748b" };
    if (income <= 100000000) return { name: "SuperXora", bonus: "7%", max: 100000000, pct: (income/100000000)*100, medal: "🥇", color: "#d97706" };
    if (income <= 500000000) return { name: "MegaXora", bonus: "8%", max: 500000000, pct: (income/500000000)*100, medal: "💎", color: "#00f2fe" };
    return { name: "UltraXora", bonus: "10%", max: income, pct: 100, medal: "👑", color: "#ff0055" };
}

let customersDB = [
    { id: "NEXC-260112-001", name: "PT Maju Bersama", type: "Corporate", joined: "12 Jan 2026", spent: 15000000, status: "Active", project: "Web E-Commerce", workerAssigned: "Budi Santoso", email: "contact@majubersama.com", wa: "+6281234567890", username: "NEXC-maju", password: "123", avatar: "" },
    { id: "NEXC-260220-002", name: "Rina Melati", type: "Personal", joined: "20 Feb 2026", spent: 5000000, status: "Active", project: "UI/UX App Design", workerAssigned: "Arief Gunawan", email: "rina.m@email.com", wa: "+6289876543210", username: "NEXC-rina99", password: "123", avatar: "" }
];

function calculateCustomerLevel(spent) {
    if (spent <= 10000000) return { name: "NexMicro", discount: "1%", max: 10000000, pct: (spent/10000000)*100, medal: "🥉", color: "#cd7f32" };
    if (spent <= 50000000) return { name: "NexMacro", discount: "2%", max: 50000000, pct: (spent/50000000)*100, medal: "🥈", color: "#64748b" };
    if (spent <= 100000000) return { name: "NexSuper", discount: "3%", max: 100000000, pct: (spent/100000000)*100, medal: "🥇", color: "#d97706" };
    if (spent <= 500000000) return { name: "NexMega", discount: "4%", max: 500000000, pct: (spent/500000000)*100, medal: "💎", color: "#00f2fe" };
    return { name: "NexUltra", discount: "5%", max: spent, pct: 100, medal: "👑", color: "#ff0055" };
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