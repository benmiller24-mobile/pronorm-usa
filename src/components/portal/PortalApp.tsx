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

  const isAdmin = dealer.role === 'admin';
  const isDesigner = dealer.role === 'designer';

  // Designers are nested under a dealer — scope all data to the parent dealer's account.
  // We swap dealer.id to parent_dealer_id so every component's queries naturally
  // filter to the parent dealer's projects, orders, and warranty claims.
  const scopedDealer: Dealer = isDesigner && dealer.parent_dealer_id
    ? { ...dealer, id: dealer.parent_dealer_id }
    : dealer;

  // Route matching
  const renderPage = () => {
    if (path === '/dealer-portal/dashboard' || path === '/dealer-portal' || path === '/dealer-portal/') {
      return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
    }
    if (path === '/dealer-portal/pricing') {
      // Only show pricing tool to the specific dealer or admin
      const userEmail = dealer.email || session?.user?.email;
      if (userEmail === 'ben.miller24@gmail.com' || isAdmin) {
        return <PricingTool dealer={scopedDealer} onNavigate={navigate} />;
      }
      return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
    }
    if (path === '/dealer-portal/projects/new') {
      return <DesignPacketWizard dealer={scopedDealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/projects' || path === '/dealer-portal/projects/') {
      return <ProjectList dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />;
    }
    if (path.startsWith('/dealer-portal/projects/')) {
      const id = path.split('/').pop()!;
      return <ProjectDetail projectId={id} dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />;
    }
    if (path === '/dealer-portal/orders' || path === '/dealer-portal/orders/') {
      return <OrderList dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />;
    }
    if (path.startsWith('/dealer-portal/orders/')) {
      const id = path.split('/').pop()!;
      return <OrderDetail orderId={id} dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} />;
    }
    if (path === '/dealer-portal/warranty/new') {
      return <WarrantyForm dealer={scopedDealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/warranty' || path === '/dealer-portal/warranty/') {
      return <WarrantyList dealer={scopedDealer} onNavigate={navigate} />;
    }
    if (path === '/dealer-portal/team' || path === '/dealer-portal/team/') {
      // Designers don't manage anyone — redirect to dashboard
      if (isDesigner) return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
      return <TeamManagement dealer={scopedDealer} isAdmin={isAdmin} isDesigner={isDesigner} />;
    }
    if (path === '/dealer-portal/account') {
      return <AccountSettings dealer={dealer} onDealerUpdate={setDealer} />;
    }
    return <DealerDashboard dealer={scopedDealer} onNavigate={navigate} isAdmin={isAdmin} isDesigner={isDesigner} />;
  };

  return (
    <PortalLayout dealer={dealer} dealerEmail={dealer?.email || session?.user?.email} currentPath={path} onNavigate={navigate} onLogout={handleLogout} isAdmin={isAdmin} isDesigner={isDesigner}>
      {renderPage()}
    </PortalLayout>
  );
}
