import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Dealer } from '../../lib/types';
import LoginForm from './LoginForm';
import PortalLayout from './PortalLayout';
import DealerDashboard from './DealerDashboard';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import ProjectDetail from './ProjectDetail';
import OrderList from './OrderList';
import OrderDetail from './OrderDetail';
import WarrantyList from './WarrantyList';
import WarrantyForm from './WarrantyForm';
import AccountSettings from './AccountSettings';

export default function PortalApp() {
  const [session, setSession] = useState<any>(null);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState('/dealer-portal/dashboard');

  // Read initial path from URL
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/dealer-portal/') && currentPath !== '/dealer-portal/') {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) fetchDealer(s.user.id);
      else { setDealer(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchDealer(userId: string) {
    const { data } = await supabase.from('dealers').select('*').eq('user_id', userId).single();
    setDealer(data);
    setLoading(false);
  }

  const navigate = (newPath: string) => {
    setPath(newPath);
    window.history.pushState({}, '', newPath);
    window.scrollTo(0, 0);
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/dealer-portal')) {
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
    // Session will be picked up by the auth state listener
    navigate('/dealer-portal/dashboard');
  };

  // Loading
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f7f4f0', fontFamily: "'DM Sans', sans-serif", color: '#8a8279',
      }}>
        Loading...
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // No dealer profile
  if (!dealer) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f7f4f0', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', padding: '2rem',
      }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.5rem' }}>Account Setup Pending</h2>
          <p style={{ color: '#8a8279', marginBottom: '1.5rem' }}>
            Your dealer profile hasn't been set up yet. Please contact your Pronorm USA representative.
          </p>
          <button onClick={handleLogout} style={{
            padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa', border: 'none',
            borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
          }}>Sign Out</button>
        </div>
      </div>
    );
  }

  // Route matching
  const renderPage = () => {
    if (path === '/dealer-portal/dashboard' || path === '/dealer-portal' || path === '/dealer-portal/') {
      return <DealerDashboard dealer={dealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/projects/new') {
      return <ProjectForm dealer={dealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/projects' || path === '/dealer-portal/projects/') {
      return <ProjectList dealer={dealer} onNavigate={navigate} />;
    }
    if (path.startsWith('/dealer-portal/projects/')) {
      const id = path.split('/').pop()!;
      return <ProjectDetail projectId={id} dealer={dealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/orders' || path === '/dealer-portal/orders/') {
      return <OrderList dealer={dealer} onNavigate={navigate} />;
    }
    if (path.startsWith('/dealer-portal/orders/')) {
      const id = path.split('/').pop()!;
      return <OrderDetail orderId={id} dealer={dealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/warranty/new') {
      return <WarrantyForm dealer={dealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/warranty' || path === '/dealer-portal/warranty/') {
      return <WarrantyList dealer={dealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/account') {
      return <AccountSettings dealer={dealer} onDealerUpdate={setDealer} />;
    }
    return <DealerDashboard dealer={dealer} onNavigate={navigate} />;
  };

  return (
    <PortalLayout dealer={dealer} currentPath={path} onNavigate={navigate} onLogout={handleLogout}>
      {renderPage()}
    </PortalLayout>
  );
}
