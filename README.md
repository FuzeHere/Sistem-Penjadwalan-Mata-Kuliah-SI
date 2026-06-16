#Sistem Informasi Penjadwalan Kuliah UIN Alauddin Makassar

Web ini adalah aplikasi berbasis web modern yang dirancang untuk mengelola dan menyusun jadwal perkuliahan secara otomatis serta memfasilitasi pengisian Rencana Studi (KRS) mahasiswa.

WEb ini menggunakan **Next.js (App Router)** di frontend dan backend, serta mendukung arsitektur database hybrid (Prisma ORM PostgreSQL dengan fallback otomatis ke file JSON lokal).

---

## 🚀 Fitur Utama

1. **Penyusun Jadwal Kuliah Otomatis (Constraint-Based Scheduler)**:
   * Menggunakan algoritma heuristik serakah (*Greedy Heuristic*) untuk menyusun draf jadwal otomatis.
   * Menghindari bentrok waktu mengajar dosen, kapasitas ruangan, kecocokan jenis kelas (teori/praktikum), dan bentrok asisten dosen yang sedang kuliah di jam yang sama.
2. **Dashboard Multi-Role**:
   * **Admin Jurusan**: Mengelola data master (dosen, mahasiswa, ruangan, kelas), memicu generator otomatis, melakukan revisi manual jadwal, serta memantau laporan bentrok.
   * **Dosen Pengajar**: Melihat jadwal mengajar pribadi dan mengisi preferensi waktu mengajar untuk semester berikutnya.
   * **Mahasiswa**: Mengisi KRS mandiri, melihat jadwal kuliah visual harian yang tersinkronisasi, dan mengekspor jadwal ke berkas cetak PDF.
3. **Pembatasan & Penguncian KRS Satu Kali**:
   * Mahasiswa baru hanya diperkenankan memilih mata kuliah **satu kali saja**.
   * Setelah disimpan, form pemilihan disembunyikan dan jadwal beralih ke tampilan penuh (*full-width*) yang terkunci secara permanen.
4. **Hybrid-Fallback Database**:
   * Secara bawaan mendukung PostgreSQL melalui Prisma ORM.
   * **Tanpa PostgreSQL**: Jika koneksi database kosong atau mati, sistem akan otomatis beralih menggunakan file database simulasi lokal [mockDb.json](src/utils/mockDb.json).

---

## 🛠️ Cara Menjalankan & Mengembangkan

### 1. Prasyarat
Pastikan Anda telah menginstal **Node.js** (versi 18 ke atas) di komputer Anda.

### 2. Instalasi Dependensi
Jalankan perintah berikut pada terminal di folder proyek untuk menginstal seluruh pustaka yang diperlukan:
```bash
npm install
```

### 3. Menjalankan Server Pengembangan
Jalankan server lokal Next.js:
```bash
npm run dev
```
Buka browser Anda dan akses alamat [http://localhost:3000](http://localhost:3000).

### 4. Menjalankan Pengujian Unit (TDD)
Untuk memastikan seluruh logika bentrok penjadwalan dan pembatasan KRS berjalan dengan benar, jalankan suite pengujian:
```bash
npm test
```

### 5. Pemeriksaan Kualitas Kode (Linting)
Jalankan ESLint untuk memverifikasi kebersihan kode:
```bash
npm run lint
```

---

## 🔑 Kredensial Akun Uji Coba (Demo)

Gunakan daftar akun berikut untuk masuk ke portal sistem:

| Peran (Role) | Alamat Email | Kata Sandi | Status KRS |
| :--- | :--- | :--- | :--- |
| **Admin Jurusan** | `admin@uin-alauddin.ac.id` | `admin123` | N/A |
| **Dosen Pengampu** | `irwan@uin-alauddin.ac.id` | `dosen123` | N/A |
| **Mahasiswa Senior** | `ahmad@uin-alauddin.ac.id` | `mhs123` | **Terkunci** (Sudah mengisi KRS) |
| **Mahasiswa Baru** | `fairuz@uin-alauddin.ac.id` | `mhs123` | **Terbuka** (Belum memilih KRS) |
