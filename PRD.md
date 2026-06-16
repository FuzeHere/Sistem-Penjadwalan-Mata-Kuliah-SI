# Product Requirements Document (PRD)

## Sistem Manajemen Penjadwalan Perkuliahan Prodi Sistem Informasi UIN Alauddin

**Versi:** 1.0
**Status:** Draft
**Tanggal:** Juni 2026
**Lingkup:** 1 Program Studi Sistem Informasi, Jurusan Sistem Informasi, UIN Alauddin Makassar

---

## 1. Ringkasan Produk

Sistem ini adalah aplikasi web untuk mengelola dan menyusun jadwal perkuliahan pada Program Studi Sistem Informasi. Aplikasi digunakan oleh Admin Jurusan untuk mengelola data akademik, aturan penjadwalan, ruangan, slot waktu, dan publikasi jadwal. Dosen dapat melihat jadwal mengajar serta memberikan preferensi waktu mengajar. Mahasiswa dapat melihat jadwal kuliah per kelas dan mengunduhnya dalam bentuk PDF.

Sistem dirancang untuk menggantikan proses manual atau semi-manual agar penyusunan jadwal lebih cepat, terstruktur, bebas bentrok, dan mudah dipublikasikan ke seluruh sivitas akademika.

---

## 2. Latar Belakang Masalah

Berdasarkan diagram alur sistem yang menjadi dasar rancangan, proses penjadwalan kuliah melibatkan Admin Akademik/Jurusan, Dosen, dan Mahasiswa. Admin mengelola data dosen, mata kuliah, kelas, program studi, ruangan, slot waktu, hard constraints, soft constraints, serta revisi jadwal. Dosen mengirimkan mata kuliah yang diampu dan preferensi waktu mengajar. Mahasiswa mencari jadwal berdasarkan kelas dan semester. Sistem kemudian menyusun jadwal, memvalidasi konflik, dan mempublikasikan hasilnya. fileciteturn0file0

Masalah utama yang ingin diselesaikan:

* Penyusunan jadwal memakan waktu lama bila dilakukan manual.
* Risiko bentrok dosen, kelas, ruangan, dan waktu cukup tinggi.
* Informasi jadwal belum terpusat dan mudah diakses.
* Perlu sistem yang dapat dipakai nyata oleh kampus.

---

## 3. Tujuan Produk

### Tujuan bisnis

* Menjadi sistem penjadwalan yang benar-benar bisa dipakai oleh kampus.
* Mengurangi waktu penyusunan jadwal.
* Mengurangi kesalahan dan bentrok jadwal.
* Memudahkan publikasi jadwal ke dosen dan mahasiswa.

### Tujuan pengguna

* Admin Jurusan dapat menyusun dan memvalidasi jadwal dengan lebih cepat.
* Dosen dapat melihat jadwal mengajar dan memberi preferensi waktu.
* Mahasiswa dapat melihat jadwal kuliah per kelas secara mandiri.

---

## 4. Ruang Lingkup Produk

### In scope

* Sistem berbasis web.
* Satu program studi: Sistem Informasi.
* Satu admin utama: Admin Jurusan.
* Akses dosen untuk melihat jadwal dan mengelola preferensi.
* Akses mahasiswa untuk melihat jadwal per kelas dan unduh PDF.
* Penjadwalan otomatis berdasarkan constraint.
* Validasi bentrok jadwal.
* Publikasi jadwal dalam aplikasi.
* Laporan bentrok dan laporan penggunaan ruangan.

### Out of scope

* Aplikasi mobile.
* Multi prodi.
* Multi kampus.
* Integrasi ke sistem akademik eksternal.
* Pengisian jadwal oleh mahasiswa.
* Penjadwalan berbasis AI generatif.

---

## 5. Target Pengguna

### Admin Jurusan

Pengguna utama yang mengelola data akademik, menyusun jadwal, melakukan validasi, dan mempublikasikan jadwal.

### Dosen

Pengguna yang melihat jadwal mengajar dan mengirim preferensi waktu mengajar. Dosen juga dapat mengajukan informasi mata kuliah yang diampu.

### Mahasiswa

Pengguna yang melihat jadwal kuliah berdasarkan kelas dan semester, serta mengunduh jadwal dalam format PDF.

---

## 6. Asumsi Bisnis dan Aturan Dasar

* Sistem hanya digunakan untuk 1 prodi, yaitu Sistem Informasi.
* Pengelola utama adalah Admin Jurusan.
* Penjadwalan dilakukan otomatis oleh sistem.
* Preferensi waktu mengajar dosen bersifat opsional.
* Mata kuliah terdiri dari teori dan praktikum.
* Praktikum tidak diisi langsung oleh dosen, tetapi diwakili asisten dosen; jadwal asisten dosen tidak boleh bertabrakan dengan mata kuliah lain.
* 1 SKS setara dengan 40 menit.
* 1 kelas maksimal berisi 25 orang.
* Dosen dapat mengajar lebih dari satu mata kuliah.
* Satu mata kuliah dapat diajar oleh lebih dari satu dosen.
* Satu kelas dapat dipecah menjadi beberapa kelas paralel jika diperlukan.
* Mahasiswa tidak perlu login untuk melihat jadwal.
* Jadwal dapat diunduh dalam format PDF.
* Notifikasi perubahan jadwal cukup ditampilkan di dalam aplikasi.

