import { useEffect, useState } from "react";
import { createUser, getBranches, getTills, getUsers, resetBranchUserPassword, updateUser } from "../services/api";

const emptyForm = { username: "", password: "", role: "BRANCH_USER", branchId: "", tillId: "", status: "ACTIVE" };

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [tills, setTills] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const [userRows, branchRows, tillRows] = await Promise.all([getUsers(), getBranches(), getTills()]);
      setUsers(userRows || []);
      setBranches(branchRows || []);
      setTills(tillRows || []);
    } catch (e) { setError(e.message || "Could not load user management data."); }
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditingId(null); setForm(emptyForm); setMessage("");
  }
  function editUser(user) {
    setEditingId(user.id);
    setResettingId(null);
    setResetPassword("");
    setForm({ username: user.username, password: "", role: user.role, branchId: user.branch_id ? String(user.branch_id) : "", tillId: user.till_id ? String(user.till_id) : "", status: user.status });
    setMessage(""); setError("");
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (editingId) {
        await updateUser(editingId, { role: form.role, branchId: form.branchId || null, tillId: form.tillId || null, status: form.status });
        setMessage("User account updated successfully.");
      } else {
        await createUser({ username: form.username, password: form.password, role: form.role, branchId: form.branchId || null, tillId: form.tillId || null });
        setMessage("User account created successfully. The user must change the initial password at first login.");
      }
      await load(); resetForm();
    } catch (e) { setError(e.message || "Could not save user account."); }
    finally { setBusy(false); }
  }
  async function submitReset(e) {
    e.preventDefault();
    if (!resettingId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await resetBranchUserPassword(resettingId, resetPassword);
      setMessage(`Password reset for ${result.username}. The user must change the temporary password at next login.`);
      setResettingId(null); setResetPassword("");
      await load();
    } catch (e) { setError(e.message || "Could not reset password."); }
    finally { setBusy(false); }
  }
  const activeBranches = branches.filter((b) => b.status !== "INACTIVE");

  return (
    <main className="user-management-page">
      <section className="user-management-header">
        <div><h1>User Management</h1><p>Manager-controlled accounts, roles and branch responsibility.</p></div>
        <div className="user-management-role">Signed in as <strong>{currentUser?.username}</strong></div>
      </section>
      {error && <div className="error-message um-message">{error}</div>}
      {message && <div className="success-message um-message">{message}</div>}
      <section className="user-management-grid">
        <form className="um-card" onSubmit={submit}>
          <div className="um-card-title">{editingId ? "Edit User Account" : "Create User Account"}</div>
          {!editingId && <>
            <label>Username<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. joan" required /></label>
            <label>Initial Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={8} required /></label>
          </>}
          <label>Role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, branchId: e.target.value === "MANAGER" ? "" : form.branchId, tillId: e.target.value === "BRANCH_USER" ? form.tillId : "" })}><option value="BRANCH_USER">Branch User</option><option value="SUPERVISOR">Supervisor</option><option value="MANAGER">Manager</option></select></label>
          {["BRANCH_USER","SUPERVISOR"].includes(form.role) && <label>Assigned Branch<select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })} required><option value="">Select branch</option>{activeBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
          {form.role === "BRANCH_USER" && <label>Assigned Till<select value={form.tillId} onChange={e => setForm({ ...form, tillId: e.target.value })} required><option value="">Select Till</option>{tills.filter(t => t.status === "ACTIVE" && String(t.branch_id) === String(form.branchId) && !users.some(u => u.role === "BRANCH_USER" && u.status === "ACTIVE" && Number(u.till_id) === Number(t.id) && Number(u.id) !== Number(editingId))).map(till => <option key={till.id} value={till.id}>{till.name}</option>)}</select></label>}
          {editingId && <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}
          <div className="um-actions"><button className="primary-button" disabled={busy}>{busy ? "Saving…" : editingId ? "Save Changes" : "Create User"}</button>{editingId && <button type="button" className="secondary-button" onClick={resetForm}>Cancel</button>}</div>
        </form>

        <section className="um-card um-list-card">
          <div className="um-card-title">System Users</div>
          <div className="um-table-wrap"><table className="um-table"><thead><tr><th>Username</th><th>Role</th><th>Branch</th><th>Till</th><th>Status</th><th></th></tr></thead>
          <tbody>{users.map(user => <tr key={user.id}>
            <td><strong>{user.username}</strong>{user.id === currentUser?.id && <span className="um-you">YOU</span>}</td>
            <td>{user.role === "MANAGER" ? "Manager" : user.role === "SUPERVISOR" ? "Supervisor" : "Branch User"}</td><td>{user.branch_name || "Company-wide"}</td><td>{user.till_name || "—"}</td>
            <td><span className={`um-status ${user.status === "ACTIVE" ? "active" : "inactive"}`}>{user.status}</span></td>
            <td><button type="button" className="table-action" onClick={() => editUser(user)}>Edit</button>{["BRANCH_USER","SUPERVISOR"].includes(user.role) && <button type="button" className="table-action um-reset-button" onClick={() => { setResettingId(user.id); setResetPassword(""); setEditingId(null); setError(""); setMessage(""); }}>Reset Password</button>}</td>
          </tr>)}{!users.length && <tr><td colSpan="6" className="um-empty">No user accounts found.</td></tr>}</tbody></table></div>

          {resettingId && <form className="um-reset-panel" onSubmit={submitReset}>
            <div className="um-card-title">Reset Branch User / Supervisor Password</div>
            <p>Set a temporary password. The user will be required to change it after signing in.</p>
            <label>Temporary Password<input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} minLength={8} required autoFocus /></label>
            <div className="um-actions"><button className="primary-button" disabled={busy}>{busy ? "Resetting…" : "Reset Password"}</button><button type="button" className="secondary-button" onClick={() => { setResettingId(null); setResetPassword(""); }}>Cancel</button></div>
          </form>}
        </section>
      </section>
    </main>
  );
}
