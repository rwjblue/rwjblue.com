export interface PracticeQso {
  id: string;
  kind?: "story";
  title: string;
  stations: [string, string];
  /** QSO transmissions alternate stations; story lines use a single narrator. */
  lines: string[];
}
