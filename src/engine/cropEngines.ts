import { GrowthStage } from '../types/crop';
import { CurrentWeather, DailyForecast, TemporalFeatures } from '../types/weather';
import {
  ActionableRecommendation,
  DiseaseRiskAssessment,
  FertilizationAdvisory,
  IrrigationAdvisory,
  RiskLevel
} from '../types/decision';

export interface CropEvaluationOutput {
  overallRisk: RiskLevel;
  diseaseRisks: DiseaseRiskAssessment[];
  irrigation: IrrigationAdvisory;
  fertilization: FertilizationAdvisory;
  recommendations: ActionableRecommendation[];
  temporalSummary: string;
}

// ----------------------------------------------------
// 1. ENGINE CABAI MERAH (Capsicum annuum L.)
// ----------------------------------------------------
export function evaluateCabaiEngine(
  stage: GrowthStage,
  hst: number,
  tf: TemporalFeatures,
  current: CurrentWeather,
  _forecast: DailyForecast[]
): CropEvaluationOutput {
  const recommendations: ActionableRecommendation[] = [];
  const diseaseRisks: DiseaseRiskAssessment[] = [];

  // Model Antraknosa (Colletotrichum acutatum / gloeosporioides)
  // Trigger: consecutive rainy days >= 3 ATAU rolling 3d rain >= 25mm DENGAN RH 7d >= 82% & suhu 23-28°C
  let antraknosaScore = 15;
  const antraknosaFactors: string[] = [];

  if (tf.consecutiveRainyDays >= 3) {
    antraknosaScore += 45;
    antraknosaFactors.push(`Hujan turun ${tf.consecutiveRainyDays} hari berturut-turut (ambang batas >= 3 hari)`);
  } else if (tf.rolling3dRain >= 25) {
    antraknosaScore += 30;
    antraknosaFactors.push(`Akumulasi curah hujan 3 hari mencapai ${tf.rolling3dRain} mm`);
  }

  if (tf.rolling7dRH >= 82) {
    antraknosaScore += 25;
    antraknosaFactors.push(`Kelembapan udara rata-rata tinggi (${tf.rolling7dRH}% RH)`);
  }

  if (current.temperature >= 23 && current.temperature <= 28) {
    antraknosaScore += 15;
    antraknosaFactors.push(`Suhu optimum perkecambahan spora (${current.temperature}°C)`);
  }

  // Pengali kerentanan fase berbuah (HST 66-90)
  if (stage.id === 'c_fruiting') {
    antraknosaScore = Math.min(100, Math.round(antraknosaScore * 1.2));
    antraknosaFactors.push('Fase pembesaran buah memiliki dinding sel rentan penetrasi spora');
  }

  const antraknosaLevel: RiskLevel = antraknosaScore >= 70 ? 'TINGGI' : antraknosaScore >= 40 ? 'SEDANG' : 'RENDAH';
  diseaseRisks.push({
    diseaseId: 'antraknosa',
    diseaseName: 'Antraknosa (Patek Buah Cabai)',
    pathogen: 'Colletotrichum acutatum',
    level: antraknosaLevel,
    score: antraknosaScore,
    reason: antraknosaLevel === 'TINGGI'
      ? 'Mikroklimat jenuh lembap dengan riwayat hujan berulang memicu perkecambahan konidia secara massal.'
      : 'Kondisi mikroklimat cukup terkendali namun tetap waspadai kelembapan malam hari.',
    triggerFactors: antraknosaFactors,
    preventiveAdvice: 'Aplikasi fungisida kontak berbahan Mancozeb atau Propineb saat jeda hujan.',
    literatureCitationId: 'balitsa_antraknosa_2020'
  });

  if (antraknosaLevel === 'TINGGI') {
    recommendations.push({
      id: 'rec_cabai_antraknosa',
      category: 'PROTEKSI_PENYAKIT',
      title: 'Proteksi Mendesak Antraknosa (Patek)',
      urgency: 'HARI_INI',
      riskLevel: 'TINGGI',
      action: 'Lakukan penyemprotan fungisida protektif Mancozeb/Propineb sebelum hujan sore; petik dan bakar buah yang menunjukkan lesi patek aktif.',
      rationale: `Riwayat hujan ${tf.consecutiveRainyDays} hari berturut-turut dan RH ${tf.rolling7dRH}% sangat kondusif untuk penyebaran spora (Balitsa, 2020).`,
      growthStageContext: `Fase ${stage.name} (HST ${hst})`,
      evidenceCitationId: 'balitsa_antraknosa_2020',
      literatureSource: 'Balai Penelitian Tanaman Sayuran (Balitsa) Lembang'
    });
  }

  // Model Busuk Batang Phytophthora
  let phytophthoraScore = 10;
  const phytophthoraFactors: string[] = [];
  if (tf.rolling3dRain >= 35) {
    phytophthoraScore += 50;
    phytophthoraFactors.push(`Kejenuhan air tanah tinggi (hujan 3 hari = ${tf.rolling3dRain} mm)`);
  }
  if (current.relativeHumidity >= 88) {
    phytophthoraScore += 30;
    phytophthoraFactors.push(`Kelembapan relatif ekstrem (${current.relativeHumidity}%)`);
  }
  const phytophthoraLevel: RiskLevel = phytophthoraScore >= 65 ? 'TINGGI' : phytophthoraScore >= 35 ? 'SEDANG' : 'RENDAH';
  diseaseRisks.push({
    diseaseId: 'hawar_phytophthora',
    diseaseName: 'Busuk Batang / Hawar Daun Phytophthora',
    pathogen: 'Phytophthora capsici',
    level: phytophthoraLevel,
    score: phytophthoraScore,
    reason: phytophthoraLevel === 'TINGGI'
      ? 'Kondisi perakaran rawan anaerob akibat air tanah jenuh memicu zoospora bergerak bebas.'
      : 'Kondisi aerasi bedengan dalam batas toleransi.',
    triggerFactors: phytophthoraFactors,
    preventiveAdvice: 'Perdalam parit drainase hingga kedalaman minimal 30 cm.',
    literatureCitationId: 'balitsa_tomat_blight_2018'
  });

  // Logika Irigasi
  let soilMoistureEstimate = Math.min(100, Math.round(30 + tf.rolling3dRain * 1.5 + (100 - tf.currentVPD * 40)));
  soilMoistureEstimate = Math.max(10, Math.min(100, soilMoistureEstimate));
  
  let irrigationStatus: IrrigationAdvisory['status'] = 'CUKUP';
  let irrigationAdvice = 'Kadar air tanah optimal. Pertahankan kelembapan seimbang.';
  let irrigationRationale = 'Keseimbangan antara evapotranspirasi dan ketersediaan air mencukupi.';

  if (tf.rolling3dRain > 45 || tf.forecastRain24h > 30) {
    irrigationStatus = 'DRAINASE_MENDESAK';
    irrigationAdvice = 'Kuras parit bedengan segera; cegah air menggenang lebih dari 4 jam.';
    irrigationRationale = `Akumulasi hujan tinggi (${tf.rolling3dRain} mm) berpotensi memicu asfiksia perakaran cabai.`;
    recommendations.push({
      id: 'rec_cabai_drainase',
      category: 'PENGATURAN_IRIGASI',
      title: 'Kuras dan Normalisasi Parit Drainase Bedengan',
      urgency: 'HARI_INI',
      riskLevel: 'TINGGI',
      action: 'Pastikan parit pembuangan air di antara bedengan mengalir lancar dan tidak ada genangan.',
      rationale: 'Cabai merah tidak tahan genangan air (waterlogging). Genangan memicu busuk akar dan infeksi Phytophthora.',
      growthStageContext: `Fase ${stage.name}`,
      evidenceCitationId: 'balitsa_antraknosa_2020',
      literatureSource: 'Balitsa Lembang'
    });
  } else if (tf.consecutiveDryDays >= 4 && stage.id === 'c_flowering') {
    irrigationStatus = 'BUTUH_PENGAIRAN';
    irrigationAdvice = 'Lakukan pengocoran air di pagi hari untuk mencegah rontok bunga.';
    irrigationRationale = 'Fase pembungaan sangat rentan terhadap stres air (abscission kuncup bunga).';
    recommendations.push({
      id: 'rec_cabai_siram_bunga',
      category: 'PENGATURAN_IRIGASI',
      title: 'Pengairan Terukur Fase Berbunga',
      urgency: '24_48_JAM',
      riskLevel: 'SEDANG',
      action: 'Berikan air irigasi tetes atau leb cepat 2 jam di pagi hari untuk menjaga kelembapan perakaran.',
      rationale: 'Tanaman sedang fase berbunga lebat; defisit air menyebabkan bunga rontok sebelum terbentuk bakal buah.',
      growthStageContext: `HST ${hst} - Inisiasi Pembungaan`,
      evidenceCitationId: 'ipb_irigasi_vpd_2021',
      literatureSource: 'IPB University'
    });
  }

  // Logika Pemupukan (Pencegahan Pencucian / Leaching)
  const safeForFertilizer = tf.forecastRain24h < 20 && tf.maxPrecipProbabilityNext48h < 75;
  const fertAdvisory: FertilizationAdvisory = {
    safeToApply: safeForFertilizer,
    status: safeForFertilizer ? 'AMAN' : 'TUNDA_KARENA_HUJAN',
    reason: safeForFertilizer
      ? 'Prakiraan hujan 24-48 jam ke depan rendah, risiko pencucian pupuk minimal.'
      : `Prakiraan hujan lebat (${tf.forecastRain24h} mm) dalam 24 jam ke depan berisiko mencuci pupuk NPK (FAO-56).`,
    recommendedNutrient: stage.keyNutrientNeed
  };

  if (!safeForFertilizer) {
    recommendations.push({
      id: 'rec_cabai_tunda_pupuk',
      category: 'APLIKASI_PUPUK',
      title: 'Tunda Pemupukan Susulan Butiran/Kocor',
      urgency: '24_48_JAM',
      riskLevel: 'SEDANG',
      action: 'Tunda aplikasi pupuk NPK butiran atau kocor hingga cuaca stabil.',
      rationale: `Prakiraan hujan ${tf.forecastRain24h} mm dalam 24 jam akan mencuci ion nitrat dan kalium ke luar perakaran (FAO, 2019).`,
      growthStageContext: stage.name,
      evidenceCitationId: 'fao_irrigation_leaching_2019',
      literatureSource: 'FAO Irrigation Paper 56'
    });
  }

  const overallRisk: RiskLevel = diseaseRisks.some(d => d.level === 'TINGGI') || irrigationStatus === 'DRAINASE_MENDESAK'
    ? 'TINGGI'
    : diseaseRisks.some(d => d.level === 'SEDANG')
    ? 'SEDANG'
    : 'RENDAH';

  const temporalSummary = `Lag Hujan Kemarin: ${tf.lag1Rain} mm | Akumulasi 3 Hari: ${tf.rolling3dRain} mm | Hari Hujan Beruntun: ${tf.consecutiveRainyDays} hari | VPD: ${tf.currentVPD} kPa`;

  return {
    overallRisk,
    diseaseRisks,
    irrigation: {
      status: irrigationStatus,
      soilMoistureIndexPercent: soilMoistureEstimate,
      recommendation: irrigationAdvice,
      rationale: irrigationRationale
    },
    fertilization: fertAdvisory,
    recommendations,
    temporalSummary
  };
}

