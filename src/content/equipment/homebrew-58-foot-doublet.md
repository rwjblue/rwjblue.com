---
name: Homebrew 58-foot portable doublet
category: antennas
summary: A lightweight continuous-wire doublet with a 58-foot radiator and 28 feet of homebrew balanced feed line for portable KX2 operation from 40 through 10 meters.
status: current
state: 58 ft radiator / 28 ft balanced feed line
useContexts:
  - portable
connections:
  - elecraft-kx2
  - gigaparts-explorer-pota20
  - throw-line-kit
  - rigexpert-match-advanced
sortOrder: 32
image: /images/pota/2026-08-08-pulaski-state-park-doublet-test/antenna-center-support.jpg
imageAlt: Balanced feed line with orange spacers rising to the doublet center suspended from a tree branch
history:
  - date: "2026-08-08"
    title: Built and characterized
    details: Completed the continuous-wire radiator and feed line, then measured and modeled the first deployed system.
    note: /notes/2026-08-08-portable-58-foot-doublet/
  - date: "2026-08-08"
    title: First field test at Pulaski State Park
    details: Made 12 five-watt CW contacts on four bands, including Spain on 15 meters.
    note: /notes/2026-08-08-pulaski-state-park-doublet-test/
---

I built this doublet as a lightweight general-purpose antenna for the
[Elecraft KX2](/radio/equipment/elecraft-kx2/). Its 58-foot center-fed radiator
has two 29-foot legs, while 28 feet of homebrew balanced line carries the
feedpoint to the operating position.

The radiator and feed line use the same two continuous conductors. They pass
through a printed center and spread into the radiating legs without a splice or
connector. Small PETG spacers maintain approximately 12.7 mm conductor spacing
along the balanced section. The parameterized parts are available in the
[`lightweight_balanced_feedline` OpenSCAD model
folder](https://github.com/rwjblue/scad-lab/tree/main/models/ham_radio/lightweight_balanced_feedline),
including the
[continuous-wire center](https://github.com/rwjblue/scad-lab/blob/main/models/ham_radio/lightweight_balanced_feedline/doublet_center_strain_relief.scad)
and
[snap-on feed-line spacer](https://github.com/rwjblue/scad-lab/blob/main/models/ham_radio/lightweight_balanced_feedline/balanced_feedline_spacer.scad).

The complete antenna winds onto a lightweight printed winder and lives in a
bright Hidden Woodsmen zippered bag.

<div class="photo-grid photo-grid--single photo-grid--compact">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/antenna-bag.jpg" alt="Bright orange and yellow Hidden Woodsmen bag used to carry the homebrew portable doublet">
</div>

At the radio end, a BNC binding-post adapter connects the balanced line to a
PackTenna Mix 31 current choke, a short RG-8X jumper, and the KX2's internal
KXAT2 tuner. The antenna is intended for 40 through 10 meters rather than for a
natural 50-ohm match on every band.

The [complete build note](/notes/2026-08-08-portable-58-foot-doublet/) records
the construction, radio-end impedance measurements, radiation-pattern model,
and the reversible length experiment planned for the next round of testing.
