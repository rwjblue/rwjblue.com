/** Public practice catalogs. Order and repeated entries are intentional. */
export const ENGLISH_WORDS_TITLE = "30 most common English words";
export const QSO_WORDS_TITLE = "Common QSO words";
export const COMMON_WORDS = "THE OF AND TO A IN IS FOR THAT WAS ON WITH HE IT AS AT HIS BY BE FROM ARE THIS I BUT HAVE AN HAS NOT THEY OR";
export const COMMON_QSO_WORDS = "VVV VERT OM HR XYL QTH RR AGE FB LID QSL TKS RIG QSB CQ CL KN NAME PKT QSO TEST DE BT 73 QRM BK AGN DIPOLE SK RR HW? QRP TNX YRS YL QRX QRL ES WX QRT K QRS 88 PWR RUNS CALL VY WIRE YAGI NR RPT OP AR PSE EL LOOP ABT QSY TU HI BEAM RST WATT AR AS TEMP CPY QRZ CL ANT WX QRN BEAM CW DX";
export const WORD_LISTS = [
  { id: "common-30", title: ENGLISH_WORDS_TITLE, text: COMMON_WORDS, description: "A supplied practice selection of 30 common English words." },
  { id: "common-qso", title: QSO_WORDS_TITLE, text: COMMON_QSO_WORDS, description: "Common on-air words and abbreviations. The supplied reference has 75 entries, including intentional repeats (70 unique entries)." },
] as const;
