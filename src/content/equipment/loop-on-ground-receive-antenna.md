---
name: Loop-on-ground receive antenna
category: antennas
summary: A low outdoor receive loop used at the home station for quieter signals and K4D diversity comparisons.
status: current
history:
  - date: "2025-12-03"
    title: Initial installation completed
    details: Ran the feed line and put the receive loop into service.
  - date: "2025-12-19"
    title: Relocated away from the HVAC system
    details: Moved the loop from the dog yard to the front side of the house to reduce local noise.
  - date: "2025-12-20"
    title: Reoriented for SSW coverage
    details: Repositioned the loop to favor low-angle reception toward the south-southwest and Central Europe.
useContexts:
  - home
connections:
  - dx-engineering-receiver-guard-5000hd
sortOrder: 50
image: /images/equipment/loop-on-ground-receive-antenna/dxe-bfs-1-enclosure.jpg
imageAlt: DX Engineering BFS-1 feedpoint transformer enclosure prepared for the loop-on-ground receive antenna
---

The loop on the ground is a receive-only antenna built to provide a quieter
alternative to the transmitting antennas at the QTH. It feeds the K4D's second
receiver through a
[DX Engineering Receiver Guard 5000HD](/radio/equipment/dx-engineering-receiver-guard-5000hd/)
so the loop and a transmitting antenna can be compared directly or heard
together in diversity receive.

I installed it on December 3, 2025, using 14 AWG THHN wire for the loop and
RG-6 coax for the feed line. The first evening's checks compared it with the
attic EFHW on 80, 40, and 20 meters.

The system uses a
[DX Engineering BFS-1 Beverage transformer](https://www.dxengineering.com/parts/dxe-bfs-1),
RG-6 feed line, receive-side amplification and attenuation, and switching that
keeps transmitted power away from the receive path. The Receiver Guard adds a
final protective stage at the radio end of that path.

![Inside the DX Engineering BFS-1 enclosure, showing the feedpoint transformer circuit board](/images/equipment/loop-on-ground-receive-antenna/dxe-bfs-1-interior.jpg)

Its value is situational rather than absolute: sometimes it lowers the noise
enough to recover a caller, while other signals remain stronger on the
vertical or attic EFHW.
