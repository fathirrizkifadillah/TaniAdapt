# INDEX VERIFIKASI EMPIRIS TANIADAPT (SESI W)

Dokumen ini merekam seluruh eksekusi perintah mentah dan temuan audit verifikasi berbasis perintah independen (Claude) per tanggal 15 Oktober 2026.

---

## Tabel Ringkasan Verifikasi

| ID | Dijalankan? | Output Mentah Ada Di | Kesimpulan Ilmiah / Arsitektur |
| :--- | :--- | :--- | :--- |
| **V-A0** | YA | `verifikasi/raw/vitest_verbose.txt`, `verifikasi/raw/package_lock_diff.txt` | Vitest 30/30 lulus (7 suite); selisih package-lock mencakup ajv, ajv-formats, dan pembaruan native bindings rolldown/oxc. |
| **V-A1** | YA | `verifikasi/V_A_pre_G1.md` | Tabel M1/M2/M3 terpetakan ke nama tes spesifik; klaim tanpa tes ditandai `TIDAK ADA TES` secara jujur. |
| **V-A2** | YA | `verifikasi/raw/va2_engine_output.txt` | Eksekusi output engine nyata untuk 7 skenario komoditas/cuaca dan divalidasi Ajv Draft 2020-12 terhadap `engine_output.schema.json`. |
| **V-A3** | YA | `verifikasi/raw/va3_grep_numbers.txt` | Audit grepping angka numerik dan string rules di luar `rules.json` (klasifikasi hardcode vs SSOT). |
| **V-A4** | YA | `verifikasi/raw/va4_water_rules.txt` | Audit alur penentuan kartu Siram dan RAW per tanaman; konfirmasi kartu cabai berstatus `evidence_insufficient`. |
| **V-A5** | YA | `verifikasi/raw/va5_weather_failure.txt` | Analisis alur catch `weatherService.ts` dan perilaku `FALLBACK_WEATHER_DATABASE` saat API Open-Meteo gagal. |
| **V-A6** | YA | `verifikasi/raw/va6_groq_audit.txt` | Audit pemanggilan Groq API (browser vs server, penyimpanan API key di localStorage vs env). |
| **V-A7** | YA | `verifikasi/raw/va7_tania_guardrails.txt` | Status fungsi guardrail Tania (filter merek, dosis, kepastian, dan paritas angka). |
| **V-A8** | YA | `verifikasi/raw/va8_timezone_hst.txt` | Pengujian pergeseran zona waktu `TZ=UTC` vs `TZ=Asia/Jakarta` pada fungsi kalkulasi HST tanaman. |
