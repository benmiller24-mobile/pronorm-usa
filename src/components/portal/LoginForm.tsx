import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface LoginFormProps {
  onLogin: () => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f4f0',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem',
        background: '#fdfcfa',
        border: '1px solid rgba(26,26,26,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '1.8rem',
            fontWeight: 400,
            color: '#1a1a1a',
            marginBottom: '0.35rem',
          }}>
            Dealer Portal
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>
            Sign in with your dealer credentials
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: '#fdf0ef',
              border: '1px solid #f5c6cb',
              color: '#c44536',
              fontSize: '0.82rem',
              borderRadius: '3px',
              marginBottom: '1.25rem',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '0.9rem',
                border: '1.5px solid #d4cdc5',
                borderRadius: '3px',
                background: '#fdfcfa',
                color: '#1a1a1a',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '0.9rem',
                border: '1.5px solid #d4cdc5',
                borderRadius: '3px',
                background: '#fdfcfa',
                color: '#1a1a1a',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: loading ? '#d4cdc5' : '#b87333',
              color: '#fdfcfa',
              border: 'none',
              borderRadius: '3px',
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 200ms',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#b5aca3', marginTop: '1.5rem' }}>
          Contact your Pronorm USA representative to request dealer access.
        </p>
      </div>
    </div>
  );
}
