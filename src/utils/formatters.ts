/**
 * formatters.ts
 * Utilitas pemformatan angka dan teks terpusat untuk TaniAdapt.
 * Menghilangkan artefak floating-point precision (seperti 2.9400000000000004 mm)
 * dan menstandardisasi penyajian desimal sesuai konvensi bahasa Indonesia.
 */

/**
 * Memformat angka dengan batas desimal tetap (default 1 desimal).
 * Mengembalikan '-' jika nilai null, undefined, atau NaN.
 */
export function formatNumber(val: number | null | undefined, decimals: number = 1): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '-';
  }
  return Number(val.toFixed(decimals)).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

/**
 * Format desimal tepat 1 angka di belakang koma (misal: suhu 28.4 °C, hujan 12.0 mm).
 */
export function format1d(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val.toFixed(1)).toString();
}

/**
 * Format desimal tepat 2 angka di belakang koma (misal: VPD 0.45 kPa, Kc 1.15).
 */
export function format2d(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val.toFixed(2)).toString();
}

/**
 * Format koordinat GPS (4 desimal).
 */
export function formatGps(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val.toFixed(4)).toString();
}

/**
 * Format mata uang atau bilangan bulat (0 desimal).
 */
export function formatInt(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Math.round(val).toString();
}
