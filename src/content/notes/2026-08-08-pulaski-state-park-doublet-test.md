---
title: First Field Test of a 58-Foot Doublet at Pulaski State Park
date: 2026-08-08
summary: "A tree-supported 58-foot doublet produced 12 five-watt CW QSOs on four bands, including Spain on 15 meters."
shareImage: /images/pota/2026-08-08-pulaski-state-park-doublet-test/picnic-table-site.jpg
contactMap: src/data/pota/contact-maps/2026-08-08-pulaski-state-park-doublet-test.json
tags:
  - radio
  - pota
  - field-notes
  - antennas
  - cw
  - us-7508
---

I went to [Pulaski State Park, US-7508](/radio/pota/US-7508/) with two
goals: activate another new-to-me Rhode Island park and find out whether my
new 58-foot doublet was genuinely practical away from home. The antenna needed
a center support and roughly 42 to 50 feet of horizontal room, so the site
would matter almost as much as the radio.

Pulaski supplied an almost ideal answer. I found a shaded picnic table a little
way back from the water and main recreation area, with a broad overhead branch
and clear space for both legs of the antenna. The center went to approximately
30 feet without needing the mast I had carried, and the finished station
produced 12 five-watt CW contacts on four bands. The third contact was Spain on
15 meters.

![A shaded picnic-table operating site among the pines at Pulaski State Park](/images/pota/2026-08-08-pulaski-state-park-doublet-test/picnic-table-site.jpg)

## At a glance

- **Where:** [Pulaski State Park, US-7508](/radio/pota/US-7508/), Chepachet, Rhode Island
- **When:** August 8, 2026; contacts from 12:41 to 2:47 p.m. EDT
- **Activation:** 12 CW QSOs on 15, 17, 30, and 20 meters
- **Radio:** [Elecraft KX2](/radio/equipment/elecraft-kx2/) at 5 watts
- **Antenna:** 58-foot doublet with two 29-foot legs and 28 feet of homebrew balanced feed line
- **Support:** An overhead branch and [throw line](/radio/equipment/throw-line-kit/); center about 30 feet and ends about 10 feet high
- **Orientation:** Broadside approximately northeast toward Europe and southwest toward the southeastern United States
- **CW gear:** [N3ZN ZN-Lite II paddle](/radio/equipment/n3zn-zn-lite-ii/), also sold as the QRP-Lite II
- **Operating position:** A shaded picnic table above the water and recreation area

## The park solved the deployment problem

My fallback plan was a 30-foot DX Commander mast with the antenna ends brought
down to about five feet. That geometry needs roughly 50 feet of clear span and
would have been workable, but the tree made the deployment much simpler. The
throw landed cleanly over the branch, so I used it for the center support and
let the 28-foot feed line drop toward the table.

The limb put the center at approximately 30 feet while both ends were closer
to 10 feet above ground. Treating the installation as symmetric and ignoring
sag, each 29-foot leg dropped about 20 feet and projected about 21 feet
horizontally. That reconstructs to a span near 42 feet and an included apex
angle of approximately 93 degrees. Those are useful estimates, not surveyed
dimensions.

I ran the radiator roughly northwest-southeast, putting its broadside direction
approximately northeast-southwest. That favored Europe in one direction and
the southeastern United States in the other. Just as importantly on a hot,
sunny afternoon, the tree kept both me and the station in the shade. The lawn,
building, and parking area were visible downhill through the trees, but this
picnic site remained comfortably apart from the busier part of the park.

<div class="photo-grid">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/antenna-center-support.jpg" alt="Center of the doublet suspended from a leafy overhead branch">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/doublet-inverted-v.jpg" alt="One leg of the doublet sloping through the trees from its high center support">
</div>

![A red antenna support line descending through the woods to a low tie-off](/images/pota/2026-08-08-pulaski-state-park-doublet-test/radiator-end-tieoff.jpg)

## The station, and one misleading tune

At the table, the balanced feed line terminated at a BNC binding-post adapter
and a Mix 31 common-mode choke from the makers of the PAC-10A. A three-foot
RG-8X jumper connected the choke to the KX2. The N3ZN paddle sat on its weighted
magnetic base beside the radio.

