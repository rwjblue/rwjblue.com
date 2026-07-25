const editableTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as
    | { tagName?: string; isContentEditable?: boolean }
    | null;
  return (
    Boolean(element) &&
    (editableTags.has(element?.tagName ?? "") ||
      element?.isContentEditable === true)
  );
}

export function shouldHandleSearchShortcut(event: {
  key: string;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target: EventTarget | null;
}): boolean {
  return (
    event.key === "/" &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !isEditableTarget(event.target)
  );
}

export function initSearchShortcut() {
  window.addEventListener("keydown", (event) => {
    if (!shouldHandleSearchShortcut(event)) return;
    event.preventDefault();
    const input = document.querySelector<HTMLInputElement>("[data-search-input]");
    if (input) {
      input.focus();
      input.select();
      return;
    }
    window.location.assign("/search/?focus=1");
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("focus") === "1") {
    document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
  }
}
