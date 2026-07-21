---
title: A Portable OCFD Experiment with Reliance Antennas
date: 2026-07-21
summary: "Why a compact OCFD fits my portable antenna toolkit, how Reliance helped investigate the first wire, and what an experimental 80/20 replacement changed."
shareImage: /images/radio/2026-07-21-reliance-ocfd-replacement-wire-testing/original-transformer-closeup.jpg
tags:
  - radio
  - field-notes
  - antennas
---

<!--
UNPUBLISHED WORKING DRAFT

This file intentionally lives outside src/content/notes so it cannot appear on
the site. The likely publication target is:

src/content/notes/2026-07-21-reliance-ocfd-replacement-wire-testing.md

Before publishing, complete the orange 64/36 comparison and on-air testing,
update the measurements and comparison chart, resolve the remaining questions,
and remove this comment.
-->

I like having several antennas available for portable operating. There is no
single best way to put an antenna in the air at every park or summit, and part
of the fun for me is trying different designs and learning where each one
fits.

An end-fed half-wave is convenient when I can raise one end or use a tree as
the high point. Sometimes the easier support is in the middle, though. A dipole
or off-center-fed dipole can hang from that center support as an inverted V,
with both ends tied off relatively low. An OCFD also offers the possibility of
one resonant wire covering several harmonically related bands, much like an
EFHW, but with a much lower transformer ratio. Whether that translates into a
meaningful efficiency difference in my portable setup is something I still
want to measure; the useful deployment geometry is the primary attraction.

## Why Reliance caught my attention

I had been looking at [Reliance Antennas](https://www.relianceantennas.com/)
for a while. The products had a good reputation, the transformer boxes were
made for portable work, and I am always happy to support a small ham-owned
business.

The [OCFD Bugout](https://www.relianceantennas.com/product/ocfd-bugout-antenna/)
transformer is 3.5 by 2.5 by 0.75 inches and 2.5 ounces. It has a BNC
connector, a 4:1 transformer, and power ratings of 100 watts SSB or 60 watts
digital and CW. The
[EFHW Bugout Mini](https://www.relianceantennas.com/product/efhw-bugout-mini-antenna/)
is smaller still at 2 by 1.5 by 0.75 inches. Reliance also builds a similarly
pocketable [9:1 EFRW Bugout Mini](https://www.relianceantennas.com/product/efrw-bugout-mini/)
and a [4:1 Rybakov setup](https://www.relianceantennas.com/product/rybakov-bugout-vertical-40-6m-antenna/).
I believe I now have examples of all four transformer boxes. They take up remarkably little
room in a field kit while still leaving me the option of using a 100-watt radio
such as my FT-891.

![Reliance OCFD Bugout transformer at the center of the original inverted-V installation](/images/radio/2026-07-21-reliance-ocfd-replacement-wire-testing/original-transformer-closeup.jpg)

I placed my order before the 2026 New England QSO Party because I wanted to
use the antennas in the woods that weekend. By coincidence,
[NEQP ran May 2--3](https://neqp.org/rules/) while
[NEAR-Fest XXXIX ran May 1--2](https://near-fest.com/) in New Boston, New
Hampshire. Matt had driven up from Reliance's home in Pennsylvania for
NEAR-Fest, so he fulfilled my order in person rather than shipping it. We sat
and talked about radios and portable antennas for at least an hour and a half.
It was a genuinely lovely way to meet the person behind the gear.

## A problem became a collaborative experiment

When I tested the 40-through-10-meter OCFD after that weekend, it did not tune
where either Matt or I expected. I sent him setup photos and analyzer readings,
and he worked through the installation details with me: feedpoint height, end
height, included angle, feedline, and the measured resistance and reactance.

Matt and the Reliance team have been excellent throughout this process. They
took the measurements seriously and stayed curious about what could explain
them. After we compared the two radiator legs with the design length, Matt
thought the wire assembly itself was likely short rather than there being a
problem with the little 4:1 transformer.

The measured legs were approximately 7.2 and 12.81 meters from the feedpoint
shackles to the far ends, about 20.01 meters total before accounting for the
folded tails. The design called for approximately 67 feet of radiator,
excluding the six-inch tails.

Instead of sending only one replacement, Matt turned it into a useful
experiment. He sent:

- an orange 68-foot conventional 64/36 OCFD wire, deliberately long so it can
  eventually be trimmed for the CW portion of the bands
- a fluorescent-green experimental 80/20 wire, also deliberately long
- a return mailer for whichever assembly I do not keep

## The original wire as a baseline

The original antenna was installed as an inverted V with the feedpoint near
the top of a 20-foot mast, the ends about three to five feet high, and an
included angle of roughly 120 degrees. I used approximately 25 feet of RG-316
because I did not yet have RG-174. I do not remember installing a choke for
that session, and the setup photos do not show ferrites at the feedpoint.

These measurements were made on a different day from the replacement-wire
test, so they are a useful historical baseline rather than a controlled A/B
comparison.

![Original Reliance OCFD installed as an inverted V on a 20-foot mast](/images/radio/2026-07-21-reliance-ocfd-replacement-wire-testing/original-setup.jpg)

| Band | Selected point | Best point in sweep |
| --- | ---: | ---: |
| 40 m | 4.3 at 7.150 MHz | 1.82 at 8.530 MHz |
| 20 m | 2.3 at 14.175 MHz | 1.11 at 14.755 MHz |
| 15 m | 3.9 at 21.225 MHz | 2.7 at 20.505 MHz |
| 10 m | 1.37 at 28.850 MHz | 1.37 at 28.850 MHz |

The 10-meter reading was quite good, but the overall pattern was not the
multiband field antenna Matt or I expected. The excellent 20-meter minimum was
above the amateur band, the best 40-meter point was even farther above its
band, and 15 meters remained above 3:1 in the band. I did not come away from
that first session planning to rely on the assembly for 40-through-10-meter
portable use. Those readings, combined with the physical wire measurements,
gave Matt a concrete direction for the replacements.

## Why try an 80/20 split?

The 80/20 split has real design precedent. A conventional 40-meter OCFD
with a roughly one-third/two-thirds split can match 20 and 10 meters through a
4:1 transformer, but 15 meters is often difficult because that feedpoint falls
near a high-impedance current node on the third harmonic.

Moving the feedpoint closer to one end changes those harmonic impedances. A
[documented 1/6-feedpoint Field Day experiment](https://www.amateurradio.com/200-ohm-feed-point-off-centre-fed-dipole/)
was specifically intended to add 15 meters to a 40/20/10-meter OCFD, and it
measured good results on 20, 15, and 10 meters. That experiment also struggled
on 40 meters and identified common-mode current and choking as likely factors.
A separate
[modeled 20-percent-feedpoint design](https://hamwaves.com/cl-ocfd/en/)
similarly treats the feedpoint position as a deliberate multiband compromise.

That does not make 80/20 universally better. It changes the feedpoint
impedance on every band and can make the result more sensitive to the
transformer, common-mode current, feedline, height, and surroundings. It does,
however, give Matt's alternate wire a sound experimental basis--especially if
15 meters matters.

## First replacement session: the green 80/20 wire

For the first replacement test I installed the untrimmed fluorescent-green
wire as an inverted V using the same OCFD Bugout transformer and 20-foot mast.
Both ends were at least three feet above ground, with one somewhat higher than
the other. This time I used approximately 25 feet of RG-174 and installed five
ferrite beads on the coax near the feedpoint. No wire was trimmed.

![Fluorescent-green 80/20 replacement wire installed as an inverted V for its first test](/images/radio/2026-07-21-reliance-ocfd-replacement-wire-testing/green-setup.jpg)

The green wire gave me potentially useful starting points on 20, 15, and 10
meters. Twenty and 15 meters were near 1.5:1 without a tuner. Ten meters was
higher, but its 2.3--2.5:1 range is at least plausible with a tuner. Forty
meters remained the unresolved band.

Rather than filling the note with analyzer screenshots, this chart compares
the measured in-band points. It is a historical comparison, not a pure test of
feedpoint geometry: the wire lengths, coax, choke configuration, and day all
changed between sessions.

<picture>
  <source media="(max-width: 520px)" srcset="/images/radio/2026-07-21-reliance-ocfd-replacement-wire-testing/measured-swr-comparison-mobile.svg">
  <img src="/images/radio/2026-07-21-reliance-ocfd-replacement-wire-testing/measured-swr-comparison.svg" alt="Dumbbell chart comparing measured in-band SWR for the original and green 80/20 wires on 40, 20, 15, and 10 meters">
</picture>

The analyzer's resistance and reactance readings preserve more detail than SWR
alone:

| Band | Original wire: selected point and impedance | Green 80/20: selected point and impedance |
| --- | --- | --- |
| 40 m | 4.3 at 7.150 MHz; 11.7 - j5.7 ohms | 3.6 at 7.090 MHz; 17.4 + j23.3 ohms |
| 20 m | 2.3 at 14.175 MHz; 34.2 - j31.9 ohms | 1.48 at 14.178 MHz; 43.4 + j17.1 ohms |
| 15 m | 3.9 at 21.225 MHz; 15.2 + j20.1 ohms | 1.51 at 21.225 MHz; 40.5 - j16.0 ohms |
| 10 m | 1.37 at 28.850 MHz; 45.3 + j14.3 ohms | 2.5 at 28.850 MHz; 32.6 - j33.5 ohms |

The shift on 20 meters was particularly useful: the original wire's 1.11
minimum was at 14.755 MHz, while the green wire produced a broad 1.48 minimum
around 14.15 MHz and measured 1.52 at 14.030 MHz. On 15 meters, the green wire
measured 1.51 at 21.225 MHz and reached 1.43 at 21.025 MHz. That is the clearest
result consistent with the reason for trying the alternate feedpoint.

Ten meters moved in the other direction, from 1.37 on the original wire to a
shallow 2.3 minimum at 28.490 MHz on the green wire. Even so, the practical
result is that the green assembly currently looks like a plausible three-band
portable antenna on 20, 15, and 10 meters. I did not reach that conclusion
after the original session. SWR only describes the match, not radiation
efficiency, so on-air testing still matters.

Forty meters is still the open question. The green wire measured 3.6 at 7.090
MHz, and its 2.8 minimum remained above the band at 8.370 MHz. The published
1/6-feedpoint experiment's similar 40-meter difficulty makes the choke and
feedline especially interesting variables, but the orange-wire comparison
comes first.

## What I have learned so far

The green wire did exactly what makes a real antenna experiment worthwhile: it
moved the compromises in a useful and measurable way. Twenty and especially
15 meters improved substantially, 10 meters remained potentially usable, and
40 meters showed where more work is needed.

It also reinforces how helpful Reliance has been. Matt took an unexpected set
of readings, worked through the evidence with me, and supplied both a
conventional replacement and a modeled alternative so we could learn something
from the process. I now have much better data than I would have had from simply
swapping one wire and calling the problem closed.

A storm ended this session before I could install the orange 64/36 wire. I am
deliberately leaving both replacements untrimmed until that comparison is
complete.

## What remains to test

- Measure and photograph the OCFD, EFHW, EFRW, and Rybakov transformer boxes
  together.
- Install the untrimmed orange 64/36 assembly with the long leg in the same
  direction as the green long leg.
- Preserve the transformer, RG-174, ferrites, mast height, inverted-V angle,
  end heights, and anchor directions as closely as possible.
- Repeat the same sweeps on 40, 20, 15, and 10 meters and add the orange series
  to the comparison chart.
- Do some on-air testing rather than treating a good impedance match as the
  whole antenna story.
- Share the comparison with Matt, choose the assembly that best fits my
  portable operating goals, and only then begin trimming.

## References

- [Reliance Antennas OCFD Bugout](https://www.relianceantennas.com/product/ocfd-bugout-antenna/)
- [Reliance 40-through-10-meter OCFD wire assembly](https://www.relianceantennas.com/product/ocfd-40-10m-22-awg-polystealth-wire-assembly/)
- [Multiband HF center-loaded off-center-fed dipoles](https://hamwaves.com/cl-ocfd/en/)
- [A practical 200-ohm feedpoint OCFD experiment](https://www.amateurradio.com/200-ohm-feed-point-off-centre-fed-dipole/)
