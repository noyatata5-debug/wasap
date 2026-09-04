<div align="center">

# ⚡ Wasap Daily Hub
### *Modern Executive Daily Workspace, Ideas Backlog, Aesthetic Wall Calendar & Expense Tracker*

[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.10-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)

**Wasap Daily Hub** adalah platform produktivitas harian all-in-one berbasis **Next.js 14**, **Tailwind CSS**, dan **Supabase**. Dirancang dengan arsitektur **Multi-User terisolasi per Nomor WhatsApp**, antarmuka **Executive Dark Glassmorphism**, serta **Kalender Dinding Pinboard Estetik (Sticky Notes)** yang tersinkronisasi langsung dengan Bot WhatsApp (Hermes).

</div>

---

## 🌟 Fitur Utama

### 1. 📱 Multi-User & WhatsApp Data Isolation (Multi-Tenancy)
* **Pemisahan Data Otomatis**: Setiap catatan tugas, agenda kalender, ide, dan pengeluaran terisolasi per nomor WhatsApp (`phone_number`).
* **Satu Database untuk Semua Teman**: Aman digunakan bersama tanpa risiko data tertukar antar pengguna.
* **Auto-Formatting**: Nomor HP lokal (`0812...`) otomatis dikonversi ke format internasional (`62812...`).

### 2. 📌 Kalender Dinding Pinboard Estetik (*Aesthetic Dark Wall Calendar*)
* **Tampilan Grid Besar Interaktif**: Kalender bulanan berukuran besar tepat di bawah workspace harian dengan tema dark glassmorphism.
* **Gaya Sticky Note Wall**: Setiap tugas/agenda tampil seperti memo tempel warna-warni berpin (📌/🌱/🌸/💎/🔮).
* **Sinkronisasi 1-Arah & 2-Arah**: Jika tugas ditambahkan pada tanggal hari ini di kalender, otomatis langsung masuk ke kolom **Tugas Hari Ini**, begitu pun sebaliknya.
* **Rekap Pengeluaran per Tanggal**: Menampilkan total pengeluaran (misal `-25k`, `-50k`) langsung di dalam kotak tanggal terkait.
* **Filter Cepat**: Filter tampilan kalender (*Semua*, *⏳ Belum*, *✅ Selesai*, *💳 Pengeluaran*).

### 3. 🧩 3 Kolom Workspace Harian Terpadu
* **✅ Tugas Hari Ini (*Today's Tasks*)**: Checklist tugas harian, filter status, dan live completion progress.
* **💡 Draft & Ide Backlog (*Brain Dump*)**: Penampung ide kasar dengan tombol **`⚡ Jadwalkan Hari Ini`**.
* **💸 Catat Pengeluaran (*Expense Tracker*)**: Kategori cepat (🍔 Makan, 🚗 Transport, 🛍️ Belanja, ⚡ Tagihan, 📝 Lainnya), quick chips nominal, dan rekap otomatis.
### 4. 👑 Admin Control Panel (`/admin`)
* Manajemen pengguna terdaftar, nomor WhatsApp terhubung, pengubahan role (Admin/User), dan link direct chat WhatsApp.
---

## 🤖 Panduan Integrasi Bot WhatsApp (Hermes Bot Guide)

Bot WhatsApp (Hermes) dapat berinteraksi langsung dengan database Supabase untuk membaca dan menulis tugas harian, catatan kalender masa depan/lampau, maupun transaksi keuangan.

### 1. Struktur Tabel & Kolom Kunci

#### A. Tabel `tasks` (Tugas, Agenda Kalender & Backlog)
| Kolom | Tipe | Keterangan | Format Contoh |
| :--- | :--- | :--- | :--- |
| `phone_number` | `TEXT` | Nomor WhatsApp pengirim (hanya digit tanpa +) | `"6281234567890"` |
| `title` | `TEXT` | Isi tugas / catatan agenda | `"Meeting project jam 14.00"` |
| `task_date` | `DATE` | Tanggal tugas (**YYYY-MM-DD**) | `"2026-03-30"` |
| `status` | `TEXT` | Status tugas | `'pending'` (belum), `'done'` (selesai), `'draft'` (backlog) |

#### B. Tabel `expenses` (Catatan Pengeluaran)
| Kolom | Tipe | Keterangan | Format Contoh |
| :--- | :--- | :--- | :--- |
| `phone_number` | `TEXT` | Nomor WhatsApp pengirim | `"6281234567890"` |
| `amount` | `NUMERIC` | Nominal angka pengeluaran | `25000` |
| `description` | `TEXT` | Keterangan pengeluaran + [Kategori] | `"[Makan] Nasi Padang Siang"` |
| `expense_date`| `DATE` | Tanggal pengeluaran (**YYYY-MM-DD**) | `"2026-03-30"` |
---

### 2. Format Logika Pesan Masuk untuk Hermes

#### 📝 Skenario 1: Menambah Tugas untuk Hari Ini
* **Contoh Chat Pengguna**: `"Tugas: Kirim proposal ke klien"` atau `"Ingatkan beli obat nanti malam"`
* **Aksi Hermes di Supabase**:

