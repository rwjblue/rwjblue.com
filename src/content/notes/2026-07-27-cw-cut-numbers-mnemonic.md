---
title: A Mnemonic for CW Cut Numbers
date: 2026-07-27
summary: "After copying `2TW` during Flight of the Bumblebees, I found a simple way to derive the full set of Morse cut numbers instead of memorizing them one by one."
visibility: draft
tags:
  - radio
  - cw
  - field-notes
---

During my [Flight of the Bumblebees activation from Block
Island](/notes/2026-07-26-flight-of-the-bumblebees-from-block-island/), one
home station sent me:

```text
2TW
```

I copied it carefully, sent it back for confirmation, and received `RR`. I
still did not understand it until I was home.

The home-station exchange includes transmitter power. `2TW` meant **20 watts**:

- `2` was the ordinary numeral 2;
- `T` was a cut zero;
- `W` was the literal unit suffix for watts.

Most of my on-air CW has been POTA, where `N` for 9 in `5NN` is by far the cut
number I recognize most readily. Encountering `T` in the middle of a power
exchange made me realize that I did not understand the underlying pattern.

## Why cut numbers exist

Every Morse numeral normally contains five elements. That is predictable, but
it can be slow in a contest or other exchange where both operators already know
that a number is coming.

A cut number substitutes a shorter Morse character for the full numeral. The
meaning therefore depends heavily on context. Hearing `T` in ordinary prose
means the letter T. Hearing it inside an expected serial number, report, or
power value may mean zero.

## The mnemonic

When I asked about cut numbers, Josh [AC9M](https://www.qrz.com/db/AC9M)
pointed out the useful way to think about them: the shorter characters are
fragments of the full five-element numerals. `A` (`.-`) is the beginning of 1
(`.----`), while `D` (`-..`) is the end of 8 (`---..`).

From there, the useful rule is:

> **Except for 5, keep every dit and collapse a run of multiple dahs to one
> dah. Five is E.**

That produces the complete conventional table:

| Number | Full Morse | Cut Morse | Sent as |
| ---: | :---: | :---: | :---: |
| 0 | `-----` | `-` | `T` |
| 1 | `.----` | `.-` | `A` |
| 2 | `..---` | `..-` | `U` |
| 3 | `...--` | `...-` | `V` |
| 4 | `....-` | `....-` | `4` |
| 5 | `.....` | `.` | `E` |
| 6 | `-....` | `-....` | `6` |
| 7 | `--...` | `-...` | `B` |
| 8 | `---..` | `-..` | `D` |
| 9 | `----.` | `-.` | `N` |

The sequence is also compact enough to remember directly:

```text
T A U V 4 E 6 B D N
0 1 2 3 4 5 6 7 8 9
```

But the pattern is more useful than the sequence because it lets me reconstruct
a character I have forgotten.

For example, 9 is `----.`. Keep its final dit and reduce the four dahs to one:
`-.`, which is `N`. Zero is five dahs reduced to one dah, which is `T`. Two is
`..---`; keep the two dits and reduce the dahs to one, producing `..-`, or `U`.

## What I expect to hear in practice

The full table exists, but not every cut number is equally familiar on the air.
`N` for 9 is common in signal reports such as `5NN`, and `T` for zero appears in
serial numbers, times, and power values. `A` for 1 also appears in compact
contest exchanges. The remaining forms are worth recognizing, but I would not
assume every operator expects them.

That is the practical limitation: cut numbers save time only when the receiving
operator can identify the field. `2TW` was valid and efficient, but it was also
unfamiliar enough that I could confirm the characters without understanding the
value.

I do not plan to start cutting every number I send. The more useful goal is to
recognize the pattern quickly when someone else does, then ask for a targeted
fill when the context is still unclear.
