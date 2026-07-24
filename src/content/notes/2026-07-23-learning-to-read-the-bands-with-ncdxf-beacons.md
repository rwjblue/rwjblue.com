---
title: Learning to Read the Bands with NCDXF Beacons
date: 2026-07-23
summary: "A first look at the synchronized NCDXF/IARU beacon network, its stepped-power signals, and two quick ways to choose an HF band from the field."
beaconMap: true
tags:
  - radio
  - field-notes
  - cw
---

I learned about the
[NCDXF/IARU International Beacon Project](https://www.ncdxf.org/beacon/)
today, and the schedule immediately felt useful for portable operating. The
network provides known transmitters, in known places, on a known schedule. In
three minutes I can listen around the world on one band. In 50 seconds I can
follow one location across five bands.

That is a much more direct answer to "what is open from here?" than staring at a
solar index and trying to turn it into an operating decision.

I have not completed a full field test yet. This note records the model that
made the network click for me, the way I expect to use it, and the
[NCDXF Beacon Guide](/radio/beacons/) I built to make the timing manageable
beside the radio.

## A beacon network from before today's digital modes

The network has roots in the earliest years of NCDXF. The foundation formed in
1972 and wanted to support a scientific project that could involve amateurs
whether or not they were DXers. One early idea was to place expensive drifting
beacons in Arctic currents so amateurs could help track them. The drifting
hardware was far beyond the foundation's budget, but the underlying idea of
coordinated, worldwide beacon observations survived.

The first fixed NCDXF beacon went on the air in 1979 from a trailer near
Stanford University. It signed WB6ZNL on 14.100 MHz and sent a one-minute
message every ten minutes. The IARU became involved during the 1980s, and the
modern five-band system began deployment in 1995.

That history puts this network decades ahead of WSPR, FT8, internet-connected
SDRs, and the Reverse Beacon Network. Its approach is almost startlingly
direct: carefully coordinated transmitters, UTC, Morse code, and known power
levels. The detailed
[early history](https://www.ncdxf.org/beacon/earlyhistory.html) is worth
reading; it includes the original drifting-beacon idea, the first Stanford
installation, and the transition to the current 18-slot design.

### Frequencies and timing

The 18 scheduled locations share five frequencies:

<div class="beacon-frequency-grid" aria-label="NCDXF beacon frequencies">
  <div><strong>20 m</strong><span>14.100 MHz</span></div>
  <div><strong>17 m</strong><span>18.110 MHz</span></div>
  <div><strong>15 m</strong><span>21.150 MHz</span></div>
  <div><strong>12 m</strong><span>24.930 MHz</span></div>
  <div><strong>10 m</strong><span>28.200 MHz</span></div>
</div>

The coordination is the clever part. Each beacon gets a ten-second slot, and
the complete sequence repeats every three minutes. At the end of its slot, a
beacon moves to the next higher band while the next beacon begins on the
frequency it just left. No two project beacons transmit on the same frequency
at the same time.

The official
[beacon locations](https://www.ncdxf.org/beacon/beaconlocations.html) and
[transmission schedule](https://www.ncdxf.org/beacon/index.html) provide the
current reference data. An accurate clock matters because the time slot can
identify a signal even when the callsign is too weak or too fast to copy.

### Stations and locations

The map and station list above use the official NCDXF transmission order. The
network starts with 4U1UN at the United Nations in New York, continues west
through Canada, California, Hawaii, New Zealand, Australia, and Asia, then
crosses Africa, Europe, and South America before ending with YV5B in Venezuela.
The geographic order is not a perfect trip around the globe, but it makes the
three-minute sequence easier to understand.

These are scheduled slots, not a promise that all 18 signals are on the air.
Remote sites contend with lightning, corrosion, storms, power problems, aging
radios, antenna failures, and occasional theft. The
[official live schedule and status](https://www.ncdxf.org/beacon/index.html)
remains the source of truth before treating a missing signal as a propagation
result.

### Radios, timing, and antennas

The first beacon was custom hardware, followed by a generation built around the
[Kenwood TS-120S](https://www.rigpix.com/kenwood/ts120s.htm). For the 1995
five-band network, Kenwood donated 16
[TS-50S transceivers](https://www.rigpix.com/kenwood/ts50s.htm). Those stations
paired a TS-50S with a custom controller, GPS timing, and generally a
[Cushcraft MA5V multiband vertical](https://www.manuals.repeater-builder.com/Cushcraft/MA-5VA/MA-5VA.pdf).

The network is no longer perfectly uniform. Aging TS-50s and increasingly
difficult controller repairs led to the open-source
[Beacon Controller 2.0](https://www.ncdxf.org/beacon/beaconcontroller.html),
an Arduino-based design used with
[Icom IC-7200 radios](https://www.rigpix.com/icom/ic7200.htm). The first beta
system went to W6WX in 2015 and the second to KH6RS in 2016. Aging MA5V antennas
have also driven replacement work, including an
[NCDXF dual-band discone design](https://wavenodedevelop.com/wp-content/uploads/2019/02/NCDXF-Beacon-Replacement-Antenna-Summary.pdf)
now used at W6WX.

I could not find a reliable current radio-and-antenna inventory for every
location. NCDXF's
[current reception page](https://www.ncdxf.org/beacon/RBN.html) still identifies
RR9O as a version-one controller with a TS-50, while many other sites report
version-two controllers. The honest description is therefore a mixed network
being modernized in place, not 18 identical stations.

## Four signals hiding inside each slot

Each transmission starts with the beacon's callsign sent as Morse code at 22
words per minute. The callsign and first one-second dash use 100 watts. Three
more one-second dashes follow at:

- 10 watts
- 1 watt
- 100 milliwatts

Each step is 10 dB below the previous one. Hearing the 10-watt dash shows 10 dB
more path margin than barely hearing the 100-watt signal. Hearing the 1-watt
dash represents 20 dB, and hearing the 100-milliwatt dash represents 30 dB.

That is the part that changed the beacons from a collection of CW identifiers
into a small propagation instrument. "I heard Finland" is useful. "I heard
Finland down to one watt on 17 meters" is much more useful.

The comparison is still only evidence, not a guarantee. Each beacon transmits
into its own antenna from its own site. My antenna, the other station's
antenna, local noise, QRM, and the shape of the path all matter. A missing
signal is also ambiguous: the path may be closed, the beacon may be off, or I
may simply be unable to hear it.

## Two practical listening patterns

There are two complementary ways I expect to use the schedule.

### Stay on one band for three minutes

If I want to know where a band is open, I can tune one beacon frequency and
leave the radio there for a complete cycle. Every location gets one ten-second
turn.

For example, three minutes on 18.110 MHz answers questions such as:

- Is 17 meters reaching Europe?
- Is South America coming through?
- Are there any long paths into the Pacific or Asia?
- Which directions have enough margin for a low-power attempt?

This is the geographically broad scan. It tells me what one band is doing
around the world.

### Follow one beacon for 50 seconds

If I care about a particular direction, I can instead follow one beacon as it
moves through 20, 17, 15, 12, and 10 meters. Once its sequence begins, that
takes 50 seconds.

That is neat on paper and demanding with a manually tuned field radio. Changing
bands or entering five frequencies inside consecutive ten-second slots leaves
little time to listen for the callsign and four power steps. CAT control makes
this mode practical; carefully prepared memories or direct band buttons may
make it possible without CAT. For a completely manual station, the three-minute
single-band scan is the dependable workflow, while the five-band comparison is
still an experiment.

For a Rhode Island portable operation, CS3B in Madeira is an interesting proxy
for a transatlantic path. LU4AA in Argentina offers a South American path.
W6WX in California provides a path toward the western United States. The
beacons are not perfect stand-ins for every station in those regions, but the
comparison can quickly reveal which of the five bands has the most margin in
that direction.

This is the focused band comparison. It tells me which band appears strongest
toward one part of the world.

## Why this seems useful in the field

My usual portable question is not an abstract request for a propagation score.
It is closer to:

> I have limited time and a multiband antenna. Where should I call first?

The [Reverse Beacon Network](/radio/rbn-skimmers/) and spotting data help, but
they depend on someone transmitting and on a receiver reporting the result.
Solar data describes the environment but not necessarily the path from my
operating position. The NCDXF beacons add a repeatable on-air measurement that
I can hear through my actual radio and antenna.

The network also works without a data connection once I have the schedule and
beacon status. That matters at parks where cellular service is marginal. The
hard part is tracking a ten-second worldwide schedule while tuning, listening,
and writing down four power levels.

## A small guide for the radio

I built the [NCDXF Beacon Guide](/radio/beacons/) around those two listening
patterns. It uses the device's UTC clock to show which beacon should be on each
frequency. A Maidenhead grid adds approximate bearing and distance.

In the one-band view, I leave the radio on a selected beacon frequency and tap
the weakest power step I hear during each slot. In the band-comparison view, I
choose one beacon and the guide supplies the five-frequency timing. It cannot
tune the radio yet, so that mode currently assumes CAT software, prepared
memories, or very fast manual operation. The observations stay in the browser
and produce a local recommendation for 30 minutes.

The first version does not need audio decoding, an account, or a backend.
Manual signal input also keeps the central question visible: what did I
actually hear through the station I am using right now? CAT control is the
obvious next step if the focused comparison proves useful.

## What I still want to test

The timing and power sequence are documented by NCDXF, but the field workflow
still needs real operating time. I want to learn:

- whether the power-step buttons are easy to use during a ten-second slot;
- how often local noise makes the lower-power dashes difficult to distinguish;
- which beacon paths are most useful proxies from Rhode Island;
- whether a focused 50-second comparison is enough, or whether repeating it
  over several three-minute cycles produces a better band choice;
- how well beacon results agree with RBN activity and actual portable contacts.

I also want to avoid turning a useful observation into false precision. The
best result may ultimately be phrased as "try 17 meters first, with 20 meters as
the reliable fallback," rather than assigning every band a synthetic score.

For now, I have a clearer way to listen. Instead of wondering whether an empty
band is closed or merely quiet, I can wait for a known transmitter, hear how
far down its power steps I can go, and make the next call with a little more
evidence.
