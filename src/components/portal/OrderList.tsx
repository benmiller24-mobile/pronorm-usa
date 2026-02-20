import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';

interface OrderListProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
  isAdmin?: boolean;
}

const STATUS_FILTERS = ['all', 'pending_order_payment', 'order_paid', 'sent_to_factory', 'acknowledgement_review', 'in_production', 'shipped', 'pending_shipping_payment', 'delivered'] as const;

export default function OrderList({ dealer, onNavigate, isAdmin }: OrderListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('all');

  useEffect(() => {
    if (isAdmin) {
      supabase.from('dealers').select('*').neq('role', 'admin').order('company_name').then(({ data }) => {
        setDealers(data || []);
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (isAdmin) {
        if (selectedDealerId !== 'all') {
          query = query.eq('dealer_id', selectedDealerId);
        }
      } else {
        query = query.eq('dealer_id', dealer.id);
      }
      const { data } = await query;
      setOrders(data || []);
      setLoading(false);
    }
    load();
  }, [dealer.id, isAdmin, selectedDealerId]);

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const dealerMap = new Map(dealers.map(d => [d.id, d.company_name]));

  return (
    <div>
      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400, marginBottom: '0.2rem' }}>
        {isAdmin ? 'All Orders' : 'Orders'}
      </h1>
      <p style={{ fontSize: '0.85rem', color: '#8a8279', marginBottom: '1.5rem' }}>{orders.length} total orders</p>

      {/* Admin dealer selector */}
      {isAdmin && (
        <div style={{ marginBottom: '1rem' }}>
          <select
            value={selectedDealerId}
            onChange={e => setSelectedDealerId(e.target.value)}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.85rem', border: '1.5px solid #d4cdc5',
              borderRadius: '3px', background: '#fdfcfa', color: '#1a1a1a', fontFamily: 'inherit',
              minWidth: '250px',
            }}
          >
            <option value="all">All Dealers</option>
            {dealers.map(d => (
              <option key={d.id} value={d.id}>{d.company_name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '0.4rem 0.85rem', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', background: filter === s ? '#2d2d2d' : '#fdfcfa',
            color: filter === s ? '#fdfcfa' : '#4a4a4a', border: '1px solid #d4cdc5',
            borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div style={{ background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>No orders found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8e4df' }}>
                {(isAdmin ? ['Order #', 'Dealer', 'Status', 'Payment', 'Tracking', 'Total', 'Date'] : ['Order #', 'Status', 'Payment', 'Tracking', 'Total', 'Date']).map(h => (
                  <th key={h} style={{ textAlign: h === 'Total' || h === 'Date' ? 'right' : 'left', padding: '0.75rem 1rem', fontWeight: 600, color: '#4a4a4a', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} onClick={() => onNavigate(`/dealer-portal/orders/${o.id}`)} style={{ borderBottom: '1px solid #f0ebe4', cursor: 'pointer', transition: 'background 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#1a1a1a' }}>{o.order_number}</td>
                  {isAdmin && (
                    <td style={{ padding: '0.75rem 1rem', color: '#4a4a4a', fontSize: '0.82rem' }}>{dealerMap.get(o.dealer_id) || '—'}</td>
                  )}
                  <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={o.status} /></td>
                  <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={o.payment_status} /></td>
                  <td style={{ padding: '0.75rem 1rem', color: '#4a4a4a', fontSize: '0.82rem' }}>
                    {o.shipping_tracking ? (
                      <span style={{ color: '#b87333', fontWeight: 500 }}>{o.shipping_tracking}</span>
                    ) : '\u2014'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500 }}>${o.total_amount?.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#8a8279' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
