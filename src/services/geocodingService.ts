/**
 * Open-Meteo Geocoding & Browser GPS Service for TaniAdapt.
 * Provides precise hyperlocal coordinates (latitude, longitude, elevation)
 * for smallholders, farms, and research organizations.
 */

export interface GeocodingResult {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  admin1?: string; // Provinsi
  admin2?: string; // Kabupaten / Kota
  country?: string;
  displayName: string;
}

const GEOCODING_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export async function searchLocationsByApi(query: string): Promise<GeocodingResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const params = new URLSearchParams({
      name: q,
      count: '6',
      language: 'id',
      format: 'json',
    });

    const res = await fetch(`${GEOCODING_BASE_URL}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Geocoding API status: ${res.status}`);
    }

    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((item: any) => {
      const parts = [item.name];
      if (item.admin2) parts.push(item.admin2);
      if (item.admin1) parts.push(item.admin1);
      if (item.country && item.country !== 'Indonesia') parts.push(item.country);

      return {
        id: item.id || `${item.latitude}_${item.longitude}`,
        name: item.name,
        latitude: Number(item.latitude.toFixed(4)),
        longitude: Number(item.longitude.toFixed(4)),
        elevation: item.elevation ? Math.round(item.elevation) : undefined,
        admin1: item.admin1,
        admin2: item.admin2,
        country: item.country,
        displayName: parts.join(', '),
      };
    });
  } catch (err) {
    console.warn('Geocoding search failed:', err);
    return [];
  }
}

export function getCurrentGpsPosition(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Browser Anda tidak mendukung deteksi lokasi GPS.'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      (err) => {
        reject(new Error(err.message || 'Gagal mendeteksi koordinat GPS. Pastikan izin lokasi aktif.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
