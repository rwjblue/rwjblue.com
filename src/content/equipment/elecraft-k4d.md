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

These are my experimental assignments for QK4-first trials. PF1 is already
configured on one QK4 laptop; PF2 and PF4 are plans to try. Physical K4 macro
execution and display behavior have not been verified. The command review
below is based on documentation and QK4 source, without connecting to a radio.

| Key | Assignment | Status |
| --- | --- | --- |
| PF1 | Reset noise levels | Configured on one QK4 laptop |
| PF2, under CLR | Split Reset | Planned |
| PF3 | Speakers + headphones / headphones only | Existing assignment; behavior recorded only |
| PF4, under XIT | DX SPLIT+2 | Planned |

In QK4, open **Fn -> MACROS**, select the PF slot, and paste the entire line
into its command field. QK4 sends saved CAT macros to the connected K4;
trying one in QK4 changes the radio, rather than simulating it locally.

<details>
<summary><strong>PF1 - Reset noise levels</strong></summary>

```text
#ar1;nrs~;
```

`#AR1;` applies the current panadapter AutoRef level once, preserving its
settings and on/off mode. The intended `NRS~;` action is to recalibrate the
main receiver's SSNR noise estimate: use a clear frequency with SSNR active.
It is not an SSNR on/off command. The saved spelling above is preserved;
Elecraft permits either case for these CAT commands.

**Firmware caveat:** Elecraft introduced SSNR and the `NRS` command in
R38.BETA3, subsequently included in production R38. However, programmer
reference D12 and the published R38 release notes do **not** document the
`NRS~;` recalibration variant or its minimum firmware. Its support still needs
confirmation for the installed radio firmware; SSNR support alone does not
establish that this variant works.

</details>

<details>
<summary><strong>PF2 - Split Reset (under CLR)</strong></summary>

```text
XT0;FT0;DV0;SB0;#DPM0;#VFB0;
```

Turn XIT off, select simplex/TX A, turn diversity and the sub receiver off,
select the main/A panadapter on the K4 LCD, and hide the B cursor. Neither
VFO is retuned or copied.

This is a split reset, not a saved station profile. It leaves the span,
centering, fixed/tracking mode, waterfall settings, A cursor, VFO link,
RIT state/offsets, and copied B parameters as they stand. In particular, it
does not restore the link or diversity settings from before PF4: diversity
is forced off and link is left unchanged. It does not zero the stored XIT
offset or restore the external monitor layout.

</details>

<details>
<summary><strong>PF3 - Speakers + headphones / headphones only</strong></summary>

My existing assignment toggles between speakers plus headphones and
headphones only. The exact macro string and tested platform have not been
recorded here, so there is no pasteable command or cross-platform claim for
this entry.

</details>

<details>
<summary><strong>PF4 - DX SPLIT+2 (under XIT)</strong></summary>

```text
DV0;XT0;LN0;AB3;VO$+2000;SB1;FT1;#DPM0;#DSM1;#VFA1;#VFB1;#SPN10000;#FXT1;FC+2000;
```

The target is one 10 kHz waterfall with both cursors, main RX on A and TX on
B starting 2 kHz above A. The sub receiver also listens on B.

- `DV0;XT0;LN0;` disables diversity, XIT, and VFO linking.
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

The exact on-screen placement from the signed center offset still needs a
QK4/K4 check. Fixed-tuning edge behavior (`#FXA`) and waterfall height are
inherited; this macro does not restore them afterward. RIT is not cleared,
so check it when comparing dial frequencies with received signals. PF2
returns to simplex but leaves B at its new frequency and retains this span
and fixed-centering setup. The external monitor has separate layout commands.

</details>

<details>
<summary><strong>Command sources and QK4 display caveats</strong></summary>

Reviewed on November 17, 2026:

- [Elecraft K4 programmer's reference, D12](https://ftp.elecraft.com/K4/Manuals%20Downloads/K4ProgrammersReferencerev.D12.html):
  CAT syntax, `AB`, `DV`, `FT`, `LN`, `NRS`, `SB`, `VO`, `XT`, `FC`, and
  the display commands. `#DPM`/`#DSM` target the radio LCD;
  `#HDPM`/`#HDSM` target its external monitor.
- [Elecraft K4 operating manual, D14](https://ftp.elecraft.com/K4/Manuals%20Downloads/K4%20Built-In%20Operating%20Manual%20rev%20D14/K4BuiltInOperatingManualrevD14.html):
  programmable controls, split operation, and panadapter modes.
- [Elecraft R38 release notes](https://ftp.elecraft.com/K4/firmware/K4%20Software%20Release%20R38%20PROD.txt):
  SSNR introduction and the restriction on `FC` offsets in tracking mode.
- QK4 source at
  [5191c8b](https://github.com/mikeg-dal/QK4/tree/5191c8b1932148511381bd8574e7365e279463e7):
  [macro dispatch](https://github.com/mikeg-dal/QK4/blob/5191c8b1932148511381bd8574e7365e279463e7/src/controllers/macrocontroller.cpp),
  [display controls](https://github.com/mikeg-dal/QK4/blob/5191c8b1932148511381bd8574e7365e279463e7/src/ui/popups/displaypopupwidget.cpp),
  and [spectrum controller](https://github.com/mikeg-dal/QK4/blob/5191c8b1932148511381bd8574e7365e279463e7/src/controllers/spectrumcontroller.cpp).

QK4 has its own rendered display. Its DISPLAY control updates the local
panadapter layout directly because the K4 does not echo `#DPM` changes;
saved macros use a separate send path without that local update. A macro
may therefore change the radio LCD while QK4's layout stays unchanged.
QK4 also follows reported span/cursor state and waterfall height; `#DSM1;`
alone is not evidence that its local waterfall is visible. If needed, select
the single A panadapter and a nonzero waterfall height through QK4's DISPLAY
controls. Treat layout, span, and centering as trial results to record for
the installed QK4 version, separately from the K4 LCD and external monitor.

</details>
