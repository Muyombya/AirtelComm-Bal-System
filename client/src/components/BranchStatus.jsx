import { useEffect, useMemo, useRef, useState } from "react";
import { getBranches, getGeneralShopStatus } from "../services/api";
import { subscribeToBranchReportChanges } from "../services/branchReportEvents";
import "../branch-status.css";

const money = (value) => `UGX ${Number(value || 0).toLocaleString("en-UG")}`;
const compactNumber = (value) => Number(value || 0).toLocaleString("en-UG");
const figureTone = (value, emphasis = "") => Number(value) < 0 ? "negative-figure" : emphasis;

function shortageRowTitle(item) {
  return item.eventName || item.employee_name || item.employeeName || item.name || "—";
}

function shortageRowDetails(item) {
  const details = [];
  const tillName = item.tillName || item.till_names;
  const attendant = item.affectedAttendant || (item.source === "excess-offset" ? item.employeeName : "");
  if (attendant) details.push(`Attendant: ${attendant}`);
  if (tillName) details.push(`Till: ${tillName}`);
  return details.join(" · ");
}

function providerGroup(name) {
  const normalized = String(name || "").trim().toLocaleLowerCase();
  return ["mtn", "airtel", "master", "roving", "africell", "warid"].some((word) => normalized.includes(word))
    ? "mobile"
    : "banks";
}

function branchReportTint(name) {
  const normalized = String(name || "").trim().toLocaleLowerCase();
  if (normalized.includes("namugongo")) return "#ffe599";
  if (normalized.includes("naalya")) return "#efefef";
  if (normalized.includes("kitende")) return "#9fc5e8";
  if (normalized.includes("lubowa")) return "#f4cccc";
  return "#ffffff";
}

function reportItemIdentity(name) {
  const label = String(name || "Other").trim();
  const normalized = label.toLocaleLowerCase();
  if (normalized.includes("mtn")) return { key: "provider:mtn", name: "Mtn Mobile Money" };
  if (normalized.includes("airtel")) return { key: "provider:airtel", name: "Airtel Money" };
  return { key: normalized, name: label };
}

function printBranchStatus() {
  const report = document.querySelector(".branch-status-report");
  if (!report) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  const styles = [...document.head.querySelectorAll('link[rel="stylesheet"], style')]
    .map((node) => node.outerHTML)
    .join("\n");
  const branch = report.querySelector(".branch-status-report-head h2")?.textContent || "Branch";
  const reportDate = report.querySelector(".branch-status-report-head p")?.textContent || "";
  printWindow.addEventListener("load", () => {
    printWindow.document.title = `${branch} Branch Status ${reportDate}`;
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  }, { once: true });
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${document.baseURI}"><title>Branch Status</title>${styles}</head><body>${report.outerHTML}</body></html>`);
  printWindow.document.close();
}

