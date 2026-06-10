import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AWB, ROLES, ROLE_LABEL } from "../constants/Theme.jsx";
import api from "../auth/apiClient.js";

const ROLE_OPTIONS = [ROLES.ADMIN, ROLES.FRONT_OFFICE, ROLES.BACK_OFFICE];

const EMPTY_FORM = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  role: ROLES.FRONT_OFFICE,
  enabled: true,
};

function RoleBadge({ role }) {
  const color = role === ROLES.ADMIN ? AWB.danger
              : role === ROLES.BACK_OFFICE ? AWB.gold
              : AWB.info;
  const bg = role === ROLES.ADMIN ? AWB.dangerSoft
           : role === ROLES.BACK_OFFICE ? AWB.goldLight
           : AWB.infoSoft;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, color, background: bg, border: `1px solid ${color}33`,
    }}>{ROLE_LABEL[role] || role}</span>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/users");
      setUsers(res.data);
    } catch (e) {
      toast.error("Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setForm({
      username: u.username || "",
      email: u.email || "",
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      password: "",
      role: u.roles?.[0] || ROLES.FRONT_OFFICE,
      enabled: u.enabled !== false,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        username: form.username,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        enabled: form.enabled,
        roles: [form.role],
      };
      if (form.password) payload.password = form.password;

      if (editingId) {
        await api.put(`/api/admin/users/${editingId}`, payload);
        toast.success("Utilisateur mis à jour");
      } else {
        if (!form.password) {
          toast.error("Le mot de passe initial est obligatoire");
          setSubmitting(false);
          return;
        }
        await api.post("/api/admin/users", payload);
        toast.success("Utilisateur créé");
      }
      resetForm();
      load();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Erreur";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Supprimer l'utilisateur ${u.username} ?`)) return;
    try {
      await api.delete(`/api/admin/users/${u.id}`);
      toast.success("Utilisateur supprimé");
      load();
    } catch {
      toast.error("Suppression impossible");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 20 }}>
      {/* List */}
      <div style={{
        background: AWB.white, border: `1px solid ${AWB.border}`,
        borderRadius: 12, padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: AWB.navy }}>Utilisateurs</div>
            <div style={{ fontSize: 12, color: AWB.slate500 }}>Comptes synchronisés depuis Keycloak</div>
          </div>
          <button
            onClick={load}
            style={{
              fontSize: 12, padding: "6px 12px", borderRadius: 6,
              border: `1px solid ${AWB.border}`, background: AWB.white,
              color: AWB.slate700, cursor: "pointer",
            }}>
            Rafraîchir
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, color: AWB.slate500, fontSize: 13 }}>Chargement…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: AWB.slate50, color: AWB.slate600, fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>Utilisateur</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>Email</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>Rôle</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>État</th>
                <th style={{ textAlign: "right", padding: "10px 12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: `1px solid ${AWB.border}` }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600, color: AWB.navy }}>
                      {(u.firstName || "") + " " + (u.lastName || "")}
                    </div>
                    <div style={{ fontSize: 11, color: AWB.slate500 }}>@{u.username}</div>
                  </td>
                  <td style={{ padding: "10px 12px", color: AWB.slate700 }}>{u.email || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {(u.roles || []).map((r) => <RoleBadge key={r} role={r} />)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: u.enabled ? AWB.success : AWB.danger,
                    }}>{u.enabled ? "Actif" : "Désactivé"}</span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <button
                      onClick={() => startEdit(u)}
                      style={{
                        fontSize: 12, padding: "4px 10px", borderRadius: 6,
                        border: `1px solid ${AWB.border}`, background: AWB.white,
                        color: AWB.navy, cursor: "pointer", marginRight: 6,
                      }}>Éditer</button>
                    <button
                      onClick={() => remove(u)}
                      style={{
                        fontSize: 12, padding: "4px 10px", borderRadius: 6,
                        border: `1px solid ${AWB.danger}`, background: AWB.white,
                        color: AWB.danger, cursor: "pointer",
                      }}>Supprimer</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: AWB.slate500 }}>Aucun utilisateur</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Form */}
      <form onSubmit={submit} style={{
        background: AWB.white, border: `1px solid ${AWB.border}`,
        borderRadius: 12, padding: 20, alignSelf: "flex-start",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: AWB.navy, marginBottom: 4 }}>
          {editingId ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
        </div>
        <div style={{ fontSize: 12, color: AWB.slate500, marginBottom: 16 }}>
          {editingId ? "Laissez le mot de passe vide pour le conserver" : "Mot de passe initial obligatoire"}
        </div>

        <Field label="Nom d'utilisateur" required>
          <input
            type="text" required disabled={!!editingId}
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            style={inputStyle}
          />
        </Field>
        <Field label="Prénom">
          <input type="text" value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} style={inputStyle} />
        </Field>
        <Field label="Nom">
          <input type="text" value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={inputStyle} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle} />
        </Field>
        <Field label="Rôle" required>
          <select value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={inputStyle}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label={editingId ? "Nouveau mot de passe (optionnel)" : "Mot de passe initial"} required={!editingId}>
          <input type="password" value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} style={inputStyle} />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: AWB.slate700 }}>
          <input type="checkbox" checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
          Compte actif
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="submit" disabled={submitting} style={{
            flex: 1, padding: "10px 14px", borderRadius: 8,
            background: AWB.navy, color: AWB.white,
            border: "none", fontWeight: 600, fontSize: 13,
            cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1,
          }}>
            {editingId ? "Mettre à jour" : "Créer l'utilisateur"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} style={{
              padding: "10px 14px", borderRadius: 8, background: AWB.white,
              color: AWB.slate700, border: `1px solid ${AWB.border}`,
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>Annuler</button>
          )}
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", fontSize: 13,
  border: `1px solid ${AWB.border}`, borderRadius: 6,
  background: AWB.white, color: AWB.navy, outline: "none",
};

function Field({ label, required, children }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: AWB.slate600, textTransform: "uppercase", marginBottom: 4 }}>
        {label}{required && <span style={{ color: AWB.danger }}> *</span>}
      </div>
      {children}
    </label>
  );
}
