---
name: Elecraft K4D
category: radios
summary: The primary home-station HF transceiver for CW, digital modes, contest practice, and repeatable station experiments.
status: current
acquired: "2026-05-11"
useContexts:
  - home
connections:
  - dx-commander-expedition
  - homebrew-attic-efhw
  - dx-engineering-receiver-guard-5000hd
sortOrder: 10
externalUrl: https://elecraft.com/products/k4-transceiver
image: /images/radio/2026-05-31-cq-wpx-cw-learning-weekend/img-8987.jpg
imageAlt: Elecraft K4D panadapter during CQ WPX CW
---

Command reference: [Elecraft K4 Programmer's Reference, D12](https://ftp.elecraft.com/K4/Manuals%20Downloads/K4ProgrammersReferencerev.D12.html).

The K4D anchors the home station. Its antenna paths currently include the DX
Commander Expedition, the homebrew attic EFHW, and the loop-on-ground receive
antenna through a
[DX Engineering Receiver Guard 5000HD](/radio/equipment/dx-engineering-receiver-guard-5000hd/).
Its second receiver and internal tuner make it useful for antenna comparisons,
diversity receive, and experiments that are easier to understand from a stable
operating position.

I have used it for extended CW operating, including [CQ WPX CW practice](/notes/2026-05-31-cq-wpx-cw-learning-weekend/),
and for a [network-only WSJT-X setup through QK4](/notes/2026-07-16-wsjt-x-qk4-k4d-network-setup/).

## Field reference

### Programmable keys

PF1 works from my QK4 laptop with K4 firmware **R40.B1**. PF3 is my existing
audio toggle; PF2 and PF4 are experimental assignments to try in QK4 first.

| Key | Assignment | Status |
| --- | --- | --- |
| PF1 | Reset noise levels | Confirmed in QK4 with R40.B1 |
| PF2, under CLR | Split Reset | Planned |
| PF3 | Speakers + headphones / headphones only | Existing assignment |
| PF4, under XIT | DX SPLIT+2 | Planned |

In QK4, open **Fn -> MACROS**, select the PF slot, and paste the entire line
into its command field. QK4 sends saved CAT macros to the connected K4;
trying one in QK4 changes the radio, rather than simulating it locally.

<details>
<summary><strong>PF1 - Reset noise levels</strong></summary>

<div class="macro-snippet" data-macro-snippet="PF1">

```text
#ar1;nrs~;
```

</div>

- `#ar1;` applies the current panadapter AutoRef level once, preserving its
  settings and on/off mode.
- `nrs~;` recalibrates the main receiver's SSNR noise estimate. Use a clear
  frequency with SSNR active.

The saved spelling above is preserved; Elecraft permits either case for these
CAT commands.

Confirmed working on R40.B1.

</details>

<details>
<summary><strong>PF2 - Split Reset (under CLR)</strong></summary>

<div class="macro-snippet" data-macro-snippet="PF2">

```text
DV0;XT0;RT0;RT$0;RC;RC$;FT0;SB0;#DPM0;#VFB0;
```

</div>

- `DV0;XT0;` turns diversity and XIT off.
- `RT0;RT$0;RC;RC$;` turns RIT off on A and B, then zeros both VFOs'
  shared RIT/XIT offset registers.
- `FT0;SB0;` selects simplex/TX A and turns the sub receiver off.
- `#DPM0;#VFB0;` selects the main/A panadapter on the K4 LCD and hides the
  B cursor.

Neither VFO is retuned or copied.

Span, centering, fixed/tracking mode, waterfall settings, A cursor, VFO link,
and B's copied parameters stay as they stand. Diversity is forced off; earlier
link/diversity settings and the external monitor layout are not restored.

</details>

<details>
<summary><strong>PF3 - Speakers + headphones / headphones only</strong></summary>

The documented CAT toggle for this assignment is:

<div class="macro-snippet" data-macro-snippet="PF3">

```text
ME0072./;
```

</div>

- `ME0072./;` toggles the K4's **Speakers + Phones** menu setting. With
  headphones plugged into the K4, YES keeps speakers and headphones active;
  NO mutes the speakers. This controls the radio's audio outputs, not QK4's
  laptop audio routing.

</details>

<details>
<summary><strong>PF4 - DX SPLIT+2 (under XIT)</strong></summary>

<div class="macro-snippet" data-macro-snippet="PF4">

```text
DV0;XT0;RT0;RT$0;RC;RC$;LN0;AB3;VO$+2000;SB1;FT1;#DPM0;#DSM1;#VFA1;#VFB1;#SPN10000;#FXT1;FC+2000;
```

</div>

The target is one 10 kHz waterfall with both cursors, main RX on A and TX on
B starting 2 kHz above A. The sub receiver also listens on B.

- `DV0;XT0;` disables diversity and XIT.
- `RT0;RT$0;RC;RC$;` turns RIT off on A and B and zeros both RIT/XIT offsets.
- `LN0;` disables VFO linking.
- `AB3;VO$+2000;` copies A's frequency and other VFO parameters to B, then
  adds 2,000 Hz to B. This overwrites B's previous setup. Each invocation
  starts again from A, rather than adding another 2 kHz to the old B.
- `SB1;FT1;` enables the sub receiver and selects split/TX B.
- `#DPM0;#DSM1;#VFA1;#VFB1;` requests the LCD's single A panadapter with
  waterfall and both cursors always visible.
- `#SPN10000;` requests 10,000 Hz total span. Use the full Hz value, with no
  zero padding or decimal point.
- `#FXT1;FC+2000;` selects fixed tuning and requests panadapter centering
  relative to A with a positive 2,000 Hz offset. The sign here controls the
  display; `VO$+2000;` sets the TX VFO offset separately. Elecraft says a
  nonzero `FC` offset does not apply in tracking mode, hence `#FXT1;`.

Fixed-tuning edge behavior (`#FXA`) and waterfall height keep their existing
settings. PF2 returns to simplex while retaining B's new frequency, the
10 kHz span, and fixed centering. The external monitor has separate layout
commands; the exact QK4 display result remains part of the planned trial.

</details>

<details>
<summary><strong>Command sources and QK4 display caveats</strong></summary>

Reviewed on November 17, 2026:

- [Elecraft K4 programmer's reference, D12](https://ftp.elecraft.com/K4/Manuals%20Downloads/K4ProgrammersReferencerev.D12.html):
  CAT syntax, `AB`, `DV`, `FT`, `LN`, `NRS`, `RC`, `RT`, `SB`, `VO`, `XT`,
  `FC`, menu ID `0072`, and the display commands. `#DPM`/`#DSM` target the radio LCD;
  `#HDPM`/`#HDSM` target its external monitor.
- [Elecraft K4 operating manual, D14](https://ftp.elecraft.com/K4/Manuals%20Downloads/K4%20Built-In%20Operating%20Manual%20rev%20D14/K4BuiltInOperatingManualrevD14.html):
  programmable controls, Speakers + Phones, split operation, and panadapter modes.
- [Elecraft R38 release notes](https://ftp.elecraft.com/K4/firmware/K4%20Software%20Release%20R38%20PROD.txt):
  SSNR introduction and the restriction on `FC` offsets in tracking mode.
- QK4 source at
  [5191c8b](https://github.com/mikeg-dal/QK4/tree/5191c8b1932148511381bd8574e7365e279463e7):
  [macro dispatch](https://github.com/mikeg-dal/QK4/blob/5191c8b1932148511381bd8574e7365e279463e7/src/controllers/macrocontroller.cpp),
  [display controls](https://github.com/mikeg-dal/QK4/blob/5191c8b1932148511381bd8574e7365e279463e7/src/ui/popups/displaypopupwidget.cpp),
  and [spectrum controller](https://github.com/mikeg-dal/QK4/blob/5191c8b1932148511381bd8574e7365e279463e7/src/controllers/spectrumcontroller.cpp).

QK4's DISPLAY control updates its local layout directly; saved macros do not
take that path, and the K4 does not echo `#DPM` changes. If the radio's single
panadapter layout is not reflected in QK4, select A and a nonzero waterfall
height in QK4's DISPLAY controls. QK4 follows reported span/cursor state and
waterfall height; `#DSM1;` alone does not ensure its local waterfall is visible.

</details>
