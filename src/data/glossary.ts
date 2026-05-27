export interface GlossaryEntry {
  /** Display name for the term, shown as the label on the glossary page and in tag hints. */
  term: string;
  /** Full definition rendered on the glossary page and inside expanded tag hints. */
  body: string;
  /** If set, this entry powers a tag hint for notes tagged with this value. */
  tag?: string;
  /** Summary line used as the `<details>` label when this is the only matched tag hint. Defaults to `term`. */
  hintLabel?: string;
  /** Optional links appended to the tag hint and inlined into the glossary body. */
  links?: Array<{ label: string; href: string }>;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "POTA",
    tag: "pota",
    hintLabel: "New to POTA?",
    body: "Parks on the Air — an amateur radio program where licensed operators make contacts from designated public lands (national parks, state parks, wildlife refuges, and similar areas). Each location has a reference number. To activate a park, you log at least 10 contacts from within its boundaries. Hunters are operators who contact activators from home.",
    links: [{ label: "POTA about page", href: "https://docs.pota.app/about.html" }],
  },
  {
    term: "Activation",
    body: "A successful POTA outing at a single park — at least 10 contacts logged from within the park boundaries. The activator is the operator in the field.",
  },
  {
    term: "Rove",
    tag: "rove",
    hintLabel: "What is a rove?",
    body: "A single outing that activates multiple parks in sequence. Set up, make the required contacts, pack down, drive to the next park, repeat.",
  },
  {
    term: "Twofer",
    body: "An activation from a location that falls within two overlapping park boundaries at once, earning credit for both references with a single set of contacts.",
  },
  {
    term: "CW",
    body: "Continuous wave — Morse code transmitted by radio. CW contacts use a key or paddle to send code and are received by ear. Most contacts in field notes here are CW.",
  },
  {
    term: "QRP",
    body: "Low-power operation, conventionally 5 watts or less on CW and digital modes, 10 watts or less on voice. Most activations here run 5 watts.",
  },
  {
    term: "Pack Mule",
    body: "A POTA News & Reviews activator award for portable stations carried away from the vehicle by hiking, cycling, paddling, or another non-motorized approach. A qualifying activation needs at least 22 QSOs, and the full award requires 100 qualifying activations.",
    links: [{ label: "Pack Mule Award", href: "https://pota.news/pack-mule-award/" }],
  },
  {
    term: "Hunter",
    body: "A POTA participant who contacts activators from a fixed station, typically at home. Hunters earn credit for each unique park reference they contact.",
  },
];
