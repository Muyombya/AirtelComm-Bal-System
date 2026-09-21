import { useEffect, useMemo, useState } from "react";
import {
  createTerminal,
  updateTerminal,
  getBranches,
  getServiceProviders,
  getTerminals,
  getMasterTills,
  getTillTerminals,
  assignTerminalToTill,
  unassignTerminalFromTill,
  transferTerminal,
  removeTerminalFromBranch,
  getTerminalBranchHistory,
} from "../services/api";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function StatusBadge({ status }) {
  const active = status === "ACTIVE";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function TerminalManagement() {
  const [providers, setProviders] = useState([]);
  const [branches, setBranches] = useState([]);
  const [tills, setTills] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [providerFilter, setProviderFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [selectedTill, setSelectedTill] = useState("");
  const [assignTerminalId, setAssignTerminalId] = useState("");
  const [form, setForm] = useState({ branchId: "", serviceProviderId: "", name: "", outletId: "", accountNumber: "" });
  const [transferTerminalId, setTransferTerminalId] = useState("");
  const [transferBranchId, setTransferBranchId] = useState("");
  const [editingTerminal, setEditingTerminal] = useState(null);
  const [editForm, setEditForm] = useState({ serviceProviderId: "", name: "", outletId: "", accountNumber: "" });
  const [historyTerminal, setHistoryTerminal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeTerminals = useMemo(() => terminals.filter((item) => item.status === "ACTIVE" && item.branch_id), [terminals]);
  const assignedActiveIds = useMemo(
    () => new Set(assigned.filter((item) => !item.active_to).map((item) => String(item.terminal_id))),
    [assigned]
  );
  const selectedTillData = tills.find((till) => String(till.id) === String(selectedTill));
  const availableForAssignment = activeTerminals.filter(
    (item) => String(item.branch_id) === String(selectedTillData?.branch_id) && !assignedActiveIds.has(String(item.id))
  );

  async function loadBaseData() {
    setError("");
    const [providerData, branchData, tillData, terminalData] = await Promise.all([
      getServiceProviders(),
      getBranches(),
      getMasterTills(),
      getTerminals(providerFilter || undefined, branchFilter || undefined),
    ]);
    setProviders(providerData);
    setBranches(branchData);
    setTills(tillData);
    setTerminals(terminalData);
    if (!form.branchId && branchData.length) setForm((current) => ({ ...current, branchId: String(branchData[0].id) }));
    if (!form.serviceProviderId && providerData.length) setForm((current) => ({ ...current, serviceProviderId: String(providerData[0].id) }));
    if (!selectedTill && tillData.length) setSelectedTill(String(tillData[0].id));
  }

  async function loadTerminals() {
    setTerminals(await getTerminals(providerFilter || undefined, branchFilter || undefined));
  }

  async function loadAssigned(tillId = selectedTill) {
    if (!tillId) { setAssigned([]); return; }
    setAssigned(await getTillTerminals(tillId));
  }

  useEffect(() => {
    setLoading(true);
    loadBaseData().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [providerFilter, branchFilter]);

  useEffect(() => {
    loadAssigned().catch((err) => setError(err.message));
  }, [selectedTill]);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      await createTerminal(form);
      setForm((current) => ({ ...current, name: "", outletId: "", accountNumber: "" }));
      await loadTerminals();
      setNotice("Terminal registered and assigned to the selected branch successfully.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleAssign() {
    if (!selectedTill || !assignTerminalId) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await assignTerminalToTill(selectedTill, assignTerminalId);
      setAssignTerminalId(""); await loadAssigned();
      setNotice("Terminal assigned to the selected Till.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleUnassign(terminalId) {
    if (!selectedTill) return;
    if (!window.confirm("Unassign this terminal from the selected Till? The assignment history will be retained.")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await unassignTerminalFromTill(selectedTill, terminalId);
      await loadAssigned();
      setNotice("Terminal unassigned. Till assignment history was retained.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  function beginEdit(terminal) {
    setEditingTerminal(terminal);
    setEditForm({
      serviceProviderId: String(terminal.service_provider_id || ""),
      name: terminal.name || "",
      outletId: terminal.outlet_id || "",
      accountNumber: terminal.account_number || "",
    });
    setError("");
    setNotice("");
  }

  function cancelEdit() {
    if (saving) return;
    setEditingTerminal(null);
    setEditForm({ serviceProviderId: "", name: "", outletId: "", accountNumber: "" });
  }

  async function handleEdit(event) {
    event.preventDefault();
    if (!editingTerminal) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateTerminal(editingTerminal.id, {
        serviceProviderId: Number(editForm.serviceProviderId),
        name: editForm.name,
        outletId: editForm.outletId,
        accountNumber: editForm.accountNumber,
        status: editingTerminal.status,
      });

      setEditingTerminal(null);
      setEditForm({ serviceProviderId: "", name: "", outletId: "", accountNumber: "" });
      await loadTerminals();
      setNotice("Terminal information updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function beginTransfer(terminal) {
    setTransferTerminalId(String(terminal.id));
    setTransferBranchId("");
    setError(""); setNotice("");
  }

  async function handleTransfer() {
    if (!transferTerminalId || !transferBranchId) return;
    const terminal = terminals.find((item) => String(item.id) === String(transferTerminalId));
    const target = branches.find((branch) => String(branch.id) === String(transferBranchId));
    if (!window.confirm(`Transfer ${terminal?.name || "this terminal"} to ${target?.name || "the selected branch"}? Any active Till assignment will be closed and retained in history.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await transferTerminal(transferTerminalId, transferBranchId);
      setTransferTerminalId(""); setTransferBranchId("");
      await Promise.all([loadTerminals(), loadAssigned()]);
      setNotice("Terminal transferred successfully. Its previous branch and Till history was retained.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleRemove(terminal) {
    if (!window.confirm(`Remove ${terminal.name} from ${terminal.branch_name || "its branch"}? The terminal will be deactivated and all assignment history will be retained.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await removeTerminalFromBranch(terminal.id);
      if (String(terminal.id) === String(transferTerminalId)) { setTransferTerminalId(""); setTransferBranchId(""); }
      await Promise.all([loadTerminals(), loadAssigned()]);
      setNotice("Terminal removed from the branch and deactivated. History was retained.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function showHistory(terminal) {
    setError(""); setNotice("");
    try {
      const rows = await getTerminalBranchHistory(terminal.id);
      setHistoryTerminal(terminal); setHistory(rows);
    } catch (err) { setError(err.message); }
  }

  const selectedTillName = selectedTillData?.name || "Selected Till";

  return (
    <div className="terminal-management-page min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">TERMINAL MANAGEMENT</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Terminal Management</h1>
            <p className="mt-1 text-sm text-slate-500">Register terminals to branches, manage Till assignments and control transfers.</p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Backend connected</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold">Register terminal</h2>
              <p className="mt-1 text-sm text-slate-500">A terminal must be assigned to a branch when it is registered.</p>
            </div>
            <form className="space-y-4" onSubmit={handleCreate}>
              <label className="block"><span className="mb-1.5 block text-sm font-medium">Branch</span>
                <select className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} required>
                  <option value="">Select branch</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-1.5 block text-sm font-medium">Service Provider</span>
                <select className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={form.serviceProviderId} onChange={(e) => setForm({ ...form, serviceProviderId: e.target.value })} required>
                  <option value="">Select provider</option>
                  {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-1.5 block text-sm font-medium">Terminal Name</span>
                <input className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MTN Till 01" required />
              </label>
              <label className="block"><span className="mb-1.5 block text-sm font-medium">Outlet / Agent ID <span className="font-normal text-slate-400">(optional)</span></span>
                <input className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={form.outletId} onChange={(e) => setForm({ ...form, outletId: e.target.value })} />
              </label>
              <label className="block"><span className="mb-1.5 block text-sm font-medium">Account Number <span className="font-normal text-slate-400">(optional)</span></span>
                <input className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              </label>
              <button disabled={saving || loading || !branches.length} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Register Terminal"}</button>
            </form>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5">
              <div><h2 className="text-lg font-bold">Terminal register</h2><p className="mt-1 text-sm text-slate-500">Current branch ownership is shown for every terminal.</p></div>
              <div className="flex flex-wrap gap-2">
                <select className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
                <select className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}><option value="">All providers</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Branch</th><th className="px-6 py-3">Provider</th><th className="px-6 py-3">Terminal</th><th className="px-6 py-3">Outlet / Agent ID</th><th className="px-6 py-3">Account</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Actions</th></tr></thead>
                <tbody className="divide-y">
                  {terminals.map((terminal) => <tr key={terminal.id}>
                    <td className="px-6 py-4 font-medium">{terminal.branch_name || "—"}</td><td className="px-6 py-4">{terminal.service_provider_name}</td><td className="px-6 py-4">{terminal.name}</td><td className="px-6 py-4 text-slate-500">{terminal.outlet_id || "—"}</td><td className="px-6 py-4 text-slate-500">{terminal.account_number || "—"}</td><td className="px-6 py-4"><StatusBadge status={terminal.status} /></td>
                    <td className="px-6 py-4"><div className="flex flex-wrap gap-2"><button disabled={saving || terminal.status !== "ACTIVE"} onClick={() => beginEdit(terminal)} className="text-sm font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-40">Edit</button><button disabled={saving || terminal.status !== "ACTIVE"} onClick={() => beginTransfer(terminal)} className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40">Transfer</button><button disabled={saving || terminal.status !== "ACTIVE"} onClick={() => handleRemove(terminal)} className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-40">Remove</button><button disabled={saving} onClick={() => showHistory(terminal)} className="text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-40">History</button></div></td>
                  </tr>)}
                  {!terminals.length && <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">No terminals registered yet.</td></tr>}
                </tbody>
              </table>
            </div>

            {editingTerminal && (
              <div className="border-t bg-slate-50 px-6 py-5">
                <form onSubmit={handleEdit} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">Edit terminal</div>
                      <div className="mt-1 text-lg font-bold text-slate-900">{editingTerminal.name}</div>
                      <div className="mt-1 text-sm text-slate-500">Branch ownership is not changed here. Use Transfer for a branch change.</div>
                    </div>
                    <button type="button" disabled={saving} onClick={cancelEdit} className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">Cancel</button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Service Provider</span>
                      <select className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={editForm.serviceProviderId} onChange={(e) => setEditForm({ ...editForm, serviceProviderId: e.target.value })} required>
                        <option value="">Select provider</option>
                        {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Terminal Name</span>
                      <input className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Outlet / Agent ID <span className="font-normal text-slate-400">(optional)</span></span>
                      <input className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={editForm.outletId} onChange={(e) => setEditForm({ ...editForm, outletId: e.target.value })} />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Account Number <span className="font-normal text-slate-400">(optional)</span></span>
                      <input className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={editForm.accountNumber} onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })} />
                    </label>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" disabled={saving} onClick={cancelEdit} className="rounded-xl border bg-white px-4 py-2.5 font-semibold disabled:opacity-40">Cancel</button>
                    <button type="submit" disabled={saving || !editForm.serviceProviderId || !editForm.name.trim()} className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Saving..." : "Save Changes"}</button>
                  </div>
                </form>
              </div>
            )}

            {transferTerminalId && <div className="border-t bg-blue-50 px-6 py-5"><div className="flex flex-wrap items-end gap-3"><div className="mr-auto"><div className="text-sm font-semibold text-blue-900">Transfer terminal</div><div className="text-sm text-blue-700">Choose the new branch. Any active Till assignment will be closed and preserved in history.</div></div><select className="min-w-56 rounded-xl border bg-white px-3 py-2.5" value={transferBranchId} onChange={(e) => setTransferBranchId(e.target.value)}><option value="">Select new branch</option>{branches.filter((branch) => String(branch.id) !== String(terminals.find((t) => String(t.id) === String(transferTerminalId))?.branch_id)).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><button disabled={!transferBranchId || saving} onClick={handleTransfer} className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40">Confirm Transfer</button><button disabled={saving} onClick={() => { setTransferTerminalId(""); setTransferBranchId(""); }} className="rounded-xl border bg-white px-4 py-2.5 font-semibold">Cancel</button></div></div>}
          </div>
        </section>

        {historyTerminal && <section className="rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-6 py-5"><div><h2 className="text-lg font-bold">Branch history — {historyTerminal.name}</h2><p className="mt-1 text-sm text-slate-500">Historical branch assignments are preserved.</p></div><button onClick={() => { setHistoryTerminal(null); setHistory([]); }} className="rounded-xl border px-4 py-2 text-sm font-semibold">Close</button></div><div className="overflow-x-auto px-6 py-4"><table className="min-w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-6">Branch</th><th className="py-3 pr-6">Assigned From</th><th className="py-3">Assigned Until</th></tr></thead><tbody className="divide-y">{history.map((item) => <tr key={item.id}><td className="py-4 pr-6 font-medium">{item.branch_name}</td><td className="py-4 pr-6 text-slate-500">{formatDate(item.active_from)}</td><td className="py-4 text-slate-500">{formatDate(item.active_to)}</td></tr>)}{!history.length && <tr><td colSpan="3" className="py-8 text-center text-slate-400">No branch history recorded.</td></tr>}</tbody></table></div></section>}

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b px-6 py-5"><div><h2 className="text-lg font-bold">Till terminal assignments</h2><p className="mt-1 text-sm text-slate-500">A terminal can only be assigned to a Till within its current branch.</p></div><div className="flex flex-wrap items-end gap-3"><label className="block min-w-56"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Till</span><select className="w-full rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={selectedTill} onChange={(e) => setSelectedTill(e.target.value)}>{tills.map((till) => <option key={till.id} value={till.id}>{till.name}</option>)}</select></label><div className="flex gap-2"><select className="min-w-56 rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500" value={assignTerminalId} onChange={(e) => setAssignTerminalId(e.target.value)}><option value="">Select terminal</option>{availableForAssignment.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.service_provider_name} — {terminal.name}</option>)}</select><button disabled={!assignTerminalId || saving} onClick={handleAssign} className="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-40">Assign</button></div></div></div>
          <div className="px-6 py-5"><div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-semibold">{selectedTillName}</span><span className="mx-2 text-slate-300">•</span>{assigned.filter((item) => !item.active_to).length} active terminal assignment(s)</div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-3 pr-6">Provider</th><th className="py-3 pr-6">Terminal</th><th className="py-3 pr-6">Status</th><th className="py-3 pr-6">Assigned From</th><th className="py-3 pr-6">Assigned Until</th><th className="py-3">Action</th></tr></thead><tbody className="divide-y">{assigned.map((item) => <tr key={item.id}><td className="py-4 pr-6 font-medium">{item.service_provider_name}</td><td className="py-4 pr-6">{item.terminal_name}</td><td className="py-4 pr-6"><StatusBadge status={item.active_to ? "INACTIVE" : "ACTIVE"} /></td><td className="py-4 pr-6 text-slate-500">{formatDate(item.active_from)}</td><td className="py-4 pr-6 text-slate-500">{formatDate(item.active_to)}</td><td className="py-4">{!item.active_to ? <button disabled={saving} onClick={() => handleUnassign(item.terminal_id)} className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-40">Unassign</button> : <span className="text-slate-400">History</span>}</td></tr>)}{!assigned.length && <tr><td colSpan="6" className="py-12 text-center text-slate-400">No terminal assignments for this Till yet.</td></tr>}</tbody></table></div></div>
        </section>
      </main>
    </div>
  );
}
