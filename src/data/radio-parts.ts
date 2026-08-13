export type RadioPartCategory =
  | "ferrites"
  | "connectors"
  | "terminations"
  | "capacitors"
  | "protection"
  | "test-loads";

export interface RadioPart {
  id: string;
  name: string;
  category: RadioPartCategory;
  manufacturer: string;
  manufacturerPartNumber: string;
  digikeyPartNumber: string;
  stock: {
    onHand: number;
    incoming: number;
    asOf: string;
  };
  specification: string;
  dimensions?: string;
  intendedUse: string;
  material?: "31" | "43";
  massGramsEach?: number;
  productUrl: string;
  datasheetUrl?: string;
}

export interface RadioPartCategoryDefinition {
  id: RadioPartCategory;
  label: string;
  description: string;
}

export const RADIO_PART_CATEGORIES: RadioPartCategoryDefinition[] = [
  {
    id: "ferrites",
    label: "Ferrite cores",
    description:
      "Mix 43 toroids for transformer experiments and Mix 31 cores for common-mode suppression.",
  },
  {
    id: "connectors",
    label: "RF connectors",
    description:
      "A repeatable panel connector for printed feedpoints and small enclosures.",
  },
  {
    id: "terminations",
    label: "Wire terminations",
    description:
      "Terminals sized for the lightweight wire used in portable antennas.",
  },
  {
    id: "capacitors",
    label: "RF capacitors",
    description:
      "Stable high-voltage capacitors for broadband-transformer compensation experiments.",
  },
  {
    id: "protection",
    label: "Mechanical protection",
    description:
      "Adhesive-lined heat shrink for strain relief and weather-resistant transitions.",
  },
  {
    id: "test-loads",
    label: "Transformer test loads",
    description:
      "Low-power analyzer terminations for checking common transformer ratios.",
  },
];

