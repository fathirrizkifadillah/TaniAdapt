---
name: agro-decision-engine
description: Scientific rules and pipeline for crop-specific agro-advisory in Indonesia, transforming microclimate, temporal lag, and phenology into risk, operational decisions, and explainability.
version: 1.0.0
---

# Agro-Decision Engine Methodology

## Pipeline: Input → Feature Engineering → Crop-Specific Engine → Risk → Decision → Explanation

### 1. Temporal Feature Engineering
- **Lag Features**: $\text{Lag}_1, \text{Lag}_3, \text{Lag}_7, \text{Lag}_{14}$ for rainfall, humidity, and temperature.
- **Cumulative Rainfall**: $\sum_{t=0}^{k} R_t$ for 3, 7, and 14-day rolling windows.
- **Consecutive Rainy Days**: Count of sequential days with $R_t \ge 5\text{ mm}$.
- **Dry Spell**: Count of sequential days with $R_t < 1\text{ mm}$.
- **Vapor Pressure Deficit (VPD)**:
  $$e_s = 0.61078 \times \exp\left(\frac{17.27 \times T}{T + 237.3}\right)$$
  $$e_a = e_s \times \frac{\text{RH}}{100}$$
  $$\text{VPD} = e_s - e_a \quad [\text{kPa}]$$

### 2. Supported Indonesian Crops & Scientific Focus
1. **Cabai Merah (Capsicum annuum L.)**:
   - Disease focus: Antraknosa (*Colletotrichum spp.*), Busuk Daun (*Phytophthora capsici*).
   - Water stress focus: Bunga rontok akibat kekeringan mendadak / busuk akar akibat drainase buruk.
   - Pupuk focus: Pencegahan pencucian nitrogen (*nutrient leaching*) saat prakiraan hujan $> 25\text{ mm/24h}$.
2. **Padi Sawah (Oryza sativa L.)**:
   - Disease focus: Blas (*Magnaporthe oryzae*), Hawar Daun Bakteri (*Xanthomonas oryzae*).
   - Water management: Sistem Basah Kering Bergantian (AWD / Alternate Wetting and Drying).
3. **Bawang Merah (Allium cepa var. aggregatum)**:
   - Disease focus: Layu Fusarium / Moler (*Fusarium oxysporum*), Bercak Ungu (*Alternaria porri*).
   - Water sensitivity: Sangat rentan genangan air hujan; peringatan parit drainase prioritas.
4. **Jagung (Zea mays L.)**:
   - Stress focus: Cekaman kekeringan fase kritis berbunga/silking (R1).
   - Pest focus: Ulat Grayak Jagung (*Spodoptera frugiperda* / FAW).
5. **Tomat (Solanum lycopersicum L.)**:
   - Disease focus: Hawar Daun (*Phytophthora infestans* - Wallin index).
   - Physiological focus: Retak buah (*fruit cracking*) akibat lonjakan turgor pasca kemarau.