---

## 7. Deskripsi Proses Bisnis

### Alur utama

1. Admin Jurusan memasukkan data akademik.
2. Dosen mengirim mata kuliah yang diampu dan preferensi mengajar.
3. Sistem mengambil data akademik, ruangan, slot waktu, dan constraint.
4. Sistem menyusun jadwal otomatis.
5. Sistem memvalidasi konflik jadwal.
6. Admin Jurusan dapat merevisi bila ada konflik.
7. Setelah valid, jadwal dipublikasikan.
8. Dosen dan mahasiswa dapat melihat hasil jadwal melalui web.

---

## 8. Kebutuhan Fungsional

### 8.1 Admin Jurusan

Admin harus dapat:

* Login ke sistem.
* Mengelola data dosen.
* Mengelola data mata kuliah.
* Mengelola data kelas.
* Mengelola data program studi.
* Mengelola data ruangan.
* Mengelola data slot waktu.
* Mengelola hard constraints.
* Mengelola soft constraints.
* Mengelola data revisi jadwal.
* Menjalankan proses penjadwalan otomatis.
* Melihat hasil jadwal per kelas, per dosen, dan per ruangan.
* Melihat laporan bentrok jadwal.
* Melihat laporan penggunaan ruangan.
* Mengekspor jadwal ke PDF.
* Mempublikasikan jadwal.

### 8.2 Dosen

Dosen harus dapat:

* Login ke sistem.
* Melihat jadwal mengajar.
* Melihat mata kuliah yang diampu.
* Mengisi preferensi waktu mengajar.
* Melihat status penugasan jadwal.

### 8.3 Mahasiswa

Mahasiswa harus dapat:

* Melihat jadwal kuliah per kelas.
* Mencari jadwal berdasarkan kelas dan semester.
* Mengunduh jadwal dalam format PDF.

---

## 9. Kebutuhan Non-Fungsional

### 9.1 Kinerja

* Sistem harus cepat diakses dari jaringan kampus maupun luar kampus.
* Proses pencarian jadwal harus responsif.
* Proses penjadwalan otomatis harus dapat selesai dalam waktu yang wajar untuk skala 1 prodi.

### 9.2 Keamanan

* Login admin dan dosen harus aman.
* Password harus di-hash.
* Hak akses harus dibatasi berdasarkan role.
* Akses edit hanya untuk pengguna yang berwenang.

### 9.3 Ketersediaan

* Sistem harus tersedia selama jam operasional akademik.
* Data jadwal harus tersimpan aman dan dapat dipulihkan.

### 9.4 Usability

* Antarmuka harus sederhana dan mudah digunakan oleh admin jurusan.
* Mahasiswa harus dapat melihat jadwal tanpa login.
* Tampilan harus rapi, jelas, dan mudah dibaca.

### 9.5 Maintainability

* Struktur kode harus mudah dirawat.
* Database harus mudah diperluas jika kampus menambah prodi di masa depan.

---

## 10. Aturan Penjadwalan

### Hard Constraints

Aturan wajib yang tidak boleh dilanggar:

* Dosen tidak boleh mengajar pada waktu yang sama.
* Kelas tidak boleh memiliki dua mata kuliah dalam waktu yang sama.
* Ruangan tidak boleh dipakai oleh dua kelas secara bersamaan.
* Kapasitas ruangan harus mencukupi jumlah mahasiswa.
* Praktikum harus ditempatkan pada ruangan yang sesuai.
* Asisten dosen praktikum tidak boleh bentrok dengan mata kuliah lain.
* Jadwal harus mengikuti slot waktu yang tersedia.

### Soft Constraints

Aturan yang diprioritaskan untuk meningkatkan kualitas jadwal:

* Preferensi waktu mengajar dosen.
* Penempatan jadwal yang lebih nyaman bagi mahasiswa.
* Penggunaan ruangan tertentu bila tersedia.
* Pemerataan beban jadwal agar tidak menumpuk pada satu waktu tertentu.

---

## 11. Desain Ruang Lingkup Data

### Data akademik utama

* Dosen
* Mata kuliah
* Kelas
* Program studi
* Ruangan
* Slot waktu

### Data penjadwalan

* Hard constraints
* Soft constraints
* Preferensi dosen
* Jadwal hasil generate
* Revisi jadwal
* Konflik jadwal

### Data output

* Jadwal kuliah per kelas
* Jadwal mengajar dosen
* Laporan bentrok jadwal
* Laporan penggunaan ruangan
* Rekap jadwal perkuliahan

---

## 12. Ruangan dan Kapasitas

### Daftar ruangan

#### Lantai 1

* 101
* 102
* 103

#### Lantai 2

* 201
* 202
* 203
* 204
* 205
* 206
* 207

#### Lantai 3

* 301
* 302
* 303
* 304
* 305
* 306
* 307