// ----------------------------------------------------
// 2. ENGINE PADI SAWAH (Oryza sativa L.)
// ----------------------------------------------------
export function evaluatePadiEngine(
  stage: GrowthStage,
  hst: number,
  tf: TemporalFeatures,
  current: CurrentWeather,
  _forecast: DailyForecast[]
): CropEvaluationOutput {
  const recommendations: ActionableRecommendation[] = [];
  const diseaseRisks: DiseaseRiskAssessment[] = [];

  // Model Blas Padi (Magnaporthe oryzae)
  // Kondisi kondusif: RH > 85%, suhu 22-27°C, curah hujan akumulatif 3 hari > 30 mm pada fase bunting (HST 41-65)
  let blasScore = 20;
  const blasFactors: string[] = [];

  if (tf.rolling3dRain >= 30) {
    blasScore += 35;
    blasFactors.push(`Curah hujan 3 hari mencapai ${tf.rolling3dRain} mm (ambang infeksi >= 30 mm)`);
  }
  if (tf.rolling7dRH >= 85) {
    blasScore += 25;
    blasFactors.push(`Kelembapan relatif rata-rata tinggi (${tf.rolling7dRH}% RH)`);
  }
  if (current.temperature >= 22 && current.temperature <= 27) {
    blasScore += 15;
    blasFactors.push(`Suhu mikroklimat malam/pagi sejuk (${current.temperature}°C)`);
  }
  if (stage.id === 'p_booting') {
    blasScore = Math.min(100, Math.round(blasScore * 1.25));
    blasFactors.push('Fase bunting (booting) memiliki kerentanan fisiologis kritis terhadap infeksi leher malai');
  }

  const blasLevel: RiskLevel = blasScore >= 70 ? 'TINGGI' : blasScore >= 40 ? 'SEDANG' : 'RENDAH';
  diseaseRisks.push({
    diseaseId: 'blas_padi',
    diseaseName: 'Penyakit Blas Daun & Leher Malai',
    pathogen: 'Magnaporthe oryzae',
    level: blasLevel,
    score: blasScore,
    reason: blasLevel === 'TINGGI'
      ? 'Kombinasi cuaca basah dan fase bunting memicu perkecambahan spora blas leher yang dapat menyebabkan malai hampa.'
      : 'Tekanan penyakit blas dalam batas aman terkontrol.',
    triggerFactors: blasFactors,
    preventiveAdvice: 'Aplikasi fungisida protektif Trisiklazol saat daun bendera mulai muncul.',
    literatureCitationId: 'bbpadi_blas_2019'
  });

  if (blasLevel === 'TINGGI') {
    recommendations.push({
      id: 'rec_padi_blas',
      category: 'PROTEKSI_PENYAKIT',
      title: 'Aplikasi Preventif Fungisida Blas Daun/Leher',
      urgency: 'HARI_INI',
      riskLevel: 'TINGGI',
      action: 'Semprotkan fungisida Trisiklazol atau Isoprotiolan saat embun pagi mengering; kurangi dosis pupuk Urea berlebih.',
      rationale: `Akumulasi hujan 3 hari ${tf.rolling3dRain} mm dan RH ${tf.rolling7dRH}% memenuhi kriteria epidemi blas BB Padi Sukamandi (2019).`,
      growthStageContext: `Fase ${stage.name} (HST ${hst})`,
      evidenceCitationId: 'bbpadi_blas_2019',
      literatureSource: 'Balai Besar Penelitian Tanaman Padi (BB Padi) Sukamandi'
    });
  }

  // Pengaturan Tata Air (AWD / Macak-macak vs Genangan)
  let irrigationStatus: IrrigationAdvisory['status'] = 'CUKUP';
  let irrigationAdvice = 'Terapkan ketinggian air sawah 2-3 cm.';
  let irrigationRationale = 'Menjaga kelembapan optimal fase aktif.';

  if (stage.id === 'p_booting') {
    irrigationStatus = 'BUTUH_PENGAIRAN';
    irrigationAdvice = 'Pertahankan genangan air setinggi 3-5 cm terus-menerus selama fase bunting hingga berbunga.';
    irrigationRationale = 'Fase bunting tidak boleh mengalami kekeringan karena menyebabkan malai mandul.';
  } else if (stage.id === 'p_tillering') {
    irrigationStatus = 'CUKUP';
    irrigationAdvice = 'Lakukan pengairan berselang (AWD): biarkan air surut hingga tanah macak-macak sebelum diairi lagi.';
    irrigationRationale = 'Irigasi berselang memperdalam jangkauan akar dan memperkokoh rumpun anakan produktif.';
  } else if (stage.id === 'p_ripening') {
    irrigationStatus = 'CUKUP';
    irrigationAdvice = 'Keringkan lahan secara bertahap menjelang panen (10 hari sebelum potong).';
    irrigationRationale = 'Mempercepat pengisian gabah dan memudahkan mekanisasi pemanenan.';
  }

  // Pupuk Urea Susulan
  const safeForFertilizer = tf.forecastRain24h < 20;
  const fertAdvisory: FertilizationAdvisory = {
    safeToApply: safeForFertilizer,
    status: safeForFertilizer ? 'AMAN' : 'TUNDA_KARENA_HUJAN',
    reason: safeForFertilizer
      ? 'Aman mengaplikasikan pupuk Urea/NPK susulan di petak sawah.'
      : `Prakiraan curah hujan ${tf.forecastRain24h} mm berisiko menghanyutkan pupuk nitrogen yang belum terserap.`,
    recommendedNutrient: stage.keyNutrientNeed
  };

  const overallRisk: RiskLevel = diseaseRisks.some(d => d.level === 'TINGGI') ? 'TINGGI' : 'RENDAH';
  const temporalSummary = `Lag Hujan Kemarin: ${tf.lag1Rain} mm | 3 Hari Terakhir: ${tf.rolling3dRain} mm | Rerata RH 7 Hari: ${tf.rolling7dRH}%`;

  return {
    overallRisk,
    diseaseRisks,
    irrigation: {
      status: irrigationStatus,
      soilMoistureIndexPercent: 85,
      recommendation: irrigationAdvice,
      rationale: irrigationRationale
    },
    fertilization: fertAdvisory,
    recommendations,
    temporalSummary
  };
}

