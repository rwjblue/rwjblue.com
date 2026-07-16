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

## Snapshot on July 16, 2026

Software:

- macOS on Apple silicon
- QK4 `0.7.0-beta.3`
- WSJT-X `3.1.0`
- Rogue Amoeba Loopback for the virtual audio devices

What was running and connected when I confirmed the setup:

- QK4 had an encrypted connection to the K4 on network port `9204`.
- QK4's CAT server was enabled on `127.0.0.1:9299`.
- WSJT-X had an active TCP connection to that CAT server.
- A read-only CAT query through QK4 reported the K4 at `14.095600 MHz`, in the
  K4 data mode, matching the 20-meter WSPR setup.
- WSJT-X was running in WSPR mode, decoding multiple stations during each
  two-minute receive cycle.
- Scheduled WSPR transmit cycles were keying the K4 through CAT and sending
  audio back through QK4.

## QK4 settings observed

- CAT server: enabled
- CAT server port: `9299`
- Radio connection: TLS enabled on port `9204`
- Streaming latency: `3`
- Speaker/output device: `K4 RX to WSJT-X`
- Microphone/input device: `WSJT-X TX to K4`
- Mono mix: enabled
- QK4 audio volume: `47`

I have both local and remote radio profiles saved in QK4. Their addresses,
identities, and pre-shared keys are intentionally omitted here.

## Loopback devices

Both devices are stereo, 48 kHz virtual devices using Loopback's pass-through
source.

### K4 RX to WSJT-X

This is selected as:

- QK4's speaker/output device
- WSJT-X's sound input

The intended direction is QK4 receive audio into WSJT-X.

### WSJT-X TX to K4

This is selected as:

- WSJT-X's sound output
- QK4's microphone/input device

The intended direction is WSJT-X transmit tones into QK4 and then across the
network to the K4.

## WSJT-X radio settings observed

- Rig: `Elecraft K4`
- Network CAT endpoint: `127.0.0.1:9299`
- PTT method: CAT
- Mode: Data
- Split operation: Rig
- Transmit audio source: Rear
- Audio input: `K4 RX to WSJT-X`, mono
- Audio output: `WSJT-X TX to K4`, mono
- PSK Reporter reporting: enabled

For the WSPR session, WSJT-X was set to:

- Transmit percentage: `20%`
- Reported power: `37 dBm` (5 watts)

The K4's front-panel/CAT power setting and the RF output produced by an
audio-driven data signal are not necessarily the same thing. I still use the
normal WSJT-X transmit-level procedure to confirm RF power, ALC, and waveform
cleanliness rather than treating the K4 power setting alone as proof.

## Failure seen during setup

WSJT-X was started before QK4's CAT server was available. Its log showed:

- a broken CAT connection
- `Connection reset by peer`
- repeated connection attempts to `127.0.0.1:9299`
- `Connection refused` while nothing was listening on that port

After QK4 was running with its CAT server enabled, the TCP connection from
WSJT-X to QK4 was established.

Working startup order:

1. Start QK4.
2. Connect QK4 to the K4D and confirm receive audio.
3. Confirm that QK4's CAT server is enabled on port `9299`.
4. Start WSJT-X, or use its radio-test/reconnect control if it was already
   running.

## What works

- QK4 can connect to and control the K4D over the network.
- QK4 exposes a local CAT server that WSJT-X can connect to.
- Frequency and mode information make it from the K4 through QK4 to WSJT-X.
- The QK4-to-WSJT-X receive audio route has produced WSPR decodes.
- CAT PTT keys and unkeys the K4 through QK4.
- WSJT-X transmit audio reaches the K4 through the second Loopback device.
- WSJT-X is completing WSPR receive and transmit cycles.

## What I still want to test

- A complete FT8 or FT4 contact works through the same paths.
- QK4 and WSJT-X recover cleanly if either application or the network connection
  drops.
- The same settings work when using the remote radio profile instead of the
  local-network profile.
- A longer unattended WSPR session remains stable.

## Questions to answer as this develops

- Does QK4 require mono mix for WSJT-X, or is selecting the main receiver
  channel explicitly better?
- Does QK4's audio volume affect the stream sent to the Loopback receive
  device, or only monitor volume?
- Which control gives the most repeatable transmit level: WSJT-X output
  attenuation, the Loopback device level, QK4 microphone level, or a
  combination?
- Does changing bands or modes in WSJT-X reliably update the K4 through QK4?
- Does changing frequency or mode at the K4/QK4 reliably update WSJT-X?
- What is the cleanest recovery procedure after QK4 reconnects to the radio?

## References

- [QK4 project](https://mikeg-dal.github.io/QK4/)
- [QK4 source and documentation](https://github.com/mikeg-dal/QK4)
- [Elecraft K4 manuals and downloads](https://elecraft.com/pages/manuals-downloads)
- [WSJT-X downloads and documentation](https://wsjtx.github.io/wsjtx/)
