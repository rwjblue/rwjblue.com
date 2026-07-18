---
title: Taking K2HRC to Rhode Island
date: 2026-07-18
summary: "The first Rhode Island activation for K2HRC, with 23 SSB QSOs, a 135-foot EFHW, and a misleading SWR sweep from an unplugged radiator."
shareImage: /images/pota/2026-07-18-k2hrc-rhode-island-pota/80-meter-efhw-setup.jpg
contactMap: src/data/pota/contact-maps/2026-07-18-k2hrc-rhode-island-pota.json
tags:
  - radio
  - pota
  - field-notes
  - ssb
  - us-6992
---

I headed to [JL Curran State Park, US-6992](/radio/pota/US-6992/) with a
specific goal: put Rhode Island on the air with
[K2HRC](https://www.qrz.com/db/K2HRC), the Ham2K Amateur Radio Club call. The
club has been working toward activations from every state, and Rhode Island was
still missing. I finished with 23 SSB QSOs, including seven park-to-parks, and
got the state into the K2HRC log.

The timing added a second constraint. July 18 was the first day of the 2026
[Summer Support Your Parks weekend](https://docs.pota.app/docs/events.html),
but rain and thunderstorms were expected early that afternoon. That left a
short window for the setup, activation, and teardown.

<div class="photo-grid">
  <img src="/images/pota/2026-07-18-k2hrc-rhode-island-pota/operator-hiking-in.jpg" alt="N1RWJ hiking into JL Curran State Park with the portable station packed behind him">
  <img src="/images/pota/2026-07-18-k2hrc-rhode-island-pota/wooded-operating-site.jpg" alt="Wooded operating site at JL Curran State Park with a red field chair among the trees">
</div>

## At a glance

- **Where:** [JL Curran State Park, US-6992](/radio/pota/US-6992/), Rhode Island
- **When:** July 18, 2026, 15:41 to 16:12 UTC (11:41 AM to 12:12 PM EDT)
- **Activation:** 23 SSB QSOs; 4 on 40 meters and 19 on 20 meters; 7 park-to-parks
- **Radio:** Yaesu FT-891
- **Antenna:** Spooltenna Ultra transformer and spool with the 80-meter accessory wire, about 135 feet long, oriented north to south in an attempt to favor paths westward
- **Support:** Far end about 35 feet up in a tree; feed point on a [20-foot GigaParts Explorer POTA20 carbon-fiber mast](https://www.gigaparts.com/explorer-pota20-portable-handheld-20-ft-telescopic-carbon-fiber-mast.html)
- **Feed line:** 25 feet of orange, sheathed ABR Industries RG-174 with an integrated five-bead common-mode choke
- **Power:** 75 watts
- **Logging:** Ham2K Portable Logger, with K2HRC as the station callsign and N1RWJ as the operator
- **Conditions:** Canadian wildfire smoke, approaching thunderstorms, and calm [NOAA space weather](https://services.swpc.noaa.gov/text/daily-solar-indices.txt) at Kp 1 and 105 sfu solar flux; 20 meters was short enough to reach New York

## Why K2HRC

The [K2HRC club-call instructions](https://forums.ham2k.com/t/about-the-k2hrc-the-club-call/308)
allow members of the loosely defined Ham2K community to use the call after
coordinating with the club. I logged K2HRC as the station callsign and N1RWJ as
the operator, then sent the log back to the club for upload.

That station/operator split gives both the club and me POTA credit for the
activation, while the park-to-park credit stays with K2HRC. I do not upload a
second copy of the same QSOs under N1RWJ; the operator field in the club's log
is what gives me personal credit. That is the workflow described in POTA's
[club activation guide](https://docs.pota.app/docs/activator_reference/activator_guide_clubs.html).

This was the difference between the station call and the operator call: I used
K2HRC on the air, while N1RWJ identified me as the operator. I had done the same
thing before with [K1NQG](https://www.qrz.com/db/K1NQG), the Fidelity Amateur
Radio Club call, during one of our club POTA outings.

## Setting up 135 feet of Spooltenna wire

The [Spooltenna Ultra](https://www.spooltenna.com/products/spooltenna-ultra-efhw4010)
normally carries its own 40-through-10-meter EFHW wire. For this activation I
left that wire packed and plugged in the
[PARKS 80-meter accessory wire](https://www.spooltenna.com/products/parks-80m-antenna-wire-accessory)
instead. Spooltenna sells the accessory for its PARKS model, but it comes ready
to use on what the company calls a SpareSpool and plugs into the same style of
banana jack as the Ultra's standard wire. It also includes a low-profile
PCB-trace compensation coil. In this setup it was an especially clever way to
turn the Ultra transformer and spool into an 80-through-10-meter antenna.

The underlying Spooltenna is also essentially an open-source hardware design:
the [KiCad design files are on GitHub](https://github.com/modulo8/KO4HUI-Spooltenna)
under a Creative Commons Attribution-ShareAlike license. I have exchanged email
with the people behind it a couple of times, and they have been great to talk
with.

I had never deployed a full 80-meter-length wire before, and I was surprised by
just how far 135 feet kept going. I ran it roughly north to south, hoping the
broadside of the antenna would favor paths westward across the United States.
The far end was about 35 feet up in a tree, while the feed point was supported
by a 20-foot carbon-fiber POTA20 mast. The available supports made it difficult
to keep the higher part of the wire as taut as I wanted.

<div class="photo-grid photo-grid--single">
  <img src="/images/pota/2026-07-18-k2hrc-rhode-island-pota/80-meter-efhw-setup.jpg" alt="The 135-foot Spooltenna end-fed half-wave running high through the trees above the JL Curran operating site">
</div>

The first SWR sweep was confusing. I used the RigExpert analyzer's Multè
function, which sweeps the selected bands and presents a compact summary of
which ones are resonant. The six-band view stayed below 3:1 on every band shown,
even though the readings did not look as good as I expected:

| Band | Coax-only SWR |
| --- | ---: |
| 80 meters | 2.89:1 |
| 60 meters | 2.23:1 |
| 40 meters | 2.05:1 |
| 30 meters | 2.58:1 |
| 8 meters | 2.91:1 |
| 6 meters | 2.64:1 |

The explanation turned out to be simple: I had connected the coax but had not
plugged in the radiating element. The coax by itself was producing surprisingly
plausible readings, but it was not the antenna I meant to test.

Thankfully, I did not have to take down the whole antenna. I lowered the feed
point from the mast, connected the radiating element, and raised it again. The
second Multè sweep looked excellent across almost the entire HF range:

| Band | SWR |
| --- | ---: |
| 80 meters | 1.03:1 |
| 40 meters | 1.34:1 |
| 30 meters | 2.13:1 |
| 20 meters | 1.19:1 |
| 17 meters | 1.93:1 |
| 15 meters | 1.59:1 |
| 12 meters | 1.69:1 |
| 10 meters | 1.32:1 |

<div class="photo-grid">
  <img src="/images/pota/2026-07-18-k2hrc-rhode-island-pota/coax-only-swr.jpg" alt="Analyzer showing deceptively usable SWR readings with only the 25-foot coax connected">
  <img src="/images/pota/2026-07-18-k2hrc-rhode-island-pota/connected-antenna-swr-low-bands.jpg" alt="Analyzer showing the corrected Spooltenna SWR readings from 80 through 12 meters">
  <img src="/images/pota/2026-07-18-k2hrc-rhode-island-pota/connected-antenna-swr-high-bands.jpg" alt="Analyzer showing the corrected Spooltenna SWR readings from 40 through 10 meters">
</div>

Those readings resolved the electrical mystery. The remaining question was how
the improvised route through all those branches and leaves would perform on the
air.

I also used a new feed line that came from Spooltenna: 25 feet of
[ABR Industries RG-174](https://www.spooltenna.com/products/25-rg-174-coax-with-5-ferrites-bnc-male-to-bnc-male)
with an integrated choke made from five ferrite beads. I bought it with the
80-meter wire during Spooltenna's Fourth of July sale. The bright orange outer
sheath is easy to see in the woods, and the cable coils smoothly without
kinking as readily as the RG-316 I usually carry. Having the choke integrated
also meant one less separate part to find and connect.

[ABR's published specifications](https://abrind.com/wp-content/uploads/2025/06/ABR174-21174.pdf)
show slightly less loss for this low-loss RG-174 than for its
[RG-316](https://abrind.com/wp-content/uploads/2024/05/ABR316-23316-3.pdf).
The RG-174 has lower power handling, but still more than enough at HF for my
100-watt-or-less stations. For this activation, its flexibility and visibility
were the more meaningful differences.

I also intentionally used the coax shield as the EFHW's counterpoise. I placed
the five ferrite beads at the radio end, leaving roughly 20 feet of coax between
the feed point and the choke to provide the return path. The choke then kept
that common-mode current from continuing into the radio side of the station.

## Weather, smoke, and the short window

The late-morning forecast at the park was cloudy, warm, and breezy, with the
chance of rain increasing around 1:00 PM and heavier weather expected after
that. Canadian wildfire smoke was also affecting the area.

The thunderstorms ultimately ended the activation. I heard local thunder and
started tearing the station down in a hurry, including all 135 feet of wire.

## Four on 40, then a busy 20 meters

There was nothing wrong with the antenna, but routing 135 feet of wire through
the woods took longer than I had hoped. It kept catching on branches and leaves
as I raised and tensioned it. By the time it was working, there was not enough
room in the schedule to divide the activation between voice and Morse code, so
I stayed on SSB and ran the FT-891 at 75 watts.

I started on 40 meters and made four contacts between 15:41 and 15:48 UTC. One
was a park-to-park. The band had a lot of QRN that sounded like nearby lightning
crashes. It was hard to pull callers out of the noise, which made me want to
move to 20 meters.

Twenty was packed. Between regular weekend activity and Summer Support Your
Parks, it took about ten minutes of searching up and down the band to find an
open spot. I settled on 14.341 MHz and stayed there for the rest of the
activation.

Once I started calling CQ, the response was steady without becoming
unmanageable. There were a few gaps where another CQ did not bring an immediate
answer, but most of the run kept moving. I logged 19 contacts on 20 meters in
about 16 minutes, including six more park-to-parks. Twenty was also surprisingly
short, putting New York in the log alongside the longer paths.

The last QSO went into the log at 16:12:30 UTC. I then heard local thunder,
which forced me to stop operating and tear down the station quickly.

## What worked

- The correctly connected Spooltenna 80-meter wire produced excellent multiband SWR and worked well on both bands I used.
- Twenty meters supported a steady SSB run even though finding an open frequency took time.
- Twenty meters was short enough to reach New York while still supporting contacts much farther west.
- Running 75 watts from the FT-891 was a good fit for the short operating window.
- The thin RG-174 feed line and integrated five-bead choke simplified the field setup.
- Ham2K PoLo was awesome as always. I love PoLo and the work its primary developer, [Sebastián Delmont, KI2D](https://www.qrz.com/db/KI2D), has done with it; now that he is working on it full time, I am excited to see what comes next.

## To adjust next time

- Practice deploying the full 135-foot wire and plan the anchor points before raising it.
- Confirm that the radiating element is attached before trusting a surprisingly broad SWR sweep.
- Budget more setup time whenever the antenna configuration is new.
- Add more common-mode choking only if later testing shows that the convenient five-bead choke needs help.
- Set up the 80-meter wire when I have more time for more thorough radiation-pattern analysis and on-air tests.
