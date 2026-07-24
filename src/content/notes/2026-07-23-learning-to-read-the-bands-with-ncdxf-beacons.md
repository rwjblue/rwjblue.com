---
title: Learning to Read the Bands with NCDXF Beacons
date: 2026-07-23
summary: "A first look at the synchronized NCDXF/IARU beacon network, its stepped-power signals, and two quick ways to choose an HF band from the field."
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

## Eighteen stations sharing five frequencies

The project has 18 beacon locations distributed around the world. They transmit
on five frequencies:

| Band | Frequency |
| --- | ---: |
| 20 meters | 14.100 MHz |
| 17 meters | 18.110 MHz |
| 15 meters | 21.150 MHz |
| 12 meters | 24.930 MHz |
| 10 meters | 28.200 MHz |

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

## Four signals hiding inside each slot

Each transmission starts with the beacon's callsign at 22 words per minute.
The callsign and first one-second dash use 100 watts. Three more one-second
dashes follow at:

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
choose one beacon and the guide walks through its five frequencies. The
observations stay in the browser and produce a local recommendation for 30
minutes.

The first version is intentionally manual. It does not need CAT control, audio
decoding, an account, or a backend. Manual input also keeps the central
question visible: what did I actually hear through the station I am using
right now?

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
