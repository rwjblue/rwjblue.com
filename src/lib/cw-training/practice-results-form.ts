import type { TrainingLcwoResult } from "./report-types";

const fields = {
  speedWpm: "Actual speed (WPM)", groupLength: "Group length", maximumLength: "Maximum word length",
  score: "Score", errorCount: "Number of errors", errorPercent: "Errors (%)",
} as const;
const byKind: Record<TrainingLcwoResult["kind"], (keyof typeof fields)[]> = {
  callsign: ["speedWpm", "score", "errorCount"],
  letters: ["groupLength", "speedWpm", "errorPercent"],
  words: ["speedWpm", "maximumLength", "errorCount", "score"],
  figures: ["groupLength", "speedWpm", "errorPercent"],
  custom: ["groupLength", "speedWpm", "errorPercent"],
};

/** External trainers do not return results to this page. Keep one run's metrics together. */
export function mountLcwoResultFields(container: HTMLElement, visible: boolean): void {
  container.hidden = !visible;
  container.innerHTML = visible ? `<details class="training-panel"><summary>LCWO result (optional)</summary><div class="training-panel-body">
    <label>Drill<select name="lcwoKind"><option value="">No result to record</option><option value="callsign">Callsigns</option><option value="letters">Letters</option><option value="words">Words</option><option value="figures">Figures</option><option value="custom">Custom characters / Koch</option></select></label>
    <p class="training-small">Enter results from one run. Letters, Figures and Custom use effective speed; Words uses the word trainer's own speed. For Words, count red received entries. Enter error percentage, not accuracy.</p>
    <div class="training-result-fields">${Object.entries(fields).map(([key, label]) => `<label data-lcwo-field="${key}" hidden>${label}<input type="number" name="lcwo${key}" min="${key === "speedWpm" || key === "groupLength" || key === "maximumLength" ? 1 : 0}" max="${key === "errorPercent" ? 100 : key === "speedWpm" ? 200 : key === "groupLength" || key === "maximumLength" ? 1000 : key === "score" ? 1e12 : 1e6}" step="${key === "speedWpm" || key === "errorPercent" || key === "score" ? "any" : 1}" disabled /></label>`).join("")}</div>
  </div></details>` : "";
  container.querySelector<HTMLSelectElement>("select")?.addEventListener("change", (event) => {
    const kind = (event.currentTarget as HTMLSelectElement).value as TrainingLcwoResult["kind"];
    for (const label of container.querySelectorAll<HTMLElement>("[data-lcwo-field]")) {
      const enabled = byKind[kind]?.includes(label.dataset.lcwoField as keyof typeof fields) ?? false;
      label.hidden = !enabled;
      label.querySelector("input")!.disabled = !enabled;
    }
  });
}

export function readLcwoResult(data: FormData): TrainingLcwoResult | undefined {
  const kind = data.get("lcwoKind") as TrainingLcwoResult["kind"];
  if (!Object.hasOwn(byKind, kind)) return undefined;
  const result: TrainingLcwoResult = { kind };
  for (const key of byKind[kind]) {
    const raw = String(data.get(`lcwo${key}`) ?? "").trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (key === "errorPercent" && value > 100))
      throw new Error(`Enter a valid ${fields[key].toLowerCase()}.`);
    result[key] = value;
  }
  return Object.keys(result).length > 1 ? result : undefined;
}
