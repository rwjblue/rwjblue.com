---
title: Building a 20/30/40-Meter Linked Dipole
date: 2026-09-15
summary: "Printed link insulators, bullet connectors, and the first field tuning of my compact 20/30/40-meter dipole."
tags:
  - radio
  - antennas
  - builds
  - linked-dipole
---

I wanted to add 30 and 40 meters to the
[20-meter dipole I built with separate winders](/notes/2026-09-13-compact-20-meter-dipole/)
while keeping the same compact packing arrangement. Printed insulators and
small bullet connectors let me extend each leg and select the band by
opening or closing the links.

On September 15, I assembled the extensions and took the antenna into the
field to finish the connectors and tune it. The first session produced a
good match on all three bands. I worked outward from the feedpoint and
checked each section again with its connectors fitted.

## How the links select the band

Each leg has three wire sections: the original 20-meter section, an extension
for 30 meters, and another extension for 40 meters. A connector pair bridges
each break in the wire. There are **two electrical links per leg, four for
the antenna**.

I designed small
[linked-dipole insulators](https://www.printables.com/model/1842032-linked-dipole-link-insulators)
with two wire holes at each end. The wire threads through those holes for
strain relief. Short tails hang below the body so the connectors can meet
without carrying the tension of the antenna.

[![Six orange printed insulators arranged in pairs labeled 20m, 30m, and 40m](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/printed-link-insulators.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/printed-link-insulators.jpg)

Each label names the band the antenna is tuned for **with that link open**
and all links closer to the feedpoint connected. Opening the 20m links makes
it a 20-meter dipole. To use 30 meters, I connect those links and open the
ones labeled 30m.

I used the 20m and 30m pairs for this build. The printed 40m pair in the
photo went unused: I kept my original end insulators because I did not need
another link beyond 40 meters.

The link settings are the same on both sides:

| Band | Link at the 20m label | Link at the 30m label |
| --- | --- | --- |
| 20 meters | Open | Open |
| 30 meters | Connected | Open |
| 40 meters | Connected | Connected |

The full antenna stays physically deployed on every band. Opening a link
breaks the direct connection to the outer sections, while the insulators
keep the assembly mechanically connected to the supports.

## Preparing the wire and connectors

I am using
[DX Engineering DXE-SANTW-500 wire](https://www.dxengineering.com/parts/dxe-santw-500),
a 26 AWG stranded copper-clad steel antenna wire with polyethylene insulation.
I started the additions with these cuts:

| Section added to each leg | Raw length | Pieces |
| --- | --- | --- |
| 20m to 30m extension | 2.44 m (8 ft) | 2 |
| 30m to 40m extension | 3.51 m (11 ft 6 in) | 2 |

These are **raw cutting lengths**, with allowance for routing through the
insulators, connector tails, and trimming. I have not measured the finished
sections yet, so this is a starting-cut list rather than a set of dimensions
for a tuned copy of the antenna.

I used **2 mm bullet connectors**. On the feedpoint-facing end of each new
extension, I soldered a female connector and covered the joint with
heat-shrink tubing. I left the mating male connectors for the field, after
the first length adjustments. Preparing the four female ends at the bench
reduced the soldering work during tuning.

[![An orange 30m insulator with wire threaded through both ends, a heat-shrunk female bullet connector on one tail, and unfinished wire on the other](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/assembled-link.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/assembled-link.jpg)

I left about 50-75 mm (two or three inches) of tail below the insulators so
the connectors would be easy to handle. The photo above shows that bench
stage, with one connector fitted and the opposing tail still unstripped.
The 2 mm size is the contact diameter. These male connectors add roughly
10 mm beyond the wire end, something I needed to allow for during tuning.

The small connectors also gave me some useful soldering practice. An
oxidized iron tip slowed the work: it would melt solder, but the solder
would not wet the tip, making heat transfer into the joint difficult.
[Hakko's tip-maintenance guidance](https://www.hakko.com/english/support/maintenance/detail.php?seq=180)
explains the problem and recommends leaving the tip coated with solder
before switching the iron off. That is a simple habit to carry into the next
build.

## Choosing a shape to tune

Tuning the original dipole showed me how much spreading the legs and raising
the ends could change the SWR. For this version, I wanted a repeatable
starting shape and some idea of how forgiving it would be at other heights.

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

Before the field session, I decided to favor CW more strongly. A follow-up
modeling pass suggested targets around 14.050 and 7.060 MHz, keeping
30 meters around 10.120 MHz. Tuning lower on 20 and 40 meters moved the
frequencies that stayed well matched across the five shapes toward the CW
portion of each band, at the expense of some match higher in the phone
portions.

By the time I went out to tune, I had settled on **14.060 MHz on 20 meters,
10.120 MHz on 30 meters, and 7.060 MHz on 40 meters**. The report I linked
above is from my earlier experiments, when I was aiming higher on 20 and
40 meters. It helped me pick a starting shape. Taking the antenna into the
field was my chance to get the actual wire where I wanted it.

The original model also gave me a reason to raise the ends when space allows.
On 40 meters, going from 1.5 m to 3.0 m ends added about 2 dB of realized gain
at 20 degrees above the horizon, broadside to the antenna. That comparison
includes the effect of mismatch. The benefit varies with direction and band;
it is not a uniform gain increase or a measurement of this antenna's
efficiency.

There is a space tradeoff too. In the original model's 33/10-foot setup,
continuing each wire's slope with cord down to a ground stake required about
4.4 m of cord per end, plus allowance for knots and adjustment. Each stake
was roughly 10.3 m from the mast: about 20.6 m (68 ft) across the whole setup.
Those are planning estimates for straight legs. A flat top needs elevated
supports at both ends.

## Tuning from the center outward

The [Pinecil](https://pine64.org/devices/pinecil/) was fantastic for this.
All I needed to power the iron was a USB Power Delivery (PD) battery bank
and a USB-C cable. I brought the helping-hands fixture too, so I could
finish the connectors right there in the field.

I worked outward from the feedpoint: 20 meters first, then 30, then 40.
That let me adjust each extension after the section inside it was set.

The center was at 10.1 m (33 ft). The outer ends were roughly 150-300 mm
(6-12 in) above my hand with my arm fully extended overhead; I am 1.85 m
(6 ft 1 in) tall. I figured that put the ends around 2.7 m (9 ft), close
enough to my 3.0 m (10 ft) target for this first session.

[![The linked dipole deployed as an inverted V on a mast above a wooded trail entrance](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/field-inverted-v.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/field-inverted-v.jpg)

### 20 meters: check again with the connectors fitted

The first scan put the minimum at 13.835 MHz. I trimmed 70 mm from each
20-meter leg, which moved it to **14.075 MHz at 1.10:1**. That was close
enough to my target to move on to the male connectors.

This is where I missed a step: I soldered on the male connectors without
trimming the extra 10 mm or so that each connector adds. I had tuned the
wire, then made each leg a little longer by fitting the connector.

The next sweep put the minimum at **14.035 MHz at 1.09:1**, 40 kHz lower.
At 14.075 MHz it was still only **1.11:1**, so I left it there. My
14.060 MHz target was between those two readings, near the bottom of the dip.

Next time I will account for the connector's added length when I trim,
then sweep again with it fitted. This time, the match was already good
where I wanted to operate, so there was no reason to keep cutting.

[![Wire and a printed link insulator held in an orange helping-hands fixture beside a soldering iron on a field table](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/field-soldering.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/field-soldering.jpg)

### 30 meters: trim the extension

With the 20m links connected and the 30m links open, the full 2.44 m extension
blanks put the minimum at 9.505 MHz. I left the inner sections alone and
trimmed the outer ends of the 30-meter extensions, reaching
**10.135 MHz at 1.15:1**, before fitting the outer male connectors.

That was only 15 kHz above the target, with the outer connectors still to be
fitted. The later scan was **10.125 MHz at 1.14:1**, with a shallow curve
across the 30-meter band.

### 40 meters: smaller cuts near the target

With both sets of links connected, the first 40-meter minimum was at
6.760 MHz. There was no new bullet connector to add at these outer ends.
I shortened only the outer 40-meter sections, checking between cuts as the
minimum approached the target. I stopped at **7.064 MHz at 1.05:1**. At
**7.100 MHz**, the analyzer read **1.16:1**.

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

All wire sections stayed deployed throughout the session. Even with a link
open, the nearby disconnected wire can influence the active section, which
is why I want the final recheck after trimming the outer sections. The
readings above describe the match at the analyzer; they do not measure
radiation efficiency or establish performance at other end heights.

## Still compact, with a few checks left

The extra wire and insulators still pack with the original BNC center and
separate nesting winders. Keeping that arrangement was one of the things I
wanted from this build.

[![The linked dipole packed on its two orange winders with the BNC center, labeled insulators, and silicone ties holding the assembly together](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/packed-linked-dipole-detail.jpg)](/images/radio/2026-09-15-20-30-40-meter-linked-dipole/packed-linked-dipole-detail.jpg)

The remaining checks are straightforward:

- Recheck all three bands on the complete assembly, including 20 and 30 meters
  after the final 40-meter cuts.
- Measure the finished wire sections and record the connector-tail routing.
- Record the end heights and coax/choke arrangement for repeatable comparisons.
- Sweep the frequencies I use with the ends at other heights, keeping the
  wire lengths fixed, then put the antenna on the air.

I may eventually work out a removable 80-meter extension. For now, I have
the three-band layout I wanted, still packed on separate winders, and a
repeatable way to approach the next tuning session.