function escapeSvg(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function createBranchStatusSvg({ branchName, branchTint, date, groups, totals, transactions, cashBook, accessoriesCount, shortages }) {
  const width = 360;
  const margin = 7;
  const innerWidth = width - margin * 2;
  const colWidth = innerWidth / 2;
  const mobileRows = groups.mobile || [];
  const bankRows = groups.banks || [];
  const expenses = cashBook.expenses || [];
  const shortageRows = (shortages || []).filter((item) => item.source === "excess-offset" || Number(item.balance ?? 0) > 0 || Number(item.paymentsToday ?? item.payments_today ?? 0) > 0);
  const maxProviderRows = Math.max(mobileRows.length, bankRows.length, 1);
  const branchImbalance = Number(totals.branchImbalance ?? (Number(totals.branchOperatingCapital || 0) - Number(totals.branchCapital || 0)));
  const providerHeight = 53 + maxProviderRows * 13;
  const cashbookHeight = Math.max(87, 75 + expenses.length * 12);
  const shortageHeight = 18 + 22 + Math.max(shortageRows.length, 1) * 16 + 13;
  const bottomHeight = Math.max(cashbookHeight, shortageHeight);
  const height = 8 + 30 + providerHeight + 17 + 6 + 43 + 22 + 6 + bottomHeight + 14;
  const shapes = [];
  const rect = (x, y, w, h, fill, stroke = "none", radius = 0) => shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`);
  const line = (x1, y1, x2, y2, color = "#d6e0e9", strokeWidth = 0.6) => shapes.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${strokeWidth}"/>`);
  const text = (x, y, value, { size = 7, color = "#172a40", weight = 400, anchor = "start" } = {}) => shapes.push(`<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${escapeSvg(value)}</text>`);
  const font = { label: 7, body: 7, compact: 7, value: 7 };
  const shortageFontSize = 6;
  const amountColor = (value, shortage = false) => Number(value) < 0 || shortage ? "#b42318" : "#172a40";
  const formatAmount = (value, currency = false) => `${currency ? "UGX " : ""}${Number(value || 0).toLocaleString("en-UG")}`;
  const fitted = (value, max = 22) => {
    const content = String(value ?? "—");
    return content.length > max ? `${content.slice(0, max - 1)}…` : content;
  };

  rect(0, 0, width, height, "#edf2f7");
  rect(margin, 5, innerWidth, height - 10, branchTint || "#ffffff", "#cbd5df", 7);
  const centerX = width / 2;
  text(centerX, 22, branchName, { size: 14, weight: 800, anchor: "middle", color: "#173b64" });
  text(centerX, 32, `Branch Status · ${date}`, { size: 7, anchor: "middle", color: "#64748b" });
  line(margin + 7, 38, width - margin - 7, 38, "#163d68", 1);

  let y = 43;
  rect(margin + 1, y, innerWidth - 2, 15, "#eaf1f7", "#d8e0e8", 4);
  text(centerX, y + 10, "CLOSING FLOAT AND TRANSACTIONS", { size: 7, weight: 800, anchor: "middle", color: "#24496d" });
  y += 15;
  [
    { key: "mobile", label: "MOBILE MONEY", rows: mobileRows },
    { key: "banks", label: "BANKS", rows: bankRows },
  ].forEach((group, groupIndex) => {
    const x = margin + groupIndex * colWidth;
    const right = x + colWidth;
    const itemStart = x + 9;
    const balanceEdge = right - 47;
    const transactionEdge = right - 15;
    rect(x, y, colWidth, 12, "#dce9f5", "#aebdcc");
    text(x + colWidth / 2, y + 8.5, group.label, { size: 6.5, weight: 800, anchor: "middle", color: "#24496d" });
    rect(x, y + 12, colWidth, 15, "#f7f9fb", "#d8e0e8");
    text(itemStart, y + 22, "Item", { size: font.label, weight: 800, color: "#63748a" });
    text(right - 63, y + 22, "Closing Bal", { size: font.compact, weight: 800, color: "#63748a", anchor: "middle" });
    text(right - 19, y + 22, "Tx", { size: font.label, weight: 800, color: "#63748a", anchor: "middle" });
    for (let rowIndex = 0; rowIndex < maxProviderRows; rowIndex += 1) {
      const rowY = y + 34 + rowIndex * 13;
      line(x, rowY + 4, right, rowY + 4);
      const item = group.rows[rowIndex];
      if (!item) continue;
      text(itemStart, rowY, fitted(item.name, 20), { size: font.body });
      text(balanceEdge, rowY, item.hasBalance ? formatAmount(item.amount) : "—", { size: font.compact, color: amountColor(item.amount), anchor: "end" });
      text(transactionEdge, rowY, item.hasTransactions ? formatAmount(item.count) : "—", { size: font.compact, color: amountColor(item.count), anchor: "end" });
    }
    const totalY = y + 34 + maxProviderRows * 13;
    rect(x, totalY - 9, colWidth, 13, "#f1f5f8", "#d8e0e8");
    const balanceTotal = group.rows.filter((item) => item.hasBalance).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const transactionTotal = group.rows.filter((item) => item.hasTransactions).reduce((sum, item) => sum + Number(item.count || 0), 0);
    text(itemStart, totalY, "Total", { size: font.label, weight: 800 });
    text(balanceEdge, totalY, group.rows.some((item) => item.hasBalance) ? formatAmount(balanceTotal) : "—", { size: font.compact, weight: 800, color: amountColor(balanceTotal), anchor: "end" });
    text(transactionEdge, totalY, group.rows.some((item) => item.hasTransactions) ? formatAmount(transactionTotal) : "—", { size: font.compact, weight: 800, color: amountColor(transactionTotal), anchor: "end" });
  });
  line(centerX, y, centerX, y + 38 + maxProviderRows * 13, "#8fa5bb", 1);
  y += 38 + maxProviderRows * 13;
  rect(margin + 1, y, innerWidth - 2, 14, "#dce9f5", "#aebdcc");
  text(margin + 8, y + 9.5, "TOTAL FLOAT", { size: 6, weight: 800, color: "#24496d" });
  text(margin + colWidth - 6, y + 9.5, formatAmount(totals.totalFloat, true), { size: 7, weight: 800, anchor: "end" });
  line(centerX, y + 2, centerX, y + 12, "#aebdcc");
  text(centerX + 6, y + 9.5, "TOTAL TXNS", { size: 6, weight: 800, color: "#24496d" });
  text(width - margin - 8, y + 9.5, transactions.reduce((sum, item) => sum + Number(item.count || 0), 0).toLocaleString("en-UG"), { size: 7, weight: 800, anchor: "end" });

  y += 18;
  const metrics = [
    ["TOTAL CASH", totals.totalCash],
    ["OPERATING CAPITAL", totals.branchCapital],
    ["BRANCH CAPITAL", totals.branchOperatingCapital],
    [branchImbalance < 0 ? "DAILY EXCESS" : branchImbalance > 0 ? "DAILY SHORTAGE" : "DAILY BALANCED", branchImbalance],
  ];
  metrics.forEach(([label, value], index) => {
    const x = margin + 1 + (index % 2) * colWidth;
    const rowY = y + Math.floor(index / 2) * 20;
    const isShortage = label === "DAILY SHORTAGE";
    const isExcess = label === "DAILY EXCESS";
    rect(x, rowY, colWidth - 1, 19, isShortage ? "#fff0ed" : isExcess ? "#e3f4eb" : "#f0f5f9", "#d8e0e8", 3);
    text(x + 5, rowY + 7, label, { size: font.label, weight: 800, color: isShortage ? "#a43525" : isExcess ? "#17663a" : "#63748a" });
    text(x + 5, rowY + 15.5, formatAmount(value, true), { size: font.value, weight: 800, color: isShortage ? "#b42318" : isExcess ? "#17663a" : "#172a40" });
  });
  y += 43;
  rect(margin + 1, y, innerWidth - 2, 19, "#f7f9fb", "#d8e0e8", 3);
  text(margin + 6, y + 8, "ACCESSORIES SALES:", { size: font.label, weight: 800, color: "#63748a" });
  text(width - margin - 8, y + 15, formatAmount(accessoriesCount), { size: 7, weight: 800, color: amountColor(accessoriesCount), anchor: "end" });

  y += 24;
  const bottomTop = y;
  const cashX = margin;
  const shortageX = margin + colWidth;
  const cardWidth = colWidth;
  rect(cashX, bottomTop, cardWidth, bottomHeight, "#ffffff", "#d8e0e8", 4);
  rect(shortageX, bottomTop, cardWidth, bottomHeight, "#ffffff", "#d8e0e8", 4);
  [
    [cashX, "CASHBOOK"],
    [shortageX, "BRANCH SHORTAGE COUNTER"],
  ].forEach(([x, heading]) => {
    rect(x, bottomTop, cardWidth, 14, "#eaf1f7", "none", 4);
    text(x + cardWidth / 2, bottomTop + 9.5, heading, { size: 6.5, weight: 900, color: "#24496d", anchor: "middle" });
  });

  let cashY = bottomTop + 14;
  text(cashX + cardWidth / 2, cashY + 8, "EXPENSES", { size: font.label, weight: 800, color: "#63748a", anchor: "middle" });
  line(cashX + 3, cashY + 10, cashX + cardWidth - 3, cashY + 10);
  cashY += 18;
  expenses.forEach((expense) => {
    text(cashX + 4, cashY + 6, fitted(expense.description || expense.category || "Expense", 18), { size: font.body, weight: 600 });
    text(cashX + cardWidth - 4, cashY + 6, formatAmount(expense.amount, true), { size: font.compact, weight: 700, color: amountColor(expense.amount), anchor: "end" });
    line(cashX + 3, cashY + 9, cashX + cardWidth - 3, cashY + 9);
    cashY += 12;
  });
  if (!expenses.length) {
    text(cashX + 5, cashY + 6, "No expenses recorded", { size: font.body, color: "#68788a" });
    cashY += 12;
  }
  [
    ["Total Spent", cashBook.dailyExpenses, true],
    ["Funds Added", cashBook.dailyTopUps, false],
    ["Opening Balance", cashBook.openingBalance, false],
    ["Closing Balance", cashBook.closingBalance, true],
  ].forEach(([label, value, bold]) => {
    text(cashX + 4, cashY + 7, label, { size: font.label, weight: bold ? 800 : 500 });
    text(cashX + cardWidth - 4, cashY + 7, formatAmount(value, true), { size: font.compact, weight: bold ? 800 : 500, color: amountColor(value), anchor: "end" });
    cashY += 11;
  });

  let shortageY = bottomTop + 14;
  const nameX = shortageX + 3;
  const owedX = shortageX + 71;
  const paidX = shortageX + 106;
  const balanceX = shortageX + cardWidth - 3;
  text(nameX, shortageY + 10, "NAME / EVENT", { size: shortageFontSize, weight: 800, color: "#63748a" });
  text(owedX, shortageY + 10, "OWED", { size: shortageFontSize, weight: 800, color: "#63748a", anchor: "middle" });
  text(paidX, shortageY + 10, "PAID", { size: shortageFontSize, weight: 800, color: "#63748a", anchor: "middle" });
  text(balanceX, shortageY + 10, "BALANCE", { size: shortageFontSize, weight: 800, color: "#63748a", anchor: "end" });
  line(shortageX + 3, shortageY + 13, shortageX + cardWidth - 3, shortageY + 13);
  shortageY += 19;
  shortageRows.forEach((item) => {
    text(nameX, shortageY + 6, fitted(shortageRowTitle(item), 14), { size: shortageFontSize, weight: 700 });
    const details = shortageRowDetails(item);
    if (details) text(nameX, shortageY + 13, fitted(details, 28), { size: 4.3, color: "#63748a" });
    text(owedX, shortageY + 9, formatAmount(item.amountOwed ?? item.amount_owed), { size: shortageFontSize, weight: 700, color: item.source === "excess-offset" ? "#17663a" : amountColor(item.amountOwed ?? item.amount_owed, true), anchor: "middle" });
    text(paidX, shortageY + 9, formatAmount(item.paymentsToday ?? item.payments_today), { size: shortageFontSize, weight: 700, anchor: "middle" });
    text(balanceX, shortageY + 9, formatAmount(item.balance), { size: shortageFontSize, weight: 700, color: item.source === "excess-offset" ? "#17663a" : amountColor(item.balance, true), anchor: "end" });
    shortageY += 16;
  });
  if (!shortageRows.length) {
    text(shortageX + 6, shortageY + 7, "No outstanding shortages", { size: 5.5, color: "#68788a" });
    shortageY += 13;
  }
  line(shortageX + 3, shortageY + 1, shortageX + cardWidth - 3, shortageY + 1, "#aebdcc", 0.8);
  const totalPaid = shortageRows.reduce((sum, item) => sum + Number(item.paymentsToday ?? item.payments_today ?? 0), 0);
  const totalOwed = shortageRows.reduce((sum, item) => sum + Number(item.amountOwed ?? item.amount_owed ?? 0), 0);
  text(nameX, shortageY + 8, "TOTAL", { size: shortageFontSize, weight: 900 });
  text(owedX, shortageY + 8, formatAmount(totalOwed), { size: shortageFontSize, weight: 800, color: totalOwed < 0 ? "#17663a" : amountColor(totalOwed, true), anchor: "middle" });
  text(paidX, shortageY + 8, formatAmount(totalPaid), { size: shortageFontSize, weight: 800, anchor: "middle" });
  text(balanceX, shortageY + 8, formatAmount(branchImbalance), { size: shortageFontSize, weight: 800, color: branchImbalance < 0 ? "#17663a" : branchImbalance > 0 ? "#b42318" : "#172a40", anchor: "end" });

  y = bottomTop + bottomHeight;
  text(centerX, y + 9, "Figures consolidated across the branch for the selected date.", { size: 5.4, color: "#758397", anchor: "middle" });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height * 2}" viewBox="0 0 ${width} ${height}">${shapes.join("")}</svg>`;
}

