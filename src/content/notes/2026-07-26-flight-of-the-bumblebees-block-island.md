---
title: Taking Flight of the Bumblebees to Block Island
date: 2026-07-26
summary: "A West Beach lead turns my Block Island FOBB plan toward a saltwater vertical and a careful boundary check for US-0513."
boundaryMap:
  title: US-0513 boundary parcels on Block Island
  subtitle: "USFWS boundary polygons for Block Island National Wildlife Refuge. These identify the reference parcels, not guaranteed public access or antenna sites."
  geoJson: /data/pota/boundaries/us-0513.geojson
  sourceLabel: USFWS National Realty Boundaries
  sourceUrl: https://gis-fws.opendata.arcgis.com/datasets/fws::fws-national-realty-boundaries/explore
series:
  slug: flight-of-the-bumblebees-2026
  title: Flight of the Bumblebees 2026
  order: 2
tags:
  - radio
  - pota
  - field-notes
  - cw
  - antennas
  - contest
  - us-0513
---

My original
[Flight of the Bumblebees plan](/notes/2026-07-26-flight-of-the-bumblebees/)
was deliberately simple: choose a nearby Rhode Island park, put a resonant
dipole in a tree, and spend Sunday afternoon operating five-watt CW.

Then my wife suggested that we make a day trip to Block Island.

That is a much better outing, but it changes both parts of the radio plan.
West Beach is now the leading operating location, provided that my station is
inside [Block Island National Wildlife Refuge,
US-0513](/radio/pota/US-0513/). An open beach also favors a compact vertical
antenna rather than sixty feet of wire looking for a tree.

## The boundary still matters

