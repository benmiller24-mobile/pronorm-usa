import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// All estimator admin-users requests go through our own Netlify function,
// which authenticates the caller via Supabase session (admin role required)
// and forwards to the estimator using the real ESTIMATOR_API_SECRET server-
// side. The old client-side literal bearer has been removed — the admin
// secret no longer ships in the bundle.
const PROXY_API = '/.netlify/functions/estimator-admin-users';

interface EstimatorUser {
  id: string;
  email: string;
  role: string;
  company_name: string;
  created_at: string;
  last_sign_in_at: string | null;
}

const FONT = "'DM Sans', -apple-system, sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export default function EstimatorUsers() {
  const [users, setUsers] = useState<EstimatorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('dealer');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(PROXY_API, { headers });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(PROXY_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole, company_name: newCompany }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showMsg(`Account created for ${newEmail}`, 'success');
      setNewEmail(''); setNewPassword(''); setNewCompany(''); setNewRole('dealer');
      setShowCreate(false);
      fetchUsers();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
    setCreating(false);
  };

  const handleDelete = async (user: EstimatorUser) => {
    if (!confirm(`Delete ${user.email}? This will remove their account and all their orders from the estimator.`)) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(PROXY_API, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ id: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showMsg(`${user.email} deleted`, 'success');
      fetchUsers();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const startEdit = (user: EstimatorUser) => {
    setEditingId(user.id);
    setEditRole(user.role);
    setEditCompany(user.company_name);
    setEditPassword('');
  };

  const handleUpdate = async (userId: string) => {
    try {
      const headers = await authHeaders();
      const body: any = { id: userId, role: editRole, company_name: editCompany };
      if (editPassword) body.password = editPassword;
      const res = await fetch(PROXY_API, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showMsg('User updated', 'success');
      setEditingId(null);
      fetchUsers();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: FONT, color: '#8a8279' }}>
        Loading estimator users...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: FONT, padding: '2rem' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem 1.5rem', color: '#991b1b' }}>
          Failed to load users: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: '1.6rem', fontWeight: 400, color: '#191919', margin: 0 }}>
            Estimator Users
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#8a8279', margin: '0.25rem 0 0' }}>
            Manage dealer accounts for the Pronorm Estimator
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: '0.6rem 1.2rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em',
            background: '#b87333', color: '#fdfcfa', border: 'none', borderRadius: 4,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {showCreate ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {/* Message banner */}
      {message && (
        <div style={{
          padding: '0.7rem 1rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.82rem', fontWeight: 500,
          background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: message.type === 'success' ? '#166534' : '#991b1b',
        }}>
          {message.text}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div style={{
          background: '#fff', border: '1px solid #e4ddd5', borderRadius: 8,
          padding: '1.5rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '1rem', color: '#191919' }}>
            Create New Estimator Account
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8279', marginBottom: '0.35rem' }}>Email</label>
                <input
                  type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="dealer@company.com"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem',
                    border: '1px solid #e4ddd5', borderRadius: 4, fontSize: '0.85rem',
                    fontFamily: 'inherit', color: '#191919', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8279', marginBottom: '0.35rem' }}>Password</label>
                <input
                  type="text" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="min 6 characters"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem',
                    border: '1px solid #e4ddd5', borderRadius: 4, fontSize: '0.85rem',
                    fontFamily: 'inherit', color: '#191919', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8279', marginBottom: '0.35rem' }}>Company Name</label>
                <input
                  type="text" required value={newCompany} onChange={e => setNewCompany(e.target.value)}
                  placeholder="Dealer Kitchen Co."
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem',
                    border: '1px solid #e4ddd5', borderRadius: 4, fontSize: '0.85rem',
                    fontFamily: 'inherit', color: '#191919', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8279', marginBottom: '0.35rem' }}>Role</label>
                <select
                  value={newRole} onChange={e => setNewRole(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem',
                    border: '1px solid #e4ddd5', borderRadius: 4, fontSize: '0.85rem',
                    fontFamily: 'inherit', color: '#191919', outline: 'none', background: '#fff',
                  }}
                >
                  <option value="dealer">Dealer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button
              type="submit" disabled={creating}
              style={{
                padding: '0.6rem 1.5rem', fontSize: '0.78rem', fontWeight: 600,
                background: '#b87333', color: '#fdfcfa', border: 'none', borderRadius: 4,
                cursor: creating ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>
      )}

      {/* Users table */}
      <div style={{
        background: '#fff', border: '1px solid #e4ddd5', borderRadius: 8,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e4ddd5' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8279' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8279' }}>Company</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8279' }}>Role</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8279' }}>Last Sign In</th>
              <th style={{ width: 140, padding: '0.75rem 1rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f0ece7' }}>
                {editingId === user.id ? (
                  <>
                    <td style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>{user.email}</td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <input
                        value={editCompany} onChange={e => setEditCompany(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', border: '1px solid #e4ddd5', borderRadius: 3, fontSize: '0.82rem', fontFamily: 'inherit' }}
                      />
                    </td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <select
                        value={editRole} onChange={e => setEditRole(e.target.value)}
                        style={{ padding: '0.35rem 0.5rem', border: '1px solid #e4ddd5', borderRadius: 3, fontSize: '0.82rem', fontFamily: 'inherit', background: '#fff' }}
                      >
                        <option value="dealer">Dealer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.6rem 1rem' }}>
                      <input
                        value={editPassword} onChange={e => setEditPassword(e.target.value)}
                        placeholder="New password (optional)"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', border: '1px solid #e4ddd5', borderRadius: 3, fontSize: '0.82rem', fontFamily: 'inherit' }}
                      />
                    </td>
                    <td style={{ padding: '0.6rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => handleUpdate(user.id)}
                        style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', background: '#166534', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', marginRight: 4 }}
                      >Save</button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', background: '#f0ece7', color: '#191919', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit' }}
                      >Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 500, color: '#191919' }}>{user.email}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#8a8279' }}>{user.company_name || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 10,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        background: user.role === 'admin' ? '#fef2f2' : '#f0fdf4',
                        color: user.role === 'admin' ? '#991b1b' : '#166534',
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#8a8279' }}>{fmtDate(user.last_sign_in_at)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => startEdit(user)}
                        style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', background: '#f0ece7', color: '#191919', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', marginRight: 4 }}
                      >Edit</button>
                      <button
                        onClick={() => handleDelete(user)}
                        style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.3rem 0.7rem', background: '#fef2f2', color: '#991b1b', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit' }}
                      >Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#8a8279', fontSize: '0.85rem' }}>
                  No estimator users yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: '0.72rem', color: '#b5aca3', marginTop: '1rem', textAlign: 'center' }}>
        {users.length} user{users.length !== 1 ? 's' : ''} in the Pronorm Estimator
      </div>
    </div>
  );
}
