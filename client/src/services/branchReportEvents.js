const REPORT_EVENT = "airtelcomm:branch-report-updated";
const REPORT_STORAGE_KEY = "airtelcomm:branch-report-updated";

function emit(detail = {}) {
  if (typeof window === "undefined") return;

  const payload = {
    branchId: detail.branchId == null ? null : String(detail.branchId),
    businessDate: detail.businessDate || null,
    reason: detail.reason || "data-change",
    timestamp: Date.now(),
  };

  window.dispatchEvent(new CustomEvent(REPORT_EVENT, { detail: payload }));

  try {
    window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage can be unavailable in private/restricted browser contexts.
  }
}

export function notifyBranchReportChanged(detail = {}) {
  emit(detail);
}

export function subscribeToBranchReportChanges(callback) {
  if (typeof window === "undefined") return () => {};

  const handleEvent = (event) => {
    callback(event?.detail || {});
  };

  const handleStorage = (event) => {
    if (event.key !== REPORT_STORAGE_KEY || !event.newValue) return;
    try {
      callback(JSON.parse(event.newValue));
    } catch {
      callback({ reason: "data-change" });
    }
  };

  window.addEventListener(REPORT_EVENT, handleEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(REPORT_EVENT, handleEvent);
    window.removeEventListener("storage", handleStorage);
  };
}
