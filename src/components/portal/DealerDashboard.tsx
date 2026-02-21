import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Project, Order, WarrantyClaim, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';

interface DashboardProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
  isAdmin?: boolean;
  isDesigner?: boolean;
}

export default function DealerDashboard({ dealer, onNavigate, isAdmin, isDesigner }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [warranties, setWarranties] = useState<WarrantyClaim[]>([]);
  const [dealerCount, setDealerCount] = useState(0);
  const [designerCount, setDesignerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (isAdmin) {
        // Admin sees all records across all dealers
        const [projRes, ordRes, warRes, dealersRes, designersRes] = await Promise.all([
          supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('warranty_claims').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('dealers').select('id', { count: 'exact', head: true }).eq('role', 'dealer'),
          supabase.from('dealers').select('id', { count: 'exact', head: true }).eq('role', 'designer'),
        ]);
        setProjects(projRes.data || []);
        setOrders(ordRes.data || []);
        setWarranties(warRes.data || []);
        setDealerCount(dealersRes.count || 0);
        setDesignerCount(designersRes.count || 0);
      } else {
        // Dealer and Designer both scope to dealer.id
        // (Designer's dealer.id is already set to parent_dealer_id by PortalApp)
        const [projRes, ordRes, warRes] = await Promise.all([
          supabase.from('projects').select('*').eq('dealer_id', dealer.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('orders').select('*').eq('dealer_id', dealer.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('warranty_claims').select('*').eq('dealer_id', dealer.id).order('created_at', { ascending: false }).limit(5),
        ]);
        setProjects(projRes.data || []);
        setOrders(ordRes.data || []);
        setWarranties(warRes.data || []);
      }
      setLoading(false);
    }
    loadData();
  }, [dealer.id, isAdmin]);

  // Items needing action
  const actionNeeded = isAdmin
    ? [
        ...projects.filter(p => p.status === 'submitted').map(p => ({ type: 'project', label: `New submission: ${p.job_name}`, id: p.id })),
        ...projects.filter(p => p.status === 'changes_requested').map(p => ({ type: 'project', label: `Changes requested: ${p.job_name}`, id: p.id })),
        ...orders.filter(o => o.status === 'order_paid').map(o => ({ type: 'order', label: `Send to factory: ${o.order_number}`, id: o.id })),
        ...orders.filter(o => o.status === 'acknowledgement_changes').map(o => ({ type: 'order', label: `Re-upload ack: ${o.order_number}`, id: o.id })),
        ...orders.filter(o => o.status === 'acknowledgement_approved').map(o => ({ type: 'order', label: `Start production: ${o.order_number}`, id: o.id })),
      ]
    : [
        ...projects.filter(p => ['design_delivered', 'design_revised'].includes(p.status)).map(p => ({ type: 'project', label: `Review design: ${p.job_name}`, id: p.id })),
        ...orders.filter(o => o.status === 'pending_order_payment').map(o => ({ type: 'order', label: `Pay order: ${o.order_number}`, id: o.id })),
        ...orders.filter(o => o.status === 'acknowledgement_review').map(o => ({ type: 'order', label: `Review confirmation: ${o.order_number}`, id: o.id })),
        ...orders.filter(o => o.status === 'pending_shipping_payment').map(o => ({ type: 'order', label: `Pay shipping: ${o.order_number}`, id: o.id })),
      ];

  const activeProjects = projects.filter(p => p.status !== 'approved');
  const activeOrders = orders.filter(o => o.status !== 'delivered');
  const pendingWarranties = warranties.filter(w => !['resolved', 'denied'].includes(w.status));

  const cardStyle: React.CSSProperties = { padding: '1.5rem', background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px' };
  const statStyle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2.5rem', fontWeight: 300, color: '#b87333', lineHeight: 1 };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem 0', fontWeight: 600, color: '#4a4a4a', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#8a8279' }}>Loading dashboard...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2rem', fontWeight: 400, color: '#1a1a1a' }}>
          {isAdmin ? 'Admin Dashboard' : `Welcome, ${dealer.contact_name}`}
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#8a8279', marginTop: '0.25rem' }}>
          {isAdmin ? 'Pronorm USA — Manage all dealers, projects & orders' : `${dealer.company_name} — ${isDesigner ? 'Designer' : 'Dealer'} Dashboard`}
        </p>
      </div>

      {/* Action Items */}
      {actionNeeded.length > 0 && (
        <div style={{ ...cardStyle, background: '#fef9f0', borderLeft: '4px solid #b87333', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.75rem' }}>Action Required</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {actionNeeded.map((item, i) => (
              <button key={i} onClick={() => onNavigate(`/dealer-portal/${item.type === 'project' ? 'projects' : 'orders'}/${item.id}`)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.8rem', background: '#fff', border: '1px solid #e8e4df', borderRadius: '3px',
                cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'left', width: '100%',
              }}>
                <span style={{ color: '#2d2d2d', fontWeight: 500 }}>{item.label}</span>
                <span style={{ color: '#b87333', fontSize: '0.75rem', fontWeight: 600 }}>View &rarr;</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={cardStyle}><div style={statStyle}>{activeProjects.length}</div><div style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4a4a', marginTop: '0.5rem' }}>Active Projects</div></div>
        <div style={cardStyle}><div style={statStyle}>{activeOrders.length}</div><div style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4a4a', marginTop: '0.5rem' }}>Open Orders</div></div>
        <div style={cardStyle}><div style={statStyle}>{orders.filter(o => o.status === 'in_production').length}</div><div style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4a4a', marginTop: '0.5rem' }}>In Production</div></div>
        <div style={cardStyle}><div style={statStyle}>{pendingWarranties.length}</div><div style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4a4a', marginTop: '0.5rem' }}>Open Warranty Claims</div></div>
      </div>

      {/* Team Overview — Admin only */}
      {isAdmin && (
        <div style={{ ...cardStyle, marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div>
              <div style={{ ...statStyle, fontSize: '1.8rem' }}>{dealerCount}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginTop: '0.25rem' }}>Dealers</div>
            </div>
            <div>
              <div style={{ ...statStyle, fontSize: '1.8rem' }}>{designerCount}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginTop: '0.25rem' }}>Designers</div>
            </div>
          </div>
          <button onClick={() => onNavigate('/dealer-portal/team')} style={{
            background: 'none', border: 'none', color: '#b87333', fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'inherit',
          }}>Manage Team &rarr;</button>
        </div>
      )}

      {/* Quick Actions */}
      {!isAdmin && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate('/dealer-portal/projects/new')} style={{ padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa', border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit' }}>+ New Project</button>
          <button onClick={() => onNavigate('/dealer-portal/warranty/new')} style={{ padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', color: '#4a4a4a', border: '1.5px solid #d4cdc5', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Warranty Claim</button>
        </div>
      )}

      {/* Recent Projects */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500 }}>Recent Projects</h3>
          <button onClick={() => onNavigate('/dealer-portal/projects')} style={{ background: 'none', border: 'none', color: '#b87333', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'inherit' }}>View All &rarr;</button>
        </div>
        {projects.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>No projects yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead><tr style={{ borderBottom: '1px solid #e8e4df' }}>
              <th style={thStyle}>Job Name</th><th style={thStyle}>Client</th><th style={thStyle}>Status</th><th style={{ ...thStyle, textAlign: 'right' }}>Date</th>
            </tr></thead>
            <tbody>{projects.map(p => (
              <tr key={p.id} onClick={() => onNavigate(`/dealer-portal/projects/${p.id}`)} style={{ borderBottom: '1px solid #f0ebe4', cursor: 'pointer' }}>
                <td style={{ padding: '0.65rem 0', color: '#1a1a1a', fontWeight: 500 }}>{p.job_name}</td>
                <td style={{ padding: '0.65rem 0', color: '#4a4a4a' }}>{p.client_name}</td>
                <td style={{ padding: '0.65rem 0' }}><StatusBadge status={p.status} size="sm" /></td>
                <td style={{ padding: '0.65rem 0', color: '#8a8279', textAlign: 'right' }}>{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* Recent Orders */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500 }}>Recent Orders</h3>
          <button onClick={() => onNavigate('/dealer-portal/orders')} style={{ background: 'none', border: 'none', color: '#b87333', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'inherit' }}>View All &rarr;</button>
        </div>
        {orders.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>No orders yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead><tr style={{ borderBottom: '1px solid #e8e4df' }}>
              <th style={thStyle}>Order #</th><th style={thStyle}>Status</th><th style={thStyle}>Payment</th><th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
            </tr></thead>
            <tbody>{orders.map(o => (
              <tr key={o.id} onClick={() => onNavigate(`/dealer-portal/orders/${o.id}`)} style={{ borderBottom: '1px solid #f0ebe4', cursor: 'pointer' }}>
                <td style={{ padding: '0.65rem 0', color: '#1a1a1a', fontWeight: 500 }}>{o.order_number}</td>
                <td style={{ padding: '0.65rem 0' }}><StatusBadge status={o.status} size="sm" /></td>
                <td style={{ padding: '0.65rem 0' }}><StatusBadge status={o.payment_status} size="sm" /></td>
                <td style={{ padding: '0.65rem 0', color: '#2d2d2d', textAlign: 'right', fontWeight: 500 }}>${o.total_amount?.toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