My first thought was to operate somewhere near North Light or Sandy Point. The
[USFWS visitor information](https://www.fws.gov/refuge/block-island/visit-us)
says the refuge is about four miles from the ferry landing and describes the
walk to North Light as being bordered by refuge lands. That does not mean the
entire beach, lighthouse area, or northern end of the island is automatically
inside the POTA reference.

The official USFWS boundary data shows a collection of disconnected parcels.
They include land near the northern tip, a parcel along West Beach, and inland
property near Corn Neck Road. The map below renders the current USFWS National
Realty Boundaries GeoJSON for the refuge.

This is useful evidence for deciding whether a coordinate is inside US-0513,
but it is not an access map. USFWS describes the data as resource-grade and
warns that not every mapped area is open to visitors. A valid POTA position
still needs lawful public access, a safe place to stop, and compliance with any
on-site closures.

## A better lead at West Beach

A friend who knows the island offered a much more specific possibility. His
directions are to continue beyond the transfer station toward West Beach, walk
with the fence on the right, go over the hill, and look for a giant driftwood
log on the beach. He described it as an excellent place to operate.

That route is consistent with the published West Beach access information.
[ExploreRI](https://exploreri.org/siteReport.php?siteID=131&src=criteria)
describes a rough dirt road past the transfer station, a small parking area,
and an approximately 150-foot carry to an open sand-and-cobble beach. It also
warns that some sections of West Beach are town property while others belong
to the refuge.

The published West Beach access coordinate appears to be just south of the
current USFWS parcel. The mapped refuge boundary reaches the beach roughly 470
feet farther north, near
[41.209466, -71.577879](https://www.google.com/maps/search/?api=1&query=41.209466%2C-71.577879).
A point around
[41.209700, -71.577500](https://www.google.com/maps/search/?api=1&query=41.209700%2C-71.577500)
is inside the resource-grade polygon and still immediately beside Block Island
Sound.

I do not yet know whether the giant log is at that point or merely near the
ordinary public access. I should not treat the first patch of beach at the end
of the road as the activation site. A dropped pin would help, but in either
case I will continue north and verify that my phone shows a comfortable margin
inside the parcel before unpacking. The map establishes a useful target, not
permission to cross a fence, enter a closure, or set up on private property.

[WB4SON's 2023 Block Island report](https://wb4son.com/wpblog/?p=4890) keeps
[Skipper's Island Road](https://www.google.com/maps/search/?api=1&query=41.2031732%2C-71.5717162)
as a defensible inland fallback. WB4SON and W1LY operated from a refuge parcel
there using a whip and a mast-supported wire antenna.

## The beach changes the antenna

My preference for the linked dipole depended on finding a tree or a protected
clearing. If the operating position is literally on West Beach, a vertical
radiator has a smaller footprint and can take advantage of the conductive
saltwater immediately to the west. An
[ARRL QEX analysis](https://www.arrl.org/files/file/QEX_Next_Issue/May-Jun_2011/QEX_5_11_Siwiak.pdf)
helps explain why vertically polarized antennas beside seawater can produce
especially useful low-angle radiation.

Almost the entire antenna is one modular REZ system: the
[Scout XF base](https://www.rezantenna.com/product-page/scout-xf),
[[Z]-25 whip](https://www.rezantenna.com/scout), and
[XFORM 4:1](https://www.rezantenna.com/product-page/xform-4-1). I can use those
parts in two configurations:

- On 20 meters, I will mount the [Z]-25 directly on the Scout XF, shorten it to
  approximately 16 feet 8 inches, and direct-feed it as a resonant quarter-wave
  vertical. This should be the most efficient configuration for the primary
  FOBB band.
- On 40 meters, I will extend the [Z]-25 to its full 25 feet, add the XFORM
  4:1, and use the radio's tuner. That produces the familiar nonresonant
  [Rybakov configuration](https://wb3gck.com/2018/12/09/revisiting-the-rybakov-806-vertical/)
  for the later regional activity.

The four 33-foot radials are also from REZ: the
[[Z]QD Radial Expansion Kit](https://www.rezantenna.com/product-page/radial-expansion-kit),
preassembled with 4mm banana plugs that connect directly to the Scout XF. The
same set can remain deployed for both configurations. I may not have enough
safe space to spread all four on the beach, so I will use as many as I can keep
flat on the sand without crossing the walking route or reaching into the
rising tide. Multiple radials should make the feed system less dependent on
the coax as an accidental counterpoise. I will also use short coax and place
the common-mode choke at the antenna feedpoint.

Changing bands means collapsing or adjusting the whip and inserting or
removing the XFORM 4:1, but it avoids lowering and relinking a full dipole. I
already have notes for how many whip segments to extend on 20 meters, so I can
follow those and check the installed resonance once I am on the beach. The
tuner should be bypassed on 20 meters unless a small final correction is
necessary.

I will begin near 14.036 MHz with the resonant 20-meter configuration. After
the initial FOBB activity slows, I can extend the whip, install the XFORM 4:1,
retune near 7.036 MHz, and check 40 meters.

The remaining mechanical problem is wind rather than antenna footprint. If the
driftwood log is stable and using it causes no damage, a padded strap may help
restrain the whip base. Light guys and the loaded station pack can provide
additional support without relying on a ground stake.

## Power in two stages

The KX3 will run at five watts during FOBB. If the schedule leaves time for a
POTA activation before the event, I may use up to ten watts for that and then
turn it back down.

For a rough battery budget, I am assuming 0.2 amp while receiving, approximately
1.2 amps while transmitting at five watts, and 1.8 amps at ten watts. At a
25-percent active-CW transmit duty cycle, that works out to an average draw of
about 0.45 amp at five watts or 0.6 amp at ten watts. A 3 Ah battery therefore
represents about 6.7 hours of five-watt operating in the ideal calculation, or
roughly 5.3 hours after reserving 20 percent of its capacity. The
[KX3 manual](https://ftp.elecraft.com/KX3/Manuals%20Downloads/E740163%20KX3%20Owner%27s%20man%20Rev%20C5.pdf)
quotes 0.15 to 0.25 amp on receive and 1 to 3 amps on transmit, while a
[QST battery study](https://www.arrl.org/files/file/QST/This%20Month%20in%20QST/March2020/Mayer.pdf)
uses the same 25-percent duty cycle for active full-break-in CW.

One battery should cover the shortened FOBB session, but I have two matching
3 Ah LiFePO4 packs. I will use the first for setup and any earlier POTA
operation, then swap in the fully charged second pack immediately before FOBB.
Keeping them separate provides six amp-hours of total capacity without
paralleling the packs, and a battery or connector problem does not end the
activation.

I will also carry a lightweight 5,000 mAh USB-C PD bank and trigger cable as a
phone reserve and third way to power the radio. I have already confirmed that
it holds the expected voltage during transmit and does not add switching noise
on 20 or 40 meters.

## A possible patch of shade

I also have an
[ENO ProFly hammock rain tarp](https://www.rei.com/product/814104/eno-profly-hammock-rain-tarp)
that I picked up from REI during the Florida trip. It is a lightweight hex tarp,
compact enough for the ferry but large enough to give me and the radio a useful
patch of shade. Although it is designed for a hammock, it can also be pitched
independently.

One of my fiberglass masts and the driftwood log may let me pitch it low as a
small shaded operating shelter. I do not want to attach it to the antenna whip:
the tarp would add substantial wind load to the radiator and its support.
Using a separate mast also lets me abandon the shade quickly without disturbing
the station.

This needs a practice setup before it earns space on the ferry. The tarp and
its lines must fit alongside the radials without creating a web across the
public beach, and an 11-to-13-mph wind may make a low, wind-aligned pitch more
important than the extra shade.

## Ferry, weather, and tide constraints

The published
[2026 Block Island Ferry schedule](https://www.blockislandferry.com/wp-content/uploads/2026/04/2026schedule-FINAL.pdf)
has the Newport high-speed ferry leaving at 9:10 a.m. and the return leaving
Block Island at 5:00 p.m. The crossing is approximately one hour, and passengers
must be aboard at least fifteen minutes before departure.

That should leave enough time to reach West Beach and deploy before FOBB starts
at 1:00 p.m., but I still need to arrange transportation between Old Harbor and
the beach. The return ferry does not allow me to operate through the official
5:00 p.m. finish. Once the return ride is settled, I can choose a firm QRT time
around 3:45 or 4:00 and leave enough margin to tear down and check in.

The current
[National Weather Service forecast](https://forecast.weather.gov/MapClick.php?FcstType=text&lat=41.161&lg=en&lon=-71.584&unit=1)
is sunny with a high near 75 degrees and an east wind around 11 to 13 mph.
That should be a pleasant day for a trip, but an exposed 25-foot whip still
needs deliberate support.

The
[NOAA prediction for Block Island](https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8459338&units=standard&bdate=20260726&edate=20260726&timezone=LST/LDT&clock=12hour&datum=MLLW)
for the Old Harbor station places low tide around 11:46 a.m. and high tide
around 6:45 p.m. Exact timing can differ on West Beach, but the useful fact is
that the water will be rising throughout my operation. Radials and equipment
that seem safely above the water when I arrive still need to remain above the
high-water wrack line.

## What remains to verify

Four checks remain:

- locate the giant log and confirm an accessible operating position comfortably
  inside the refuge boundary;
- arrange transportation to West Beach and a return pickup that leaves enough
  time for the ferry;
- confirm that my recorded [Z]-25 segment setting is resonant once installed on
  the beach, then confirm that the tuner can match the full whip through the
  XFORM 4:1 on 40 meters; and
- practice pitching the ProFly with a separate mast, then decide whether its
  shade justifies its wind load and footprint.

With those settled, the ferry load becomes straightforward: the Scout XF,
[Z]-25, XFORM 4:1, [Z]QD radials, short coax and choke, antenna support lines
and strap, radio, two 3 Ah batteries, the small USB-C bank and trigger cable,
key, headphones, logging gear, water, and sun and insect protection. If the
practice setup works, the tarp, its lines, and one fiberglass mast join the
load. The linked dipole, throw line, and Challenger can stay home. What began
as a search for a tree has turned into a compact saltwater station with a very
promising western horizon.
