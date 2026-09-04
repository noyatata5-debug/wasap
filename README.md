<div align="center">

# ⚡ Wasap Daily Hub
### *Modern Executive Daily Workspace, Ideas Backlog, Aesthetic Wall Calendar, Custom Time Reminders & Expense Tracker*

[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.10-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)

**Wasap Daily Hub** adalah platform produktivitas harian all-in-one berbasis **Next.js 14**, **Tailwind CSS**, dan **Supabase**. Dirancang dengan arsitektur **Multi-User terisolasi per Nomor WhatsApp**, antarmuka **Executive Dark Glassmorphism**, **Pengingat / Reminder Bebas Jam (`due_time`)**, serta **Kalender Dinding Pinboard Estetik (Sticky Notes)** yang tersinkronisasi langsung dengan Bot WhatsApp (Hermes).

</div>

---

## 🌟 Fitur Utama

### 1. 📱 Multi-User & WhatsApp Data Isolation (Multi-Tenancy)
* **Pemisahan Data Otomatis**: Setiap catatan tugas, agenda kalender, ide, dan pengeluaran terisolasi per nomor WhatsApp (`phone_number`).
* **Satu Database untuk Semua Pengguna**: Aman digunakan bersama tanpa risiko data tertukar antar pengguna.
* **Auto-Formatting**: Nomor HP lokal (`0812...`) otomatis dikonversi ke format internasional (`62812...`).

### 2. ⏰ Pengingat Jam Bebas (*Custom Time Reminders*)
* **Dukungan Kolom `due_time`**: Bisa mengatur jam pengingat bebas (misal: `21:00`, `08:30`, `14:00`).
* **Tampilan Badge Waktu**: Tugas dengan reminder menampilkan badge estetik `⏰ 21:00 WIB` di dashboard & kalender.
* **Bot WhatsApp Sync**: Hermes membaca `due_time` untuk mengeksekusi notifikasi WA tepat waktu.
### 3. 📌 Kalender Dinding Pinboard Estetik (*Aesthetic Dark Wall Calendar*)
* **Tampilan Grid Besar Interaktif**: Kalender bulanan berukuran besar tepat di bawah workspace harian dengan tema dark glassmorphism.
* **Gaya Sticky Note Wall**: Setiap tugas/agenda tampil seperti memo tempel warna-warni berpin (📌/🌱/🌸/💎/🔮).
* **Sinkronisasi 1-Arah & 2-Arah**: Tugas yang ditambahkan pada tanggal hari ini di kalender otomatis langsung masuk ke kolom **Tugas Hari Ini**, begitu pun sebaliknya.
* **Rekap Pengeluaran per Tanggal**: Menampilkan total pengeluaran (misal `-25k`, `-50k`) langsung di dalam kotak tanggal terkait.
* **Filter Cepat**: Filter tampilan kalender (*Semua*, *⏳ Belum*, *✅ Selesai*, *💳 Pengeluaran*).

### 4. 🧩 3 Kolom Workspace Harian Terpadu
* **✅ Tugas Hari Ini (*Today's Tasks*)**: Checklist tugas harian, setting jam reminder, filter status, dan live completion progress.
* **💡 Draft & Ide Backlog (*Brain Dump*)**: Penampung ide kasar dengan tombol **`⚡ Jadwalkan Hari Ini`**.
* **💸 Catat Pengeluaran (*Expense Tracker*)**: Kategori cepat (🍔 Makan, 🚗 Transport, 🛍️ Belanja, ⚡ Tagihan, 📝 Lainnya), quick chips nominal, dan rekap otomatis.
### 5. 👑 Admin Control Panel (`/admin`)
* Manajemen pengguna terdaftar, nomor WhatsApp terhubung, pengubahan role (Admin/User), dan link direct chat WhatsApp.

---

## 🤖 Panduan Integrasi Bot WhatsApp (Hermes Bot Guide)

Bot WhatsApp (Hermes) berinteraksi langsung dengan database Supabase untuk membaca & menulis tugas harian, reminder jam bebas, catatan kalender, dan transaksi keuangan.

### 1. Struktur Database `tasks` (Mendukung Reminder Jam)
| Kolom | Tipe | Keterangan | Format Contoh |
| :--- | :--- | :--- | :--- |
| `phone_number` | `TEXT` | Nomor WhatsApp pengirim (hanya digit) | `"6281234567890"` |
| `title` | `TEXT` | Isi tugas / catatan agenda | `"Minum vitamin & cek email"` |
| `task_date` | `DATE` | Tanggal tugas (**YYYY-MM-DD**) | `"2026-03-30"` |
| `due_time` | `TIME` | Jam reminder (format **HH:MM:SS**) | `"21:00:00"` atau `"08:30:00"` |
| `status` | `TEXT` | Status tugas | `'pending'`, `'done'`, `'draft'` |
| `is_reminder` | `BOOLEAN` | Penanda tugas reminder | `true` / `false` |

---

### 2. Format Chat WhatsApp & Parsing Hermes

#### ⏰ Skenario 1: Reminder Jam Bebas Hari Ini
* **Chat Pengguna**: `"ingetin jam 9 malam: cek & rekap pengeluaran hari ini"` atau `"reminder 21:00: minum vitamin"`
* **Parsing Hermes**:
  - `title`: `"cek & rekap pengeluaran hari ini"`
  - `task_date`: `today` (tanggal hari ini `YYYY-MM-DD`)
  - `due_time`: `"21:00:00"`
  - `is_reminder`: `true`
* **Query Hermes di Supabase**:

