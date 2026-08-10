---
title: Building a 58-Foot Portable Doublet for the KX2
date: 2026-08-08
summary: "How I built a continuous-wire 58-foot portable doublet, what its first field measurements established, and the reversible experiment I plan to try next."
shareImage: /images/radio/2026-08-08-portable-58-foot-doublet/share.png
tags:
  - radio
  - antennas
  - builds
  - field-notes
  - cw
  - qrp
---

I wanted one lightweight antenna that could live in my KX2 field kit and cover
40 through 10 meters without traps, loading coils, or a transformer at the
feedpoint. I built a [58-foot inverted-V
doublet](/radio/equipment/homebrew-58-foot-doublet/) fed with 28 feet of
homebrew balanced line, all made from the same two continuous wires.

Its [first deployment at Pulaski State Park](/notes/2026-08-08-pulaski-state-park-doublet-test/)
answered the most important questions. The antenna was easy to raise, fit into
a real picnic site, matched on every intended band, and made 12 five-watt CW
contacts on four bands, including Spain on 15 meters.

The measurements were more interesting than the contact count. The bottom of
the balanced line presents some extreme impedances to the radio, but the KXAT2
can match them. Modeling anchored to those measurements also suggests that the
original 58-foot radiator and 28-foot line landed surprisingly close to a
useful seven-band compromise.

I am not cutting anything. The next experiment is to fold six inches back at
each radiator end, making an approximately 57-foot radiator while leaving the
feed line alone, then repeat the entire measurement set. That reversible test
should tell me more than another round of increasingly precise modeling.

## The design

The length choice was inspired by Tim Hale,
[K5OHY](https://www.qrz.com/db/K5OHY). His videos
[“The Doublet | Best Multi-Band Antenna?”](https://www.youtube.com/watch?v=eSS1dw3e5Oc)
and
[“An Efficient Portable Antenna: 66' Doublet with 300 Ohm Line”](https://www.youtube.com/watch?v=CxpK4-N2K9Q)
made the radiator tradeoff click for me. A doublet keeps its dominant radiation
broadside to the wire through approximately 1.25 wavelengths. Around that
length it behaves as an extended double Zepp; beyond it, additional lobes and
nulls begin taking over.

I use 40 meters often, and I expect the lower bands to matter more as this
solar cycle winds down. I therefore treated 40 through 15 meters as the core
range. A 58-foot radiator is approximately 0.42 wavelength on 40 meters and
1.24 wavelengths on 15 meters, putting 15 meters almost exactly at that
extended-double-Zepp boundary. Twelve and 10 meters remain useful bonus bands,
although their patterns are more complicated.

Tim's videos did more than supply the design idea. Watching him model, build,
deploy, and operate these antennas gave me the push to make this my first
complete antenna build from raw materials rather than a kit.

The resulting design is:

- a 58-foot center-fed radiator, with two 29-foot legs;
- 28 feet of lightweight homebrew balanced feed line;
- the same two continuous wires forming both the line and radiator;
- a printed center that separates the wires into the two radiator legs;
- printed spacers maintaining the conductor separation below the center;
- a Mix 31 current choke between the balanced line and the KX2;
- an inverted-V deployment from either a tree or a 20- to 30-foot mast.

Natural resonance on every band was never the goal. The intended system is a
nonresonant radiator, low-loss balanced line, and the KXAT2 performing the
final impedance transformation at the radio.

## Building the continuous-wire antenna

Each conductor starts at the radio end, runs up one side of the balanced line,
passes through the printed center, and continues outward as a 29-foot radiator
leg. The wires spread apart at the apex, but there is no connector, solder
joint, or electrical splice there.

The conductors are [DX Engineering DXE-SANTW-500 26-AWG Stealth Antenna
Wire](https://quad2.mydigitalpublication.com/publication/?i=659206&p=49&view=issueViewer):
thin, seven-strand copper-coated steel with a black UV-resistant polyethylene
jacket. DX Engineering rated it for a 24.5-pound break load and approximately
one ounce per 62 feet. This is the older `DXE-SANTW-500` product, not the
similarly named 24-AWG tinned-copper wire in the current catalog. The OpenSCAD
model records a nominal jacket outside diameter of 1.02 mm.

PETG spacers hold the feed-line conductors apart. The model uses 12.7 mm
center-to-center spacing; I rounded that to approximately 14 mm in my first
field notes and have not separately measured the finished line. Spacer
intervals vary from roughly 8 to 14 inches, clustered around my original
10-inch target.

<div class="photo-grid photo-grid--single photo-grid--compact">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/printed-center-and-spacers.jpg" alt="Orange PETG doublet center and feed-line spacers on the Bambu Lab printer bed">
</div>

I published the parameterized parts in the
[`lightweight_balanced_feedline` OpenSCAD model folder](https://github.com/rwjblue/scad-lab/tree/main/models/ham_radio/lightweight_balanced_feedline).
They include the
[snap-on feed-line spacer](https://github.com/rwjblue/scad-lab/blob/main/models/ham_radio/lightweight_balanced_feedline/balanced_feedline_spacer.scad),
the
[continuous-wire center used here](https://github.com/rwjblue/scad-lab/blob/main/models/ham_radio/lightweight_balanced_feedline/doublet_center_strain_relief.scad),
and a terminalized center for interchangeable radiator pairs. The parts landed
in [`scad-lab` pull request #1](https://github.com/rwjblue/scad-lab/pull/1).

<div class="photo-grid">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/continuous-wire-center.jpg" alt="Both continuous conductors threaded through the orange printed doublet center and strain relief">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/feedline-spacer-closeup.jpg" alt="One orange PETG spacer holding the two black feed-line conductors apart">
</div>

At the radio end, I crimped ferrules onto both conductors and clamped them into
a BNC binding-post adapter. A PackTenna Mix 31 current choke separates the
balanced line from a three-foot RG-8X jumper to the KX2:

```text
KX2 -> 3 ft RG-8X jumper -> Mix 31 current choke
    -> BNC binding-post adapter -> 28 ft balanced line
    -> 29 ft leg + 29 ft leg
```

I added the choke to suppress common-mode current on the outside of the coax
and keep the station from becoming part of the antenna. I have not measured
common-mode current yet, so I do not know how effective it is in this setup.

<div class="photo-grid">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/feedline-end-ferrules.jpg" alt="Two balanced-line conductors with ferrules crimped onto their ends beside an orange spacer">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/binding-post-wiring.jpg" alt="The two balanced-line conductors secured to the red and black posts of the BNC binding-post adapter">
</div>

The finished antenna winds onto a lightweight printed winder. The complete
radiator, feed line, center, and spacers fit into one bright Hidden Woodsmen
zippered bag.

<div class="photo-grid">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/doublet-on-winder.jpg" alt="The assembled continuous-wire doublet and balanced feed line wound onto an orange antenna winder">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/antenna-bag.jpg" alt="Bright orange and yellow Hidden Woodsmen bag used to store the portable doublet">
</div>

## Planning the deployment and radiation pattern

I designed around center heights of 20 and 30 feet, with both ends at least
five feet above ground and an included apex angle greater than 90 degrees. For
the calculations and radiation modeling, I used a symmetric 120-degree
inverted V as the reference geometry.

With 29-foot legs, that arrangement spans approximately 50.2 feet. A 20-foot
center puts the ends near 5.5 feet; a 30-foot center puts them near 15.5 feet.
Those dimensions give me a useful upper-bound estimate when judging whether a
park has enough room.

I also built a custom thin-wire analytical model to understand where the
antenna should send RF at the two heights. It is not a full NEC-2 model. It
uses a sinusoidal standing-current approximation, vector far-field numerical
integration, complex Fresnel ground reflection, and average ground. The
balanced line is omitted from the far-field calculation on the assumption that
equal and opposite differential currents largely cancel. Common-mode current,
uneven deployment, real ground, trees, terrain, and wire sag could all change
the actual result.

The normalized patterns—not absolute realized-gain predictions—suggest:

- **40 m, 0.42 wavelength:** Mostly high-angle/NVIS at either modeled height.
- **20 m, 0.83 wavelength:** A broadside lobe near 41 degrees at 30 feet.
- **17 m, 1.07 wavelengths:** The broadside peak falls from about 68 to 34
  degrees when raised from 20 to 30 feet.
- **15 m, 1.24 wavelengths:** A particularly clean broadside lobe near 33
  degrees at 30 feet.
- **12 m, 1.47 wavelengths:** Additional azimuth lobes begin developing.
- **10 m, 1.65 wavelengths:** A multilobed pattern with useful diagonal lobes
  near 18 degrees at 30 feet.

The practical guidance is straightforward: height is especially valuable on
20 through 15 meters. Forty meters remains largely an NVIS antenna at these
heights. Ten meters should still be useful, but its best low-angle directions
are diagonal to the wire rather than simply broadside.

<a href="/downloads/radio/2026-08-08-portable-58-foot-doublet/58ft-doublet-radiation-patterns.pdf">
  <img src="/images/radio/2026-08-08-portable-58-foot-doublet/radiation-pattern-overview.png" alt="Twelve normalized sky-view radiation patterns comparing 20-foot and 30-foot center heights from 40 through 10 meters">
</a>

The complete pattern-model package is available for inspection and revision:

- [Nine-page radiation-pattern report (PDF)](/downloads/radio/2026-08-08-portable-58-foot-doublet/58ft-doublet-radiation-patterns.pdf)
- [Raw model summary (CSV)](/downloads/radio/2026-08-08-portable-58-foot-doublet/58ft-doublet-model-summary.csv)
- [Python generator](https://github.com/rwjblue/rwjblue.com/blob/main/scripts/radio/generate-58ft-doublet-radiation-patterns.py)

That model does not include 30 meters, the feed-line transformation, tuner
loss, or the measured impedances below. Its job is to estimate normalized
pattern shape, not complete-system efficiency.

## The first field test

At Pulaski, a tree limb put the center at approximately 30 feet while both ends
were closer to 10 feet above ground. Assuming equal end heights and ignoring
sag, that installation spanned roughly 42 feet with an included apex angle near
93 degrees. It was steeper than the 120-degree reference model, but it fit the
site easily and confirmed that the antenna does not always need the full
50-foot span.

The antenna tuned across its entire intended 40- through 10-meter range and
made contacts on 15, 17, 30, and 20 meters. The 15-meter group included
[EF5Y](https://www.qrz.com/db/EF5Y) in Spain at five watts. That is not enough
evidence to validate a radiation model or compare efficiency, but it was a
successful mechanical and operational test.

![The KX2, N3ZN paddle, choke, jumper, and balanced-line connection during the first field test](/images/pota/2026-08-08-pulaski-state-park-doublet-test/kx2-station.jpg)

## What the electrical measurements established

I connected a
[RigExpert MATCH](/radio/equipment/rigexpert-match-advanced/) at the radio end
of the deployed system. These readings include the 28-foot balanced line and
the same general choke and adapter arrangement used with the radio. They are
the impedances presented to the tuner, not impedances measured at the antenna
apex.

- **80 m:** Radio-end impedance not measured; the KXAT2 found no match.
- **60 m:** Radio-end impedance not measured; the KXAT2 reached 1.6:1.
- **40 m:** 35.5 - j211 ohms, 27.16:1 raw SWR; the KXAT2 reached 1.8:1.
- **30 m:** 31.0 - j25.5 ohms, 2.20:1 raw SWR; the KXAT2 reached 1.0:1.
- **20 m:** 5.8 - j71.8 ohms, 26.48:1 raw SWR; the KXAT2 reached 1.0:1
  after a second search.
- **17 m:** 2.3 - j35.1 ohms, 32.47:1 raw SWR; the KXAT2 reached 1.0:1.
- **15 m:** 49.1 + j2.3 ohms, 1.05:1 raw SWR; the KXAT2 reached 1.0:1.
- **12 m:** 4.3 - j16.0 ohms, 12.83:1 raw SWR; the KXAT2 reached 1.0:1.
- **10 m:** 4.1 - j21.4 ohms, 14.44:1 raw SWR; the KXAT2 reached 1.3:1.

Three bands explain why both the tuner test and the impedance measurements
matter. The 15-meter load at the radio end was already almost a natural
50-ohm match. Seventeen meters presented the highest measured raw SWR, yet the
KXAT2 reached 1.0:1. Twenty meters had a slightly lower raw SWR, but the first
tuner search stopped around 2.7 to 3.0:1.

[W1WC](https://www.qrz.com/db/W1WC) told me to “hit tune a second time.” I
thought he was joking, but the
[KX2 Owner's Manual](https://ftp.elecraft.com/KX2/Manuals%20Downloads/KX2%20owner%27s%20man%20B2.pdf)
documents exactly that procedure: tap ATU again within five seconds to perform
a deeper search for a difficult load. The second search took the same
20-meter system to 1.0:1.

I suspect a previously stored nearby match contributed to the plausible first
result, but the manual does not document a 3:1 stopping threshold and I cannot
say exactly why it stopped there. The useful conclusion is that the antenna did
not need the feed-line extension I had started considering. I needed to use
the KXAT2's full search. I still need to retry 40 and 60 meters the same way, so
their recorded 1.8:1 and 1.6:1 results may not be the tuner’s best.

The larger lesson is that raw SWR does not predict whether this tuner can match
a load. Seventeen meters matched perfectly despite a raw 32.47:1 SWR, while
the first 20-meter search stopped high on a somewhat lower raw SWR. The KXAT2
has a finite set of network states, and some extreme impedances are easier for
it to transform than others.

### Matching and efficiency are different questions

This antenna is intentionally not a 50-ohm load at the bottom of its balanced
line. Its power path is:

```text
KX2 power amplifier -> KXAT2 -> current choke
                    -> balanced line -> radiator -> radiated RF
```

The RigExpert readings describe the matching problem presented to the tuner. A
point far from the center of a 50-ohm Smith chart does not, by itself, prove
poor radiation efficiency, excessive line loss, or a defective radiator.
Conversely, a 1.0:1 reading after the tuner does not prove that every part of
the system is lossless.

The radiator is physically substantial on every intended band and has no
loading coils, resistive termination, or high-ratio feedpoint transformer. Its
modeled patterns also look physically sensible. Those facts make large
radiator loss unlikely, but they do not measure it.

The more interesting loss questions are the actual KXAT2 matching network and
the thin copper-coated-steel balanced line operating with high standing-wave
currents. A first-order model ranks 40, 30, and 15 meters as the least
concerning line-loss conditions; 20 meters as reasonably good; and 17, 12,
and 10 meters as having wider uncertainty. Seventeen meters remains the most
interesting candidate for improvement even though it reaches a perfect
transmitter-side match.

I do not know the conductor's RF resistance, the line's exact characteristic
impedance or velocity factor, the tuner insertion loss for each match, or the
actual common-mode current. Exact efficiency percentages would imply more
certainty than the current measurements support.

## What the optimization tells me

The measurements gave the modeling a real anchor: the complete 58-foot
radiator and 28-foot line as deployed. I used them to answer two practical
questions rather than to search for a mathematically perfect antenna.

### Keep the 28-foot feed line

First I held the 58-foot radiator fixed and mathematically moved the radio-end
reference plane along feed-line lengths from 13 through 43 feet. With nominal
assumptions of 500 ohms and a 0.97 velocity factor, the minimum worst-band raw
50-ohm SWR occurred near 28.74 feet. Varying characteristic impedance from 450
to 550 ohms and velocity factor from 0.94 to 0.99 kept that favorable point
between approximately 28.65 and 28.85 feet.

This does not mean that 28 feet 9 inches is a universal or efficiency-maximizing
line length. The optimization only looked for a reasonable worst-band load for
a 50-ohm tuner. It also does not simulate every KXAT2 relay state.

What matters is the shape of the result. The current 28-foot line sits inside
a favorable multiband region. Trimming or adding several feet pushed one or
more bands toward dramatically worse transformed impedances, and the full
plus-or-minus-15-foot search found no better distant region. There is no
evidence that this antenna needs a feed-line change.

### The complete 58/28 antenna is already close

I then varied both dimensions: radiator lengths from 48 through 68 feet and
feed-line lengths from 18 through 38 feet, both in quarter-foot increments.
That produced 6,561 physical combinations across 40, 30, 20, 17, 15, 12, and
10 meters.

Candidate changes were modeled relative to the measured 58/28 antenna rather
than replacing it with an unrelated ideal impedance. The uncertainty ensemble
varied characteristic impedance, velocity factor, matched line loss, measured
R and X, and several assumptions used to estimate how radiator impedance
changes with length.

The optimizer did not find a radically better antenna elsewhere in the search
space. The broad favorable region remained near a 56.75- to 57-foot radiator
and a 28-foot line. The numerical best point was 56.75 feet of radiator with
28.25 feet of line, but the model uncertainty is larger than the precision
implied by those quarter-foot steps. Those are not magic dimensions.

The most useful nearby comparison is the present 58/28 antenna against a 57/28
version. The median modeled efficiency changes were essentially zero on 40,
30, 20, and 15 meters; approximately +0.79 dB on 17 meters; -0.31 dB on 12
meters; and +0.23 dB on 10 meters. The uncertainty is wide on the upper bands:
the 10th–90th percentile range was +0.15 to +3.94 dB on 17 meters and -1.35 to
+1.58 dB on 12 meters.

That result does not promise an extra 0.79 dB on 17 meters. It says that a
slight shortening is unlikely to ruin the all-band compromise and may improve
the most questionable line-current condition. A more aggressive 17-meter
optimization improved that band in the model but moved more difficulty to 12
meters. Radiators at or below roughly 54 feet also failed to produce a
compelling all-band result.

The important output is not the numerical optimum. It is that no 52/30, 54/25,
60/32, or other distant combination dominated the antenna already in the bag.
The original 58/28 dimensions were a good starting point.

### What the model cannot establish

The optimizer is better at comparing nearby geometries than at calculating
absolute radiated power. It does not contain a full KXAT2 circuit-state model,
and transformed raw SWR is only a conservative proxy for tuner matchability.
The 20-meter second-pass tune demonstrates that limitation directly.

The absolute line-loss estimates also depend strongly on conductor RF
resistance and other unmeasured properties. The model helps choose the next
physical experiment; it does not replace that experiment.

<!--
TODO: Add and link 58ft_doublet_optimization_v1.0.zip when the reproducibility
bundle is available in the repository. It contains the optimizer source,
frozen measurements, configuration, candidate grid, uncertainty results,
figures, report, documentation, hashes, and START_NEW_SESSION.md.
-->

## What I am going to do next

The next test is deliberately simple and reversible:

1. Leave the balanced feed line at 28 feet.
2. Fold six inches back at each radiator end, targeting an approximately
   57-foot effective radiator.
3. Reproduce the original deployment geometry as closely as practical.
4. Measure radio-end R and X on 40, 30, 20, 17, 15, 12, and 10 meters.
5. Run the KXAT2's first search on every band and use the documented second
   search whenever the first result is poor.
6. Compare the results directly with the existing 58/28 measurements.

Nothing gets cut, and the original antenna can be restored in minutes. More
importantly, the 57-foot measurements will provide a second physical
calibration point. I can compare the actual impedance change caused by one
foot of radiator shortening with the modeled change instead of asking the
optimizer to infer that relationship from a single installed geometry.

After that comparison, the remaining work is to:

- retry 40 and 60 meters with the second ATU search;
- record raw R and X on 60 and 80 meters;
- estimate feed-line loss across plausible conductor and line properties;
- estimate KXAT2 insertion loss for the actual per-band matches;
- measure common-mode current rather than assuming the choke eliminates it;
- repeat the deployment with a 20-foot center and compare it with 30 feet.

## Where the antenna fits

After one outing and the measurement-anchored modeling, this doublet is a
strong candidate to become my preferred general-purpose KX2 antenna when I
have a center support and roughly 42 to 50 feet of horizontal room. It covers
40 through 10 meters with one continuous radiator, packs as one lightweight
unit, and has proven straightforward to deploy. I still want more activations
under different conditions before calling it my default.

It will not replace every portable antenna. An EFHW or random wire remains
useful when only one high support is available. A quarter-wave vertical fits
sites without horizontal room and can favor lower angles with a suitable
radial system. The doublet is attractive when the site offers a center support
and room for both legs.

The build has already succeeded at its original goal: one practical,
backpack-portable radiator that the KX2 can use from 40 through 10 meters. The
remaining work is refinement—measuring loss more honestly and finding out
whether a reversible one-foot shortening makes the good multiband compromise
slightly better.
