# Morse sending dependency and license notices

The optional sending tools use Stephen C. Phillips's `morse-pro` for Morse
translation, decoding, and audio playback.

Copyright: Stephen C Phillips, 2013-2017; Licensed under the EUPL v1.2, with extension of article 5 (compatibility clause) to any licence for distributing derivative works that have been produced by the normal use of the Work as a library.

The exact corresponding source is freely available in the upstream repository:

- [Source at the pinned commit](https://gitlab.com/scphillips/morse-pro/-/tree/92bf6ec02092d45c159216c61e241ada3f146989)
- [Download the source archive](https://gitlab.com/scphillips/morse-pro/-/archive/92bf6ec02092d45c159216c61e241ada3f146989/morse-pro-92bf6ec02092d45c159216c61e241ada3f146989.tar.gz)
- Commit: `92bf6ec02092d45c159216c61e241ada3f146989` (2026-08-28)
- [EUPL-1.2 license](./LICENSE)
- [Unmodified upstream README and license explanation](./UPSTREAM-README.md)

The application installs this immutable HTTPS archive through npm. Its
`package-lock.json` records the archive URL and SHA-512 integrity checksum.
The package is consumed without source modifications and bundled into the
site's optional, locally served JavaScript. No copied implementation is stored
in this directory. The upstream package still identifies itself as 3.0.1, so
the full commit identifies this newer development snapshot.

Morse Pro's EBNF 1.9.0 dependency remains under its [original MIT license and
copyright notice](./EBNF-LICENSE). Its corresponding source is included in the
[EBNF 1.9.0 package archive](https://registry.npmjs.org/ebnf/-/ebnf-1.9.0.tgz).

Keep these notices and exact source links with redistribution. The library
license does not grant permission to reuse the Morse Code World website UI or
third-party training content.
