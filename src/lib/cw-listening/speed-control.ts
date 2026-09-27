export const LISTENING_SPEEDS = [12, 15, 18, 20, 23, 25, 28, 30, 35, 40] as const;

/** Keep an exact/custom speed selectable without rounding an existing draft. */
export function listeningSpeedStops(wpm: number): number[] {
  return [...new Set<number>([...LISTENING_SPEEDS, wpm])].sort((a, b) => a - b);
}

export function mountSpeedControl(host: HTMLElement, initial: number, changed: (wpm: number, fwpm?: number) => void, initialFwpm?: number) {
  host.classList.add("listening-speed");
  host.innerHTML = `<label class="listening-speed-label">Character speed <output></output>
      <input type="range" min="0" step="1" aria-label="Character speed (WPM)" />
    </label>
    <div class="listening-speed-stops" aria-hidden="true"></div>
    <details><summary>Enter speed</summary>
      <label>Exact speed (WPM)<input type="number" min="10" max="60" step="1" required /></label>
      <p class="listening-small">10-60 WPM</p>
    </details>
    <label>Effective speed (WPM)<input data-effective-speed type="number" min="5" max="60" step="1" required /></label>
    <p class="listening-small">Lower effective speed adds Farnsworth spacing between characters and words. Match character speed for normal spacing. Speech and extra pauses are additional.</p>`;
  const slider = host.querySelector<HTMLInputElement>('input[type="range"]')!;
  const number = host.querySelector<HTMLInputElement>('input[type="number"]')!;
  const output = host.querySelector("output")!;
  const ticks = host.querySelector<HTMLElement>(".listening-speed-stops")!;
  const effective = host.querySelector<HTMLInputElement>("[data-effective-speed]")!;
  let current = initial;
  let currentFwpm = initialFwpm;
  let stops: number[] = [];
  function preview(wpm: number) {
    output.textContent = `${wpm} WPM`;
    slider.setAttribute("aria-valuetext", `${wpm} words per minute`);
  }
  function set(wpm: number, fwpm = currentFwpm) {
    current = wpm;
    currentFwpm = fwpm === undefined || fwpm >= wpm ? undefined : fwpm;
    effective.max = String(wpm);
    effective.value = String(currentFwpm ?? wpm);
    stops = listeningSpeedStops(wpm);
    slider.max = String(stops.length - 1);
    slider.value = String(stops.indexOf(wpm));
    number.value = String(wpm);
    preview(wpm);
    ticks.replaceChildren(...stops.map(speed => {
      const tick = document.createElement("span");
      tick.textContent = String(speed);
      return tick;
    }));
  }
  // Preview while dragging; regenerate audio once the thumb is released.
  slider.addEventListener("input", () => preview(stops[Number(slider.value)]));
  slider.addEventListener("change", () => {
    const wpm = stops[Number(slider.value)];
    set(wpm);
    changed(wpm, currentFwpm);
  });
  number.addEventListener("change", () => {
    if (!number.checkValidity()) { number.reportValidity(); number.value = String(current); return; }
    const wpm = Number(number.value);
    set(wpm);
    changed(wpm, currentFwpm);
  });
  effective.addEventListener("change", () => {
    if (!effective.checkValidity()) { effective.reportValidity(); effective.value = String(currentFwpm ?? current); return; }
    set(current, Number(effective.value));
    changed(current, currentFwpm);
  });
  host.querySelector("details")!.open = !LISTENING_SPEEDS.some(speed => speed === initial);
  set(initial);
  return { set };
}
