---
name: Elecraft KH1
category: radios
summary: An ultralight five-band CW transceiver for handheld, hiking, and minimal portable stations.
status: current
acquired: "2026-05"
state: PF1 VBT / PF2 CLR / PF3 PAN
history:
  - date: "2026-08-12"
    title: First full POTA activation
    details: Used as the primary radio for 25 QRP CW contacts on 40 and 30 meters at JL Curran State Park.
    note: /notes/2026-08-12-jl-curran-kh1-doublet/
useContexts:
  - portable
sortOrder: 25
externalUrl: https://elecraft.com/products/kh1-transceiver
image: https://elecraft.com/cdn/shop/files/KH1_Product_page_2.jpg?v=1771030516
imageAlt: Elecraft KH1 ultralight CW transceiver with its integrated field accessories
imageSourceName: Elecraft
imageSourceUrl: https://elecraft.com/products/kh1-transceiver
---

The KH1 is the smallest complete Elecraft station in the portable inventory. It
covers 40, 30, 20, 17, and 15 meters at up to five watts and combines a battery,
tuner, logging, and optional whip and paddle into a handheld-size CW radio.

Its low setup overhead makes it a good counterpoint to the larger portable
stations. I used it for quick Reverse Beacon Network checks while comparing
replacement wires for the Reliance OCFD. That experiment is still an
unpublished draft; its backlink will appear here automatically when the note is
published.

## Field reference

### PFN shortcuts

Hold **PFn/XMTR**, then tap:

1. **`VBT` - battery:** Show internal-battery voltage and approximate amp-hours
   consumed.
2. **`CLR` - clear offset:** Zero the shared RIT/XIT offset.
3. **`PAN` - scan:** Start the scan and mini-pan display.
4. **`[x]` - exit:** Button 4 is not programmable.

These are stored as **PF1 = VBAT**, **PF2 = RIT CLEAR**, and **PF3 = PAN MODE**.

### Audio and spotting

- **Receive volume:** Turn AF/MON normally.
- **CW monitor volume:** Tap AF/MON, then turn it. The VFO knob adjusts
  sidetone pitch on the same screen. Tap any control to return to normal.
- **SPOT:** Hold AF/MON. Tap any control to leave SPOT.

### Lock the tuning knob

Hold **BAND/MODE**, then hold **button 4 / LOK**. Repeat to unlock. This locks
the VFO and XIT; RIT remains adjustable.

### Battery tracking

Open **PFn/XMTR -> `VBT`** to see the internal-battery voltage and amp-hours
consumed. After a full charge, hold **button 4 / `[0]`** on that screen to reset
the amp-hour counter. The counter persists across power cycles.

### Normal display

`C +.00` means CW mode with a zero RIT/XIT offset. With no trailing `R` or `X`,
neither RIT nor XIT is enabled.

Source: [KH1 owner's manual, revision B7](https://ftp.elecraft.com/KH1/Manuals%20Downloads/KH1%20Owner%27s%20Manual%2C%20rev%20B7.pdf).
