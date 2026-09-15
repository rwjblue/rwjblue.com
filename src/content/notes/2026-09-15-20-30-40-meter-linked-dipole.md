---
title: Building a 20/30/40-Meter Linked Dipole
date: 2026-09-15
summary: "Printed link insulators, bullet connectors, and the first field tuning of my compact 20/30/40-meter dipole."
visibility: draft
tags:
  - radio
  - antennas
  - builds
  - linked-dipole
---

The [20-meter dipole I built with separate winders](/notes/2026-09-13-compact-20-meter-dipole/)
was always a starting point for a linked dipole. On September 15, I added the
30- and 40-meter extensions and took the assembly into the field to finish
the connectors and tune it. The longer antenna still fits on the original
winders.

I got good SWR minima on all three bands during the session: **1.09:1 on
20 meters, 1.14:1 on 30 meters, and 1.05:1 on 40 meters**. It got too dark to
recheck 20 and 30 meters after the last 40-meter adjustments, so that final
check is still on the list.

## Printed insulators and four links

I designed a set of small
[linked-dipole insulators](https://www.printables.com/model/1842032-linked-dipole-link-insulators)
with two wire holes at each end. The wire threads through those holes for
strain relief, leaving short tails below the body for the electrical
connection. The intent is for the insulator to carry the tension while the
connector tails stay relaxed.

[![Six orange printed insulators arranged in pairs labeled 20m, 30m, and 40m](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/printed-link-insulators.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/printed-link-insulators.jpg)

The labels identify the ends of the sections for each band. Each leg runs from
the feedpoint through the existing 20-meter section, a link, the 30-meter
extension, another link, and finally the 40-meter extension. That means two
electrical links per leg, or four mating connector pairs for the antenna.

The link settings are the same on both sides:

| Band | Link at the 20m label | Link at the 30m label |
| --- | --- | --- |
| 20 meters | Open | Open |
| 30 meters | Connected | Open |
| 40 meters | Connected | Connected |

The full length stays physically deployed on every band. Opening a link
disconnects the outer wire electrically; it does not remove that wire from
the supports.

## Cutting the extensions and preparing the connectors

I am using
[DX Engineering DXE-SANTW-500 wire](https://www.dxengineering.com/parts/dxe-santw-500),
a 26 AWG stranded copper-clad steel antenna wire with polyethylene insulation.
I started the additions with these cuts:

| Section added to each leg | Raw length | Pieces |
| --- | --- | --- |
| 20m to 30m extension | 2.44 m (8 ft) | 2 |
| 30m to 40m extension | 3.51 m (11 ft 6 in) | 2 |

These are **raw cutting lengths**, with allowance for routing through the
insulators, connector tails, and trimming. They are not finished antenna
dimensions. I also need to measure the existing 20-meter legs; I recorded the
original cuts and tuning adjustments, but not their final lengths.

I am using 2 mm bullet connectors, also commonly called banana connectors.
On the feedpoint-facing end of each new extension, I soldered a female
connector and covered the joint with heat-shrink tubing. Preparing those four
ends at the bench left less soldering to do while adjusting lengths in the
field.

[![An orange 30m insulator with wire threaded through both ends, a heat-shrunk female bullet connector on one tail, and unfinished wire on the other](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/assembled-link.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/assembled-link.jpg)

I left about 50-75 mm (two or three inches) of tail below the insulators so
the connectors would be easier to plug together. At this stage, the opposing
tails were unstripped. I left the male connectors for the field, after the
first length adjustments.

The connector length was part of that final adjustment. The "2 mm" describes
its diameter, not its length. I wanted to account for the metal added beyond
the wire inserted into each connector, then check the result with the
analyzer. The 20-meter measurements ended up giving me a useful example of
how much that could matter.

## A soldering lesson along the way

This took longer than I expected. I had to look up how to solder the bullet
connectors, and I also spent some time fighting my soldering iron.

I had left the tip without tinning it after the previous session, and it had
oxidized. It would still melt solder, but the solder would not wet the tip.
Getting heat into the connection became much harder than it needed to be.
[Hakko's tip-maintenance guidance](https://www.hakko.com/english/support/maintenance/detail.php?seq=180)
describes the same problem and recommends leaving solder on the tip before
switching the iron off. That is a habit I need to build.

## Choosing a shape to tune

The original 20-meter dipole taught me how much the readings could change
when I spread the legs and raised the ends. Before trimming this version, I
wanted a repeatable setup and a better idea of what would happen when a field
site required a different shape.

I used
[antenna-lab to model the linked dipole](https://github.com/rwjblue/antenna-lab/blob/main/results/linked-dipole-v1/README.md)
with the feedpoint at 10.1 m (33 ft) and the outer wire ends at approximately
1.5, 3.0, 4.6, and 6.1 m (5, 10, 15, and 20 ft), plus a flat top at the
feedpoint height. The model includes the disconnected extensions remaining
in place on the shorter bands.

The plan was to tune with the **center at 10.1 m (33 ft) and the outermost
ends at about 3.0 m (10 ft)**, then keep those lengths when changing the
deployment. Those end heights refer to the far ends of the 40-meter
extensions. The open links that end the active 20- and 30-meter sections sit
higher up the slope.

The initial study used targets of 14.135, 10.120, and 7.100 MHz. Before the
field session, I decided to favor CW more strongly. A follow-up modeling pass
suggested moving the 20- and 40-meter targets to about 14.050 and 7.060 MHz,
while keeping 30 meters around 10.120 MHz. That moved the shared low-SWR
windows across the five deployments toward the CW frequencies I want to use.
It did not make the antenna insensitive to height, and it traded away some
match higher in the phone portions.

In the field, I aimed for **14.060 MHz on 20 meters, 10.120 MHz on 30 meters,
and 7.060 MHz on 40 meters**. The linked report still describes the original
planning study; its wire dimensions and SWR predictions are not a model
calibrated to the finished antenna.

The radiation comparison gives me another reason to raise the ends when I
can. On 40 meters, going from 1.5 m to 3.0 m ends adds about 2 dB of
modeled realized gain broadside to the antenna at 20 degrees above the
horizon. Higher ends help in that direction too. The pattern changes with
band and elevation angle, so this is one useful comparison rather than a
gain improvement in every direction. Ground and wire losses remain uncertain,
and the model assumes a balanced feed without modeling the actual feed line.
I am not treating its efficiency estimates as measurements of this antenna.

There is also a practical space requirement. In the planned 33/10-foot setup,
continuing each wire's slope with cord down to a ground stake takes about
4.4 m of cord per end, before knots and adjustment allowance. Each stake is
roughly 10.3 m from the mast, making the total footprint about 20.6 m (68 ft).
A flat top needs elevated supports at both ends.

## First field tuning

I took the soldering iron and helping-hands fixture with me and worked
outward from the feedpoint: 20 meters first, then 30, then 40. That let me
adjust each extension after the section inside it was set.

The center was at 10.1 m (33 ft). I did not measure the outer ends to the
ground: they were roughly 150-300 mm (6-12 in) above my outstretched hand
over my head, and I am 1.85 m (6 ft 1 in) tall. That leaves some uncertainty
when comparing the setup with the modeled 3.0 m end height.

[![The linked dipole deployed as an inverted V on a mast above a wooded trail entrance](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/field-inverted-v.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/field-inverted-v.jpg)

### 20 meters: the connectors moved the minimum

The first scan put the minimum at 13.835 MHz. I trimmed 70 mm from each
20-meter leg, which moved it to **14.075 MHz at 1.10:1**. That was close
enough to my target to move on to the male connectors.

I forgot to add the connector allowance to the trim amount before soldering
them on. With the connectors fitted, the minimum moved down to
**14.035 MHz at 1.09:1**. At 14.075 MHz it was still only **1.11:1**, so I
left it there. My 14.060 MHz target was between those two readings, near the
bottom of the dip.

The useful lesson was to check after fitting the actual connectors. In this
session, that step shifted the minimum by 40 kHz. It gave me a practical
sense of their effect without pretending I had measured their physical
length or established a universal allowance.

[![Wire and a printed link insulator held in an orange helping-hands fixture beside a soldering iron on a field table](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/field-soldering.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/field-soldering.jpg)

### 30 meters: leave room for the outer connectors

With the first links connected and the full 2.44 m extension blanks still in
place, the minimum was at 9.505 MHz. After trimming, I reached
**10.135 MHz at 1.15:1**, before fitting the outer male connectors.

That was only 15 kHz above the 10.120 MHz target. The outer connectors still
had to be fitted, so I wanted another scan before deciding on more trimming.
The later scan was **10.125 MHz at 1.14:1**, with a shallow curve across the
30-meter band.

### 40 meters: smaller cuts near the target

With both sets of links connected, the first 40-meter minimum was at
6.760 MHz. There was no new bullet connector to add at these outer ends.
Trimming brought the minimum up through 7.020 and 7.044 MHz, then to
**7.064 MHz at 1.05:1**. At **7.100 MHz**, the analyzer read **1.16:1**.

That put the minimum only 4 kHz above my CW target, which was a good place to
stop cutting.

[![A connected bullet link hanging in a relaxed loop below its orange insulator, with the antenna wire extending from both ends](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/connected-link-deployed.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/connected-link-deployed.jpg)

## Readings from the session

These are analyzer readings from the individual tuning stages. The 20- and
30-meter scans preceded the final 40-meter trims; I did not repeat them
afterward because it had become too dark.

| Band | Minimum at | SWR | Other reading |
| --- | --- | --- | --- |
| 20m | 14.035 MHz | 1.09:1 | 1.11:1 at 14.075 MHz |
| 30m | 10.125 MHz | 1.14:1 | |
| 40m | 7.064 MHz | 1.05:1 | 1.16:1 at 7.100 MHz |

[![20-meter analyzer sweep showing minimum SWR of 1.09 at 14.035 MHz and 1.11 at 14.075 MHz](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/20m-swr-with-connectors.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/20m-swr-with-connectors.jpg)

<div class="photo-grid">
  <a href="/images/radio/2026-09-15-20-30-40-meter-linked-dipole/30m-swr.jpg"><img src="/images/radio/2026-09-15-20-30-40-meter-linked-dipole/30m-swr.jpg" alt="30-meter analyzer sweep showing minimum SWR of 1.14 at 10.125 MHz"></a>
  <a href="/images/radio/2026-09-15-20-30-40-meter-linked-dipole/40m-swr.jpg"><img src="/images/radio/2026-09-15-20-30-40-meter-linked-dipole/40m-swr.jpg" alt="40-meter analyzer sweep showing minimum SWR of 1.05 at 7.064 MHz and 1.16 at 7.100 MHz"></a>
</div>

The wire sections were all deployed in line throughout the session. I expect
that to help make the earlier readings representative, but the final recheck
will establish what changed after the outer sections were shortened. These
SWR scans also do not measure radiation efficiency or establish how the
antenna will behave at every end height.

## Still compact, with a few checks left

The extra wire and insulators still pack with the original BNC center and
separate nesting winders. Keeping that arrangement was one of the things I
wanted from this build.

[![The linked dipole packed on its two orange winders with the BNC center, labeled insulators, and silicone ties holding the assembly together](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/packed-linked-dipole-detail.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/packed-linked-dipole-detail.jpg)

Before calling the build finished, I still want to:

- Recheck all three bands on the complete assembly, including 20 and 30 meters
  after the final 40-meter cuts.
- Measure the finished wire sections and record the connector-tail routing.
- Record the end heights and coax/choke arrangement for repeatable comparisons.
- Sweep the frequencies I use with the ends at other heights, keeping the
  wire lengths fixed, then put the antenna on the air.

I may eventually work out a removable 80-meter extension. For now, the
20/30/40-meter version has made it through its first tuning session, and I
have a much better feel for assembling and adjusting the links.
