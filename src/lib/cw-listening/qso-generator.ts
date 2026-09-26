import type { PracticeQso } from "./qso-types.ts";

// Link recipe v1: these pool entries and templates are a public format. Append
// new choices, but do not reorder/edit existing entries or templates. Changes to
// existing material need a new recipe version, retaining the v1 renderer.

/** Illustrative calls only; these profiles do not describe the calls' real owners. */
export const QSO_CALLSIGNS = [
  "W1DPN", "K2MVR", "N3LHT", "W4JCF", "K5BZS", "N6RDM", "W7PGL", "K8VTR",
  "N9FKS", "W0HBN", "AA1LR", "AB2DX", "AC3MW", "AD4JN", "AE5RP", "AF6TV",
  "AG7DS", "AI8KC", "AJ9WF", "AK0BM", "KB1TQS", "KC2VHL", "KD3RNP", "KE4WBG",
  "KF5ZMT", "KG6BPC", "KI7NVR", "KJ8DLS", "KK9FHT", "KN0JRW",
] as const;
export const QSO_NAMES = ["BOB", "ANN", "SAM", "LIZ", "JIM", "JO", "MAYA", "BEN", "ROSE", "TOM", "ELLA", "LEE", "DAVE", "SUE", "CHRIS", "PAT", "NORA", "ERIC", "KATE", "MIGUEL"] as const;
export const QSO_LOCATIONS = [
  { city: "BOSTON", state: "MA" }, { city: "ALBANY", state: "NY" },
  { city: "RALEIGH", state: "NC" }, { city: "BOISE", state: "ID" },
  { city: "AUSTIN", state: "TX" }, { city: "DAYTON", state: "OH" },
  { city: "PORTLAND", state: "ME" }, { city: "MADISON", state: "WI" },
  { city: "TUCSON", state: "AZ" }, { city: "SPOKANE", state: "WA" },
  { city: "DES MOINES", state: "IA" }, { city: "SANTA FE", state: "NM" },
  { city: "PROVIDENCE", state: "RI" }, { city: "LANCASTER", state: "PA" },
] as const;
/** Keep power choices with the rig, rather than assigning arbitrary power to it. */
export const QSO_RADIOS = [
  { rig: "KX3", watts: [5, 10] }, { rig: "IC7300", watts: [5, 25, 50, 100] },
  { rig: "FT891", watts: [10, 25, 50, 100] }, { rig: "K2", watts: [5, 10] },
  { rig: "QCX", watts: [3, 5] }, { rig: "FT817", watts: [2, 5] },
] as const;
export const QSO_ANTENNAS = ["DIPOLE UP 30 FT", "DIPOLE UP 40 FT", "VERTICAL", "EFHW UP 25 FT", "LOOP", "END FED WIRE"] as const;
export const QSO_WEATHER = ["SUNNY TEMP 75 F", "CLOUDY TEMP 60 F", "RAIN TEMP 55 F", "CLEAR TEMP 68 F", "WINDY TEMP 50 F", "SNOW TEMP 28 F"] as const;
export const QSO_REPORTS = ["449", "459", "559", "569", "579", "589", "599"] as const;

export interface QsoStation {
  call: string;
  name: string;
  city: string;
  state: string;
  rig: string;
  watts: number;
  antenna: string;
  weather: string;
  /** The report this station sends about the other station. */
  report: string;
}
export interface QsoTemplate {
  id: string;
  kind: "qso";
  title: string;
  lines: (a: QsoStation, b: QsoStation) => string[];
}
const qth = (s: QsoStation) => `${s.city} ${s.state}`;
const turn = (sender: QsoStation, receiver: QsoStation) => `${receiver.call} DE ${sender.call}`;