async function createBranchStatusImage(reportData) {
  const svg = createBranchStatusSvg(reportData);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Could not render the report image in this browser."));
      image.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the report image.");
    context.drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the PNG file.")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function localBusinessDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

const today = localBusinessDate();

export default function BranchStatus({ user }) {
  const [date, setDate] = useState(today);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === "SUPERVISOR" ? String(user.branch_id || "") : "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [fitMode, setFitMode] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const requestId = useRef(0);
  const reportRef = useRef(null);

  useEffect(() => {
    if (!fitMode) return undefined;
    document.body.classList.add("branch-status-fit-active");
    const fitReport = () => {
      const report = reportRef.current;
      if (!report) return;
      report.style.setProperty("--branch-status-fit-scale", "1");
      const bounds = report.getBoundingClientRect();
      const availableWidth = window.innerWidth - 12;
      const availableHeight = window.innerHeight - 48;
      const scale = Math.min(1, availableWidth / bounds.width, availableHeight / bounds.height);
      report.style.setProperty("--branch-status-fit-scale", String(Math.max(0.35, scale)));
    };
    const frame = window.requestAnimationFrame(fitReport);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fitReport);
    if (reportRef.current && observer) observer.observe(reportRef.current);
    window.addEventListener("resize", fitReport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", fitReport);
      if (observer) observer.disconnect();
      document.body.classList.remove("branch-status-fit-active");
      if (reportRef.current) reportRef.current.style.removeProperty("--branch-status-fit-scale");
    };
  }, [fitMode, data]);

  useEffect(() => {
    if (!fitMode) return undefined;
    const exitOnEscape = (event) => {
      if (event.key === "Escape") setFitMode(false);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [fitMode]);

  useEffect(() => {
    if (user?.role === "SUPERVISOR") {
      setBranchId(String(user.branch_id || ""));
      setBranches([]);
      return;
    }
    getBranches().then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      setBranches(list);
      setBranchId((current) => current && list.some((branch) => String(branch.id) === current)
        ? current
        : String(list[0]?.id || ""));
    }).catch((err) => setError(err?.message || "Unable to load branches."));
  }, [user?.role, user?.branch_id]);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      setData(null);
      return undefined;
    }
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    getGeneralShopStatus(Number(branchId), date).then((result) => {
      if (requestId.current === currentRequest) setData(result);
    }).catch((err) => {
      if (requestId.current === currentRequest) setError(err?.message || "Unable to load Branch Status.");
    }).finally(() => {
      if (requestId.current === currentRequest) setLoading(false);
    });
    return () => { requestId.current += 1; };
  }, [branchId, date, refreshKey]);

  useEffect(() => {
    if (!branchId) return undefined;
    const refreshIfCurrent = (update) => {
      if (update?.branchId == null || String(update.branchId) !== String(branchId)) return;
      if (update?.businessDate && String(update.businessDate).slice(0, 10) !== String(date)) return;
      setRefreshKey((key) => key + 1);
    };
    const unsubscribe = subscribeToBranchReportChanges(refreshIfCurrent);
    let channel;
    try {
      channel = new BroadcastChannel("airtelcomm-shortage-updates");
      channel.onmessage = (event) => {
        const update = event?.data;
        if (update?.type === "SHORTAGE_SETTLEMENT_RECORDED") refreshIfCurrent(update);
      };
    } catch {
      channel = null;
    }
    return () => {
      unsubscribe();
      if (channel) channel.close();
    };
  }, [branchId, date]);

  const positions = useMemo(() => {
    const grouped = new Map();
    for (const item of data?.positions || []) {
      const name = String(item.service_provider_name || item.terminal_name || "Other").trim();
      const key = item.service_provider_id == null ? name.toLocaleLowerCase() : String(item.service_provider_id);
      const current = grouped.get(key) || { name, amount: 0 };
      current.amount += Number(item.amount || 0);
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const transactions = useMemo(() => {
    const grouped = new Map();
    for (const item of data?.dailyTransactions || []) {
      const name = String(item.service_provider_name || item.terminal_name || "Other").trim();
      const key = item.service_provider_id == null ? name.toLocaleLowerCase() : String(item.service_provider_id);
      const current = grouped.get(key) || { name, count: 0 };
      current.count += Number(item.transactionCount || 0);
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const groupedItems = useMemo(() => {
    const items = new Map();
    for (const item of positions) {
      const identity = reportItemIdentity(item.name);
      const current = items.get(identity.key) || { name: identity.name, amount: 0, hasBalance: false, count: 0, hasTransactions: false };
      current.amount += Number(item.amount || 0);
      current.hasBalance = true;
      items.set(identity.key, current);
    }
    for (const item of transactions) {
      const identity = reportItemIdentity(item.name);
      const current = items.get(identity.key) || { name: identity.name, amount: 0, hasBalance: false, count: 0, hasTransactions: false };
      current.count += Number(item.count || 0);
      current.hasTransactions = true;
      items.set(identity.key, current);
    }
    const groups = { mobile: [], banks: [] };
    for (const item of items.values()) groups[providerGroup(item.name)].push(item);
    for (const rows of Object.values(groups)) rows.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }, [positions, transactions]);

  const totals = data?.totals || {};
  const branchImbalance = Number(totals.branchImbalance ?? (Number(totals.branchOperatingCapital || 0) - Number(totals.branchCapital || 0)));
  const cashBook = data?.cashBook || {};
  const dailyExcesses = data?.dailyExcesses || [];
  // Excess is a report-only negative adjustment in this same counter. It nets
  // the displayed balance without creating a false settlement payment.
  const shortages = [
    ...(data?.shortageCounter || []).filter((item) => Number(item.balance ?? 0) > 0 || Number(item.paymentsToday ?? item.payments_today ?? 0) > 0),
    ...dailyExcesses.map((item) => ({
      source: "excess-offset",
      eventId: `excess-${item.tillBalanceId}`,
      eventName: "Excess",
      tillName: item.tillName,
      employeeName: item.employeeName,
      amountOwed: -Number(item.amount || 0),
      paymentsToday: 0,
      balance: -Number(item.amount || 0),
    })),
  ];
  const branchName = data?.branch?.name || user?.branch_name || "Branch";

  const shareBranchStatusImage = async () => {
    if (!reportRef.current || sharingImage) return;
    setSharingImage(true);
    setShareMessage("");
    try {
      const blob = await createBranchStatusImage({
        branchName,
        branchTint: branchReportTint(branchName),
        date,
        groups: groupedItems,
        totals,
        transactions,
        cashBook,
        accessoriesCount: data?.accessoriesCount,
        shortages,
      });
      const safeBranch = branchName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Branch";
      const file = new File([blob], `Branch-Status-${safeBranch}-${date}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const imageUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = file.name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
        setShareMessage("Image downloaded. Open it and share it in WhatsApp.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") setShareMessage(err?.message || "Unable to create the report image.");
    } finally {
      setSharingImage(false);
    }
  };

  return (
    <main className={`app-shell branch-status-page${fitMode ? " fit-mode" : ""}`}>
      <header className="branch-status-controls">
        <div><span className="branch-status-kicker">DAILY BRANCH REPORT</span><h1>Branch Status</h1></div>
        <div className="branch-status-filters">
          {user?.role === "SUPERVISOR" ? <strong>{branchName}</strong> : (
            <label>Branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select></label>
          )}
          <label>Date<input type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <button type="button" onClick={printBranchStatus} disabled={!data || loading}>Save PDF</button>
          <button type="button" onClick={shareBranchStatusImage} disabled={!data || loading || sharingImage}>{sharingImage ? "Preparing report…" : "Share report"}</button>
          <button type="button" onClick={() => setFitMode(true)} disabled={!data || loading}>Fit to screen</button>
        </div>
      </header>

      {shareMessage && <div className="branch-status-message" role="status">{shareMessage}</div>}

      {error && <div className="branch-status-message error" role="alert">{error}</div>}
      {loading && <div className="branch-status-message">Loading Branch Status…</div>}
      {!loading && !branchId && <div className="branch-status-message">No branch is available.</div>}

      {fitMode && <>
        <button type="button" className="branch-status-fit-share" onClick={shareBranchStatusImage} disabled={sharingImage}>{sharingImage ? "Preparing…" : "Share report"}</button>
        <button type="button" className="branch-status-fit-exit" aria-label="Return to normal Branch Status view" onClick={() => setFitMode(false)}>← Back to report</button>
      </>}
      {data && !loading && <article ref={reportRef} className="branch-status-report" style={{ "--branch-status-branch-tint": branchReportTint(branchName) }}>
        <header className="branch-status-report-head">
          <div><h2>{branchName}</h2><p>Branch Status · {date}</p></div>
        </header>

        <section className="branch-status-consolidated">
          <h3>Closing Float and Transactions</h3>
          <div className="branch-status-group-grid">
            {[
              { key: "mobile", label: "Mobile Money", withTransactions: true },
              { key: "banks", label: "Banks", withTransactions: true },
            ].map((group) => {
              const rows = groupedItems[group.key];
              const balanceTotal = rows.filter((item) => item.hasBalance).reduce((sum, item) => sum + Number(item.amount || 0), 0);
              const transactionTotal = rows.filter((item) => item.hasTransactions).reduce((sum, item) => sum + Number(item.count || 0), 0);
              return <div className={`branch-status-group branch-status-group-${group.key}`} key={group.key}>
                <h4>{group.label}</h4>
                <div className={`branch-status-group-columns ${group.withTransactions ? "with-transactions" : ""}`}>
                  <span>Item Name</span><span>Closing Bal</span>{group.withTransactions && <span>Txns</span>}
                </div>
                {rows.map((item) => <div className={`branch-status-group-row ${group.withTransactions ? "with-transactions" : ""}`} key={item.name}>
                  <span>{item.name}</span>
                  <strong className={figureTone(item.amount)}>{item.hasBalance ? compactNumber(item.amount) : "—"}</strong>
                  {group.withTransactions && <strong className={figureTone(item.count)}>{item.hasTransactions ? compactNumber(item.count) : "—"}</strong>}
                </div>)}
                {!rows.length && <div className="branch-status-group-empty">—</div>}
                <div className={`branch-status-group-total ${group.withTransactions ? "with-transactions" : ""}`}>
                  <span>Totals</span><strong className={figureTone(balanceTotal)}>{rows.some((item) => item.hasBalance) ? compactNumber(balanceTotal) : "—"}</strong>
                  {group.withTransactions && <strong className={figureTone(transactionTotal)}>{rows.some((item) => item.hasTransactions) ? compactNumber(transactionTotal) : "—"}</strong>}
                </div>
              </div>;
            })}
          </div>
          <div className="branch-status-consolidated-totals">
            <div><span>Total Float</span><strong className={figureTone(totals.totalFloat)}>{money(totals.totalFloat)}</strong></div>
            <div><span>Total Transactions</span><strong className={figureTone(transactions.reduce((sum, item) => sum + item.count, 0))}>{transactions.reduce((sum, item) => sum + item.count, 0).toLocaleString("en-UG")}</strong></div>
          </div>
        </section>

        <section className="branch-status-capital">
          <div><span>Total Cash</span><strong className={figureTone(totals.totalCash)}>{money(totals.totalCash)}</strong></div>
          <div><span>Operating Capital</span><strong className={figureTone(totals.branchCapital)}>{money(totals.branchCapital)}</strong></div>
          <div><span>Branch Capital</span><strong className={figureTone(totals.branchOperatingCapital)}>{money(totals.branchOperatingCapital)}</strong></div>
          <div className={`branch-status-shortage-total ${branchImbalance < 0 ? "excess" : branchImbalance === 0 ? "balanced" : ""}`}><span>Daily {branchImbalance < 0 ? "Excess" : branchImbalance === 0 ? "Balanced" : "Shortage"}</span><strong>{money(branchImbalance)}</strong></div>
          <div className="branch-status-extra-info">
            <div className="branch-status-accessories-info"><span>Accessories Sales:</span><strong className={figureTone(data.accessoriesCount)}>{compactNumber(data.accessoriesCount)}</strong></div>
          </div>
        </section>

        <section className="branch-status-bottom-grid">
          <div className="branch-status-card">
            <h3>Cashbook</h3>
            <div className="branch-status-table">
              <div className="branch-status-expenses-heading">Expenses</div>
              {(cashBook.expenses || []).map((expense) => <div className="branch-status-row" key={expense.id}><span>{expense.description || expense.category || "Expense"}</span><strong className={figureTone(expense.amount)}>{money(expense.amount)}</strong></div>)}
              {!(cashBook.expenses || []).length && <div className="branch-status-empty">No expenses recorded</div>}
              <div className="branch-status-row total"><span>Total Spent</span><strong className={figureTone(cashBook.dailyExpenses)}>{money(cashBook.dailyExpenses)}</strong></div>
              <div className="branch-status-row"><span>Funds Added</span><strong className={figureTone(cashBook.dailyTopUps)}>{money(cashBook.dailyTopUps)}</strong></div>
              <div className="branch-status-row"><span>Opening Balance</span><strong className={figureTone(cashBook.openingBalance)}>{money(cashBook.openingBalance)}</strong></div>
              <div className="branch-status-row total"><span>Closing Balance</span><strong className={figureTone(cashBook.closingBalance)}>{money(cashBook.closingBalance)}</strong></div>
            </div>
          </div>
          <div className="branch-status-card branch-status-shortage-card">
            <h3>Branch Shortage Counter</h3>
            <div className="branch-status-shortage-head"><span>Name / Event</span><span>Amount Owed</span><span>Paid Off</span><span>Balance</span></div>
            {(shortages || []).map((item) => <div className="branch-status-shortage-row" key={item.source === "excess-offset" ? item.eventId : item.eventId ? `missing-funds-${item.eventId}` : item.employeeId || item.employee_id}><span>{shortageRowTitle(item)}{shortageRowDetails(item) && <small className="branch-status-shortage-context">{shortageRowDetails(item)}</small>}</span><strong className={item.source === "excess-offset" ? "positive-figure" : figureTone(item.amountOwed ?? item.amount_owed, "shortage-figure")}>{compactNumber(item.amountOwed ?? item.amount_owed)}</strong><strong className={figureTone(item.paymentsToday ?? item.payments_today)}>{compactNumber(item.paymentsToday ?? item.payments_today)}</strong><strong className={item.source === "excess-offset" ? "positive-figure" : figureTone(item.balance, "shortage-figure")}>{compactNumber(item.balance)}</strong></div>)}
            {!shortages.length && <div className="branch-status-empty">No outstanding shortages</div>}
            <div className="branch-status-shortage-row total"><span>Total</span><strong className={shortages.reduce((sum, item) => sum + Number(item.amountOwed ?? item.amount_owed ?? 0), 0) < 0 ? "positive-figure" : "shortage-figure"}>{compactNumber(shortages.reduce((sum, item) => sum + Number(item.amountOwed ?? item.amount_owed ?? 0), 0))}</strong><strong>{compactNumber(shortages.reduce((sum, item) => sum + Number(item.paymentsToday ?? item.payments_today ?? 0), 0))}</strong><strong className={branchImbalance < 0 ? "positive-figure" : branchImbalance > 0 ? "shortage-figure" : ""}>{money(branchImbalance)}</strong></div>
          </div>
        </section>
        <footer className="branch-status-foot">Figures are consolidated across the branch for the selected business date.</footer>
      </article>}
    </main>
  );
}
