# Parts-bin inventory

`src/data/radio-parts.ts` owns the inventory rendered by
`src/pages/radio/equipment/parts-bin.astro`. Keep product identity separate
from stock: spool/package sizes describe the purchased variant, not remaining
wire. `stock.asOf` records the inventory confirmation date. Wire quantities
use an explicit spool unit. All wire appears in a single `wire` category.
Planned uses should be general applications, including the owner's actual
uses, rather than instructions for a particular build.

The September 17, 2026 wire additions comprise eight BNTECHGO variants.
Seven product titles and quantities were checked against purchase
confirmations; the 28 AWG silicone red/black pack was identified by the owner.
Current ownership was confirmed by the owner for all eight. On September 17,
the owner also confirmed there are no outstanding orders; the August 13
component quantities are now recorded as on hand.

The 28 AWG silicone set is represented as separate red and black 50 ft spools,
both linking to the shared product ASIN. The owner also uses the orange
22 AWG and yellow 18 AWG silicone wire for antenna elements.

The owner identified DX Engineering DXE-SANTW-500 as antenna wire on hand.
The [DX Engineering listing](https://www.dxengineering.com/parts/dxe-santw-500)
specifies a 500 ft spool of 26 AWG stranded copper-clad steel with black
UV-resistant polyethylene insulation.

Public records contain product ASINs, technical specifications, original
package sizes and availability. Do not copy receipts, order IDs, private
message links, addresses, payment details or unrelated purchases into the
inventory or source tree.

Use exact variant product URLs rather than Amazon short links or parent
listings. `amazonAsin` and `digikeyPartNumber` are retailer identifiers;
neither is a substitute for `manufacturerPartNumber`. Omit identifiers that
are not established. Manufacturer ratings should be labeled as such and must
not be presented as RF power qualifications.

For the 18/28 AWG magnet products, advertised diameters are close to nominal
bare copper. Finished OD and enamel build are unverified. For 22 AWG FEP,
the manufacturer specifies 19 x 0.15 mm tinned-copper strands and 1.42 +/-0.1 mm
insulated OD. Product links in the data lead to the corresponding branded
listings; the manufacturer also publishes the
[orange FEP specification](https://bntechgo.com/bntechgo-22awg-fep-teflon-coated-tin-plated-copper-wire-in-orange-100-ft-has-a-temperature-rating-of-65-to-200-c-fep-teflon-wire-is-suitable-for-applications-requiring-high-temperature-resistance/),
[18 AWG magnet wire](https://bntechgo.com/bntechgo-18-awg-magnet-wire-enameled-copper-wire-enameled-magnet-winding-wire-4-oz-0-0393-diameter-1-spool-coil-natural-temperature-rating-155-degrees-celsius-widely-used-for-transformers-and-inductors/),
and [28 AWG magnet wire](https://bntechgo.com/bntechgo-28-awg-magnet-wire-enameled-copper-wire-enameled-magnet-winding-wire-4-oz-0-0122-diameter-1-spool-coil-natural-temperature-rating-155-degrees-celsius-widely-used-for-transformers-and-inductors/).

Validate page changes with `mise run check`, `mise run build`, and desktop
and mobile browser inspection when the rendered layout changes.
