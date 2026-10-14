export type CropId = 'cabai' | 'cabai_rawit' | 'padi' | 'kedelai' | 'bawang_merah' | 'jagung' | 'tomat';

export interface GrowthStage {
  id: string;
  name: string;
  minHST: number; // Hari Setelah Tanam
  maxHST: number;
  description: string;
  waterSensitivity: 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS';
  diseaseVulnerability: 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS';
  keyNutrientNeed: string;
  agronomicFocus: string;
}

export interface DiseaseDefinition {
  id: string;
  name: string;
  pathogen: string;
  indonesianName: string;
  description: string;
  triggers: {
    minConsecutiveRainDays?: number;
    minRH?: number;
    tempRange?: [number, number];
    minRolling3dRain?: number;
    maxVPD?: number; // Kelembapan tinggi = VPD rendah
  };
  preventiveAction: string;
  curativeAction: string;
  literatureCitationId: string;
}

export interface CropDefinition {
  id: CropId;
  name: string;
  scientificName: string;
  category: 'Hortikultura' | 'Pangan' | 'Sayuran Buah' | 'Rempah';
  description: string;
  totalDurationDays: number;
  optimalTempRange: [number, number];
  optimalRHRange: [number, number];
  growthStages: GrowthStage[];
  diseases: DiseaseDefinition[];
}
