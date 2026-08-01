---
name: Quansheng UV-K1(8)
category: radios
summary: A compact handheld queued for the NR7Y CW firmware and an external-paddle modification.
status: incoming
state: CW firmware and paddle build queued
useContexts:
  - portable
sortOrder: 60
---

The UV-K1 is a compact multiband handheld purchased as a platform for the
[NR7Y CW firmware](https://briand.github.io/cw-firmware-docs/). The firmware
adds CW transmission, keyer modes, message memories, decoding, and a code
practice oscillator to the underlying radio.

The planned work includes backing up the factory calibration data, flashing the
UV-K1-specific firmware, and connecting a standard paddle. The supported paths
include a custom passive USB-C-to-TRS cable or an internal rework that allows a
normal paddle cable to use the radio's accessory port. The build will document
the chosen path, any effect from transmitted RF, and the radio's practical role
after testing rather than assuming one in advance.

The radio was sourced from this
[Amazon listing](https://www.amazon.com/dp/B0G4NF65DP).
