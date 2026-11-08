# DESIGN.md: Sistem Desain Fit to Work (FTW) Online PT. WBS

## 1. Identitas & Konteks Produk
- **Nama Produk:** Fit to Work (FTW) Online PT. WBS
- **Domain:** Kesehatan & Keselamatan Kerja Industri (HSE / Fatigue Management)
- **Pengguna Utama:**
  1. **Pekerja Lapangan & Kontraktor (Mobile-First):** Mengisi laporan kesiapan kerja harian (3 langkah: Identitas, Log Tidur 48 Jam, Konfirmasi Kebugaran) di awal shift dengan satu tangan di kondisi lapangan.
  2. **Administrator & Pengawas HSE (Desktop/Tablet):** Memantau kesiapan kru harian, menindaklanjuti pekerja dengan status *Unfit to Work* atau *Butuh Istirahat*, mengelola database personel, dan menganalisis tren kelelahan 7 hingga 30 hari.

## 2. Dial Desain (`antislop-ui` & `hallmark`)
- **Genre:** `modern-minimal` (Utilitas Industri Berkontras Tinggi / *Swiss Grid*)
- **Posture:** `quiet` (Permukaan netral hangat yang tenang; warna kromatik hanya muncul pada status keselamatan kerja dan aksi utama)
- **ENERGY:** `3 / 10` (Tenang, langsung ke inti tugas, bebas distraksi visual)
- **RHYTHM:** `4 / 10` (Grid terstruktur, pemisahan jelas melalui spasi 4px dan permukaan bernada)
- **MOTION:** `2 / 10` (Indikator fokus instan tanpa transisi, perubahan warna halus `transition-colors`, bebas animasi berulang tanpa henti, patuh `prefers-reduced-motion`)

## 3. Sistem Tipografi
- **Font Display & Heading (`--font-display`):** `'IBM Plex Sans'`, sans-serif teknis dengan keterbacaan tinggi pada judul dan angka status.
- **Font Body & UI (`--font-body`):** `'Public Sans'`, sans-serif humanis untuk formulir, label, dan tabel padat.
- **Angka & Metrik:** Selalu menggunakan `font-variant-numeric: tabular-nums` (`tabular-nums`) pada jam tidur, skor kesiapan, penghitung KPI, dan kolom numerik tabel. Penggunaan `font-mono` dilarang pada label UI biasa dan hanya diizinkan di dalam elemen `<code>` atau `<pre>`.
- **Skala Ukuran & Kapitalisasi:**
  - Batas bawah ukuran teks adalah `12px` (`text-xs`) untuk keterangan tambahan/lencana, `14px` (`text-sm`) untuk kontrol/tabel, dan `16px` (`text-base`) untuk input formulir (mencegah auto-zoom di iOS).
  - Label, header tabel, dan tombol menggunakan *Sentence case* atau *Title Case* tanpa `uppercase` + `tracking-widest`.

## 4. Sistem Token Warna & Kontras WCAG AA
Seluruh pasangan teks dan latar belakang wajib memenuhi rasio kontras minimum **4.5:1** untuk teks normal dan **3.0:1** untuk teks besar/komponen UI:

| Token CSS / Utility Tailwind | Nilai Hex | Rasio Kontras vs Putih / Kertas | Peran Semantik |
| :--- | :--- | :--- | :--- |
| `--color-paper` (`bg-paper`) | `#fafaf9` | 1.03:1 vs `#fff` | Latar dasar halaman (warm stone, bukan `#fff` murni) |
| `--color-surface` (`bg-surface`) | `#f5f5f4` | 1.08:1 vs `#fff` | Permukaan panel sekunder & header tabel |
| `--color-elevated` (`bg-elevated`) | `#ffffff` | - | Permukaan kartu utama, input formulir & modal |
| `--color-rule` (`border-rule`) | `#d6d3d1` | - | Garis batas tabel, input, dan kartu |
| `--color-ink` (`text-ink`) | `#1c1917` | **17.40:1** (vs `#fafaf9`) | Teks utama, judul, dan nilai input |
| `--color-ink-muted` (`text-ink-muted`) | `#44403c` | **9.72:1** (vs `#ffffff`) | Label formulir, subjudul, dan teks sekunder |
| `--color-ink-subtle` (`text-ink-subtle`) | `#57534e` | **7.50:1** (vs `#ffffff`) | Petunjuk input, keterangan waktu, dan teks non-aktif |
| `--color-brand-600` (`bg-brand-600`) | `#be123c` | **6.57:1** (teks putih) | Aksi utama aplikasi & identitas HSE |
| `--color-brand-700` (`bg-brand-700`) | `#9f1239` | **8.30:1** (teks putih) | State hover/active tombol utama |
| `--color-safe-600` (`bg-safe-600`) | `#047857` | **5.48:1** (teks putih) | Status *Fit to Work* & aksi ekspor/positif |
| `--color-safe-700` (`bg-safe-700`) | `#065f46` | **7.68:1** (teks putih) | State hover tombol positif & teks lencana aman |
| `--color-warn-600` (`bg-warn-600`) | `#b45309` | **5.02:1** (teks putih) | Status *Butuh Istirahat* (tidur 5-6 jam) |
| `--color-caution-600` (`bg-caution-600`) | `#c2410c` | **5.18:1** (teks putih) | Status *Catatan Kondisi* (isu non-tidur) |
| `--color-danger-600` (`bg-danger-600`) | `#be123c` | **6.57:1** (teks putih) | Status *Unfit to Work* (tidur < 5 jam / sakit / obat) |
| `--color-info-600` (`bg-info-600`) | `#0369a1` | **5.92:1** (teks putih) | Indikator sistem, sinkronisasi & informasi |

## 5. Aturan Tata Letak, Komponen & Aksesibilitas
1. **Target Sentuh Lapangan:** Semua tombol, tab, dan kontrol interaktif memiliki tinggi memadai (minimal `40px-44px` pada kontrol utama mobile) dengan area klik yang jelas.
2. **Bebas Ornamen Palsu:** Tidak menggunakan sasis ponsel palsu di layar desktop, tidak menggunakan terminal palsu, tidak menggunakan gradasi dekoratif multi-stop, dan tidak menggunakan emoji sebagai pengganti ikon UI (gunakan ikon SVG `lucide-react` dengan `aria-hidden="true"`).
3. **Semantik & Fokus Keyboard:** Semua elemen yang dapat diklik wajib menggunakan `<button>` atau `<a>`, input memiliki `<label>` yang terhubung, dan `:focus-visible` menampilkan cincin outline 2px secara instan.
4. **Umpan Balik Inline:** Konfirmasi penghapusan dan pesan status ditampilkan melalui banner/modal inline di dalam aplikasi, bukan melalui dialog `window.alert()` atau `window.confirm()`.