export const QSO_TEMPLATES: readonly QsoTemplate[] = [
  {
    id: "short-contact", kind: "qso", title: "A first contact",
    lines: (a, b) => [
      `CQ CQ CQ DE ${a.call} ${a.call} K`,
      `${turn(b, a)} ${b.call} <KN>`,
      `${turn(a, b)} GE TNX FER CALL UR RST ${a.report} ${a.report} NAME ${a.name} ${a.name} QTH ${qth(a)} ${qth(a)} HW? ${turn(a, b)} <KN>`,
      `${turn(b, a)} R R GE ${a.name} UR RST ${b.report} ${b.report} NAME ${b.name} ${b.name} QTH ${qth(b)} ${qth(b)} TNX FER RPT ${turn(b, a)} <KN>`,
      `${turn(a, b)} R TNX ${b.name} NICE TO MEET U TNX FER QSO 73 ES CU AGN ${turn(a, b)} <SK>`,
      `${turn(b, a)} TNX ${a.name} 73 ES CU AGN ${turn(b, a)} <SK>`,
    ],
  },
  {
    id: "ragchew", kind: "qso", title: "Rigs, antennas, and weather",
    lines: (a, b) => [
      `CQ CQ DE ${a.call} ${a.call} K`,
      `${turn(b, a)} ${b.call} <KN>`,
      `${turn(a, b)} GA UR RST ${a.report} ${a.report} NAME ${a.name} ${a.name} QTH ${qth(a)} HW? ${turn(a, b)} <KN>`,
      `${turn(b, a)} R GA ${a.name} UR RST ${b.report} ${b.report} NAME ${b.name} ${b.name} QTH ${qth(b)} ${turn(b, a)} <KN>`,
      `${turn(a, b)} R ${b.name} RIG HR ${a.rig} PWR ${a.watts} WATTS ANT ${a.antenna} WX ${a.weather} HW ABT U? ${turn(a, b)} <KN>`,
      `${turn(b, a)} R TNX ${a.name} FER INFO RIG HR ${b.rig} PWR ${b.watts} WATTS ANT ${b.antenna} WX ${b.weather} ${turn(b, a)} <KN>`,
      `${turn(a, b)} R FB ${b.name} TNX FER NICE CHAT HPE CU AGN 73 ES GE ${turn(a, b)} <SK>`,
      `${turn(b, a)} TNX ${a.name} ENJOY UR DAY 73 ES CU AGN ${turn(b, a)} <SK>`,
    ],
  },
  {
    id: "pota", kind: "qso", title: "A POTA contact",
    lines: (a, b) => [
      `CQ POTA CQ POTA DE ${a.call} ${a.call} K`,
      `${b.call} ${b.call}`,
      `${turn(a, b)} UR ${a.report} ${a.report} BK`,
      `BK R R UR ${b.report} ${b.report} ${b.state} ${b.state} BK`,
      `BK TNX FER ${b.state} 73 ${turn(a, b)} K`,
      "TU 73",
    ],
  },
  {
    id: "repeat", kind: "qso", title: "Asking for a repeat",
    lines: (a, b) => [
      `CQ CQ DE ${a.call} ${a.call} K`,
      `${turn(b, a)} ${b.call} <KN>`,
      `${turn(a, b)} GE UR RST ${a.report} ${a.report} NAME ${a.name} ${a.name} QTH ${qth(a)} ${turn(a, b)} <KN>`,
      `${turn(b, a)} R GE ${a.name} UR RST ${b.report} ${b.report} NAME ${b.name} ${b.name} PSE RPT QTH QTH? ${turn(b, a)} <KN>`,
      `${turn(a, b)} R ${b.name} QTH ${a.city} ${a.city} ${a.state} ${a.state} HW CPY? ${turn(a, b)} <KN>`,
      `${turn(b, a)} R R ${qth(a)} TNX MY QTH ${qth(b)} ${qth(b)} ${turn(b, a)} <KN>`,
      `${turn(a, b)} R ${qth(b)} TNX ${b.name} FER QSO 73 ES CU AGN ${turn(a, b)} <SK>`,
      `${turn(b, a)} TNX ${a.name} 73 ${turn(b, a)} <SK>`,
    ],
  },
];

/** Sample once per station; repeated details in the script always agree. */
export function generateQso(id: string, random = Math.random, previousCalls: readonly string[] = []): PracticeQso {
  const template = QSO_TEMPLATES.findIndex(template => template.id === id);
  if (template < 0) throw new Error("Choose a QSO template from the list.");
  function pick(values: readonly unknown[], excluded: number[] = []): number {
    const indexes = values.map((_, index) => index).filter(index => !excluded.includes(index));
    return indexes[Math.floor(random() * indexes.length)];
  }
  const previous = QSO_CALLSIGNS.flatMap((call, index) => previousCalls.includes(call) ? [index] : []);
  const first = pick(QSO_CALLSIGNS, previous);
  const second = pick(QSO_CALLSIGNS, [...previous, first]);
  function station(call: number, names: number[] = []): number[] {
    const radio = pick(QSO_RADIOS);
    return [call, pick(QSO_NAMES, names), pick(QSO_LOCATIONS), radio,
      pick(QSO_RADIOS[radio].watts), pick(QSO_ANTENNAS), pick(QSO_WEATHER), pick(QSO_REPORTS)];
  }
  const a = station(first);
  return qsoFromRecipe(encodeRecipe(template, a, station(second, [a[1]])));
}

