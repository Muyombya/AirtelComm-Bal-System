import { notifyBranchReportChanged } from "./branchReportEvents";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(localStorage.getItem("authToken") ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : {}), ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  return data;
}

export function getBranches() { return request("/branches"); }
export function getApiHealth() { return request("/health"); }
export function getServiceProviders() { return request("/master/service-providers"); }
export function getTills(branchId) { const p=branchId?`?branchId=${encodeURIComponent(branchId)}`:""; return request(`/master/tills${p}`); }
export function getTerminals(providerId, branchId) {
  const params = new URLSearchParams();
  if (providerId) params.set("providerId", String(providerId));
  if (branchId) params.set("branchId", String(branchId));
  const q = params.toString();
  return request(`/terminals${q ? `?${q}` : ""}`);
}
export function createTerminal(payload) { return request("/terminals", { method: "POST", body: JSON.stringify(payload) }); }
export function updateTerminal(id, payload) { return request(`/terminals/${id}`, { method: "PUT", body: JSON.stringify(payload) }); }
export function transferTerminal(id, branchId) { return request(`/terminals/${id}/branch`, { method: "PUT", body: JSON.stringify({ branchId: Number(branchId) }) }); }
export function removeTerminalFromBranch(id) { return request(`/terminals/${id}/branch`, { method: "DELETE" }); }
export function getTerminalBranchHistory(id) { return request(`/terminals/${id}/branch-history`); }
export function getTillTerminals(tillId) { return request(`/tills/${tillId}/terminals`); }
export function assignTerminalToTill(tillId, terminalId) { return request(`/tills/${tillId}/terminals`, { method: "POST", body: JSON.stringify({ terminalId: Number(terminalId) }) }); }
export function unassignTerminalFromTill(tillId, terminalId) { return request(`/tills/${tillId}/terminals/${terminalId}`, { method: "DELETE" }); }
export function reorderTillTerminals(tillId, terminalIds) { return request(`/tills/${tillId}/terminals/order`, { method: "PUT", body: JSON.stringify({ terminalIds: terminalIds.map(Number) }) }); }
export function getTillBalancingContext(tillId) { return request(`/tills/${tillId}/balancing-context`); }
export async function createTillBalance(payload) {
  const result = await request("/till-balances", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  notifyBranchReportChanged({
    branchId: payload?.branchId,
    businessDate: payload?.businessDate || null,
    reason: "till-balance-recorded",
  });
  return result;
}
export function getTillShortagePosition(tillId, businessDate) { const p=new URLSearchParams(); if(businessDate)p.set("businessDate",businessDate); const q=p.toString(); return request(`/tills/${tillId}/shortage-position${q?`?${q}`:""}`); }
export async function recordTillShortageSettlement(tillId, tillBalanceId, amount, paymentDate, note="") {
  const result = await request(`/tills/${tillId}/shortage-settlements`, {
    method:"POST",
    body:JSON.stringify({ tillBalanceId:Number(tillBalanceId), amount:Number(amount), paymentDate, note })
  });
  notifyBranchReportChanged({
    businessDate: paymentDate,
    reason: "till-shortage-settlement-recorded",
  });
  return result;
}
export function getTillBalances(tillId, businessDate) { const p=new URLSearchParams(); if(businessDate)p.set("businessDate",businessDate); const q=p.toString(); return request(`/tills/${tillId}/balances${q?`?${q}`:""}`); }
export function getTillBalanceDetails(balanceId) { return request(`/till-balances/${balanceId}`); }
export function getTillTransactionCounts(tillId, businessDate) { const p=new URLSearchParams(); if(businessDate)p.set("businessDate",businessDate); const q=p.toString(); return request(`/tills/${tillId}/transaction-counts${q?`?${q}`:""}`); }
export async function saveTillTransactionCounts(tillId, businessDate, items) {
  const result = await request(`/tills/${tillId}/transaction-counts`, {
    method:"PUT",
    body:JSON.stringify({tillId:Number(tillId),businessDate,items})
  });
  notifyBranchReportChanged({ businessDate, reason: "till-transaction-counts-updated" });
  return result;
}
export function getGeneralShopStatus(branchId, businessDate) { const p=new URLSearchParams({branchId:String(branchId),businessDate}); return request(`/general-shop-status?${p.toString()}`); }
export function saveSupervisorDailyInputs(branchId,businessDate,accessoriesCount,reason) { return request("/general-shop-status",{method:"PUT",body:JSON.stringify({branchId:Number(branchId),businessDate,accessoriesCount:Number(accessoriesCount||0),reason:String(reason||"").trim()})}); }
export function sendGeneralShopStatusEmail(branchId,businessDate,payload) { return request("/general-shop-status/email-report",{method:"POST",body:JSON.stringify({branchId:Number(branchId),businessDate,...payload})}); }
export async function getGeneralShopStatusPdf(branchId, businessDate) {
  const params = new URLSearchParams({ branchId: String(branchId), businessDate });
  const response = await fetch(`${API_BASE_URL}/general-shop-status/pdf?${params.toString()}`, {
    headers: {
      ...(localStorage.getItem("authToken") ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : {})
    }
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data?.error || data?.message || message;
    } catch {}
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return { blob, filename: match?.[1] || "General-Shop-Status.pdf" };
}
export async function saveGeneralShopStatus(branchId,businessDate,accessoriesCount,reason) {
  const result = await request("/general-shop-status",{method:"PUT",body:JSON.stringify({branchId,businessDate,accessoriesCount,reason})});
  notifyBranchReportChanged({ branchId, businessDate, reason: "branch-status-updated" });
  return result;
}
export async function saveGeneralShopTransactionCounts(branchId,businessDate,items) {
  const result = await request("/general-shop-status/transaction-counts",{method:"PUT",body:JSON.stringify({branchId,businessDate,items})});
  notifyBranchReportChanged({ branchId, businessDate, reason: "branch-transaction-counts-updated" });
  return result;
}
export async function recordShortagePayment(branchId,employeeId,amount,paymentDate,note="") {
  const result = await request("/branch-shortages/payments",{method:"POST",body:JSON.stringify({branchId,employeeId,amount,paymentDate,note})});
  notifyBranchReportChanged({ branchId, businessDate: paymentDate, reason: "shortage-payment-recorded" });
  return result;
}
export function getCashBook(branchId,businessDate) { const p=new URLSearchParams({branchId:String(branchId),businessDate}); return request(`/cash-book?${p.toString()}`); }
export async function saveCashBookOpeningBalance(branchId,openingBalance) {
  const result = await request("/cash-book/opening-balance",{method:"PUT",body:JSON.stringify({branchId,openingBalance})});
  notifyBranchReportChanged({ branchId, reason: "cash-book-opening-updated" });
  return result;
}
export async function createCashBookEntry(payload) {
  const result = await request("/cash-book/entries",{method:"POST",body:JSON.stringify(payload)});
  notifyBranchReportChanged({ branchId: payload?.branchId, businessDate: payload?.businessDate, reason: "cash-book-entry-recorded" });
  return result;
}
export function getCashBookHistory(branchId,limit=50) { const p=new URLSearchParams({branchId:String(branchId),limit:String(limit)}); return request(`/cash-book/history?${p.toString()}`); }

export function getCashBookExpenseCategories() { return request("/cash-book/expense-categories"); }
export function getCashBookMonthlyExpenses(branchId, month) {
  const params = new URLSearchParams({ branchId: String(branchId), month });
  return request(`/cash-book/monthly-expenses?${params.toString()}`);
}

// Master Data compatibility exports
export function createBranch(payload) { return request("/branches", { method:"POST", body:JSON.stringify(payload) }); }
export function updateBranch(id,payload) { return request(`/branches/${id}`, { method:"PUT", body:JSON.stringify(payload) }); }
export function getMasterTills(branchId) { const p=branchId?`?branchId=${encodeURIComponent(branchId)}`:""; return request(`/master/tills${p}`); }
export function createMasterTill(payload) { return request("/master/tills", {method:"POST",body:JSON.stringify(payload)}); }
export function updateMasterTill(id,payload) { return request(`/master/tills/${id}`, {method:"PUT",body:JSON.stringify(payload)}); }
export function getEmployees() { return request("/master/employees"); }
export function createEmployee(payload) { return request("/master/employees", {method:"POST",body:JSON.stringify(payload)}); }
export function updateEmployee(id,payload) { return request(`/master/employees/${id}`, {method:"PUT",body:JSON.stringify(payload)}); }
export function getMasterServiceProviders() { return request("/master/service-providers"); }
export function createServiceProvider(payload) { return request("/master/service-providers", {method:"POST",body:JSON.stringify(payload)}); }
export function updateServiceProvider(id,payload) { return request(`/master/service-providers/${id}`, {method:"PUT",body:JSON.stringify(payload)}); }
export function getTillAssignment(tillId) { return request(`/master/tills/${tillId}/assignment`); }
export function setTillAssignment(tillId,employeeId) { return request(`/master/tills/${tillId}/assignment`, {method:"PUT",body:JSON.stringify({employeeId:employeeId?Number(employeeId):null})}); }

export function getBranchFloatAllocations(branchId) { return request(`/branches/${branchId}/float-allocations`); }
export function allocateFloatToBranch(branchId, terminalId) { return request(`/branches/${branchId}/float-allocations`, {method:"POST", body:JSON.stringify({terminalId:Number(terminalId)})}); }
export function releaseFloatFromBranch(branchId, terminalId) { return request(`/branches/${branchId}/float-allocations/${terminalId}`, {method:"DELETE"}); }
export function allocateBranchFloatToTill(branchId, terminalId, tillId) { return request(`/branches/${branchId}/float-allocations/${terminalId}/till`, {method:"PUT", body:JSON.stringify({tillId:Number(tillId)})}); }
export function releaseFloatFromTill(branchId, terminalId) { return request(`/branches/${branchId}/float-allocations/${terminalId}/till`, {method:"DELETE"}); }

export function getCashBookExpenseLedger(branchId, month, scope = "ALL") {
  const params = new URLSearchParams({ branchId: String(branchId), month, scope });
  return request(`/cash-book/expense-ledger?${params.toString()}`);
}

export function login(username,password) { return request("/auth/login", { method:"POST", body:JSON.stringify({username,password}) }); }
export function logout() { return request("/auth/logout", { method:"POST" }); }
export function getCurrentUser() { return request("/auth/me"); }
export function changePassword(currentPassword,newPassword) { return request("/auth/password", { method:"PUT", body:JSON.stringify({currentPassword,newPassword}) }); }
export function getUsers() { return request("/auth/users"); }
export function createUser(payload) { return request("/auth/users", { method:"POST", body:JSON.stringify(payload) }); }
export function updateUser(id,payload) { return request(`/auth/users/${id}`, { method:"PUT", body:JSON.stringify(payload) }); }
export function resetBranchUserPassword(id,newPassword) { return request(`/auth/users/${id}/reset-password`, { method:"PUT", body:JSON.stringify({newPassword}) }); }
