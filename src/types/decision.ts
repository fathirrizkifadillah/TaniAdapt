import { CropId } from './crop';

export type RiskLevel = 'RENDAH' | 'SEDANG' | 'TINGGI';

export type RecommendationCategory =
  | 'PROTEKSI_PENYAKIT'
  | 'PENGATURAN_IRIGASI'
  | 'APLIKASI_PUPUK'
  | 'OPERASIONAL_PANEN';

export interface ActionableRecommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  urgency: 'HARI_INI' | '24_48_JAM' | 'PREVENTIF_RUTIN';
  riskLevel: RiskLevel;
  action: string;
  rationale: string;
  growthStageContext: string;
  evidenceCitationId: string;
  literatureSource: string;
}

export interface DiseaseRiskAssessment {
  diseaseId: string;
  diseaseName: string;
  pathogen: string;
  level: RiskLevel;
  score: number; // 0 - 100
  reason: string;
  triggerFactors: string[];
  preventiveAdvice: string;
  literatureCitationId: string;
}

export interface IrrigationAdvisory {
  status: 'CUKUP' | 'BUTUH_PENGAIRAN' | 'WASPADA_GENANGAN' | 'DRAINASE_MENDESAK';
  soilMoistureIndexPercent: number; // 0 - 100
  recommendation: string;
  rationale: string;
}

export interface FertilizationAdvisory {
  safeToApply: boolean;
  status: 'AMAN' | 'TUNDA_KARENA_HUJAN' | 'REKOMENDASI_SUSULAN';
  reason: string;
  recommendedNutrient: string;
}

export interface CropEngineResult {
  cropId: CropId;
  cropName: string;
  scientificName: string;
  currentHST: number;
  stageName: string;
  stageDescription: string;
  stageVulnerability: 'RENDAH' | 'SEDANG' | 'TINGGI' | 'KRITIS';
  overallRisk: RiskLevel;
  diseaseRisks: DiseaseRiskAssessment[];
  irrigation: IrrigationAdvisory;
  fertilization: FertilizationAdvisory;
  recommendations: ActionableRecommendation[];
  temporalSummary: string;
  computedAt: string;
}