function encodeRecipe(template: number, a: number[], b: number[]): string {
  return [1, template, ...a, ...b].map(index => index.toString(36)).join(".");
}

/** v1: version, template, then call/name/QTH/rig/power/antenna/weather/RST per station. */
export function qsoFromRecipe(recipe: string): PracticeQso {
  const invalid = () => { throw new Error("This QSO link is invalid or uses an unsupported version."); };
  if (typeof recipe !== "string" || recipe.length > 128
    || !/^[0-9a-z]+(?:\.[0-9a-z]+){17}$/.test(recipe)) return invalid();
  const values = recipe.split(".").map(value => parseInt(value, 36));
  if (values[0] !== 1 || values.map(value => value.toString(36)).join(".") !== recipe) return invalid();
  const template = QSO_TEMPLATES[values[1]];
  if (!template) return invalid();
  function station([call, name, location, radio, power, antenna, weather, report]: number[]): QsoStation {
    const rig = QSO_RADIOS[radio];
    if (!QSO_CALLSIGNS[call] || !QSO_NAMES[name] || !QSO_LOCATIONS[location] || !rig
      || rig.watts[power] === undefined || !QSO_ANTENNAS[antenna] || !QSO_WEATHER[weather] || !QSO_REPORTS[report]) return invalid();
    return { call: QSO_CALLSIGNS[call], name: QSO_NAMES[name], ...QSO_LOCATIONS[location], rig: rig.rig,
      watts: rig.watts[power], antenna: QSO_ANTENNAS[antenna], weather: QSO_WEATHER[weather], report: QSO_REPORTS[report] };
  }
  const a = station(values.slice(2, 10));
  const b = station(values.slice(10));
  if (a.call === b.call || a.name === b.name) return invalid();
  return { id: template.id, title: template.title, stations: [a.call, b.call], lines: template.lines(a, b), recipe };
}

/** Recover indexes for saved exchanges that predate recipes, without changing text. */
export function shareableQsoRecipe(qso: PracticeQso): string | undefined {
  const matches = (recipe: string) => {
    try {
      const rebuilt = qsoFromRecipe(recipe);
      return rebuilt.id === qso.id && JSON.stringify(rebuilt.stations) === JSON.stringify(qso.stations)
        && JSON.stringify(rebuilt.lines) === JSON.stringify(qso.lines);
    } catch { return false; }
  };
  if (qso.recipe && matches(qso.recipe)) return qso.recipe;
  const template = QSO_TEMPLATES.findIndex(template => template.id === qso.id);
  if (template < 0) return;
  const stations = qso.stations.map((call, index) => {
    const text = qso.lines.filter((_, line) => line % 2 === index).join(" ");
    const name = QSO_NAMES.findIndex(name => text.includes(`NAME ${name} ${name}`));
    const location = QSO_LOCATIONS.findIndex(({ city, state }) => text.includes(`QTH ${city} ${state}`)
      || (qso.id === "pota" && text.includes(` ${state} ${state} BK`)));
    const radio = QSO_RADIOS.findIndex(({ rig }) => text.includes(`RIG HR ${rig} PWR`));
    const rig = QSO_RADIOS[Math.max(0, radio)];
    return [QSO_CALLSIGNS.findIndex(value => value === call), name < 0 ? index : name, Math.max(0, location), Math.max(0, radio),
      Math.max(0, rig.watts.findIndex(watts => text.includes(`PWR ${watts} WATTS`))),
      Math.max(0, QSO_ANTENNAS.findIndex(antenna => text.includes(`ANT ${antenna} WX`))),
      Math.max(0, QSO_WEATHER.findIndex(weather => text.includes(`WX ${weather} `))),
      Math.max(0, QSO_REPORTS.findIndex(report => text.includes(`UR RST ${report} ${report}`) || text.includes(`UR ${report} ${report}`)))];
  });
  const recipe = encodeRecipe(template, stations[0], stations[1]);
  if (!matches(recipe)) return;
  qso.recipe = recipe;
  return recipe;
}
