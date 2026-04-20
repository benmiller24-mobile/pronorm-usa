import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Dealer } from '../../lib/types';
import LoginForm from './LoginForm';
import PortalLayout from './PortalLayout';
import DealerDashboard from './DealerDashboard';
import ProjectList from './ProjectList';
import DesignPacketWizard from './DesignPacketWizard';
import ProjectDetail from './ProjectDetail';
import OrderList from './OrderList';
import OrderDetail from './OrderDetail';
import WarrantyList from './WarrantyList';
import WarrantyForm from './WarrantyForm';
import AccountSettings from './AccountSettings';
import TeamManagement from './TeamManagement';
import PricingTool from './PricingTool';
import DesignEngine from './design-engine/DesignEngine';
import EstimatorUsers from './EstimatorUsers';
import Messages from './Messages';
import ResourceLibrary from './ResourceLibrary';

export default function PortalApp() {
  const [session, setSession] = useState<any>(null);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState('/dealer-portal/dashboard');
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [dealers, setDealers] = useState([]);
  const [adminSelectedDealer, setAdminSelectedDealer] = useState(null);

  // Read initial path from URL. Include the query string so things like
  // ?draft=<id> survive a refresh/bookmark — the wizard reads that param to
  // resume an in-progress draft rather than starting fresh.
  useEffect(() => {
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath.startsWith('/dealer-portal/') && window.location.pathname !== '/dealer-portal/') {
      setPath(currentPath);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) fetchDealer(s.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setLoading(false);
      } else if (s) {
        fetchDealer(s.user.id);
      } else {
        setDealer(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchDealer(userId: string) {
    const { data } = await supabase.from('dealers').select('*').eq('user_id', userId).single();
    setDealer(data);
    setLoading(false);
  }

  const fetchAllDealers = async () => {
    const { data } = await supabase.from('dealers').select('*');
    if (data) setDealers(data);
  };

  useEffect(() => {
    if (dealer && dealer.role === 'admin') {
      fetchAllDealers();
    }
  }, [dealer]);

  const navigate = (newPath: string) => {
    setPath(newPath);
    window.history.pushState({}, '', newPath);
    window.scrollTo(0, 0);
  };

  // Handle browser back/forward — keep the query string so draft-resume links stay resumable.
  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname + window.location.search;
      if (window.location.pathname.startsWith('/dealer-portal')) {
        setPath(currentPath);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setDealer(null);
    navigate('/dealer-portal');
  };

  const handleLogin = () => {
    navigate('/dealer-portal/dashboard');
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    if (newPassword.length < 8) {
      setRecoveryError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError('Passwords do not match.');
      return;
    }
    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setRecoverySuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsRecovery(false);
        setRecoverySuccess(false);
        navigate('/dealer-portal/dashboard');
      }, 2000);
    } catch (err: any) {
      setRecoveryError(err.message || 'Failed to update password.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f4f0', fontFamily: "'DM Sans', sans-serif", color: '#8a8279' }}>
        Loading...
      </div>
    );
  }

  if (isRecovery && session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', fontFamily: "'DM Sans', sans-serif", padding: '1rem' }}>
        <div style={{ background: '#232323', border: '1px solid #333', borderRadius: '8px', padding: '2.5rem 2rem', width: '100%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 600, color: '#fdfcfa', textAlign: 'center', marginBottom: '0.3rem' }}>Set New Password</h1>
          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#b5aca3', marginBottom: '1.8rem' }}>
            {recoverySuccess ? 'Password updated! Redirecting...' : 'Enter your new password below.'}
          </p>
          {!recoverySuccess && (
            <form onSubmit={handlePasswordUpdate}>
              {recoveryError && (
                <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '4px', padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#fca5a5', marginBottom: '1rem' }}>{recoveryError}</div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#b5aca3', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>New Password</label>
                <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.75rem', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fdfcfa', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit' }} placeholder="Minimum 8 characters" />
              </div>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#b5aca3', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Confirm Password</label>
                <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '0.65rem 0.75rem', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fdfcfa', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit' }} placeholder="Re-enter password" />
              </div>
              <button type="submit" disabled={recoveryLoading} style={{ width: '100%', padding: '0.85rem', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', background: recoveryLoading ? '#d4cdc5' : '#b87333', color: '#fdfcfa', border: 'none', borderRadius: '3px', cursor: recoveryLoading ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'background 200ms' }}>
                {recoveryLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
          {recoverySuccess && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '4px', padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#86efac', textAlign: 'center' }}>Password updated successfully!</div>
          )}
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (!dealer) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f4f0', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', padding: '2rem' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.5rem' }}>Account Setup Pending</h2>
          <p style={{ color: '#8a8279', marginBottom: '1.5rem' }}>Your dealer profile hasn't been set up yet. Please contact your Pronorm USA representative.</p>
          <button onClick={handleLogout} style={{ padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa', border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign Out</button>
        </div>
      </div>
    );
  }

  const isAdmin = dealer.role === 'admin';
  const isDesigner = dealer.role === 'designer';
  const scopedDealer: Dealer = isDesigner && dealer.parent_dealer_id ? { ...dealer, id: dealer.parent_dealer_id } : dealer;

  // Split path + query for matching. `path` is the state value we route on and includes the
  // query string (so refresh/back preserves ?draft=<id>) but routing comparisons ignore it.
  const [pathOnly, queryString] = (() => {
    const idx = path.indexOf('?');
    return idx === -1 ? [path, ''] : [path.slice(0, idx), path.slice(idx + 1)];
  })();
  const searchParams = new URLSearchParams(queryString);
  const draftIdParam = searchParams.get('draft');

  const renderPage = () => {
    if (pathOnly === '/dealer-portal/dashboard' || pathOnly === '/dealer-portal' || pathOnly === '/dealer-portal/') {
      return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
    }
    if (pathOnly === '/dealer-portal/pricing') {
      const userEmail = dealer.email || session?.user?.email;
      if (userEmail === 'ben.miller24@gmail.com' || isAdmin) {
        window.open('https://estimator.pronormusa.com', '_blank');
        navigate('/dealer-portal/dashboard');
      }
      return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
    }
    if (pathOnly === '/dealer-portal/estimator-users') {
      if (isAdmin) return <EstimatorUsers />;
      return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
    }
    if (pathOnly === '/dealer-portal/design-engine') {
      const userEmail = dealer.email || session?.user?.email;
      if (userEmail === 'ben.miller24@gmail.com') return <DesignEngine dealer={scopedDealer} onNavigate={navigate} />;
      return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
    }
    if (pathOnly === '/dealer-portal/projects/new') {
      if (isAdmin && !adminSelectedDealer) {
        return (
          <div style={{ padding: '2rem', maxWidth: 600 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', marginBottom: '1rem' }}>Create Project on Behalf of Dealer/Designer</h2>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Select Dealer or Designer:</label>
            <select
              onChange={(e) => {
                const selected = dealers.find(d => d.id === e.target.value);
                if (selected) setAdminSelectedDealer(selected);
              }}
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
              defaultValue=""
            >
              <option value="" disabled>-- Choose a dealer or designer --</option>
              {dealers.filter(d => d.role !== 'admin').map(d => (
                <option key={d.id} value={d.id}>{d.role === 'designer' ? ((dealers.find(p => p.id === d.parent_dealer_id) || {}).company_name || d.company_name) : d.company_name} \u2014 {d.contact_name} ({d.role})</option>
              ))}
            </select>
            <button onClick={() => navigate('/dealer-portal/projects')} style={{ padding: '0.5rem 1rem', background: '#666', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
          </div>
        );
      }
      const targetDealer = isAdmin && adminSelectedDealer ? (adminSelectedDealer.role === 'designer' && adminSelectedDealer.parent_dealer_id ? (dealers.find(d => d.id === adminSelectedDealer.parent_dealer_id) || adminSelectedDealer) : adminSelectedDealer) : scopedDealer;
      return <DesignPacketWizard dealer={targetDealer} onNavigate={(p) => { setAdminSelectedDealer(null); navigate(p); }} draftId={draftIdParam} />;
    }
    if (pathOnly === '/dealer-portal/projects' || pathOnly === '/dealer-portal/projects/') return <ProjectList dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />;
    if (pathOnly.startsWith('/dealer-portal/projects/')) { const id = pathOnly.split('/').pop()!; return <ProjectDetail projectId={id} dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />; }
    if (pathOnly === '/dealer-portal/orders' || pathOnly === '/dealer-portal/orders/') return <OrderList dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />;
    if (pathOnly.startsWith('/dealer-portal/orders/')) { const id = pathOnly.split('/').pop()!; return <OrderDetail orderId={id} dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />; }
    if (pathOnly === '/dealer-portal/warranty/new') return <WarrantyForm dealer={scopedDealer} onNavigate={navigate} />;
    if (pathOnly === '/dealer-portal/warranty' || pathOnly === '/dealer-portal/warranty/') return <WarrantyList dealer={scopedDealer} onNavigate={navigate} />;
    if (pathOnly === '/dealer-portal/team' || pathOnly === '/dealer-portal/team/') {
      if (isDesigner) return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
      return <TeamManagement dealer={scopedDealer} isAdmin={isAdmin} isDesigner={isDesigner} />;
    }
    if (pathOnly === '/dealer-portal/messages') return <Messages dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />;
    if (pathOnly === '/dealer-portal/resources') return <ResourceLibrary dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />;
    if (pathOnly === '/dealer-portal/account') return <AccountSettings dealer={dealer} onDealerUpdate={setDealer} />;
    return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
  };

  return (
    <PortalLayout dealer={dealer} dealerEmail={dealer?.email || session?.user?.email} currentPath={path} onNavigate={navigate} onLogout={handleLogout} isAdmin={isAdmin} isDesigner={isDesigner}>
      {renderPage()}
    </PortalLayout>
  );
}
