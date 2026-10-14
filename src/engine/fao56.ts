/**
 * Pure TypeScript implementation of FAO-56 Penman-Monteith Reference Evapotranspiration (ET0).
 * Reference: Allen et al. (1998), FAO Irrigation and Drainage Paper 56, Chapter 2/4, Eq. 6.
 */

export function wind2m(wind10mMs: number): number {
  // FAO-56 Eq. 47
  return wind10mMs * (4.87 / Math.log(67.8 * 10.0 - 5.42));
}

export function saturationVaporPressure(tempC: number): number {
  // FAO-56 Eq. 11
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

export function deltaSvp(tempC: number): number {
  // FAO-56 Eq. 13
  const es = saturationVaporPressure(tempC);
  return (4098.0 * es) / Math.pow(tempC + 237.3, 2);
}

export function atmosphericPressureKpa(elevationM: number): number {
  // FAO-56 Eq. 7
  return 101.3 * Math.pow((293.0 - 0.0065 * elevationM) / 293.0, 5.26);
}

export function extraterrestrialRadiation(latitudeDeg: number, dayOfYear: number): number {
  // FAO-56 Eq. 21-28
  const phi = (latitudeDeg * Math.PI) / 180.0;
  const dr = 1.0 + 0.033 * Math.cos((2.0 * Math.PI * dayOfYear) / 365.0);
  const delta = 0.409 * Math.sin((2.0 * Math.PI * dayOfYear) / 365.0 - 1.39);
  const tanProd = -Math.tan(phi) * Math.tan(delta);
  const sunsetAngle = Math.acos(Math.max(-1.0, Math.min(1.0, tanProd)));

  const gsc = 0.0820; // MJ m-2 min-1
  return (
    ((24.0 * 60.0) / Math.PI) *
    gsc *
    dr *
    (sunsetAngle * Math.sin(phi) * Math.sin(delta) +
      Math.cos(phi) * Math.cos(delta) * Math.sin(sunsetAngle))
  );
}

export function calculateDailyET0(
  tmaxC: number,
  tminC: number,
  dewpointC: number,
  wind10mMs: number,
  solarRadiationMjM2Day: number,
  elevationM: number,
  latitudeDeg: number,
  dayOfYear: number
): number {
  const tmean = (tmaxC + tminC) / 2.0;
  const es = (saturationVaporPressure(tmaxC) + saturationVaporPressure(tminC)) / 2.0;
  const ea = saturationVaporPressure(dewpointC);
  const delta = deltaSvp(tmean);
  const p = atmosphericPressureKpa(elevationM);
  const gamma = 0.000665 * p; // FAO-56 Eq. 8
  const u2 = wind2m(wind10mMs);

  const ra = extraterrestrialRadiation(latitudeDeg, dayOfYear);
  const rso = (0.75 + 2e-5 * elevationM) * ra; // FAO-56 Eq. 37
  const rs = Math.max(0.0, solarRadiationMjM2Day);
  const rns = 0.77 * rs; // FAO-56 Eq. 38, albedo = 0.23

  const sigma = 4.903e-9; // Stefan-Boltzmann constant, MJ K-4 m-2 day-1
  const tmaxK4 = Math.pow(tmaxC + 273.16, 4);
  const tminK4 = Math.pow(tminC + 273.16, 4);
  const rnl =
    sigma *
    ((tmaxK4 + tminK4) / 2.0) *
    (0.34 - 0.14 * Math.sqrt(Math.max(ea, 0.0))) *
    (1.35 * Math.min(rs / Math.max(rso, 1e-4), 1.0) - 0.35);

  const rn = rns - rnl; // Net radiation, G = 0 for daily steps (Eq. 42)

  const numerator =
    0.408 * delta * rn + gamma * (900.0 / (tmean + 273.0)) * u2 * Math.max(es - ea, 0.0);
  const denominator = delta + gamma * (1.0 + 0.34 * u2);

  return Math.max(0.0, numerator / denominator);
}

export function validateFao56Example18(): number {
  // FAO-56 Example 18 (Uccle/Brussels, Belgium benchmark target: 3.88 mm/day)
  const delta = 0.122;
  const gamma = 0.0666;
  const u2 = 2.078;
  const es = 1.997;
  const ea = 1.409;
  const rn = 13.28;
  const tmean = 16.9;

  const benchmark =
    (0.408 * delta * rn + gamma * (900.0 / (tmean + 273.0)) * u2 * (es - ea)) /
    (delta + gamma * (1.0 + 0.34 * u2));

  return benchmark;
}
