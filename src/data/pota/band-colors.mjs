export const BAND_COLORS = {
  "160m": "#b402cc",
  "80m": "#6e20f5",
  "60m": "#1e3deb",
  "40m": "#1686f0",
  "30m": "#15c2bc",
  "20m": "#49c215",
  "17m": "#b9d624",
  "15m": "#f2f211",
  "12m": "#e69119",
  "10m": "#e66119",
  "6m": "#eb1018",
  "2m": "#eb1018",
  "70cm": "#7e10eb",
  other: "#000000",
};

export function bandColor(band) {
  return BAND_COLORS[String(band ?? "").toLowerCase()] ?? BAND_COLORS.other;
}