The KXAT2 found usable matches everywhere I intended to operate:

| Band | Best matched SWR |
| --- | ---: |
| 80 meters | No match |
| 60 meters | 1.6:1 |
| 40 meters | 1.8:1 |
| 30 meters | 1.0:1 |
| 20 meters | 1.0:1 after a second ATU search |
| 17 meters | 1.0:1 |
| 15 meters | 1.0:1 |
| 12 meters | 1.0:1 |
| 10 meters | 1.3:1 |

Twenty meters briefly looked like the failure in an otherwise encouraging
test. The first ATU attempt stopped around 2.7 to 3.0:1. When
[W1WC](https://www.qrz.com/db/W1WC) told me to “hit tune a second time,” I
thought he was joking. He was pointing me to the procedure in the
[KX2 Owner's Manual](https://ftp.elecraft.com/KX2/Manuals%20Downloads/KX2%20owner%27s%20man%20B2.pdf):
tap ATU again within five seconds to make the tuner search more deeply for a
difficult load. That second search reached 1.0:1.

I had initially wondered whether the antenna needed a different feed-line
length. It did not. I needed to use the tuner correctly. I had not yet retried
40 or 60 meters with the same procedure, so their recorded results may not be
the best matches the KXAT2 can find. Eighty meters was outside both the tuner's
range and my design goal.

<div class="photo-grid">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/field-choke-connection.jpg" alt="Balanced feed line connected through a BNC binding-post adapter to the heat-shrink-covered Mix 31 choke">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/station-overview.jpg" alt="The complete shaded picnic-table station with the KX2, paddle, antenna connections, battery, and carrying bags">
</div>

The surprising impedance measurements, radiation-pattern model, and later
feed-line-length sweep grew into a separate
[58-foot doublet build note](/notes/2026-08-08-portable-58-foot-doublet/). This
field report only needs the practical result: the same unmodified antenna
tuned on every intended band once I used the KXAT2's full search.

## Twelve contacts across four bands

I started on 15 meters and made three contacts. The third was
[EF5Y](https://www.qrz.com/db/EF5Y) in Spain, a satisfying first DX result after
orienting the antenna broadside toward Europe. One contact cannot validate a
radiation model, but it did arrive from the direction I was trying to favor.

Seventeen meters produced four contacts, followed by two on 30 meters and
three on 20 meters:

| Band | CW QSOs |
| --- | ---: |
| 15 meters | 3 |
| 17 meters | 4 |
| 30 meters | 2 |
| 20 meters | 3 |
| **Total** | **12** |

The first QSO was at 12:41 p.m. EDT and the last at 2:47 p.m. Eleven contacts
stayed within the United States, and EF5Y supplied the one DX contact. The
20-meter group also included a park-to-park with
[AB9CA](https://www.qrz.com/db/AB9CA).

## What the outing actually established

The propagation display I was watching rated every band fair at best. It
called 80, 40, and 20 meters poor when I started, with 20 later improving to
fair. That made this a poor day for comparing antenna efficiency or judging the
doublet by contact rate alone.

It was still an excellent mechanical and operational test. The center went up
with one throw line, the inverted V fit a real park without taking over the
site, the balanced line reached the table cleanly, and the KXAT2 matched every
band I intended to use. The activation succeeded, Spain answered on 15 meters,
and the whole station was pleasant to operate for more than two hours. I had a
blast.

![The view downhill through the trees toward Pulaski State Park's recreation area](/images/pota/2026-08-08-pulaski-state-park-doublet-test/recreation-area-overlook.jpg)

<div class="photo-grid">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/operator-at-picnic-site.jpg" alt="N1RWJ at the shaded Pulaski State Park picnic-table site before setting up the antenna">
  <img src="/images/pota/2026-08-08-pulaski-state-park-doublet-test/pulaski-state-park-entrance-sign.jpg" alt="Pulaski State Park entrance sign">
</div>

That is broadly what I wanted from this antenna: one lightweight radiator for
40 through 10 meters that is easy to deploy when a park offers a center support
and enough horizontal room. One outing is not enough to make it my default, but
it earned a dedicated field bag and a place in the next round of activations.
