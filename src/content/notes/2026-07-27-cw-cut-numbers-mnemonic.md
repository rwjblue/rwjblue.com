---
title: A Mnemonic for CW Cut Numbers
date: 2026-07-27
summary: "After copying `2TW` during Flight of the Bumblebees, I found a simple way to derive the full set of Morse cut numbers instead of memorizing them one by one."
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

The full table exists, but three cut numbers account for most of what I am
likely to copy:

- `T` for 0
- `A` for 1
- `N` for 9

Andy [WI7M](https://www.qrz.com/db/WI7M) pointed out that these three appear
frequently in [CWTs](https://cwops.org/cwops-tests/), where CWops member numbers
are part of the exchange. `N` is also familiar from reports such as `5NN`, while
`T` and `A` commonly shorten serial numbers and power values.

There is related CW shorthand outside the cut-number table. `K` commonly means
one thousand: a station may send `K` or `1K` for 1,000 watts. Andy also
abbreviates his TS-2000 as `TS2K`, since that is much quicker than sending
`TSTTT`. `K` is an abbreviation for “thousand,” not a Morse numeral
substitution in the same sense as `A`, `N`, or `T`.

The remaining cut forms are worth recognizing, but I would not assume every
operator expects them. `2TW` was valid and efficient, yet unfamiliar enough
that I could confirm the characters without understanding the value.

I do not plan to start cutting every number I send. The more useful goal is to
recognize the pattern quickly when someone else does, then ask for a targeted
fill when the context is still unclear.
