/** Stable categories for self-directed CW practice, separate from assignments. */
export const OTHER_PRACTICE_ASSIGNMENT_ID = "other-practice";
export const OTHER_PRACTICE_ACTIVITIES = [
  { id: "other:word-recognition", title: "Word recognition", notePlaceholder: "For example: Morse Code Ninja podcast, word length, speed, or what felt difficult." },
  { id: "other:icr", title: "ICR (instant character recognition)", notePlaceholder: "For example: trainer used, character set, speed, or troublesome characters." },
  { id: "other:pota", title: "POTA (Parks on the Air)", notePlaceholder: "For example: activating or hunting, park reference, contacts, or what felt difficult." },
  { id: "other:cwt", title: "CWT", notePlaceholder: "Any additional private notes about this practice session." },
  { id: "other:on-air", title: "On-air (other)", notePlaceholder: "For example: callsigns, band, conversation, or what felt difficult." },
  { id: "other:general", title: "Other CW practice", notePlaceholder: "What did you practice? For example: podcast listening, sending, or an on-air conversation." },
] as const;
export const DEFAULT_OTHER_PRACTICE_ID = "other:general";

export function otherPracticeActivity(taskId: string) {
  return OTHER_PRACTICE_ACTIVITIES.find((activity) => activity.id === taskId);
}