// ----------------------------------------------------
// 3. ENGINE BAWANG MERAH (Allium cepa var. aggregatum)
// ----------------------------------------------------
export function evaluateBawangMerahEngine(
  stage: GrowthStage,
  hst: number,
  tf: TemporalFeatures,
  current: CurrentWeather,
  _forecast: DailyForecast[]
): CropEvaluationOutput {
  const recommendations: ActionableRecommendation[] = [];
  const diseaseRisks: DiseaseRiskAssessment[] = [];

  // Model Penyakit Moler (Fusarium oxysporum)
  // Sangat berbahaya saat genangan air + suhu panas (26-32°C) + curah hujan 3 hari >= 30mm
  let molerScore = 15;
  const molerFactors: string[] = [];

  if (tf.rolling3dRain >= 30 || tf.consecutiveRainyDays >= 2) {
    molerScore += 45;
    molerFactors.push(`Air tanah terlampau jenuh (hujan 3 hari = ${tf.rolling3dRain} mm)`);
  }
  if (current.temperature >= 26 && current.temperature <= 32) {
    molerScore += 25;
    molerFactors.push(`Suhu tanah hangat (${current.temperature}°C) memicu agresivitas hifa Fusarium`);
  }
  if (stage.id === 'b_bulbing') {
    molerScore = Math.min(100, Math.round(molerScore * 1.2));
    molerFactors.push('Fase pembesaran umbi (HST 31-50) sangat sensitif terhadap busuk pangkal batang');
  }

  const molerLevel: RiskLevel = molerScore >= 65 ? 'TINGGI' : molerScore >= 35 ? 'SEDANG' : 'RENDAH';
  diseaseRisks.push({
    diseaseId: 'moler_fusarium',
    diseaseName: 'Penyakit Moler / Layu Kuning (Twister)',
    pathogen: 'Fusarium oxysporum f.sp. cepae',
    level: molerLevel,
    score: molerScore,
    reason: molerLevel === 'TINGGI'
      ? 'Kondisi drainase jenuh dan suhu tinggi menciptakan lingkungan anaerob yang mematikan perakaran bawang.'
      : 'Tekanan inokulum jamur tanah masih dalam batas toleransi.',
    triggerFactors: molerFactors,
    preventiveAdvice: 'Aplikasi agens hayati Trichoderma sp. dan taburkan dolomit pada bedengan.',
    literatureCitationId: 'ipb_bawang_moler_2021'
  });

  if (molerLevel === 'TINGGI') {
    recommendations.push({
      id: 'rec_bawang_moler',
      category: 'PROTEKSI_PENYAKIT',
      title: 'Karantina & Sanitasi Tanaman Terserang Moler',
      urgency: 'HARI_INI',
      riskLevel: 'TINGGI',
      action: 'Cabut segera tanaman yang daunnya melintir dan pangkalnya membusuk, musnahkan di luar lahan, lalu taburkan kapur tohor di bekas lubang tanam.',
      rationale: `Kelembapan tanah ekstrem memicu penularan spora Fusarium antar umbi lewat aliran air (IPB, 2021).`,
      growthStageContext: `Fase ${stage.name} (HST ${hst})`,
      evidenceCitationId: 'ipb_bawang_moler_2021',
      literatureSource: 'Departemen Proteksi Tanaman, IPB University'
    });
  }

  // Model Bercak Ungu Trotol (Alternaria porri)
  let trotolScore = 20;
  const trotolFactors: string[] = [];
  if (tf.consecutiveRainyDays >= 3 || (tf.lag1Rain > 10 && tf.rolling7dRH > 82)) {
    trotolScore += 45;
    trotolFactors.push(`Embun dan hujan persisten membasahi daun (${tf.consecutiveRainyDays} hari hujan)`);
  }
  const trotolLevel: RiskLevel = trotolScore >= 65 ? 'TINGGI' : trotolScore >= 35 ? 'SEDANG' : 'RENDAH';
  diseaseRisks.push({
    diseaseId: 'trotol_alternaria',
    diseaseName: 'Bercak Ungu / Trotol',
    pathogen: 'Alternaria porri',
    level: trotolLevel,
    score: trotolScore,
    reason: trotolLevel === 'TINGGI' ? 'Daun basah berkepanjangan memicu infeksi spora bercak ungu.' : 'Risiko trotol rendah.',
    triggerFactors: trotolFactors,
    preventiveAdvice: 'Bilas daun dengan air bersih di pagi hari bila malamnya diguyur hujan.',
    literatureCitationId: 'ipb_bawang_moler_2021'
  });

  // Irigasi Bawang Merah: Kritis Drainase
  let irrigationStatus: IrrigationAdvisory['status'] = 'CUKUP';
  let irrigationAdvice = 'Penyiraman pagi hari dengan gembor halus secukupnya.';
  let irrigationRationale = 'Menjaga kelembapan tanah lempung berpasir tetap gembur.';

  if (tf.forecastRain24h > 20 || tf.rolling3dRain > 35) {
    irrigationStatus = 'DRAINASE_MENDESAK';
    irrigationAdvice = 'Kuras parit keliling bedengan segera! Air di parit harus berada minimal 20 cm di bawah puncak bedengan.';
    irrigationRationale = 'Bawang merah tidak mentolerir genangan air sama sekali; umbi akan melepuh dan membusuk.';
    recommendations.push({
      id: 'rec_bawang_drainase',
      category: 'PENGATURAN_IRIGASI',
      title: 'Pembersihan & Pendalaman Saluran Parit Bedengan',
      urgency: 'HARI_INI',
      riskLevel: 'TINGGI',
      action: 'Buka pintu pembuangan air dan bersihkan endapan lumpur pada parit keliling.',
      rationale: `Prakiraan curah hujan ${tf.forecastRain24h} mm akan merendam umbi bawang bila saluran tersumbat.`,
      growthStageContext: stage.name,
      evidenceCitationId: 'ipb_bawang_moler_2021',
      literatureSource: 'IPB University'
    });
  }

  const safeForFertilizer = tf.forecastRain24h < 15;
  const fertAdvisory: FertilizationAdvisory = {
    safeToApply: safeForFertilizer,
    status: safeForFertilizer ? 'AMAN' : 'TUNDA_KARENA_HUJAN',
    reason: safeForFertilizer
      ? 'Aman untuk pemupukan susulan kalium sulfat (ZK).'
      : `Prakiraan hujan ${tf.forecastRain24h} mm berisiko melarutkan pupuk dan memicu pembusukan leher batang.`,
    recommendedNutrient: stage.keyNutrientNeed
  };

  const overallRisk: RiskLevel = diseaseRisks.some(d => d.level === 'TINGGI') || irrigationStatus === 'DRAINASE_MENDESAK' ? 'TINGGI' : 'SEDANG';
  const temporalSummary = `Lag Hujan Kemarin: ${tf.lag1Rain} mm | Hujan 3 Hari: ${tf.rolling3dRain} mm | Suhu: ${current.temperature}°C`;

  return {
    overallRisk,
    diseaseRisks,
    irrigation: {
      status: irrigationStatus,
      soilMoistureIndexPercent: Math.min(100, Math.round(40 + tf.rolling3dRain * 1.8)),
      recommendation: irrigationAdvice,
      rationale: irrigationRationale
    },
    fertilization: fertAdvisory,
    recommendations,
    temporalSummary
  };
}