### Aturan kapasitas

* Maksimal 25 mahasiswa per kelas.
* Sistem harus memeriksa kecocokan kapasitas ruangan sebelum jadwal dipublish.

---

## 13. Algoritma Penjadwalan yang Dipilih

Untuk kebutuhan sistem ini, pendekatan yang paling sesuai adalah:

**Constraint-based automatic scheduling dengan heuristic greedy**

### Alasan pemilihan

* Cocok untuk skala 1 prodi.
* Lebih mudah diimplementasikan dan dipelihara.
* Dapat memprioritaskan hard constraints terlebih dahulu.
* Dapat menilai soft constraints sebagai faktor prioritas tambahan.
* Lebih realistis untuk sistem kampus daripada algoritma kompleks yang sulit dijelaskan ke pengguna non-teknis.

### Cara kerja tingkat tinggi

1. Sistem mengambil semua data dasar.
2. Sistem menyusun kandidat jadwal berdasarkan slot waktu dan ruangan.
3. Sistem menyaring kandidat yang melanggar hard constraints.
4. Sistem memilih jadwal terbaik berdasarkan prioritas soft constraints.
5. Sistem menyimpan hasil jadwal.
6. Sistem menjalankan validasi konflik.
7. Admin dapat melakukan revisi bila diperlukan.

---

## 14. User Flow Utama

### Admin Jurusan

Login → kelola data akademik → input constraints → jalankan penjadwalan otomatis → validasi konflik → revisi jika perlu → publikasi jadwal → unduh laporan

### Dosen

Login → lihat jadwal mengajar → input preferensi waktu → lihat status penugasan

### Mahasiswa

Buka web → pilih kelas/semester → lihat jadwal → unduh PDF

---

## 15. Rekomendasi Struktur Halaman Web

### Publik

* Beranda
* Jadwal per Kelas
* Jadwal per Semester
* Unduh PDF
* Tentang Sistem

### Dosen

* Dashboard Dosen
* Jadwal Mengajar
* Preferensi Waktu
* Profil

### Admin Jurusan

* Dashboard
* Manajemen Dosen
* Manajemen Mata Kuliah
* Manajemen Kelas
* Manajemen Program Studi
* Manajemen Ruangan
* Manajemen Slot Waktu
* Manajemen Constraints
* Generator Jadwal
* Validasi Konflik
* Laporan
* Publikasi Jadwal
* Pengguna

---

## 16. Struktur Data Awal (Draft)

### users

* id
* name
* email
* password
* role
* created_at
* updated_at

### lecturers

* id
* user_id
* nidn
* name
* email
* phone
* status

### students

* id
* nim
* name
* class_id
* semester

### courses

* id
* code
* name
* credits
* type
* needs_lab

### classes

* id
* name
* semester
* capacity

### rooms

* id
* code
* floor
* capacity
* type

### time_slots

* id
* day
* start_time
* end_time

### lecturer_preferences

* id
* lecturer_id
* preferred_slot_id
* notes

### constraints

* id
* type
* category
* description
* is_hard

### schedules

* id
* class_id
* course_id
* lecturer_id
* room_id
* time_slot_id
* academic_year
* status

### schedule_conflicts

* id
* schedule_id
* conflict_type
* description
* status

### revisions

* id
* schedule_id
* revised_by
* reason
* created_at

---

## 17. Prioritas MVP

### Prioritas tinggi

* Login admin dan dosen
* Data master akademik
* Data ruangan dan slot waktu
* Input preferensi dosen
* Generator jadwal otomatis
* Validasi konflik
* Publikasi jadwal
* Tampilan jadwal mahasiswa
* Export PDF

### Prioritas menengah

* Laporan penggunaan ruangan
* Laporan bentrok jadwal
* Riwayat revisi jadwal
* Filter pencarian jadwal

### Prioritas rendah

* Notifikasi internal
* Audit log lengkap
* Dashboard statistik lanjutan
* Integrasi email/WhatsApp

---

## 18. Risiko Produk

* Data input tidak lengkap akan mengganggu hasil jadwal.
* Preferensi dosen yang terlalu banyak dapat membatasi ruang jadwal.
* Bentrok praktikum dengan mata kuliah lain harus ditangani dengan ketat.
* Jika kapasitas ruangan tidak memadai, sistem harus memberi peringatan sejak awal.

---

## 19. Kriteria Keberhasilan

Produk dianggap berhasil jika:

* Admin dapat membuat jadwal tanpa proses manual yang panjang.
* Jadwal yang dihasilkan minim konflik.
* Dosen dapat mengakses jadwal dengan mudah.
* Mahasiswa dapat melihat jadwal tanpa bantuan admin.
* Jadwal bisa dicetak atau diunduh sebagai PDF.
* Sistem benar-benar layak dipakai oleh kampus.

---

## 20. Future Enhancement

* Multi prodi.
* Integrasi ke sistem akademik kampus.
* Notifikasi perubahan jadwal.
* Approval workflow untuk revisi.
* Optimasi penjadwalan lanjutan.
* Aplikasi mobile.

---