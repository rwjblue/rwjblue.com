---
title: Flight of the Bumblebees from Block Island
date: 2026-07-26
summary: "A windy West Beach activation put 62 five-watt CW contacts in the log, including a surprising 15-meter run to Alaska, Oregon, California, and Spain."
shareImage: /images/pota/2026-07-26-flight-of-the-bumblebees-from-block-island/2-photo-2.jpg
contactMap: src/data/pota/contact-maps/2026-07-26-flight-of-the-bumblebees-from-block-island.json
series:
  slug: flight-of-the-bumblebees-2026
  title: Flight of the Bumblebees 2026
  order: 3
tags:
  - radio
  - pota
  - field-notes
  - cw
  - antennas
  - contest
  - us-0513
---

My first [Flight of the
Bumblebees](https://ars-qrp.com/FOBB/FOBB.html) could hardly have gone better.
I finished with 62 five-watt CW QSOs from West Beach inside
[Block Island National Wildlife Refuge,
US-0513](/radio/pota/US-0513/), and I had an absolute blast.

The [plan changed several
times](/notes/2026-07-26-flight-of-the-bumblebees-block-island/) before I
reached the island. The final version was simpler than any of them: one
Rybakov-style vertical, one battery, and the same antenna configuration on
every band. Twenty meters supplied the long main run, but moving to 15 meters
late in the afternoon produced contacts with Alaska, Oregon, California, and
Spain.

<div class="photo-grid photo-grid--single">
  <img src="/images/pota/2026-07-26-flight-of-the-bumblebees-from-block-island/2-photo-2.jpg" alt="N1RWJ standing on West Beach with the 25-foot vertical and Block Island Sound behind him">
</div>

## At a glance

- **Where:** West Beach inside [Block Island National Wildlife Refuge,
  US-0513](/radio/pota/US-0513/), Block Island, Rhode Island
- **When:** July 26, 2026, 16:53 to 19:57 UTC (12:53 to 3:57 PM EDT), with a
  break around 2:30 PM
- **Activation:** 62 CW QSOs at five watts; 46 on 20 meters, 15 on 15 meters,
  and 1 on 40 meters
- **FOBB:** Bumblebee number 121; 60 QSOs fell within the official event window
- **Radio:** Elecraft KX3
- **Antenna:** [REZ Scout XF](/radio/equipment/rez-scout-xf/), 25-foot [Z]-25 whip, XFORM 4:1, and four 33-foot
  radials, including two laid into the wet sand
- **Power:** One [3 Ah Bioenno LiFePO4 battery](/radio/equipment/bioenno-3ah/) for the entire operation,
  including some phone charging
- **CW gear:** Zippy key and Ham2K PoLo

## Finding the West Beach parcel

We reached Block Island around 10:00 AM. My wife rented a moped, while I rented
a bicycle and followed the signs and roads toward the transfer station. From
there, the directions from a friend were accurate: continue toward the beach,
walk beside the fence, go over the hill, and look for the giant driftwood log.

The refuge boundary was much easier to verify on the ground than I had feared.
The fence led to a signed National Wildlife Refuge boundary, and the operating
position was just inside it on the beach. That resolved the most important
uncertainty from the planning note without requiring me to rely only on the
GeoJSON polygon.

<div class="photo-grid">
  <img src="/images/pota/2026-07-26-flight-of-the-bumblebees-from-block-island/7-photo-7.jpg" alt="Narrow path through beach grass following the tall fence toward West Beach">
  <img src="/images/pota/2026-07-26-flight-of-the-bumblebees-from-block-island/6-photo-6.jpg" alt="National Wildlife Refuge boundary sign beside the sand and beach grass at West Beach">
</div>

## The tarp loses to the wind

The one setup that did not work was the shade shelter. I got the ENO ProFly
tarp connected to the fiberglass poles, but a roughly 20-mph wind from the
north kept pushing them over. The sandy ground did not give my stakes enough
purchase to hold the load.

After fussing with it for a while, I gave up on the tarp. That was fine: I was
not uncomfortably hot, and the top of my backpack provided enough cover to
keep direct sun off the radio. Shade would have been nice, but it was not worth
delaying the activation any further. Between the bicycle ride, finding the
site, and the tarp experiment, my first QSO did not go into the log until
12:53 PM.

## One antenna configuration for everything

I deployed the full Rybakov configuration immediately: the 25-foot whip,
XFORM 4:1, and all four 33-foot radials. Two of the radials reached into the
wet sand close to the water. Rather than shortening the whip and removing the
transformer for 20 meters, I left this configuration in place all afternoon
and let the KX3's tuner handle 20, 15, and 40 meters.

That choice removed an entire class of interruptions. I never had to collapse
the whip, move the transformer, or disturb the radials when changing bands.
The 3 Ah Bioenno battery also made the power plan simpler than expected. It
lasted through the entire activation and still supplied some phone charging,
so I never needed to swap in the second radio battery.

<div class="photo-grid">
  <img src="/images/pota/2026-07-26-flight-of-the-bumblebees-from-block-island/3-photo-3.jpg" alt="West Beach operating position beside the giant driftwood log, with the red chair, station bag, and vertical antenna near the water">
  <img src="/images/pota/2026-07-26-flight-of-the-bumblebees-from-block-island/4-photo-4.jpg" alt="View from the operating chair along the orange feed line toward the 25-foot vertical at the edge of Block Island Sound">
</div>

## Combining FOBB and POTA on CW

I wanted callers to understand that I was operating both FOBB and POTA, so I
called:

```text
CQ CQ BB POTA DE N1RWJ N1RWJ/BB
```

My first version of the exchange was:

```text
<CALL> TU UR 599 599 RI RI BB 121 BK
```

That created an unexpected ambiguity. Operators expecting only a normal POTA
exchange sometimes heard the first `B` of `BB` and assumed I was sending `BK`.
They started transmitting before I could send `121`.

Changing `BB` to `NR` fixed it:

```text
<CALL> TU UR 599 599 RI RI NR 121 NR 121 BK
```

That was slightly longer, but the complete exchange made it through much more
reliably. I also needed a few contacts to understand why some non-Bumblebee
stations sent a number followed by `W`: the FOBB home-station exchange includes
power output rather than a Bumblebee number.

Unexpected prose was harder than the standard exchange. A couple of stations
sent something longer that I could not make out. I fell back to:

```text
SRI NEW OP
```

Then I sent my exchange again. That was enough to reset the contact. Next time
I want `AGN?`, `QRS PSE`, `NR?`, and `PWR?` ready so I can ask for the missing
piece without restarting everything.

Cross-checking the callsigns against the [official Bumblebee registration
list](https://ars-qrp.com/FOBB/Process_Get_All_By_Number.php) shows 23
Bumblebee contacts in the log. I copied N8HN's number as `13?`; the list
confirms that it was 13.

## Twenty meters, lunch, and a surprising fifteen

Twenty meters carried most of the activation. I made 46 contacts there,
including the two immediately before the official 1:00 PM FOBB start. The pace
was steady without becoming overwhelming.

Around 2:30 PM I took a break to stretch my legs and help my wife find the
operating position. We had stopped at the local grocery store for sandwiches,
which was an excellent suggestion from
[K1NW](https://www.qrz.com/db/K1NW). We also brought a couple cans of The
Substance, one of my favorite beers from Bissell Brothers.

After lunch, I had been on 20 meters long enough that trying 15 seemed
worthwhile. That decision transformed the end of the activation. I logged 15
contacts on the band, including my buddy
[KK7D](https://www.qrz.com/db/KK7D) in Oregon,
[KO6A](https://www.qrz.com/db/KO6A) in California,
[KL7AC](https://www.qrz.com/db/KL7AC) in Alaska, and
[EA2WX](https://www.qrz.com/db/EA2WX) in Spain.

I cannot separate the propagation from the saltwater location, but hearing
those stations answer a five-watt signal from the edge of Block Island Sound
was astonishing. I finished with one contact on 40 meters and one final contact
back on 20 before shutting down for the ride to the ferry.

<div class="photo-grid photo-grid--single">
  <img src="/images/pota/2026-07-26-flight-of-the-bumblebees-from-block-island/1-photo-1.jpg" alt="Two cans of Bissell Brothers The Substance raised in a toast beside the water during a break">
</div>

## What worked

- The fence, boundary sign, and friend's directions led to an excellent
  operating position inside US-0513.
- The full Rybakov configuration worked across every band without a physical
  antenna change.
- All four radials fit on the beach, with two reaching the wet sand.
- Checking 15 meters produced the most memorable contacts of the day.
- Replacing `BB 121` with `NR 121 NR 121` removed the ambiguity for POTA
  callers.
- One 3 Ah battery was enough for the radio and some phone charging.

## To adjust next time

- Give an optional tarp experiment a firm time limit when the radio setup is
  waiting.
- Use anchors intended for loose sand before trying the same shelter in strong
  wind.
- Start a combined FOBB and POTA run with `NR 121` instead of `BB 121`.
- Remember that a non-Bumblebee's exchange includes power output.
- Keep a few targeted fills ready for unfamiliar exchanges.
- Check 15 meters earlier rather than treating it as an afterthought.

The original idea was to make a simple dipole and operate at a familiar local
park. Instead, I rode a bicycle to a signed refuge parcel on Block Island,
worked Spain and Alaska with five watts beside the saltwater, ate sandwiches
with my wife on the beach, and returned to the ferry already wanting to do it
again. That was a much better Flight of the Bumblebees.