export const RADIO_PARTS: RadioPart[] = [
  {
    id: "fair-rite-5943000301",
    name: "FT-50-43 toroid",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "5943000301",
    digikeyPartNumber: "1934-1095-ND",
    stock: { onHand: 0, incoming: 10, asOf: "2026-08-13" },
    specification: "Mix 43 toroid; AL 440 nH +/-20%",
    dimensions: "12.7 mm OD x 7.15 mm ID x 4.9 mm high",
    intendedUse:
      "Tiny RF-transformer experiments where minimum size matters more than power margin.",
    material: "43",
    massGramsEach: 2,
    productUrl: "https://fair-rite.com/product/toroids-5943000301/",
    datasheetUrl:
      "/downloads/radio/parts/fair-rite-5943000301-datasheet.pdf",
  },
  {
    id: "fair-rite-5943000601",
    name: "FT-82-43 toroid",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "5943000601",
    digikeyPartNumber: "1934-1258-ND",
    stock: { onHand: 0, incoming: 15, asOf: "2026-08-13" },
    specification: "Mix 43 toroid; AL 470 nH +/-20%",
    dimensions: "21 mm OD x 13.2 mm ID x 6.35 mm high",
    intendedUse:
      "Compact QRP transformer builds where packed size and weight are the priority.",
    material: "43",
    massGramsEach: 6.4,
    productUrl: "https://fair-rite.com/product/toroids-5943000601/",
    datasheetUrl:
      "/downloads/radio/parts/fair-rite-5943000601-datasheet.pdf",
  },
  {
    id: "fair-rite-5943001001",
    name: "FT-114-43 toroid",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "5943001001",
    digikeyPartNumber: "1934-1590-ND",
    stock: { onHand: 0, incoming: 25, asOf: "2026-08-13" },
    specification: "Mix 43 toroid; AL 510 nH +/-20%",
    dimensions: "29 mm OD x 19 mm ID x 7.5 mm high",
    intendedUse:
      "Default starting size for portable 4:1, 9:1, and small 49:1 transformer experiments.",
    material: "43",
    massGramsEach: 13,
    productUrl: "https://fair-rite.com/product/toroids-5943001001/",
    datasheetUrl:
      "/downloads/radio/parts/fair-rite-5943001001-datasheet.pdf",
  },
  {
    id: "fair-rite-5943002701",
    name: "FT-140-43 toroid",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "5943002701",
    digikeyPartNumber: "1934-1221-ND",
    stock: { onHand: 0, incoming: 2, asOf: "2026-08-13" },
    specification: "Mix 43 toroid; AL 885 nH +/-20%",
    dimensions: "35.55 mm OD x 23 mm ID x 12.7 mm high",
    intendedUse:
      "Larger portable transformer builds where extra thermal and winding margin is wanted.",
    material: "43",
    massGramsEach: 33,
    productUrl: "https://fair-rite.com/product/toroids-5943002701/",
    datasheetUrl:
      "/downloads/radio/parts/fair-rite-5943002701-datasheet.pdf",
  },
  {
    id: "fair-rite-2631800302",
    name: "Small Mix 31 suppression toroid",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "2631800302",
    digikeyPartNumber: "1934-2631800302-ND",
    stock: { onHand: 0, incoming: 2, asOf: "2026-08-13" },
    specification: "Mix 31 burnished suppression toroid",
    dimensions: "12.7 mm OD x 7.15 mm ID x 4.78 mm high",
    intendedUse:
      "Small-wire and cable suppression experiments where only a few turns will fit.",
    material: "31",
    massGramsEach: 1.9,
    productUrl:
      "https://fair-rite.com/product/toroidal-suppression-core-2631800302/",
    datasheetUrl:
      "https://fair-rite.com/printer_friendly_datasheet.php?part=2631800302",
  },
  {
    id: "fair-rite-2631801802",
    name: "Medium Mix 31 suppression toroid",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "2631801802",
    digikeyPartNumber: "1934-2631801802-ND",
    stock: { onHand: 0, incoming: 5, asOf: "2026-08-13" },
    specification: "Mix 31 burnished suppression toroid",
    dimensions: "22.1 mm OD x 13.7 mm ID x 6.35 mm high",
    intendedUse:
      "Compact common-mode choke experiments with lightweight coax or paired conductors.",
    material: "31",
    massGramsEach: 7,
    productUrl:
      "https://fair-rite.com/product/toroidal-suppression-core-2631801802/",
    datasheetUrl:
      "https://fair-rite.com/printer_friendly_datasheet.php?part=2631801802",
  },
  {
    id: "fair-rite-2631801202",
    name: "Large Mix 31 suppression toroid",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "2631801202",
    digikeyPartNumber: "1934-1160-ND",
    stock: { onHand: 0, incoming: 5, asOf: "2026-08-13" },
    specification: "Mix 31 burnished suppression toroid; 88 ohms typical at 100 MHz",
    dimensions: "29 mm OD x 19 mm ID x 13.85 mm high",
    intendedUse:
      "Multi-turn 1:1 current chokes and feedline common-mode suppression experiments.",
    material: "31",
    massGramsEach: 25,
    productUrl:
      "https://fair-rite.com/product/toroidal-suppression-core-2631801202/",
    datasheetUrl:
      "/downloads/radio/parts/fair-rite-2631801202-datasheet.pdf",
  },
  {
    id: "fair-rite-2631803802",
    name: "2.4-inch Mix 31 cable core",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "2631803802",
    digikeyPartNumber: "1934-1100-ND",
    stock: { onHand: 0, incoming: 1, asOf: "2026-08-13" },
    specification: "Mix 31 round cable core; 119 ohms typical at 100 MHz",
    dimensions: "61 mm OD x 35.55 mm ID x 12.7 mm long",
    intendedUse:
      "Large-aperture common-mode choke tests with coax loops or bundled station cables.",
    material: "31",
    massGramsEach: 118,
    productUrl:
      "https://fair-rite.com/product/round-cable-emi-suppression-cores-2631803802/",
    datasheetUrl:
      "/downloads/radio/parts/fair-rite-2631803802-datasheet.pdf",
  },
  {
    id: "fair-rite-2631250202",
    name: "Small Mix 31 coax sleeve",
    category: "ferrites",
    manufacturer: "Fair-Rite",
    manufacturerPartNumber: "2631250202",
    digikeyPartNumber: "1934-1413-ND",
    stock: { onHand: 0, incoming: 25, asOf: "2026-08-13" },
    specification: "Mix 31 shield bead; 230 ohms typical at 100 MHz",
    dimensions: "6.35 mm OD x 2.95 mm nominal ID x 25.4 mm long",
    intendedUse:
      "Strings of sleeves over lightweight coax such as RG-174 or RG-316 for compact chokes.",
    material: "31",
    massGramsEach: 2.9,
    productUrl:
      "https://fair-rite.com/product/round-cable-emi-suppression-cores-2631250202/",
    datasheetUrl:
      "/downloads/radio/parts/fair-rite-2631250202-datasheet.pdf",
  },
  {
    id: "amphenol-031-221-rfx",
    name: "BNC female panel connector",
    category: "connectors",
    manufacturer: "Amphenol RF",
    manufacturerPartNumber: "031-221-RFX",
    digikeyPartNumber: "ARFX1064-ND",
    stock: { onHand: 0, incoming: 10, asOf: "2026-08-13" },
    specification: "50 ohm straight bulkhead jack; front mount; solder cup; 4 GHz max",
    dimensions: "See customer drawing for panel cutout and thread dimensions",
    intendedUse:
      "Standard connector for printed feedpoints, transformer boxes, and small antenna centers.",
    productUrl: "https://www.amphenolrf.com/en-us/part/031-221-rfx/1986/",
    datasheetUrl:
      "/downloads/radio/parts/amphenol-031-221-rfx-customer-drawing.pdf",
  },
  {
    id: "te-31428",
    name: "#4 uninsulated ring terminal",
    category: "terminations",
    manufacturer: "TE Connectivity",
    manufacturerPartNumber: "31428",
    digikeyPartNumber: "A27148-ND",
    stock: { onHand: 0, incoming: 50, asOf: "2026-08-13" },
    specification: "26-22 AWG; #4 stud; tin-plated copper; closed barrel",
    dimensions: "11.43 mm long; 5.16 mm wide; 3.02 mm stud diameter",
    intendedUse:
      "Small antenna elements, transformer windings, and hardware sized around #4 fasteners.",
    productUrl: "https://www.te.com/en/product-31428-2.html",
    datasheetUrl: "/downloads/radio/parts/te-solistrand-terminals-guide.pdf",
  },
  {
    id: "panduit-p22-6r-m",
    name: "#6 uninsulated ring terminal",
    category: "terminations",
    manufacturer: "Panduit",
    manufacturerPartNumber: "P22-6R-M",
    digikeyPartNumber: "298-10424-ND",
    stock: { onHand: 0, incoming: 25, asOf: "2026-08-13" },
    specification: "26-22 AWG; #6 stud; tin-plated copper; brazed seam",
    dimensions: "13.21 mm long; 5.2 mm wide; 0.51 mm thick",
    intendedUse:
      "Lightweight antenna wire and transformer leads terminating at #6 hardware.",
    productUrl:
      "https://www.panduit.com/en/products/wire-termination/terminals/ring-terminals/p22-6r-m.html",
    datasheetUrl: "/downloads/radio/parts/panduit-p22-6r-m-datasheet.pdf",
  },
  {
    id: "molex-190700007",
    name: "#4 insulated ring terminal",
    category: "terminations",
    manufacturer: "Molex",
    manufacturerPartNumber: "0190700007",
    digikeyPartNumber: "WM18272-ND",
    stock: { onHand: 0, incoming: 25, asOf: "2026-08-13" },
    specification: "InsulKrimp; 22-18 AWG; #3-#4 (M2.6) stud; tin-plated copper",
    dimensions: "18.01 mm long; 3.7 mm maximum insulation diameter",
    intendedUse:
      "Slightly heavier feedpoint wire and wiring that benefits from an insulated crimp barrel.",
    productUrl: "https://www.molex.com/en-us/products/series-chart/19070",
  },
  {
    id: "weidmuller-9028240000",
    name: "Gray insulated wire ferrule",
    category: "terminations",
    manufacturer: "Weidmuller",
    manufacturerPartNumber: "9028240000",
    digikeyPartNumber: "281-5143-ND",
    stock: { onHand: 0, incoming: 100, asOf: "2026-08-13" },
    specification: "H0,14/12 GR SV; 26 AWG; 0.14 mm^2; 8 mm contact length",
    dimensions: "12 mm overall; 0.6 mm contact diameter; 1.5 mm collar diameter",
    intendedUse:
      "Clean ends on fine stranded antenna wire before screw terminals and binding adapters.",
    productUrl: "https://eshop.weidmueller.com/en/h01412-gr-sv/p/9028240000",
    datasheetUrl:
      "/downloads/radio/parts/weidmuller-h0-14-12-gr-sv-datasheet.pdf",
  },
  {
    id: "kemet-c330c470jhg5ta",
    name: "47 pF high-voltage capacitor",
    category: "capacitors",
    manufacturer: "KEMET",
    manufacturerPartNumber: "C330C470JHG5TA",
    digikeyPartNumber: "C330C470JHG5TA-ND",
    stock: { onHand: 0, incoming: 5, asOf: "2026-08-13" },
    specification: "47 pF +/-5%; 3 kVDC; C0G/NP0; radial leaded",
    dimensions: "7.62 x 5.08 mm body; 10.67 mm max height; 5.08 mm lead spacing",
    intendedUse:
      "Broadband-transformer compensation experiments, alone or paralleled with other values.",
    productUrl:
      "https://www.digikey.com/en/products/detail/kemet/C330C470JHG5TA/6161478",
    datasheetUrl: "/downloads/radio/parts/kemet-goldmax-300-c0g-datasheet.pdf",
  },
  {
    id: "kemet-c330c101jhg5ta",
    name: "100 pF high-voltage capacitor",
    category: "capacitors",
    manufacturer: "KEMET",
    manufacturerPartNumber: "C330C101JHG5TA",
    digikeyPartNumber: "399-5096-ND",
    stock: { onHand: 0, incoming: 5, asOf: "2026-08-13" },
    specification: "100 pF +/-5%; 3 kVDC; C0G/NP0; radial leaded",
    dimensions: "7.62 x 5.08 mm body; 10.67 mm max height; 5.08 mm lead spacing",
    intendedUse:
      "Broadband-transformer compensation experiments, alone or paralleled with other values.",
    productUrl:
      "https://www.digikey.com/en/products/detail/kemet/C330C101JHG5TA/1465601",
    datasheetUrl: "/downloads/radio/parts/kemet-goldmax-300-c0g-datasheet.pdf",
  },
  {
    id: "kemet-c330c201jhg5ta",
    name: "200 pF high-voltage capacitor",
    category: "capacitors",
    manufacturer: "KEMET",
    manufacturerPartNumber: "C330C201JHG5TA",
    digikeyPartNumber: "C330C201JHG5TA-ND",
    stock: { onHand: 0, incoming: 5, asOf: "2026-08-13" },
    specification: "200 pF +/-5%; 3 kVDC; C0G/NP0; radial leaded",
    dimensions: "7.62 x 5.08 mm body; 10.67 mm max height; 5.08 mm lead spacing",
    intendedUse:
      "Broadband-transformer compensation experiments, alone or paralleled with other values.",
    productUrl:
      "https://www.digikey.com/en/products/detail/kemet/C330C201JHG5TA/6161446",
    datasheetUrl: "/downloads/radio/parts/kemet-goldmax-300-c0g-datasheet.pdf",
  },
  {
    id: "te-atum-3-1",
    name: "ATUM 3/1 adhesive-lined heat shrink",
    category: "protection",
    manufacturer: "TE Connectivity / Raychem",
    manufacturerPartNumber: "ATUM-3/1-0-STK",
    digikeyPartNumber: "ATU031K-ND",
    stock: { onHand: 0, incoming: 1, asOf: "2026-08-13" },
    specification: "Black dual-wall irradiated polyolefin; 3:1 shrink ratio; 4 ft stick",
    dimensions: "3 mm expanded ID; 1 mm recovered ID",
    intendedUse:
      "Sealing and strain relief for fine wire, small splices, and terminal transitions.",
    productUrl: "https://www.te.com/en/product-NB10602001.html",
    datasheetUrl: "/downloads/radio/parts/te-atum-tubing-datasheet.pdf",
  },
  {
    id: "te-atum-6-2",
    name: "ATUM 6/2 adhesive-lined heat shrink",
    category: "protection",
    manufacturer: "TE Connectivity / Raychem",
    manufacturerPartNumber: "ATUM-6/2-0-STK",
    digikeyPartNumber: "ATU062K-ND",
    stock: { onHand: 0, incoming: 1, asOf: "2026-08-13" },
    specification: "Black dual-wall irradiated polyolefin; 3:1 shrink ratio; 4 ft stick",
    dimensions: "6 mm expanded ID; 2 mm recovered ID",
    intendedUse:
      "Weather-resistant finishing around small coax, terminals, and printed feedpoint hardware.",
    productUrl: "https://www.te.com/en/product-NB11652001.html",
    datasheetUrl: "/downloads/radio/parts/te-atum-tubing-datasheet.pdf",
  },
  {
    id: "te-atum-9-3",
    name: "ATUM 9/3 adhesive-lined heat shrink",
    category: "protection",
    manufacturer: "TE Connectivity / Raychem",
    manufacturerPartNumber: "ATUM-9/3-0-STK",
    digikeyPartNumber: "ATU093K-ND",
    stock: { onHand: 0, incoming: 1, asOf: "2026-08-13" },
    specification: "Black dual-wall irradiated polyolefin; 3:1 shrink ratio; 4 ft stick",
    dimensions: "9 mm expanded ID; 3 mm recovered ID",
    intendedUse:
      "Larger cable transitions, connector backs, and mechanical strain relief.",
    productUrl: "https://www.te.com/en/product-NB12042001.html",
    datasheetUrl: "/downloads/radio/parts/te-atum-tubing-datasheet.pdf",
  },
  {
    id: "yageo-mfr-49r9",
    name: "49.9 ohm analyzer load",
    category: "test-loads",
    manufacturer: "YAGEO",
    manufacturerPartNumber: "MFR-25FRF52-49R9",
    digikeyPartNumber: "13-MFR-25FRF52-49R9CT-ND",
    stock: { onHand: 0, incoming: 10, asOf: "2026-08-13" },
    specification: "49.9 ohms +/-1%; 0.25 W; metal film; axial",
    dimensions: "2.4 mm diameter x 6.3 mm body length",
    intendedUse:
      "Low-power analyzer termination for testing a nominal 1:1 transformer.",
    productUrl:
      "https://www.digikey.com/en/products/detail/yageo/MFR-25FRF52-49R9/14766",
    datasheetUrl: "/downloads/radio/parts/yageo-mfr-resistors-datasheet.pdf",
  },
  {
    id: "yageo-mfr-200r",
    name: "200 ohm analyzer load",
    category: "test-loads",
    manufacturer: "YAGEO",
    manufacturerPartNumber: "MFR-25FRF52-200R",
    digikeyPartNumber: "13-MFR-25FRF52-200RCT-ND",
    stock: { onHand: 0, incoming: 10, asOf: "2026-08-13" },
    specification: "200 ohms +/-1%; 0.25 W; metal film; axial",
    dimensions: "2.4 mm diameter x 6.3 mm body length",
    intendedUse:
      "Low-power analyzer termination for testing a nominal 4:1 impedance transformer.",
    productUrl:
      "https://www.digikey.com/en/products/detail/yageo/MFR-25FRF52-200R/14824",
    datasheetUrl: "/downloads/radio/parts/yageo-mfr-resistors-datasheet.pdf",
  },
  {
    id: "yageo-mfr-453r",
    name: "453 ohm analyzer load",
    category: "test-loads",
    manufacturer: "YAGEO",
    manufacturerPartNumber: "MFR-25FRF52-453R",
    digikeyPartNumber: "13-MFR-25FRF52-453RCT-ND",
    stock: { onHand: 0, incoming: 20, asOf: "2026-08-13" },
    specification: "453 ohms +/-1%; 0.25 W; metal film; axial",
    dimensions: "2.4 mm diameter x 6.3 mm body length",
    intendedUse:
      "Low-power analyzer termination for testing a nominal 9:1 impedance transformer.",
    productUrl:
      "https://www.digikey.com/en/products/detail/yageo/MFR-25FRF52-453R/18092332",
    datasheetUrl: "/downloads/radio/parts/yageo-mfr-resistors-datasheet.pdf",
  },
  {
    id: "yageo-mfr-2k49",
    name: "2.49 kohm analyzer load",
    category: "test-loads",
    manufacturer: "YAGEO",
    manufacturerPartNumber: "MFR-25FRF52-2K49",
    digikeyPartNumber: "13-MFR-25FRF52-2K49CT-ND",
    stock: { onHand: 0, incoming: 10, asOf: "2026-08-13" },
    specification: "2.49 kohms +/-1%; 0.25 W; metal film; axial",
    dimensions: "2.4 mm diameter x 6.3 mm body length",
    intendedUse:
      "Low-power analyzer termination for testing a nominal 49:1 impedance transformer.",
    productUrl:
      "https://www.digikey.com/en/products/detail/yageo/MFR-25FRF52-2K49/14929",
    datasheetUrl: "/downloads/radio/parts/yageo-mfr-resistors-datasheet.pdf",
  },
];

export function radioPartsByCategory() {
  return RADIO_PART_CATEGORIES.map((category) => ({
    ...category,
    parts: RADIO_PARTS.filter((part) => part.category === category.id),
  })).filter((category) => category.parts.length > 0);
}

export function ferriteInventorySummary() {
  return ["43", "31"].map((material) => {
    const parts = RADIO_PARTS.filter((part) => part.material === material);
    return {
      material,
      quantity: parts.reduce(
        (total, part) => total + part.stock.onHand + part.stock.incoming,
        0,
      ),
      massGrams: parts.reduce(
        (total, part) =>
          total +
          (part.stock.onHand + part.stock.incoming) *
            (part.massGramsEach ?? 0),
        0,
      ),
    };
  });
}
