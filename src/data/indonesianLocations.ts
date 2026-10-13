import { AgriculturalLocation } from '../types/location';

export const INDONESIAN_LOCATIONS: AgriculturalLocation[] = [
  {
    id: 'lembang',
    name: 'Lembang',
    regency: 'Bandung Barat',
    province: 'Jawa Barat',
    latitude: -6.8152,
    longitude: 107.6186,
    elevationMeters: 1312,
    agroclimateZone: 'B1 (Basah, Dataran Tinggi)',
    primaryCrops: ['cabai', 'tomat'],
    soilTexture: 'Andosol Vulkanik Subur'
  },
  {
    id: 'subang_pantura',
    name: 'Sukamandi / Ciasem',
    regency: 'Subang',
    province: 'Jawa Barat',
    latitude: -6.3601,
    longitude: 107.6482,
    elevationMeters: 15,
    agroclimateZone: 'C2 (Agak Basah, Dataran Rendah)',
    primaryCrops: ['padi', 'jagung'],
    soilTexture: 'Aluvial & Vertisol'
  },
  {
    id: 'brebes',
    name: 'Wanasari / Larangan',
    regency: 'Brebes',
    province: 'Jawa Tengah',
    latitude: -6.8703,
    longitude: 109.0435,
    elevationMeters: 9,
    agroclimateZone: 'D2 (Kering Musiman, Pesisir)',
    primaryCrops: ['bawang_merah', 'cabai'],
    soilTexture: 'Aluvial Lempung Berpasir'
  },
  {
    id: 'garut',
    name: 'Cikajang / Bayongbong',
    regency: 'Garut',
    province: 'Jawa Barat',
    latitude: -7.2278,
    longitude: 107.8833,
    elevationMeters: 980,
    agroclimateZone: 'B2 (Basah Berbukit)',
    primaryCrops: ['cabai', 'jagung', 'tomat'],
    soilTexture: 'Andosol & Regosol'
  },
  {
    id: 'kediri',
    name: 'Pare / Plemahan',
    regency: 'Kediri',
    province: 'Jawa Timur',
    latitude: -7.7667,
    longitude: 112.1833,
    elevationMeters: 125,
    agroclimateZone: 'C3 (Sedang, Vulkanik Bawah Kelud)',
    primaryCrops: ['jagung', 'cabai', 'bawang_merah'],
    soilTexture: 'Regosol Berpasir Cepat Mengering'
  },
  {
    id: 'malang_pujon',
    name: 'Pujon / Batu',
    regency: 'Malang',
    province: 'Jawa Timur',
    latitude: -7.8667,
    longitude: 112.4667,
    elevationMeters: 1150,
    agroclimateZone: 'B1 (Pegunungan Sejuk Lembap)',
    primaryCrops: ['tomat', 'cabai'],
    soilTexture: 'Andosol Humus Tinggi'
  }
];
