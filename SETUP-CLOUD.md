# Setup Cloud Nexora (agar konten tampil di PC & HP)

## Kenapa konten tidak muncul di HP?
GitHub Pages hanya menyimpan file website (HTML/CSS/JS). Video, produk, banner, pesanan,
chat, dll. yang Anda unggah lewat Admin Portal sebelumnya disimpan di **browser PC Anda**
(IndexedDB), jadi HP membuka website yang masih kosong. Solusinya: simpan data di cloud.
Panduan ini memakai **Supabase** (gratis, tanpa kartu kredit).

## Langkah
1. Daftar di https://supabase.com lalu buat **New project**.
2. Buka **SQL Editor** > New query > tempel & jalankan:

```sql
create table if not exists nexora_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
alter table nexora_kv enable row level security;
create policy "nexora_kv_all" on nexora_kv for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('nexora-files', 'nexora-files', true)
on conflict (id) do nothing;

create policy "nexora_files_read"   on storage.objects for select using (bucket_id = 'nexora-files');
create policy "nexora_files_insert" on storage.objects for insert with check (bucket_id = 'nexora-files');
create policy "nexora_files_update" on storage.objects for update using (bucket_id = 'nexora-files');
```

3. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**.
4. Isi keduanya di file `cloud-config.js`, lalu upload semua file ke GitHub.
5. Buka website di **PC yang dipakai mengunggah konten** terlebih dahulu (sekali saja).
   Data lama di browser PC otomatis naik ke cloud. Setelah itu buka di HP: konten tampil.

## Catatan
- Batas ukuran 1 file di paket gratis Supabase: 50 MB (video lebih besar perlu dikompres).
- Data disinkronkan otomatis tiap ±4 detik; pesanan dan chat dari HP muncul di Admin Portal
  tanpa perlu refresh.
- **Keamanan:** kunci `anon` terlihat di kode website dan kebijakan di atas membuka baca/tulis
  untuk siapa saja yang memilikinya. Password user dan login admin juga masih disimpan di sisi
  browser. Ini cukup untuk uji coba/skala kecil, tetapi untuk bisnis nyata sebaiknya nanti
  dipindah ke sistem login server-side (mis. Supabase Auth + aturan RLS per pengguna).
