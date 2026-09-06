<div align="center">

# ⚡ Wasap Daily Hub
### *Modern Executive Daily Workspace, Personal Finance, Bulk Input, Export Excel Pro & Aesthetic Wall Calendar*

[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.10-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![ExcelJS](https://img.shields.io/badge/ExcelJS-Export_Pro-107C41?style=for-the-badge&logo=microsoft-excel)](https://github.com/exceljs/exceljs)

**Wasap Daily Hub** adalah platform produktivitas harian all-in-one berbasis **Next.js 14**, **Tailwind CSS**, dan **Supabase**. Dirancang dengan arsitektur **Multi-User terisolasi per Nomor WhatsApp**, antarmuka **Executive Dark Glassmorphism**, **Modul Personal Finance Eksekutif dengan Export Excel Berstandar Profesional**, **Fitur Bulk Input Transaksi Massal**, **Pengingat Bebas Jam (`due_time`)**, serta **Kalender Dinding Pinboard Estetik**.

</div>

---

## 🌟 Fitur Utama & Progress Pembaruan

### 1. 📊 Personal Finance Eksekutif & Template Export Excel Pro (Terbaru ✨)
* **Template Spreadsheet Premium**: Menghasilkan file Excel berekstensi `.xlsx` berstandar profesional seperti spreadsheet berbayar yang dijual praktisi keuangan (menggunakan engine `ExcelJS`).
* **Palet Warna & Tipografi Eksekutif**: Mengadopsi palet modern Dark Slate Navy (`#0F172A`), Emerald Green, Crimson Rose, dan Royal Indigo dengan font Segoe UI yang elegan dan print-ready.
* **4 Kartu Metrik KPI Utama**:
  - 🟢 **Total Pemasukan (Total Income)**: Nominal & status surplus kas.
  - 🔴 **Total Pengeluaran (Total Expense)**: Nominal beban akumulatif.
  - 🔵 **Saldo Bersih (Net Cashflow)**: Selisih netto kas riil.
  - 🟡 **Tingkat Tabungan (Savings Rate %)**: Persentase tabungan disertai evaluasi kesehatan finansial (Ideal / Waspada / Defisit).
* **In-Cell Visual Data Bar (Outcome vs Income Ratio)**:
  - Bar komparasi visual in-cell proporsi tabungan vs pengeluaran (`Tabungan: [████████░░░░] 67% | Pengeluaran: [████░░░░░░░░] 33%`).
  - Bar distribusi pengeluaran per kategori untuk mendeteksi pos belanja terbesar.
  - Bar komparasi visual ganda `🟩` vs `🟥` pada setiap baris rekapitulasi.
* **5 Sheet Terstruktur & Lengkap**:
  1. `📊 Dashboard Eksekutif`: Ringkasan banner akun, KPI cards, visual cashflow bar, dan tabel kategori pengeluaran & pemasukan.
  2. `📅 Rekap Harian`: Rekapitulasi per tanggal & hari (Senin - Minggu), volume transaksi, total masuk, total keluar, netto, dan status surplus/defisit harian.
  3. `🗓️ Rekap Bulanan (12 Bln)`: Matriks performa 12 bulan (Januari - Desember), tren tabungan, bar visual, total tahunan, dan rata-rata bulanan.
  4. `📈 Rekap Kuartal & Tren`: Analisis performa kuartal (Q1, Q2, Q3, Q4) serta rekomendasi keuangan (Aturan 50/30/20, Dana Darurat, dsb).
  5. `📑 Buku Kas & Jurnal Transaksi`: Ledger kronologis seluruh transaksi lengkap dengan **Saldo Berjalan (*Running Balance*)** di setiap baris transaksi.

---

### 2. ⚡ Fitur Baru: Bulk Input Massal (Input Cepat Bebas Capek ✨)
* **Input Multi-Baris Bebas**: Memungkinkan pencatatan banyak pengeluaran atau pemasukan sekaligus hanya dengan mengetik atau mem-paste daftar teks baris demi baris.
* **Format Fleksibel `"detail" (spasi) "nominal"`**:
  ```text
  makan siang padang 35000
  kopi susu gula aren 18000
  bensin pertamax mobil 150000
  parkir kantor 5000
  beli kemeja kerja 120000
  makan ronda 1000000
  ```
  *(Mendukung penulisan fleksibel: `35000`, `35.000`, `35k`, `50rb`, `1.5jt`, nominal di depan maupun di belakang).*
* **Auto-Detect Kategori Cerdas**: Sistem otomatis mengenali kata kunci (misal: *makan*, *kopi*, *nasi* ➔ **Makan**; *bensin*, *tol*, *parkir*, *ojol* ➔ **Transport**; *beli*, *baju*, *shopee* ➔ **Belanja**; *listrik*, *wifi*, *pulsa* ➔ **Tagihan**; *gaji*, *bonus* ➔ **Gaji**; *freelance*, *proyek* ➔ **Freelance**).
* **Live Preview Interaktif**: Menghitung secara realtime jumlah baris yang valid dan total nominal (Rp) sebelum disimpan.
* **Batch Insert Sekaligus**: Menyimpan semua transaksi valid ke database dalam satu klik tombol `+ Simpan Semua`.

---

### 3. 🛠️ Perbaikan Input Tanggal Lampau & Skema Database (Bug Fix ✨)
* **Sanitasi Tanggal ISO (`formatToISODate`)**: Memastikan tanggal dari berbagai browser atau format lokal (seperti `01/02/2026` / `DD/MM/YYYY`) dikonversi ke format standar ISO `YYYY-MM-DD` sehingga tidak memicu error database.
* **Auto-Fallback Skema Kolom**: Mencegah error `column "category" does not exist` dengan sistem fallback otomatis jika kolom `category` belum tersedia di tabel database Supabase pengguna.
* **Filter Waktu `Semua` (All-Time)**: Menambahkan tab filter periode **`Semua`** di dashboard finance agar seluruh transaksi masa lalu dapat ditinjau langsung tanpa terbatasi filter bulan tertentu.
* **Pencarian Cepat (*Quick Search*)**: Mempermudah pencarian riwayat transaksi berdasarkan nama pengeluaran atau kategori.

---

### 4. 📱 Multi-User & WhatsApp Data Isolation (Multi-Tenancy)
* **Pemisahan Data Otomatis**: Setiap catatan tugas, agenda kalender, ide, dan pengeluaran terisolasi per nomor WhatsApp (`phone_number`).
* **Satu Database untuk Semua Pengguna**: Aman digunakan bersama tanpa risiko data tertukar antar pengguna.
* **Auto-Formatting**: Nomor HP lokal (`0812...`) otomatis dikonversi ke format internasional (`62812...`).

---

### 5. ⏰ Pengingat Jam Bebas (*Custom Time Reminders*)
* **Dukungan Kolom `due_time`**: Mengatur jam pengingat bebas (misal: `21:00`, `08:30`, `14:00`).
* **Tampilan Badge Waktu**: Tugas dengan reminder menampilkan badge estetik `⏰ 21:00 WIB` di dashboard & kalender.
* **Bot WhatsApp Sync**: Hermes membaca `due_time` untuk mengeksekusi notifikasi WA tepat waktu.

---

### 6. 📌 Kalender Dinding Pinboard Estetik (*Aesthetic Dark Wall Calendar*)
* **Tampilan Grid Besar Interaktif**: Kalender bulanan berukuran besar tepat di bawah workspace harian dengan tema dark glassmorphism.
* **Gaya Sticky Note Wall**: Setiap tugas/agenda tampil seperti memo tempel warna-warni berpin (📌/🌱/🌸/💎/🔮).
* **Sinkronisasi 2-Arah**: Tugas yang ditambahkan pada tanggal hari ini di kalender otomatis langsung masuk ke kolom **Tugas Hari Ini**, begitu pun sebaliknya.
* **Rekap Pengeluaran per Tanggal**: Menampilkan total pengeluaran (misal `-25k`, `-50k`) langsung di dalam kotak tanggal terkait.
* **Filter Cepat**: Filter tampilan kalender (*Semua*, *⏳ Belum*, *✅ Selesai*, *💳 Pengeluaran*).

---

### 7. 🧩 3 Kolom Workspace Harian Terpadu
* **✅ Tugas Hari Ini (*Today's Tasks*)**: Checklist tugas harian, setting jam reminder, filter status, dan live completion progress.
* **💡 Draft & Ide Backlog (*Brain Dump*)**: Penampung ide kasar dengan tombol **`⚡ Jadwalkan Hari Ini`**.
* **💸 Catat Pengeluaran (*Expense Tracker*)**: Kategori cepat (🍔 Makan, 🚗 Transport, 🛍️ Belanja, ⚡ Tagihan, 📝 Lainnya), quick chips nominal, dan rekap otomatis.

---

### 8. 👑 Admin Control Panel (`/admin`)
* Monitoring total pengguna terdaftar, nomor WhatsApp terhubung, pengubahan role (Admin/User), dan tautan direct chat WhatsApp.

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
