---
title: Running WSJT-X through QK4 with an Elecraft K4D
date: 2026-07-16
summary: "A network-only setup for WSPR, FT8, and other WSJT-X modes using QK4, Loopback, and an Elecraft K4D."
tags:
  - radio
  - wsjt-x
  - wspr
  - qk4
  - elecraft
  - k4d
---

I now have WSPR working from the Mac while the
Elecraft K4D is reached over the network through QK4. The goal is for QK4 to
provide both the radio-control path and the streamed receive/transmit audio,
without a direct USB audio or serial connection from this Mac to the radio.

## First obstacle: getting audio out of QK4

The first confusing part was audio. There is a lot of documentation and advice
for connecting a computer directly to the K4 with USB, which gives the computer
a USB sound card and serial ports. That is not the setup I want here. I want
the Mac to reach the radio entirely through QK4's network connection, with no
USB cable from this Mac to the K4.

QK4 streams the K4's audio over the network, but WSJT-X still expects normal
input and output sound devices. The missing bridge is a pair of virtual sound
cards. I used
[Rogue Amoeba Loopback](https://rogueamoeba.com/loopback/) to make them.

## Setup

### 1. Create two Loopback devices

I created two stereo pass-through devices:

- `K4 RX to WSJT-X`
- `WSJT-X TX to K4`

The names include the audio direction so that the input/output menus are less
ambiguous later.

![The two pass-through virtual devices in Loopback](/images/radio/2026-07-16-wsjt-x-qk4-k4d/loopback-virtual-devices.png)

After creating the Loopback devices, restart QK4. QK4 discovers the available
audio devices when it starts, and its audio-device menus do not currently have
a refresh control. A newly created Loopback device will therefore not appear
in an already-running QK4 session.

QK4's current audio settings use:

- `K4 RX to WSJT-X` as QK4's audio output
- `WSJT-X TX to K4` as QK4's audio input

That sends streamed receive audio from QK4 into the first virtual device and
accepts WSJT-X's generated transmit tones from the second one.

### 2. Enable QK4's CAT server

In QK4, open Options, select **Rig Control**, enable **CAT server**, and choose a
port. I left it at QK4's default, `9299`.

When it is running, this screen shows whether QK4 is listening and how many
external clients are connected. The screenshot shows one client, WSJT-X.

![QK4 Rig Control options with the CAT server listening on port 9299](/images/radio/2026-07-16-wsjt-x-qk4-k4d/qk4-cat-server.png)

### 3. Point WSJT-X radio control at QK4

In WSJT-X, open Settings and select the **Radio** tab:

- Set **Rig** to `Elecraft K4`.
- In the field labeled **Serial Port**, enter `127.0.0.1:9299`.
- Select **CAT** as the PTT method.
- Select **Data/Pkt** for the mode.
- Select **Rig** for split operation.

The `Serial Port` label is a little misleading here. For the Elecraft K4
backend it also accepts a network host and port. `127.0.0.1` means QK4 is
running on the same Mac as WSJT-X; the port must match the CAT server port in
QK4.

The green **Test CAT** result is the first useful confirmation that WSJT-X can
reach the radio-control path through QK4.

![WSJT-X Radio settings using the Elecraft K4 backend and QK4's local CAT server](/images/radio/2026-07-16-wsjt-x-qk4-k4d/wsjt-x-radio-settings.png)

### 4. Select the virtual audio devices in WSJT-X

In WSJT-X Settings, select the **Audio** tab:

- Set **Input** to `K4 RX to WSJT-X`.
- Set **Output** to `WSJT-X TX to K4`.
- Both are currently set to mono.

![WSJT-X Audio settings using the two Loopback devices](/images/radio/2026-07-16-wsjt-x-qk4-k4d/wsjt-x-audio-settings.png)

At this point the control and audio routes are all represented in the
configuration. WSJT-X is decoding WSPR signals and completing scheduled WSPR
transmit cycles through QK4.

![A working WSJT-X session showing decoded 20-meter WSPR signals and transmit cycles](/images/radio/2026-07-16-wsjt-x-qk4-k4d/wsjt-x-wspr-results.png)

## What is platform-specific

As far as I can tell, the virtual audio devices are the only part of this setup
that is meaningfully Mac-specific. QK4's CAT server and the WSJT-X radio and
audio settings work the same way once the operating system presents two audio
paths:

- K4 receive audio from QK4 to the WSJT-X input
- WSJT-X output to QK4's transmit audio input

On macOS I used
[Rogue Amoeba Loopback](https://rogueamoeba.com/loopback/), which makes it easy
to create and name both devices. The free
[BlackHole virtual audio driver](https://existential.audio/blackhole/) is
another Mac option.

On Windows, [VB-CABLE](https://vb-audio.com/Cable/) provides the equivalent
virtual audio-cable devices. This setup needs two independent cables, one in
each direction, so a Windows setup needs two VB-CABLE devices rather than just
one. The exact installation and naming steps depend on the virtual-audio tool;
the important part for QK4 and WSJT-X is the two-direction signal path, not the
specific product used to create it.

## Switching back to CW or voice

QK4 does not currently have a quick way to toggle between the virtual audio
devices used for digital modes and the normal devices used for CW or voice. For
WSJT-X operation, I select `K4 RX to WSJT-X` as QK4's output and `WSJT-X TX to
K4` as its input. When I return to CW or voice, I have to open QK4's audio
settings and manually restore the usual speaker, headphones, or microphone.

[QK4 PR #91](https://github.com/mikeg-dal/QK4/pull/91) proposes separate
microphone and speaker selections for DATA and DATA-R modes. QK4 would use
those devices while the transmit VFO is in a data mode, then automatically
return to its primary devices in other modes. As of July 16, 2026, the PR
remains open with no reviews. Until something like it lands, moving between
WSJT-X and ordinary CW or voice operation includes a manual audio-device change
in QK4.

## Audio-level adjustment is otherwise normal WSJT-X setup

Once QK4 has been restarted and the Loopback devices are visible and selected,
there is nothing especially network-specific about adjusting the audio levels.
The normal WSJT-X setup guidance for receive input level and transmit output
level applies in the same way it does with a radio connected directly by USB.

On receive, the question is whether the audio arriving through `K4 RX to
WSJT-X` is at a useful level in WSJT-X without clipping. On transmit, the
question is whether the tones sent through `WSJT-X TX to K4` drive the radio to
the intended RF output without excessive ALC or distortion. The virtual audio
devices change the route, not the basic level-setting procedure.

Existing WSJT-X tutorials about sound-card input volume, output attenuation,
the receive level meter, and clean transmit drive remain applicable. The parts
specific to this setup are creating the two virtual devices, restarting QK4 so
it discovers them, assigning the devices in both applications, and routing CAT
through QK4.

## Intended signal path

```text
                          radio control and audio
Elecraft K4D  <-------------------------------------------->  QK4
                    encrypted network connection

QK4 CAT server (localhost:9299)  <------------------------>  WSJT-X

K4 receive audio -> QK4 speaker output
                 -> "K4 RX to WSJT-X" Loopback device
                 -> WSJT-X audio input

WSJT-X audio output
                 -> "WSJT-X TX to K4" Loopback device
                 -> QK4 microphone input
                 -> K4 transmit audio
```

QK4 connects to the K4 using the radio's remote protocol. QK4 then presents a
local CAT server for applications such as WSJT-X. The two Loopback devices act
as virtual patch cables between QK4 and WSJT-X.

## Software used

This setup was confirmed on July 16, 2026, with:

- macOS `26.5.1` on Apple silicon
- QK4 `0.7.0-beta.3`
- WSJT-X `3.1.0`

## If CAT does not connect

If WSJT-X starts before QK4's CAT server is available, it may report
`Connection reset by peer` or `Connection refused` for `127.0.0.1:9299`. This
startup order has been reliable:

1. Start QK4.
2. Connect QK4 to the K4D and confirm receive audio.
3. Confirm that QK4's CAT server is enabled on port `9299`.
4. Start WSJT-X, or use its radio-test/reconnect control if it was already
   running.

## What remains to test

WSPR receive and transmit cycles are working. I still want to test:

- completing FT8 and FT4 contacts through the same paths
- using QK4's remote-radio profile rather than the local-network profile
- recovery and frequency/mode synchronization after an application or network
  connection drops
- longer unattended WSPR sessions
- whether mono mix or the main receiver channel is the better receive source,
  and which combination of WSJT-X, Loopback, and QK4 gain controls gives the
  most repeatable clean transmit level

## References

- [QK4 project](https://mikeg-dal.github.io/QK4/)
- [QK4 source and documentation](https://github.com/mikeg-dal/QK4)
- [Elecraft K4 manuals and downloads](https://elecraft.com/pages/manuals-downloads)
- [WSJT-X downloads and documentation](https://wsjtx.github.io/wsjtx/)
