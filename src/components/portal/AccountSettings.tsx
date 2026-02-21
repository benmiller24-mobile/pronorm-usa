import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Dealer } from '../../lib/types';

interface AccountSettingsProps {
  dealer: Dealer;
  onDealerUpdate: (dealer: Dealer) => void;
}

export default function AccountSettings({ dealer, onDealerUpdate }: AccountSettingsProps) {
  const [contactName, setContactName] = useState(dealer.contact_name);
  const [phone, setPhone] = useState(dealer.phone);
  const [address, setAddress] = useState(dealer.address);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    const { error: updErr } = await supabase.from('dealers').update({
      contact_name: contactName.trim(),
      phone: phone.trim(),
      address: address.trim(),
    }).eq('id', dealer.id);

    if (updErr) { setError(updErr.message); }
    else {
      setSaved(true);
      onDealerUpdate({ ...dealer, contact_name: contactName.trim(), phone: phone.trim(), address: address.trim() });
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setPwMessage('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setPwMessage('Passwords do not match.'); return; }
    setPwSaving(true);
    setPwMessage('');
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
    if (pwErr) { setPwMessage(pwErr.message); }
    else { setPwMessage('Password updated successfully.'); setNewPassword(''); setConfirmPassword(''); }
    setPwSaving(false);
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem',
    border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa',
    color: '#1a1a1a', fontFamily: 'inherit', outline: 'none',
  };
  const cardStyle: React.CSSProperties = {
    padding: '1.5rem', background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px',
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400, marginBottom: '0.2rem' }}>Account Settings</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#8a8279' }}>{dealer.company_name}</span>
        <span style={{
          display: 'inline-block', padding: '0.15rem 0.5rem', fontSize: '0.6rem', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '2px',
          background: dealer.role === 'admin' ? '#2d2d2d' : dealer.role === 'designer' ? '#e8ddd0' : '#f0ebe4',
          color: dealer.role === 'admin' ? '#b87333' : dealer.role === 'designer' ? '#8a6c3e' : '#4a4a4a',
        }}>{dealer.role}</span>
      </div>

      {/* Profile */}
      <form onSubmit={handleSave} style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '1rem' }}>Profile Information</h3>

        {error && <div style={{ padding: '0.5rem 0.75rem', background: '#fdf0ef', color: '#c44536', fontSize: '0.82rem', borderRadius: '3px', marginBottom: '1rem' }}>{error}</div>}
        {saved && <div style={{ padding: '0.5rem 0.75rem', background: '#e8f5e9', color: '#4a7c59', fontSize: '0.82rem', borderRadius: '3px', marginBottom: '1rem' }}>Profile updated.</div>}

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Email</label>
          <input type="email" value={dealer.email} disabled style={{ ...inputStyle, background: '#f0ebe4', color: '#8a8279' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Contact Name</label>
          <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Phone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>Address</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
        </div>

        <button type="submit" disabled={saving} style={{
          padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', background: saving ? '#d4cdc5' : '#b87333', color: '#fdfcfa',
          border: 'none', borderRadius: '3px', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Password */}
      <form onSubmit={handlePasswordChange} style={cardStyle}>
        <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '1rem' }}>Change Password</h3>

        {pwMessage && (
          <div style={{
            padding: '0.5rem 0.75rem', fontSize: '0.82rem', borderRadius: '3px', marginBottom: '1rem',
            background: pwMessage.includes('success') ? '#e8f5e9' : '#fdf0ef',
            color: pwMessage.includes('success') ? '#4a7c59' : '#c44536',
          }}>{pwMessage}</div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>New Password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" style={inputStyle} />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
        </div>

        <button type="submit" disabled={pwSaving} style={{
          padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', background: 'transparent', color: '#4a4a4a',
          border: '1.5px solid #d4cdc5', borderRadius: '3px', cursor: pwSaving ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}>
          {pwSaving ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
