const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(localStorage.getItem("authToken") ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : {}), ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const raw = data?.error || data?.message || "";
    const text = String(raw);
    const technical = /(sql|postgres|postgresql|database|relation|column|constraint|syntax|stack trace|node:|select|insert|update|delete|violates|duplicate key|foreign key|not-null|null value|internal server error|request failed|fetch failed|econnrefused|localhost|endpoint)/i;
    const friendly = technical.test(text)
      ? (response.status === 401 ? "Your session has expired. Please sign in again." : response.status === 403 ? "You are not permitted to perform this action." : response.status >= 500 ? "The operation could not be completed. Please try again." : "The operation could not be completed. Please check your information and try again.")
      : (text || "The operation could not be completed. Please try again.");
    throw new Error(friendly);
  }
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
export function createTillBalance(payload) { return request("/till-balances", { method: "POST", body: JSON.stringify(payload) }); }
export function getTillBalances(tillId, businessDate) { const p=new URLSearchParams(); if(businessDate)p.set("businessDate",businessDate); const q=p.toString(); return request(`/tills/${tillId}/balances${q?`?${q}`:""}`); }
export function getTillBalanceDetails(balanceId) { return request(`/till-balances/${balanceId}`); }
export function getTillTransactionCounts(tillId, businessDate) { const p=new URLSearchParams(); if(businessDate)p.set("businessDate",businessDate); const q=p.toString(); return request(`/tills/${tillId}/transaction-counts${q?`?${q}`:""}`); }
export function saveTillTransactionCounts(tillId, businessDate, items) { return request(`/tills/${tillId}/transaction-counts`, { method:"PUT", body:JSON.stringify({tillId:Number(tillId),businessDate,items}) }); }
export function getGeneralShopStatus(branchId, businessDate) { const p=new URLSearchParams({branchId:String(branchId),businessDate}); return request(`/general-shop-status?${p.toString()}`); }
export function saveGeneralShopStatus(branchId,businessDate,accessoriesCount,reason) { return request("/general-shop-status",{method:"PUT",body:JSON.stringify({branchId,businessDate,accessoriesCount,reason})}); }
export function saveGeneralShopTransactionCounts(branchId,businessDate,items) { return request("/general-shop-status/transaction-counts",{method:"PUT",body:JSON.stringify({branchId,businessDate,items})}); }
export function recordShortagePayment(branchId,employeeId,amount,paymentDate,note="") { return request("/branch-shortages/payments",{method:"POST",body:JSON.stringify({branchId,employeeId,amount,paymentDate,note})}); }
export function getCashBook(branchId,businessDate) { const p=new URLSearchParams({branchId:String(branchId),businessDate}); return request(`/cash-book?${p.toString()}`); }
export function saveCashBookOpeningBalance(branchId,openingBalance) { return request("/cash-book/opening-balance",{method:"PUT",body:JSON.stringify({branchId,openingBalance})}); }
export function createCashBookEntry(payload) { return request("/cash-book/entries",{method:"POST",body:JSON.stringify(payload)}); }
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
