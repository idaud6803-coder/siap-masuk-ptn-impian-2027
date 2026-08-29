# SIAPP PTN — FINAL

Versi final sistem SIAPP. Tampilan existing dipertahankan; perbaikan difokuskan pada backend, validasi, pembayaran, koneksi frontend, analisis, alumni, ranking sekolah, dan perbandingan pilihan.

## Menjalankan di Windows / VS Code

1. Buka folder project ini di VS Code.
2. Jalankan `npm.cmd install` bila `node_modules` belum ada.
3. Jalankan `START_SIAPP.bat`, atau gunakan terminal:
   `node server.js`
4. Saat diminta, masukkan password admin yang kuat.
5. Buka `http://localhost:3000`.

## Admin

Buka `http://localhost:3000/admin`.
Password admin adalah password yang dimasukkan saat menjalankan `START_SIAPP.bat`, atau nilai environment variable `ADMIN_PASSWORD` jika sudah diset.

Server tidak memiliki password admin default.

## Aturan analisis

- Pembayaran harus berstatus `approved` dan diverifikasi server melalui `requestId`.
- Raport wajib memiliki minimal satu mata pelajaran; setiap mata pelajaran wajib memiliki Semester 1–5 dan setiap nilai harus 0–100.
- Prestasi boleh kosong; jika diisi, nama lomba, peringkat, dan tingkat wajib lengkap.
- Maksimal 2 pilihan prodi dan minimal 1 pilihan.
- Setiap pilihan wajib memiliki PTN, prodi, peminat, daya tampung, dan data alumni 2024/2025/2026.
- Ranking sekolah 2025/2026: 1–1000; 0/kosong berarti tidak masuk Top 1000.
- Bobot final: Raport 50%, Prestasi 25%, Alumni + Ranking Sekolah 25%.
- Persaingan PTN hanya informasi tambahan dan tidak masuk bobot akhir.
