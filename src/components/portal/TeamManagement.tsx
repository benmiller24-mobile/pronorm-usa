import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Dealer } from '../../lib/types';

interface TeamManagementProps {
  dealer: Dealer;
  isAdmin?: boolean;
  isDesigner?: boolean;
}

interface InviteForm {
  email: string;
  password: string;
  contact_name: string;
  phone: string;
  company_name: string;
  address: string;
}

const emptyForm: InviteForm = { email: '', password: '', contact_name: '', phone: '', company_name: '', address: '' };

export default function TeamManagement({ dealer, isAdmin, isDesigner }: TeamManagementProps) {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [designers, setDesigners] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState<'dealer' | 'designer'>('designer');
  const [inviteParentId, setInviteParentId] = useState<string | null>(null);
  const [form, setForm] = useState<InviteForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [expandedDealer, setExpandedDealer] = useState<string | null>(null);

  useEffect(() => {
    loadTeam();
  }, [dealer.id, isAdmin]);

  async function loadTeam() {
    setLoading(true);
    if (isAdmin) {
      // Admin: fetch all dealers and designers
      const { data: allDealers } = await supabase
        .from('dealers')
        .select('*')
        .in('role', ['dealer', 'admin'])
        .order('company_name');
      const { data: allDesigners } = await supabase
        .from('dealers')
        .select('*')
        .eq('role', 'designer')
        .order('contact_name');
      setDealers(allDealers || []);
      setDesigners(allDesigners || []);
    } else {
      // Dealer: fetch only their designers
      const { data: myDesigners } = await supabase
        .from('dealers')
        .select('*')
        .eq('parent_dealer_id', dealer.id)
        .eq('role', 'designer')
        .order('contact_name');
      setDesigners(myDesigners || []);
    }
    setLoading(false);
  }

  function openInviteForm(role: 'dealer' | 'designer', parentId?: string) {
    setInviteRole(role);
    setInviteParentId(parentId || (role === 'designer' && !isAdmin ? dealer.id : null));
    setForm(emptyForm);
    setMessage('');
    setShowInviteForm(true);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    if (!form.email || !form.password || !form.contact_name) {
      setMessage('Email, password, and contact name are required.');
      setMessageType('error');
      setSubmitting(false);
      return;
    }
    if (form.password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      setMessageType('error');
      setSubmitting(false);
      return;
    }
    if (inviteRole === 'dealer' && !form.company_name) {
      setMessage('Company name is required for dealers.');
      setMessageType('error');
      setSubmitting(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Session expired. Please log in again.');
        setMessageType('error');
        setSubmitting(false);
        return;
      }

      const payload: any = {
        email: form.email,
        password: form.password,
        contact_name: form.contact_name,
        phone: form.phone,
        role: inviteRole,
      };

      if (inviteRole === 'dealer') {
        payload.company_name = form.company_name;
        payload.address = form.address;
      } else {
        payload.parent_dealer_id = inviteParentId;
        if (form.company_name) payload.company_name = form.company_name;
        if (form.address) payload.address = form.address;
      }

      const res = await fetch('/.netlify/functions/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Something went wrong.');
        setMessageType('error');
      } else {
        setMessage(`${inviteRole === 'dealer' ? 'Dealer' : 'Designer'} "${form.contact_name}" created successfully!`);
        setMessageType('success');
        setForm(emptyForm);
        loadTeam();
        // Auto-close form after a moment
        setTimeout(() => setShowInviteForm(false), 2000);
      }
    } catch (err: any) {
      setMessage(err.message || 'Network error.');
      setMessageType('error');
    }

    setSubmitting(false);
  }

  function getDesignersForDealer(dealerId: string) {
    return designers.filter(d => d.parent_dealer_id === dealerId);
  }

  // Styles
  const cardStyle: React.CSSProperties = {
    padding: '1.5rem', background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem',
    border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa',
    color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const primaryBtnStyle: React.CSSProperties = {
    padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa',
    border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
  };
  const secondaryBtnStyle: React.CSSProperties = {
    padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', background: 'transparent', color: '#4a4a4a',
    border: '1.5px solid #d4cdc5', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
  };
  const badgeStyle = (role: string): React.CSSProperties => ({
    display: 'inline-block', padding: '0.15rem 0.5rem', fontSize: '0.6rem', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '2px',
    background: role === 'admin' ? '#2d2d2d' : role === 'designer' ? '#e8ddd0' : '#f0ebe4',
    color: role === 'admin' ? '#b87333' : role === 'designer' ? '#8a6c3e' : '#4a4a4a',
  });
  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '0.5rem 0', fontWeight: 600, color: '#4a4a4a',
    fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase',
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#8a8279' }}>Loading team...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2rem', fontWeight: 400, color: '#1a1a1a' }}>
          {isAdmin ? 'Team Management' : 'My Designers'}
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#8a8279', marginTop: '0.25rem' }}>
          {isAdmin ? 'Manage dealers, designers, and team hierarchy' : 'Manage designers linked to your account'}
        </p>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {isAdmin && (
          <button onClick={() => openInviteForm('dealer')} style={primaryBtnStyle}>
            + Invite Dealer
          </button>
        )}
        <button
          onClick={() => openInviteForm('designer')}
          style={isAdmin ? secondaryBtnStyle : primaryBtnStyle}
        >
          + Invite Designer
        </button>
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div style={{ ...cardStyle, marginBottom: '2rem', borderLeft: '4px solid #b87333', background: '#fef9f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500 }}>
              Invite {inviteRole === 'dealer' ? 'Dealer' : 'Designer'}
            </h3>
            <button onClick={() => setShowInviteForm(false)} style={{ background: 'none', border: 'none', color: '#8a8279', cursor: 'pointer', fontSize: '1.2rem' }}>
              â
            </button>
          </div>

          {message && (
            <div style={{
              padding: '0.5rem 0.75rem', fontSize: '0.82rem', borderRadius: '3px', marginBottom: '1rem',
              background: messageType === 'success' ? '#e8f5e9' : '#fdf0ef',
              color: messageType === 'success' ? '#4a7c59' : '#c44536',
            }}>{message}</div>
          )}

          <form onSubmit={handleInvite}>
            {/* Admin inviting designer â pick which dealer */}
            {isAdmin && inviteRole === 'designer' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Parent Dealer</label>
                <select
                  value={inviteParentId || ''}
                  onChange={e => setInviteParentId(e.target.value || null)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  required
                >
                  <option value="">Select a dealer...</option>
                  {dealers.filter(d => d.role === 'dealer').map(d => (
                    <option key={d.id} value={d.id}>{d.company_name} â {d.contact_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Password *</label>
                <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" style={inputStyle} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Contact Name *</label>
                <input type="text" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
              </div>
            </div>

            {inviteRole === 'dealer' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Company Name *</label>
                  <input type="text" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Address</label>
                  <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={inputStyle} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="submit" disabled={submitting} style={{ ...primaryBtnStyle, background: submitting ? '#d4cdc5' : '#b87333', cursor: submitting ? 'wait' : 'pointer' }}>
                {submitting ? 'Creating...' : `Create ${inviteRole === 'dealer' ? 'Dealer' : 'Designer'}`}
              </button>
              <button type="button" onClick={() => setShowInviteForm(false)} style={secondaryBtnStyle}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin View: Dealer list with nested designers */}
      {isAdmin && (
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '1rem' }}>
            All Dealers & Designers
          </h3>

          {dealers.filter(d => d.role === 'dealer').length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>No dealers yet. Invite one to get started.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e4df' }}>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Contact</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Designers</th>
                </tr>
              </thead>
              <tbody>
                {dealers.filter(d => d.role === 'dealer').map(d => {
                  const dDesigners = getDesignersForDealer(d.id);
                  const isExpanded = expandedDealer === d.id;
                  return (
                    <React.Fragment key={d.id}>
                      <tr
                        onClick={() => setExpandedDealer(isExpanded ? null : d.id)}
                        style={{ borderBottom: '1px solid #f0ebe4', cursor: 'pointer', background: isExpanded ? '#fef9f0' : 'transparent' }}
                      >
                        <td style={{ padding: '0.65rem 0', color: '#1a1a1a', fontWeight: 500 }}>
                          <span style={{ marginRight: '0.5rem', fontSize: '0.7rem', color: '#8a8279' }}>{isExpanded ? 'â¼' : 'â¶'}</span>
                          {d.company_name}
                        </td>
                        <td style={{ padding: '0.65rem 0', color: '#4a4a4a' }}>{d.contact_name}</td>
                        <td style={{ padding: '0.65rem 0', color: '#8a8279' }}>{d.email}</td>
                        <td style={{ padding: '0.65rem 0' }}><span style={badgeStyle(d.role)}>{d.role}</span></td>
                        <td style={{ padding: '0.65rem 0', textAlign: 'right', color: '#4a4a4a' }}>
                          {dDesigners.length}
                        </td>
                      </tr>
                      {isExpanded && (
                        <>
                          {dDesigners.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ padding: '0.5rem 0 0.5rem 2rem', color: '#8a8279', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                No designers linked â{' '}
                                <button
                                  onClick={(e) => { e.stopPropagation(); openInviteForm('designer', d.id); }}
                                  style={{ background: 'none', border: 'none', color: '#b87333', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit', textDecoration: 'underline' }}
                                >
                                  invite one
                                </button>
                              </td>
                            </tr>
                          ) : (
                            dDesigners.map(des => (
                              <tr key={des.id} style={{ borderBottom: '1px solid #f0ebe4', background: '#fef9f0' }}>
                                <td style={{ padding: '0.5rem 0 0.5rem 2rem', color: '#4a4a4a', fontSize: '0.82rem' }}>
                                  â³ {des.contact_name}
                                </td>
                                <td style={{ padding: '0.5rem 0', color: '#4a4a4a', fontSize: '0.82rem' }}></td>
                                <td style={{ padding: '0.5rem 0', color: '#8a8279', fontSize: '0.82rem' }}>{des.email}</td>
                                <td style={{ padding: '0.5rem 0' }}><span style={badgeStyle('designer')}>Designer</span></td>
                                <td></td>
                              </tr>
                            ))
                          )}
                          <tr>
                            <td colSpan={5} style={{ padding: '0.3rem 0 0.8rem 2rem' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); openInviteForm('designer', d.id); }}
                                style={{ background: 'none', border: 'none', color: '#b87333', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                              >
                                + Add Designer
                              </button>
                            </td>
                          </tr>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Dealer View: Just their designers */}
      {!isAdmin && (
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '1rem' }}>
            Designers at {dealer.company_name}
          </h3>

          {designers.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>
              No designers yet. Invite a designer to give them access to your projects and orders.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e4df' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Phone</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {designers.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f0ebe4' }}>
                    <td style={{ padding: '0.65rem 0', color: '#1a1a1a', fontWeight: 500 }}>
                      {d.contact_name}
                      <span style={{ ...badgeStyle('designer'), marginLeft: '0.5rem' }}>Designer</span>
                    </td>
                    <td style={{ padding: '0.65rem 0', color: '#8a8279' }}>{d.email}</td>
                    <td style={{ padding: '0.65rem 0', color: '#4a4a4a' }}>{d.phone || 'â'}</td>
                    <td style={{ padding: '0.65rem 0', color: '#8a8279', textAlign: 'right' }}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