// ----------------------------------------------------
// 4. ENGINE JAGUNG (Zea mays L.)
// ----------------------------------------------------
export function evaluateJagungEngine(
  stage: GrowthStage,
  hst: number,
  tf: TemporalFeatures,
  current: CurrentWeather,
  _forecast: DailyForecast[]
): CropEvaluationOutput {
  const recommendations: ActionableRecommendation[] = [];
  const diseaseRisks: DiseaseRiskAssessment[] = [];

  // Model Hama Ulat Grayak (Spodoptera frugiperda / FAW)
  // Berkembang pesat saat cuaca hangat 25-30°C dan hujan ringan/intermiten
  let fawScore = 25;
  const fawFactors: string[] = [];

  if (current.temperature >= 25 && current.temperature <= 30) {
    fawScore += 30;
    fawFactors.push(`Suhu optimum perkembangbiakan ngengat & larva FAW (${current.temperature}°C)`);
  }
  if (tf.consecutiveDryDays >= 3) {
    fawScore += 25;
    fawFactors.push(`Tidak ada hujan lebat yang membilas larva dari pucuk tanaman`);
  }
  if (stage.id === 'j_veg_early' || stage.id === 'j_veg_fast') {
    fawScore += 20;
    fawFactors.push('Fase vegetatif menyediakan pucuk daun muda yang disukai larva instar awal');
  }

  const fawLevel: RiskLevel = fawScore >= 70 ? 'TINGGI' : fawScore >= 40 ? 'SEDANG' : 'RENDAH';
  diseaseRisks.push({
    diseaseId: 'ulat_grayak_faw',
    diseaseName: 'Ulat Grayak Jagung (FAW)',
    pathogen: 'Spodoptera frugiperda',
    level: fawLevel,
    score: fawScore,
    reason: fawLevel === 'TINGGI'
      ? 'Suhu hangat dan cuaca kering intermiten mempercepat siklus generasi larva ulat grayak.'
      : 'Populasi hama ulat dalam ambang batas terkendali.',
    triggerFactors: fawFactors,
    preventiveAdvice: 'Periksa corong pucuk tanaman; cari tanda lubang gerekan dan serbuk gergaji basah.',
    literatureCitationId: 'balitkabi_jagung_faw_2022'
  });

  if (fawLevel === 'TINGGI') {
    recommendations.push({
      id: 'rec_jagung_faw',
      category: 'PROTEKSI_PENYAKIT',
      title: 'Inspeksi & Pengendalian Corong Pucuk Ulat Grayak FAW',
      urgency: 'HARI_INI',
      riskLevel: 'TINGGI',
      action: 'Aplikasi insektisida berbahan aktif Emamektin Benzoat atau Klorantraniliprol tepat mengarah ke dalam corong pucuk daun pada sore hari.',
      rationale: 'Larva bersembunyi di dalam corong daun saat siang hari dan aktif merusak titik tumbuh di senja hari (BRIN, 2022).',
      growthStageContext: `Fase ${stage.name} (HST ${hst})`,
      evidenceCitationId: 'balitkabi_jagung_faw_2022',
      literatureSource: 'Pusat Riset Tanaman Pangan BRIN'
    });
  }

  // Cekaman Air Fase Silking (HST 46-60)
  let irrigationStatus: IrrigationAdvisory['status'] = 'CUKUP';
  let irrigationAdvice = 'Ketersediaan air memadai untuk pertumbuhan vegetatif.';
  let irrigationRationale = 'Evapotranspirasi tercukupi.';

  if (stage.id === 'j_silking' && tf.consecutiveDryDays >= 4) {
    irrigationStatus = 'BUTUH_PENGAIRAN';
    irrigationAdvice = 'Lakukan pengairan leb alur segera! Jagung sedang fase keluar malai dan rambut tongkol.';
    irrigationRationale = 'Kekeringan pada fase pembungaan (silking) menyebabkan rambut tongkol layu dan biji tidak terbentuk (bogor).';
    recommendations.push({
      id: 'rec_jagung_irigasi_silking',
      category: 'PENGATURAN_IRIGASI',
      title: 'Irigasi Kritis Fase Keluar Rambut Tongkol (Silking)',
      urgency: 'HARI_INI',
      riskLevel: 'TINGGI',
      action: 'Alirkan air ke dalam alur bedengan hingga tanah basah merata.',
      rationale: 'Stres air selama 4 hari pada fase silking dapat menurunkan hasil panen hingga 40% (FAO-56).',
      growthStageContext: `HST ${hst} - Silking R1`,
      evidenceCitationId: 'ipb_irigasi_vpd_2021',
      literatureSource: 'IPB University'
    });
  }

  const safeForFertilizer = tf.forecastRain24h < 25;
  const fertAdvisory: FertilizationAdvisory = {
    safeToApply: safeForFertilizer,
    status: safeForFertilizer ? 'AMAN' : 'TUNDA_KARENA_HUJAN',
    reason: safeForFertilizer
      ? 'Kondisi cuaca aman untuk penaburan pupuk Urea susulan.'
      : 'Prakiraan hujan lebat berisiko mencuci pupuk urea.',
    recommendedNutrient: stage.keyNutrientNeed
  };

  const overallRisk: RiskLevel = fawLevel === 'TINGGI' || irrigationStatus === 'BUTUH_PENGAIRAN' ? 'TINGGI' : 'SEDANG';
  const temporalSummary = `Hari Kering: ${tf.consecutiveDryDays} hari | Suhu Saat Ini: ${current.temperature}°C | VPD: ${tf.currentVPD} kPa`;

  return {
    overallRisk,
    diseaseRisks,
    irrigation: {
      status: irrigationStatus,
      soilMoistureIndexPercent: Math.max(20, Math.min(100, Math.round(70 - tf.consecutiveDryDays * 8 + tf.rolling3dRain))),
      recommendation: irrigationAdvice,
      rationale: irrigationRationale
    },
    fertilization: fertAdvisory,
    recommendations,
    temporalSummary
  };
}

