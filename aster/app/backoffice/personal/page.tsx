"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALL_PERMISSIONS,
  ROLE_DEFINITIONS,
  type Permission,
  type Role,
  type StaffUser,
  getRolePermissions,
} from "@/lib/user-roles";

type StaffForm = Omit<StaffUser, "createdAt">;
type RolePermissions = Record<Role, Permission[]>;

const emptyUser: StaffForm = {
  id: "",
  name: "",
  email: "",
  personnelNumber: "",
  phone: "",
  role: "service",
  department: "Service",
  active: true,
};

const defaultRolePermissions = Object.fromEntries(
  Object.entries(ROLE_DEFINITIONS).map(([role, definition]) => [role, definition.permissions]),
) as RolePermissions;

function fromApi(user: {
  id: string; name: string; email: string; personnelNumber: string; phone: string | null;
  role: string; department: string; active: boolean; createdAt: string;
}): StaffUser {
  return {
    ...user,
    phone: user.phone ?? "",
    role: user.role.toLowerCase() as Role,
    createdAt: user.createdAt,
  };
}

export default function PersonalPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyUser);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(defaultRolePermissions);
  const [message, setMessage] = useState("");

  async function load() {
    const [staffResponse, permissionsResponse] = await Promise.all([
      fetch("/api/admin/staff", { cache: "no-store" }),
      fetch("/api/admin/role-permissions", { cache: "no-store" }),
    ]);
    if (staffResponse.status === 401 || permissionsResponse.status === 401) {
      window.location.href = "/backoffice";
      return;
    }
    if (!staffResponse.ok || !permissionsResponse.ok) {
      setMessage("Personal- oder Berechtigungsdaten konnten nicht geladen werden.");
      return;
    }
    const staff = (await staffResponse.json()).map(fromApi) as StaffUser[];
    setUsers(staff);
    setSelectedUserId((current) => current ?? staff[0]?.id ?? null);
    const savedPermissions = await permissionsResponse.json() as RolePermissions | null;
    if (savedPermissions) setRolePermissions(savedPermissions);
  }

  useEffect(() => { void load(); }, []);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  function updateForm<K extends keyof StaffForm>(field: K, value: StaffForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function beginEdit(user: StaffUser) {
    const { createdAt: _, ...editableUser } = user;
    setEditingId(user.id);
    setForm(editableUser);
    setMessage("");
  }

  function resetForm() {
    setForm(emptyUser);
    setEditingId(null);
  }

  async function saveStaff() {
    if (!form.name.trim() || !form.email.trim() || !form.personnelNumber.trim()) {
      setMessage("Name, E-Mail-Adresse und Personalnummer sind erforderlich.");
      return;
    }
    const payload = { ...form, id: undefined, role: form.role.toUpperCase() };
    const response = await fetch(
      editingId ? `/api/admin/staff/${editingId}` : "/api/admin/staff",
      { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(result.error ?? "Mitarbeiter konnte nicht gespeichert werden.");
      return;
    }
    setMessage(editingId ? "Mitarbeiter gespeichert." : "Mitarbeiter angelegt.");
    resetForm();
    await load();
  }

  function togglePermission(role: Role, permission: Permission) {
    if (role === "admin") return;
    setRolePermissions((current) => ({
      ...current,
      [role]: current[role].includes(permission)
        ? current[role].filter((item) => item !== permission)
        : [...current[role], permission],
    }));
  }

  async function saveRolePermissions() {
    const response = await fetch("/api/admin/role-permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rolePermissions),
    });
    if (!response.ok) {
      setMessage("Menüberechtigungen konnten nicht gespeichert werden.");
      return;
    }
    setMessage("Menüberechtigungen gespeichert.");
  }

  return (
    <>
      <header className="admin-page-header">
        <div><p className="eyebrow">Personal</p><h1>Mitarbeiterverwaltung</h1></div>
      </header>

      <div className="personal-layout">
        <section className="card personal-card">
          <h2>{editingId ? "Mitarbeiter bearbeiten" : "Neuen Mitarbeiter anlegen"}</h2>
          <label>Name<input value={form.name} onChange={(event) => updateForm("name", event.target.value)} /></label>
          <label>E-Mail<input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} /></label>
          <label>Personalnummer<input value={form.personnelNumber} onChange={(event) => updateForm("personnelNumber", event.target.value)} /></label>
          <p className="muted small">Die Personalnummer ist das Passwort für den Mitarbeiter-Login.</p>
          <label>Telefon<input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} /></label>
          <label>Abteilung<input value={form.department} onChange={(event) => updateForm("department", event.target.value)} /></label>
          <label>Rolle<select value={form.role} onChange={(event) => updateForm("role", event.target.value as Role)}>
            {Object.entries(ROLE_DEFINITIONS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select></label>
          <label className="check-row"><input type="checkbox" checked={form.active} onChange={(event) => updateForm("active", event.target.checked)} />Aktiv</label>
          <div className="actions">
            <button type="button" className="btn" onClick={() => void saveStaff()}>{editingId ? "Änderungen speichern" : "Mitarbeiter anlegen"}</button>
            {editingId && <button type="button" className="btn secondary" onClick={resetForm}>Abbrechen</button>}
          </div>
        </section>

        <section className="card personal-card">
          <h2>Mitarbeiterdetails</h2>
          {selectedUser ? <>
            <div className="profile-overview"><div className="profile-avatar">{selectedUser.name.slice(0, 2).toUpperCase()}</div><div><h3>{selectedUser.name}</h3><p>{selectedUser.email}</p><span className="role-badge">{ROLE_DEFINITIONS[selectedUser.role].label}</span></div></div>
            <dl className="staff-details">
              <div><dt>Personalnummer</dt><dd>{selectedUser.personnelNumber}</dd></div>
              <div><dt>Abteilung</dt><dd>{selectedUser.department}</dd></div>
              <div><dt>Telefon</dt><dd>{selectedUser.phone || "-"}</dd></div>
              <div><dt>Status</dt><dd>{selectedUser.active ? "Aktiv" : "Inaktiv"}</dd></div>
            </dl>
            <div className="permissions-block"><strong>Zugewiesene Admin-Menüpunkte</strong><div className="permission-list">
              {(rolePermissions[selectedUser.role] ?? getRolePermissions(selectedUser.role)).map((permission) => <span key={permission} className="permission-pill">{permission}</span>)}
            </div></div>
            <button type="button" className="btn secondary" onClick={() => beginEdit(selectedUser)}>Bearbeiten</button>
          </> : <p className="muted">Wähle eine Personalnummer aus der Übersicht.</p>}
        </section>
      </div>

      <section className="card staff-table-card">
        <h2>Personalübersicht</h2>
        <div className="table-wrap"><table><thead><tr><th>Personalnummer</th><th>Name</th><th>Rolle</th><th>Abteilung</th><th>Status</th><th>Aktionen</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td><button type="button" className="personnel-number-link" onClick={() => setSelectedUserId(user.id)}>{user.personnelNumber}</button></td>
            <td><strong>{user.name}</strong><div className="muted small">{user.email}</div></td>
            <td>{ROLE_DEFINITIONS[user.role].label}</td><td>{user.department}</td>
            <td><span className={`badge ${user.active ? "" : "off"}`}>{user.active ? "Aktiv" : "Inaktiv"}</span></td>
            <td><button type="button" className="btn secondary" onClick={() => beginEdit(user)}>Bearbeiten</button></td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <section className="card staff-table-card">
        <h2>Admin-Menüpunkte je Rolle</h2>
        <p className="muted">Lege fest, welche Bereiche im Admin-Menü für jede Rolle sichtbar sind. Admin hat immer Zugriff auf alle Bereiche.</p>
        <div className="table-wrap"><table className="role-permission-table"><thead><tr><th>Menüpunkt</th>{(Object.keys(ROLE_DEFINITIONS) as Role[]).map((role) => <th key={role}>{ROLE_DEFINITIONS[role].label}</th>)}</tr></thead>
          <tbody>{ALL_PERMISSIONS.map((permission) => <tr key={permission}><td>{permission}</td>{(Object.keys(ROLE_DEFINITIONS) as Role[]).map((role) => <td key={role}><input type="checkbox" aria-label={`${permission} für ${ROLE_DEFINITIONS[role].label}`} checked={role === "admin" || rolePermissions[role].includes(permission)} disabled={role === "admin"} onChange={() => togglePermission(role, permission)} /></td>)}</tr>)}</tbody>
        </table></div>
        <div className="actions"><button type="button" className="btn" onClick={() => void saveRolePermissions()}>Menüberechtigungen speichern</button>{message && <p className="muted">{message}</p>}</div>
      </section>
    </>
  );
}
