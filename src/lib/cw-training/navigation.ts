export type TrainingView = "today" | "focus" | "week" | "materials" | "report";

const isTrainingView = (value: string): value is TrainingView =>
  value === "today" || value === "focus" || value === "week" || value === "materials" || value === "report";

/** URL navigation owns only the selected view, never practice data or playback. */
export function createTrainingNavigation(
  browser: Pick<Window, "history" | "location" | "addEventListener">,
  onChange: (view: TrainingView) => void,
) {
  const readView = (): TrainingView => {
    const hash = browser.location.hash.slice(1);
    return isTrainingView(hash) ? hash : "today";
  };
  let view = readView();

  const onTraversal = () => {
    const next = readView();
    if (next === view) return;
    view = next;
    onChange(view);
  };
  // Some traversals emit both events. Comparing the current view deduplicates
  // them without replacing entries or adding another step to Back/Forward.
  browser.addEventListener("popstate", onTraversal);
  browser.addEventListener("hashchange", onTraversal);

  return {
    get view(): TrainingView { return view; },
    navigate(next: string): void {
      if (!isTrainingView(next) || next === view) return;
      const url = new URL(browser.location.href);
      url.hash = next;
      browser.history.pushState(browser.history.state, "", url);
      view = next;
      onChange(view);
    },
  };
}