// ----------------------------------------------------
// 5. ENGINE TOMAT (Solanum lycopersicum L.)
// ----------------------------------------------------
export function evaluateTomatEngine(
  stage: GrowthStage,
  hst: number,
  tf: TemporalFeatures,
  current: CurrentWeather,
  _forecast: DailyForecast[]
): CropEvaluationOutput {
  const recommendations: ActionableRecommendation[] = [];
  const diseaseRisks: DiseaseRiskAssessment[] = [];

  // Model Hawar Daun / Late Blight (Phytophthora infestans)
  // Sangat berbahaya pada dataran tinggi sejuk (16-22°C) dengan RH >= 88% dan hujan berkepanjangan
  let blightScore = 20;
  const blightFactors: string[] = [];

  if (current.temperature >= 15 && current.temperature <= 22) {
    blightScore += 30;
    blightFactors.push(`Suhu udara sejuk khas dataran tinggi (${current.temperature}°C)`);
  }
  if (tf.rolling7dRH >= 88) {
    blightScore += 35;
    blightFactors.push(`Kelembapan relatif udara jenuh (${tf.rolling7dRH}% RH)`);
  }
  if (tf.consecutiveRainyDays >= 2) {
    blightScore += 25;
    blightFactors.push(`Hujan turun ${tf.consecutiveRainyDays} hari berturut-turut`);
  }

  const blightLevel: RiskLevel = blightScore >= 70 ? 'TINGGI' : blightScore >= 40 ? 'SEDANG' : 'RENDAH';
  diseaseRisks.push({
    diseaseId: 'busuk_daun_phytophthora',
    diseaseName: 'Hawar Daun / Busuk Kering (Late Blight)',
    pathogen: 'Phytophthora infestans',
    level: blightLevel,
    score: blightScore,
    reason: blightLevel === 'TINGGI'
      ? 'Kondisi mikroklimat dingin-lembap memenuhi kriteria sporulasi agresif Phytophthora infestans.'
      : 'Tekanan hawar daun terkontrol.',
    triggerFactors: blightFactors,
    preventiveAdvice: 'Aplikasi fungisida protektif Mankozeb atau Propineb secara merata pada bawah daun.',
    literatureCitationId: 'balitsa_tomat_blight_2018'
  });

  if (blightLevel === 'TINGGI') {
    recommendations.push({
      id: 'rec_tomat_blight',
      category: 'PROTEKSI_PENYAKIT',
      title: 'Penyemprotan Protektif Hawar Daun Tomat',
      urgency: 'HARI_INI',
      riskLevel: 'TINGGI',
      action: 'Semprotkan fungisida kontak Mankozeb diselingi bahan aktif Simoksanil sebelum turun hujan lebat.',
      rationale: `Kombinasi suhu ${current.temperature}°C dan RH ${tf.rolling7dRH}% memicu sporulasi massal (Balitsa Lembang, 2018).`,
      growthStageContext: `Fase ${stage.name} (HST ${hst})`,
      evidenceCitationId: 'balitsa_tomat_blight_2018',
      literatureSource: 'Balitsa Lembang'
    });
  }

  // Model Retak Buah Fisiologis (Fruit Cracking)
  // Terjadi saat hujan lebat (> 20mm) mengguyur setelah periode hari kering (consecutiveDryDays >= 3) pada fase pembesaran buah (HST 61-80)
  if (stage.id === 't_fruiting' && tf.forecastRain24h >= 20 && tf.consecutiveDryDays >= 2) {
    recommendations.push({
      id: 'rec_tomat_cracking',
      category: 'OPERASIONAL_PANEN',
      title: 'Pencegahan Retak Buah (Fruit Cracking)',
      urgency: 'HARI_INI',
      riskLevel: 'SEDANG',
      action: 'Petik buah yang sudah memasuki fase mengkal/semburat merah lebih awal sebelum diguyur hujan deras; aplikasikan pupuk kalsium cair.',
      rationale: 'Hujan deras mendadak setelah hari kering memicu penyerapan air agresif hingga kulit buah pecah karena tekanan turgor internal.',
      growthStageContext: `Fase ${stage.name}`,
      evidenceCitationId: 'ipb_irigasi_vpd_2021',
      literatureSource: 'IPB University'
    });
  }

  const overallRisk: RiskLevel = blightLevel === 'TINGGI' ? 'TINGGI' : 'SEDANG';
  const temporalSummary = `Lag Hujan Kemarin: ${tf.lag1Rain} mm | Hujan 3 Hari: ${tf.rolling3dRain} mm | Suhu: ${current.temperature}°C | VPD: ${tf.currentVPD} kPa`;

  return {
    overallRisk,
    diseaseRisks,
    irrigation: {
      status: tf.rolling3dRain > 30 ? 'WASPADA_GENANGAN' : 'CUKUP',
      soilMoistureIndexPercent: Math.min(100, Math.round(50 + tf.rolling3dRain * 1.5)),
      recommendation: 'Jaga kelembapan tanah stabil dengan mulsa.',
      rationale: 'Fluktuasi basah-kering ekstrem memicu retak buah.'
    },
    fertilization: {
      safeToApply: tf.forecastRain24h < 20,
      status: tf.forecastRain24h < 20 ? 'AMAN' : 'TUNDA_KARENA_HUJAN',
      reason: tf.forecastRain24h < 20 ? 'Aman untuk pupuk kalsium & kalium.' : 'Prakiraan hujan tinggi.',
      recommendedNutrient: stage.keyNutrientNeed
    },
    recommendations,
    temporalSummary
  };
}
