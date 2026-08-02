---
title: My First NAQP CW
date: 2026-08-02
summary: "My first NAQP CW entry produced 107 contacts, 53 band multipliers, a 5,671 claimed score, and an unexpectedly useful lesson about running at my own speed."
contactMap: src/data/pota/contact-maps/2026-08-02-my-first-naqp-cw.json
tags:
  - radio
  - field-notes
  - contest
  - cw
  - naqp
  - software
---

My first [North American QSO Party CW](https://ncjweb.com/NAQP-Rules.pdf)
entry is in the books: **107 contacts, 53 band multipliers, and a claimed score
of 5,671**. I operated from home at 100 watts, took a five-hour break for a
family movie, and finished just before 1:00 AM.

The score gives me a baseline for next year, but the more useful result was
learning that running a frequency at my own speed was much more comfortable
than trying to chase faster stations across the band.

I also spent the hours before the contest building an entirely new companion
app for it. Nothing makes my brain productive quite like a deadline and
something else I am supposed to be doing.

## At a glance

- **Category:** Single Operator Assisted, Low Power
- **Exchange:** ROB RI
- **Result:** 107 QSOs, 53 band multipliers, 5,671 claimed points
- **First session:** 2:51 to 5:13 PM EDT
- **Second session:** 10:25 PM to 12:53 AM EDT
- **Radio:** [Elecraft K4D](/radio/equipment/elecraft-k4d/) at 100 watts
- **Antenna:** DX Commander vertical on 15, 20, and 40 meters, with the tuner
  somehow finding a match on 80
- **Logging:** [Ham2K Portable Logger](https://polo.ham2k.com/) (PoLo),
  accompanied by [QSO Sidecar](https://github.com/rwjblue/qso-sidecar)

| Band | QSOs | Multipliers |
| --- | ---: | ---: |
| 80m | 6 | 6 |
| 40m | 62 | 31 |
| 20m | 34 | 13 |
| 15m | 5 | 3 |
| **Total** | **107** | **53** |

## The side project before the contest

The morning began with a bee in my bonnet: what if PoLo had a local
contest dashboard beside it? That became
[QSO Sidecar](https://github.com/rwjblue/qso-sidecar), a small Rust application
that serves its own browser interface and treats PoLo as the source of truth.

[Sebastián Delmont, KI2D](https://www.qrz.com/db/KI2D), helped me understand how
to connect safely after I mentioned the idea in the PoLo Discord. Sidecar
registers a read-only client with Ham2K's LoFi sync service, lets the operator
associate a PoLo account through an email link, and then pulls the selected
operation's contacts. It can also fall back to repeated ADIF imports.

PoLo already calculates the NAQP claimed score and the QSO and multiplier
totals for each band. Sidecar rearranges those live contacts into a worked and
needed multiplier matrix, then can turn fresh Reverse Beacon Network reports
into a queue of possible needed multipliers. The entire thing is one local
Rust binary with the web interface embedded inside it. It binds only to the
local machine, and the LoFi credentials never enter the browser.

<div class="photo-grid photo-grid--single">
  <img src="/images/radio/2026-08-02-my-first-naqp-cw/qso-sidecar-demo.jpg" alt="QSO Sidecar dashboard showing synthetic NAQP CW data, band totals, a multiplier matrix, RBN candidates, and the read-only PoLo connection">
</div>

It came out much better than a contest-morning experiment had any right to.
The live score and multiplier matrix were genuinely satisfying to watch, and
the RBN panel could show where a likely needed multiplier had just been heard.

LoFi was the most exciting part of the experiment. It let me build a read-only
companion against my current operation without turning Sidecar into a second
logger or taking ownership of the contacts away from PoLo. That makes me even
more excited about the future of [Ham2K](https://ham2k.com/) now that Sebastián
is working on it full time. His "Next Logger" work already has
[CAT control being built out](https://youtube.com/shorts/TUR5RJRtq9k?si=d7nABFdYG0uCNJrC),
which directly addresses my biggest search-and-pounce frustration. Ham2K's apps
are free and open source, and anyone else excited about that future should
[support the work through Buy Me a Coffee](https://buymeacoffee.com/ham2k).

It did not become a major part of my operating, though. That was not because it
failed. I simply had too much else to process: copying CW, entering the
exchange, deciding where to tune, and keeping the radio and logger aligned.
Adding a tactical dashboard on top of that was one more thing than my brain
wanted during my first real attempt at this contest.

## Running was easier than hunting

I made my first contact at 2:51 PM, nearly an hour after the contest started,
because I was still distracted by building Sidecar. Once I finally turned my
attention to the radio, I began by searching and pouncing on 20 meters, working
my way up the band and making a few contacts on 15 as well.

Search and pounce carried an annoying amount of bookkeeping. I did not have
the radio connected to the logger, so every time I tuned to another station I
also had to update PoLo's frequency manually before entering the exchange. The
individual steps were small, but together they made every contact feel busier.

Eventually I found room around 14.062 MHz and started calling CQ. That felt
natural because it is what I normally do as a POTA activator. Sixteen contacts
followed on that frequency between 4:22 and 4:51 PM.

The K4's message memories made the simple NAQP exchange especially pleasant.
There was no serial number to change after every contact, so four memories
covered nearly the entire operating rhythm:

- **M1:** `CQ NA N1RWJ`
- **M2:** `N1RWJ`
- **M3:** `ROB RI`
- **M4:** `TU N1RWJ`

M1, M3, and M4 handled most of a run: call CQ, send the exchange, and thank the
caller. M2 and M3 were the pair I used for search and pounce. Being able to
repeat those pieces cleanly without touching the paddle worked really well.

The physical arrangement was the weak point. My hands were already at the
computer for logging, so reaching over to the radio for M1 through M4 added a
little awkward motion to every contact. My friend
[Josh, AC9M](https://www.qrz.com/db/AC9M), told me about his N1MM setup, where
the same messages are available directly from the keyboard's function keys.
That sounds much closer to the integrated workflow I want: radio frequency and
mode flowing into the logger, with the logger able to trigger the K4's
messages in return.

The biggest surprise was how much running changed the speed of the other side
of the contact. I was sending mostly around 20 WPM, occasionally dropping to
18. When I answered someone running at 30 or 35 WPM, they often continued at
their own speed unless I asked for repeats or explicitly requested QRS. When I
called CQ at 20 WPM, most callers answered somewhere around 20 to 25. I was no
longer trying to force myself into someone else's rhythm; they were entering
mine.

Callbook data also helped more than I expected. If the lookup showed a quoted
nickname, I could listen specifically for that. Even a full name narrowed the
possibilities: Michael was likely to send MIKE, for example. It was never a
substitute for copying the exchange, but having a likely answer in mind made a
fast name much easier to recognize.

I made my last afternoon contact at 5:13 PM, with 40 meters just beginning to
enter the log.

## A Spider-Man intermission

My youngest brother, [Jon, KC1YED](https://www.qrz.com/db/KC1YED), is getting
married on Tuesday, so there was plenty of family in town and the contest was
never going to own the whole day. My wife, my son Max, my brother Stephen, and
I went into Providence for a 6:00 PM showing of the new Spider-Man movie. We
loved it, and the five-hour break was a very good way to divide the operation.

I was back on the air at 10:25 PM. By then, 40 meters was wide open.

## Forty meters after dark

The evening became almost entirely a 40-meter operation. Once again, running
was the comfortable choice. I settled around 7.052 MHz and made 34 contacts
there, followed by another 17 around 7.053 MHz. The 62 total 40-meter contacts
included stations in Oregon, California, Arizona, and Utah, much farther west
than I expected to reach that night.

Then I tried 80 meters with the same DX Commander. The 40-meter element is not
remotely resonant on 80, and a tuner finding a match does not turn it into an
efficient 80-meter antenna. Still, it worked. Six stations answered me: Maryland,
Rhode Island, Michigan, New Jersey, Ontario, and Quebec. Every contact was a
new multiplier on the band, so the strange antenna experiment contributed six
QSOs and six multipliers.

Max and Stephen went from Spider-Man to a late showing of *The Odyssey*, which
meant I was staying awake until they returned anyway. I kept working the radio
while I waited.

## Fatigue is real

Near the end, I could hear my ability to copy deteriorating. Calls and names
that I would have handled earlier in the evening needed more repeats. There was
more `AGN?`, more uncertainty, and more time spent waiting for my brain to turn
the sounds into letters.

I made my final contact at 12:53 AM. Stopping then was the right choice. The
band still had stations to work, but I was no longer operating as cleanly as I
wanted.

## What I want to carry into next year

- Start running sooner. Search and pounce is useful, but running at my own
  speed produced longer, calmer stretches of contacts.
- Connect the radio to the logger before trying to hunt stations seriously.
  Automatic frequency updates would remove a surprising amount of friction,
  and keyboard access to the K4 memories would make running even smoother.
- Simplify the live assistance. Sidecar worked, but during a run I probably
  need one clear needed-multiplier cue rather than another full surface to
  monitor.
- Put up an antenna that actually belongs on 80 meters. Six multipliers from a
  tuned 40-meter vertical was a delightful accident, not a band plan.
- Treat fatigue as part of the operating plan. CW copy is the first thing to
  go when I am tired.

This was not a competitive score, and it was never likely to be one with a
five-hour break in the middle. It was still exactly the score I wanted: my
first one. Under the contest's recurring calendar, the next NAQP CW will be
[January 9–10, 2027](https://ncjweb.com/NAQP-Rules.pdf), from 1:00 PM Saturday
to 12:59 AM Sunday Eastern. The next August edition will be August 7–8, 2027. I
will have a number to beat, a much clearer idea of how I prefer to operate, and
a surprisingly capable little dashboard waiting beside the logger.
