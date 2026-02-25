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
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/dealer-portal/`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setResetError(err.message || 'Unable to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  /* ── shared styles ── */
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
    fontFamily: "'DM Sans', sans-serif",
    padding: '1rem',
  };

  const cardStyle: React.CSSProperties = {
    background: '#232323',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#fdfcfa',
    textAlign: 'center' as const,
    marginBottom: '0.3rem',
  };

  const subheadingStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    fontSize: '0.82rem',
    color: '#b5aca3',
    marginBottom: '1.8rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#b5aca3',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '0.35rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.75rem',
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fdfcfa',
    fontSize: '0.88rem',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const errorStyle: React.CSSProperties = {
    background: 'rgba(220,38,38,0.1)',
    border: '1px solid rgba(220,38,38,0.3)',
    borderRadius: '4px',
    padding: '0.6rem 0.75rem',
    fontSize: '0.8rem',
    color: '#fca5a5',
    marginBottom: '1rem',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.85rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    background: '#b87333',
    color: '#fdfcfa',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 200ms',
  };

  /* ── Reset-password view ── */
  if (showReset) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={headingStyle}>Reset Password</h1>
          <p style={subheadingStyle}>
            {resetSent
              ? 'Check your inbox for a reset link.'
              : "Enter your email and we'll send a reset link."}
          </p>

          {resetSent ? (
            <button
              onClick={() => {
                setShowReset(false);
                setResetSent(false);
                setResetEmail('');
              }}
              style={btnStyle}
            >
              Back to Sign In
            </button>
          ) : (
            <form onSubmit={handleResetPassword}>
              {resetError && <div style={errorStyle}>{resetError}</div>}

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                style={{
                  ...btnStyle,
                  background: resetLoading ? '#d4cdc5' : '#b87333',
                  cursor: resetLoading ? 'wait' : 'pointer',
                }}
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReset(false);
                  setResetError('');
                  setResetEmail('');
                }}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  background: 'none',
                  border: 'none',
                  color: '#b87333',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  /* ── Login view ── */
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Dealer Portal</h1>
        <p style={subheadingStyle}>Sign in to access your dashboard</p>

        <form onSubmit={handleSubmit}>
          {error && <div style={errorStyle}>{error}</div>}

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: '1.2rem' }}>
            <button
              type="button"
              onClick={() => setShowReset(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#b87333',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...btnStyle,
              background: loading ? '#d4cdc5' : '#b87333',
              cursor: loading ? 'wait' : 'pointer',
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
