import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderStatusUpdate, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';
import StatusTimeline from './ui/StatusTimeline';

interface OrderDetailProps {
  orderId: string;
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

const ORDER_STEPS = ['pending_payment', 'paid', 'in_production', 'shipped', 'delivered'];
const STEP_LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment',
  paid: 'Payment Received',
  in_production: 'In Production',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export default function OrderDetail({ orderId, dealer, onNavigate }: OrderDetailProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [updates, setUpdates] = useState<OrderStatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [ordRes, updRes] = await Promise.all([
        supabase.from('orders').select('*').eq('id', orderId).single(),
        supabase.from('order_status_updates').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
      ]);
      setOrder(ordRes.data);
      setUpdates(updRes.data || []);
      setLoading(false);
    }
    load();
  }, [orderId]);

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#8a8279' }}>Loading...</div>;
  if (!order) return <div style={{ padding: '3rem', textAlign: 'center', color: '#c44536' }}>Order not found.</div>;

  const currentIdx = ORDER_STEPS.indexOf(order.status);
  const timelineSteps = ORDER_STEPS.map((step, i) => {
    let date: string | undefined;
    if (step === 'pending_payment') date = new Date(order.created_at).toLocaleDateString();
    if (step === 'in_production' && order.production_started_at) date = new Date(order.production_started_at).toLocaleDateString();
    if (step === 'shipped' && order.shipped_at) date = new Date(order.shipped_at).toLocaleDateString();
    if (step === 'delivered' && order.delivered_at) date = new Date(order.delivered_at).toLocaleDateString();

    const update = updates.find(u => u.new_status === step);
    return {
      label: STEP_LABELS[step],
      status: (i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'upcoming') as 'completed' | 'active' | 'upcoming',
      date,
      note: update?.note || undefined,
    };
  });

  const cardStyle: React.CSSProperties = {
    padding: '1.5rem', background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px',
  };

  return (
    <div>
      <button onClick={() => onNavigate('/dealer-portal/orders')} style={{
        background: 'none', border: 'none', color: '#b87333', fontSize: '0.78rem', fontWeight: 600,
        cursor: 'pointer', marginBottom: '1rem', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>&larr; Back to Orders</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400 }}>
          Order {order.order_number}
        </h1>
        <StatusBadge status={order.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Total Amount</div>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400, color: '#b87333' }}>${order.total_amount?.toLocaleString()}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Payment Status</div>
              <div style={{ marginTop: '0.25rem' }}><StatusBadge status={order.payment_status} /></div>
            </div>
            {order.estimated_delivery && (
              <div style={cardStyle}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Est. Delivery</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#2d2d2d' }}>{new Date(order.estimated_delivery).toLocaleDateString()}</div>
              </div>
            )}
          </div>

          {/* Shipping */}
          {(order.shipping_tracking || order.shipping_carrier) && (
            <div style={{ ...cardStyle, borderLeft: '3px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>Shipping Information</h3>
              {order.shipping_carrier && (
                <div style={{ fontSize: '0.88rem', marginBottom: '0.4rem' }}>
                  <strong>Carrier:</strong> {order.shipping_carrier}
                </div>
              )}
              {order.shipping_tracking && (
                <div style={{ fontSize: '0.88rem' }}>
                  <strong>Tracking:</strong> <span style={{ color: '#b87333', fontWeight: 500 }}>{order.shipping_tracking}</span>
                </div>
              )}
            </div>
          )}

          {/* QuickBooks Payment Link */}
          {order.payment_status !== 'paid' && order.quickbooks_invoice_id && (
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>Payment</h3>
              <p style={{ fontSize: '0.85rem', color: '#4a4a4a', marginBottom: '1rem' }}>
                Your invoice is ready. Click below to view and pay through QuickBooks.
              </p>
              <a
                href={`https://app.qbo.intuit.com/app/invoice?txnId=${order.quickbooks_invoice_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa',
                  borderRadius: '3px', textDecoration: 'none',
                }}
              >
                Pay Invoice
              </a>
            </div>
          )}

          {/* Status History */}
          {updates.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>Status History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {updates.map(u => (
                  <div key={u.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f0ebe4', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <StatusBadge status={u.old_status} size="sm" />
                        <span style={{ margin: '0 0.5rem', color: '#b5aca3' }}>&rarr;</span>
                        <StatusBadge status={u.new_status} size="sm" />
                      </span>
                      <span style={{ color: '#8a8279', fontSize: '0.75rem' }}>{new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                    {u.note && <p style={{ color: '#4a4a4a', marginTop: '0.3rem', fontSize: '0.82rem' }}>{u.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Timeline */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '1rem' }}>Progress</h3>
          <StatusTimeline steps={timelineSteps} />
        </div>
      </div>
    </div>
  );
}
