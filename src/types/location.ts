import { CropId } from './crop';

export interface AgriculturalLocation {
  id: string;
  name: string;
  regency: string;
  province: string;
  latitude: number;
  longitude: number;
  elevationMeters: number;
  agroclimateZone: string; // e.g., Oldeman zone C2, B1
  primaryCrops: CropId[];
  soilTexture: string;
  district?: string; // Kecamatan
  village?: string;  // Desa / Kelurahan
}
