---
title: Adjusting a K8CES Zippy Paddle
date: 2026-08-13
summary: "A practical guide to setting the contact spacing, travel, balance, and mounting of a K8CES Zippy paddle to match how you send."
visibility: draft
tags:
  - radio
  - cw
  - builds
---

<!--
UNPUBLISHED WORKING DRAFT

Finish this while adjusting and testing the HamXposition giveaway batch. Before
publishing, confirm the best adjustment order, document which direction moves
each contact point, add close photographs of all four adjustment screws, and
record the most common symptoms from the completed paddles.
-->

Building a [K8CES Zippy Paddle](/notes/2026-07-29-building-k8ces-zippy-paddle/)
gets all the pieces into the right place. Adjusting it is what makes the small
printed paddle feel like my paddle rather than merely a finished assembly.

The Zippy provides separate controls for electrical contact and physical
travel. There is no single correct setting. The useful target is a clean,
repeatable closure on both sides with enough movement to feel deliberate and
not so much movement that sending becomes tiring.

## Begin with a known electrical state

Before changing the feel, connect a known-good 3.5 mm TRS cable and use a
multimeter in continuity mode:

- Sleeve to tip and sleeve to ring should both remain open at rest.
- Pressing one paddle should close only sleeve to tip.
- Pressing the other paddle should close only sleeve to ring.
- Sleeve should always have continuity to the center body screw and brass
  standoff.

If either paddle is already closed at rest, correct that before connecting the
key to a radio or keyer.

## Know which screws change what

Four M3 set screws control the feel of the paddle:

- The two screws entering through the sides of the top limit physical paddle
  travel. Threading a side screw farther in shortens that side's movement;
  backing it out allows more movement.
- One screw inside each paddle establishes the electrical contact point against
  the common center standoff.

Treat those as two related adjustments rather than trying to fix everything
with one screw. The contact needs to close reliably within the available
travel, while the travel stop needs to leave a small, comfortable amount of
movement around that contact point.

## Establish a comfortable starting point

Begin with slightly more travel than I think I want. Work on one side at a time
and make small changes, checking continuity after every adjustment. Once both
sides close reliably, shorten their travel gradually until the paddle feels
responsive without becoming easy to trigger accidentally.

Compare the two sides after every few changes. They do not need to be
mathematically identical, but a large difference in travel or contact timing is
easy to feel while sending.

## Test by sending, not only with a meter

A continuity tester proves that the circuit closes. It does not show whether
the paddle feels good through a complete word or whether a marginal adjustment
causes missed or extra elements at speed.

Connect the Zippy to a keyer and send at the speed I normally use. Include
characters that alternate sides, repeated dits, repeated dahs, and several
ordinary words. Pause, return both paddles to rest, and repeat the test after a
few minutes of use.

If dit and dah are opposite my preference, reverse the paddle assignment in
the radio or keyer rather than reopening a correctly wired paddle.

## Give the magnets something useful to grip

The three magnets in the base are most effective on a flat steel plate. The
plate can be part of a desk base, field clipboard, leg mount, or other operating
surface. Check that all three magnets sit evenly and that the cable does not
pull the key sideways while sending.

## Diagnose the feel

- **A contact remains closed at rest:** increase the applicable contact gap,
  then repeat the complete continuity check.
- **A side misses elements:** confirm electrical continuity, then check that
  the contact closes before the physical travel ends.
- **One side feels much longer:** compare the two side travel-stop screws and
  adjust in small increments.
- **The paddle does not return freely:** check for trapped or taut internal
  wire, case distortion from overtightened body screws, or a paddle shaft that
  is not seated cleanly in both bearings.
- **The key moves while sending:** use a larger steel plate, reposition the
  cable, or add a nonslip surface beneath the plate.

## What remains to verify

The giveaway batch will provide enough examples to turn this starting method
into a repeatable adjustment sequence. I still need to document the screw
directions photographically, decide how much initial travel makes the easiest
baseline, and record which adjustments most often differ between newly
assembled paddles.
