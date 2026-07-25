export const OFFLINE_FIELD_KIT_PATH = "/radio/";

export function updateOfflineUi(online = navigator.onLine) {
  document.documentElement.toggleAttribute("data-offline", !online);
  for (const notice of document.querySelectorAll<HTMLElement>("[data-offline-only]")) {
    notice.hidden = online;
  }
}

export function initOfflineFieldKit() {
  updateOfflineUi();
  window.addEventListener("online", () => updateOfflineUi(true));
  window.addEventListener("offline", () => updateOfflineUi(false));

  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is optional; the normal online site remains usable.
      });
    },
    { once: true },
  );
}
