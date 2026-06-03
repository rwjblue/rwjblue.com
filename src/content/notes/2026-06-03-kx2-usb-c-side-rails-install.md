---
title: Installing USB-C Charging and Side Rails on My KX2
date: 2026-06-03
summary: "A first-pass walkthrough of adding USB-C charging and protective side rails to a new Elecraft KX2."
shareImageHero: /images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9040.jpg
tags:
  - radio
  - field-notes
  - kx2
  - elecraft
---

![Elecraft KX2 charging through the new USB-C port](/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9040.jpg)

I finished two small upgrades to the KX2: the
[KXUSBC2 internal USB-C charger from G7UFO](https://shop.g7ufo.radio/collections/kxusbc2-unofficial-internal-usb-c-charger-for-the-elecraft-kx2)
and the Side KX rails from
[Gems Products](https://gemsproducts.com/shop-kx/).
The KXUSBC2 replaces the KXIBC2 that came factory-installed in this radio,
using the same side-plate location to add USB-C charging. The rails replace the
stock side plates with protective handles, which should make the radio easier
to pack for portable operating without worrying as much about the knobs and
front panel.

This is a field note, not a replacement for the manuals. I am not a serious
tinkerer, and opening up a brand-new radio still makes me pause. The install
went fine, but it was not a mindless follow-the-pictures job either. My KX2 was
manufactured in mid-May 2026, and one bit of the right-side hardware did not
look like the manual photos. The useful part of this note is probably that
moment: slowing down, comparing the parts in front of me to the instructions,
and figuring out what Elecraft changed.

## At a glance

- **Radio:** Elecraft KX2, manufactured mid-May 2026
- **USB-C charger:** G7UFO KXUSBC2
- **Rails:** Gems Products / Jen's Products Side KX for the KX2
- **Extra parts:** non-rail KXUSBC2 side plate, plus an uninstalled Pro Audio
  Engineering heatsink
- **References:** the
  [KXUSBC2 project notes](https://github.com/manuelkasper/kxusbc2/) and the
  [Side KX KX2 manual](https://gemsproducts.com/wp-content/uploads/2026/05/PAE-Kx22-Manual-r4.2.pdf)
- **Why:** USB-C charging in the radio and better side protection for portable
  operating
- **Result:** USB-C charging worked; the charge indicator glowed green after
  plugging in a USB-C charger

## The parts

The G7UFO kit includes the charger board and a replacement side plate. I also
bought the protective rail version for that same side, plus the matching rail
for the other side of the radio. Before taking anything apart, I laid out the
parts and took a few photos so I could tell which screws, washers, and plates
came from which kit.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-8989.jpg" alt="KXUSBC2 kit parts laid out on a towel">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-8996.jpg" alt="KXUSBC2 replacement charging board before installation">
</div>

That was worth doing. There are enough small screws, washers, thermal pads, and
connectors involved that I did not want to rely on memory once the radio was
open. It also means I have the normal non-rail KXUSBC2 side plate left over if
I decide later that the handles are more than I want for a particular pack or
trip.

I also picked up the Pro Audio Engineering heatsink, but I left it out for now.
It adds a few ounces, and most of my portable activations are five-watt CW/SSB
outings rather than long digital-mode sessions. For now I would rather keep the
KX2 light. If I start pushing it harder, especially on digital modes, I already
have the heatsink and can add it later.

## Opening the KX2

I worked on a towel and treated the first part as slow disassembly: battery
out, side hardware off, screws kept together, and no tugging on small internal
connectors.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-8991.jpg" alt="KX2 opened with the battery compartment and RF board visible">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-8993.jpg" alt="Close view of the original side-board wiring and RF board connections">
</div>

The KXUSBC2 uses the same two RF-board connection points as the factory charger
board. In my radio the visible labels were `B` and `E`, and the replacement
board had matching red and white wiring. This was simple enough, but I was glad
I had photographed the original routing before disconnecting anything. A phone
photo is cheap insurance when the radio is open on the bench.

## The stock side plate

The factory KXIBC2 side plate came out as a small assembly with the connector
wiring, thermal material, and heat-transfer surfaces still attached.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9004.jpg" alt="Original KX2 side plate with internal thermal material and connector wiring">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9010.jpg" alt="Small parts removed from the KX2 side plate during the install">
</div>

This was the first place where "remove the side plate" covered more detail
than I expected. The parts are small, the clearances are tight, and the plate
has enough bits attached to it that I wanted to understand what was structural,
what was thermal, and what was simply coming along with the old assembly.

## The newer KX2 screw difference

The trickiest part on my radio was one right-side screw/fastener arrangement
that did not look like the pictures I was using. My KX2 was built in mid-May
2026, and the area around the PA/heatsink/side plate matches the newer
mechanical revision that Gems Products notes for KX2 radios after serial number
5441, roughly since May 2025.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9012.jpg" alt="Close view of the newer KX2 internal screw and heatsink area">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9027.jpg" alt="KX2 interior after working through the newer side-plate screw arrangement">
</div>

The manual described a small screw with only a few threads. On my radio, the
part behaved more like a longer screw threading into a small barrel-shaped
standoff. I would call it a threaded standoff or internally threaded spacer:
not a normal nut, but a little sleeve with threads inside it. As far as I can
tell, it is only receiving that screw. The screw does not pass all the way
through the standoff and attach to something on the other side.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/threaded-standoff-inside-plate.jpg" alt="Inside of the KX2 side rail showing the internally threaded standoff protruding through the plate">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/standoff-screw-outside-plate.jpg" alt="Outside of the KX2 side rail showing the screw threading into the standoff">
</div>

That was the moment where I had to stop treating the manual photo as literal
and look at what the radio was actually doing. Once I realized that the longer
screw and standoff were the newer version of the same attachment point, the
rest of the install made sense again. The important thing was not to force it.

## Moving the thermal interface over

The Side KX plate still needs to preserve the thermal path that the original
side plate provided. I reused and moved the thermal material as instructed, then
checked the coverage and alignment before reassembling the side.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9016.jpg" alt="Thermal compound and pads transferred onto the replacement KX2 side plate">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9017.jpg" alt="Replacement side plate being fitted back onto the KX2">
</div>

This was another place where going slowly mattered. The rail is a mechanical
upgrade, but it still has to behave like the original side plate electrically
and thermally. I did a dry fit before tightening everything down so I could
make sure the wires were not pinched and the plate was seating correctly.

## Fitting the rails

Once the side-plate details were sorted out, the rail install was mostly the
kind of mechanical work I expected: line up the plates, confirm the connector
openings, and tighten the hardware evenly.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9026.jpg" alt="Side KX rail plate held next to the KX2 during test fitting">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9029.jpg" alt="KX2 interior with the replacement rail side plate installed">
</div>

I checked the fit from a few angles before closing the radio. Nothing should
bow, the connector openings should line up, and the internal wiring should
still have a natural path. That is all obvious once the part is seated, but it
is much easier to catch before the case is back together.

## Closing the radio

After the internal checks, I reinstalled the battery cover and looked over the
radio from the front, back, and sides. The rails make the KX2 look a little
more field-ready, and they give the radio a much better handhold without adding
a lot of bulk.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9030.jpg" alt="KX2 battery cover back in place after the rail installation">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9035.jpg" alt="Finished KX2 with Side KX rails installed">
</div>

The last real test was simple: plug in USB-C power and see whether the charger
behaved.

<div class="photo-grid">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9039.jpg" alt="KX2 plugged into USB-C power with the new side rail installed">
  <img src="/images/radio/2026-06-03-kx2-usb-c-side-rails-install/img-9040.jpg" alt="Front view of the finished KX2 charging through USB-C with a green indicator light">
</div>

It worked. I plugged in a USB-C cable, got the green charging light, and the
radio looked happy. The first real field use came later that morning during a
[Pack Mule activation at JL Curran State Park](/notes/2026-06-03-jl-curran-state-park-pota/).
That does not make the install fully proven yet, but it did get the radio
through a normal portable CW outing.

## What I would do the same way again

- Take photos before disconnecting anything.
- Keep the original screws and small parts organized by side and step.
- Treat the instructions as the source of truth, but compare them against the
  actual radio before forcing any part.
- Dry-fit the rail before tightening the hardware.
- Check USB-C charging before putting the tools away.

## What I still want to verify

- Do a longer charge cycle and a few more portable operating sessions before
  calling the install boringly complete.
- Decide after a few activations whether the rail handles stay on full time or
  whether I prefer the normal side plate for some trips.
