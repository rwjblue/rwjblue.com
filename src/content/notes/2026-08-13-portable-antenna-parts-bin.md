---
title: Building a Portable Antenna Parts Bin
date: 2026-08-13
summary: "My first portable doublet made me want to build more antennas, so I stocked the small parts that make it easier to keep experimenting."
tags:
  - radio
  - antennas
  - builds
  - qrp
---

Building my [58-foot portable doublet](/notes/2026-08-08-portable-58-foot-doublet/)
was much more fun than I expected. I started with wire, printed the center and
feed-line spacers, assembled the whole antenna, and then used it for successful
QRP activations at
[Pulaski State Park](/notes/2026-08-08-pulaski-state-park-doublet-test/),
[Carolina Wildlife Management Area](/notes/2026-08-09-carolina-management-area-doublet/),
and [JL Curran State Park](/notes/2026-08-12-jl-curran-kh1-doublet/).

That build changed the question from “Can I make an antenna?” to “What should I
make next?”

I want to try more doublets, simple dipoles, linked dipoles, off-center-fed
dipoles, end-fed wires, random wires, Rybakov-style antennas, and whatever else
looks interesting. Most of them will be for QRP operation—usually five watts
and no more than 15 watts—so they can be light, compact, and easy to carry into
a park.

The obstacle was no longer the ideas. It was the collection of small parts
between an idea and a finished antenna: the right ferrite, a panel connector,
a terminal that actually fits thin wire, or a capacitor for one more
transformer experiment. I put together a focused
[portable antenna parts bin](/radio/equipment/parts-bin/) so I can keep building
without turning every project into another parts order.

## Ferrites for two different jobs

The largest part of the bin is ferrite, divided conceptually into two groups.

Fair-Rite Mix 43 toroids are there for impedance transformers. I chose FT-50,
FT-82, FT-114, and FT-140 sizes for experimenting with 4:1, 9:1, and 49:1
transformers for different antenna ideas. The middle sizes should suit most of
the compact QRP builds I have in mind, while the smallest are useful for
experiments and the largest leave more room for windings.

Mix 31 is there for common-mode suppression. I chose small, medium, large, and
2.4-inch toroids for winding current chokes, along with sleeves that can fit
over lightweight coax. That should let me try both conventional wound chokes
and compact strings of ferrite on RG-174- or RG-316-sized feed line.

The distinction gives me a useful starting point: Mix 43 for impedance
transformation and Mix 31 for common-mode suppression. It is not a complete
design rule, and neither the material nor the core size supplies a power rating
by itself. Performance depends on many factors, so the finished designs still
need to be measured and tested.

## Repeatable connectors and terminations

I want the electrical and mechanical interfaces to become boring in the best
possible way. A familiar connector and a few known hardware sizes mean I can
reuse printed designs, panel cutouts, and assembly techniques instead of
reinventing them for every antenna.

For the RF connection, I chose Amphenol BNC panel jacks. I followed advice from
[Vince, VE6LK](https://www.qrz.com/db/VE6LK), on the Ham Radio Workbench:
“Always go with Amphenol.” BNC is already a convenient connector for my portable
gear, and standardizing on one known part gives me reliable dimensions for
printed antenna centers and small transformer enclosures.

I also stocked ring terminals and ferrules sized for the fine stranded wire I
use in portable antennas. Much of the electrical hardware sold locally assumes
larger automotive wire. Having terminations that fit the actual conductors
should make small feedpoints cleaner and more mechanically reliable.

## Parts for transformer experiments

I added a small selection of high-voltage C0G/NP0 capacitors for transformer
compensation. Their capacitance is stable with voltage and temperature, and a
few values can be combined when I want to see whether compensation improves a
transformer's response.

I also bought metal-film resistors corresponding to common transformer ratios.
These are low-power analyzer loads, not transmitter dummy loads. They will let
me terminate a new winding with a representative resistance and measure it
before it becomes part of an antenna.

I still need to develop a good, repeatable test routine. At minimum, I want to
record the core, winding arrangement, compensation, analyzer sweep, and any
heating I observe under the intended operating conditions. Otherwise it will
be too easy to build several promising variations and forget what made one
better than another.

## The unglamorous finishing pieces

The bin also includes adhesive-lined heat shrink in several sizes. It is not
the exciting part of an antenna design, but it handles strain relief, protects
terminal joints, seals cable transitions, and helps a lightweight build survive
being packed, deployed, and packed again.

That is really the purpose of the whole parts bin. It is not a general
electronics inventory and it does not contain everything needed to make an
antenna. Wire, coax, rope, hardware, winding wire, and printed parts will still
come from elsewhere. This is the smaller collection that makes it easier to
turn those materials into different antennas.

The doublet showed me how satisfying it is to carry an antenna I built myself
into the field and make contacts with it. Now I have enough of the useful bits
and pieces on hand to follow that excitement into the next build instead of
stopping at the shopping list.
