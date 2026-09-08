import { View } from "../runtime/view.js";
import { Calls } from "../runtime/call.js";
import { installRunnerBridge } from "./bridge.js";

// View starts this load in its constructor without retaining its promise.
// Preserve it locally so readiness means both configuration and calls loaded.
const fetchCalls = Calls.prototype.fetch_calls;
Calls.prototype.fetch_calls = function () {
  const pending = fetchCalls.call(this);
  this.trainingCallsReady = pending;
  void pending.catch(() => {});
  return pending;
};

const initialize = () => {
  const view = new View();
  view.onLoad();
  installRunnerBridge(view, { window, document, callsReady: view.calls.trainingCallsReady });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
else initialize();
