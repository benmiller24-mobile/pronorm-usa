import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderFile, OrderStatusUpdate, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';
import StatusTimeline from './ui/StatusTimeline';
import FileUploader from './ui/FileUploader';

interface OrderDetailProps {
  orderId: string;
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

const ORDER_STEPS = [
  'pending_order_payment', 'order_paid', 'sent_to_factory',
  'acknowledgement_review', 'acknowledgement_approved',
  'in_production', 'shipped', 'pending_shipping_payment', 'shipping_paid', 'delivered',
];

const STEP_LABELS: Record<string, string> = {
  pending_order_payment: 'Order Payment',
  order_paid: 'Payment Received',
  sent_to_factory: 'Sent to Factory',
  acknowledgement_review: 'Review Order Confirmation',
  acknowledgement_changes: 'Confirmation Changes Submitted',
  acknowledgement_approved: 'Confirmation Approved',
  in_production: 'Manufacturing',
  shipped: 'Shipped',
  pending_shipping_payment: 'Shipping Payment',
  shipping_paid: 'Shipping Paid',
  delivered: 'Delivered',
};

export default function OrderDetail({ orderId, dealer, onNavigate }: OrderDetailProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [updates, setUpdates] = useState<OrderStatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [markupMode, setMarkupMode] = useState(false);
  const [markupFiles, setMarkupFiles] = useState<File[]>([]);
  const [markupNote, setMarkupNote] = useState('');
  const [submittingMarkup, setSubmittingMarkup] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => { loadData(); }, [orderId]);

  async function loadData() {
    const [ordRes, filesRes, updRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase.from('order_files').select('*').eq('order_id', orderId).order('uploaded_at', { ascending: true }),
      supabase.from('order_status_updates').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    ]);
    setOrder(ordRes.data);
    setFiles(filesRes.data || []);
    setUpdates(updRes.data || []);
    setLoading(false);
  }

  const downloadFile = async (file: OrderFile) => {
    const { data } = await supabase.storage.from('order-files').createSignedUrl(file.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  // Dealer submits markup on factory acknowledgement
  const handleSubmitAckMarkup = async () => {
    if (!order || markupFiles.length === 0) return;
    setSubmittingMarkup(true);
    try {
      for (const file of markupFiles) {
        const path = `${dealer.id}/${order.id}/ack-markup-${Date.now()}-${file.name}`;
        await supabase.storage.from('order-files').upload(path, file);
        await supabase.from('order_files').insert({
          order_id: order.id, file_name: file.name, file_path: path,
          file_type: file.type || 'application/octet-stream', file_size: file.size,
          category: 'acknowledgement_markup', uploaded_by: 'dealer',
        });
      }
      await supabase.from('orders').update({ status: 'acknowledgement_changes' }).eq('id', order.id);
      setMarkupMode(false); setMarkupFiles([]); setMarkupNote('');
      await loadData();
    } catch (err) { console.error(err); }
    setSubmittingMarkup(false);
  };

  // Dealer approves factory acknowledgement
  const handleApproveAck = async () => {
    if (!order) return;
    setApproving(true);
    await supabase.from('orders').update({ status: 'acknowledgement_approved' }).eq('id', order.id);
    await loadData();
    setApproving(false);
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#8a8279' }}>Loading...</div>;
  if (!order) return <div style={{ padding: '3rem', textAlign: 'center', color: '#c44536' }}>Order not found.</div>;

  // Build timeline
  const hasAckChanges = files.some(f => f.category === 'acknowledgement_markup');
  const steps = [...ORDER_STEPS];
  if (hasAckChanges) {
    const ackIdx = steps.indexOf('acknowledgement_approved');
    steps.splice(ackIdx, 0, 'acknowledgement_changes');
  }

  const currentIdx = steps.indexOf(order.status);
  const timelineSteps = steps.map((step, i) => {
    let date: string | undefined;
    if (step === 'pending_order_payment') date = new Date(order.created_at).toLocaleDateString();
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

  const ackFiles = files.filter(f => f.category === 'acknowledgement');
  const ackMarkupFiles = files.filter(f => f.category === 'acknowledgement_markup');
  const canReviewAck = order.status === 'acknowledgement_review';
  const needsOrderPayment = order.status === 'pending_order_payment';
  const needsShippingPayment = order.status === 'pending_shipping_payment';

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
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400 }}>Order {order.order_number}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }} className="portal-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ORDER PAYMENT Banner */}
          {needsOrderPayment && order.quickbooks_order_invoice_id && (
            <div style={{ ...cardStyle, background: '#fef9f0', borderLeft: '4px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.35rem' }}>Order Payment Required</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.5, marginBottom: '1rem' }}>
                Your order is ready. Pay via QuickBooks to proceed to production.
              </p>
              <a href={`https://app.qbo.intuit.com/app/invoice?txnId=${order.quickbooks_order_invoice_id}`}
                target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-block', padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa',
                  borderRadius: '3px', textDecoration: 'none',
                }}>Pay Order Invoice &mdash; ${order.total_amount?.toLocaleString()}</a>
            </div>
          )}

          {/* ACKNOWLEDGEMENT REVIEW Banner */}
          {canReviewAck && !markupMode && (
            <div style={{ ...cardStyle, background: '#fef9f0', borderLeft: '4px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.35rem' }}>Review Order Confirmation</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.5, marginBottom: '1rem' }}>
                The factory order confirmation is ready for your review. Approve it to begin manufacturing, or upload marked-up changes.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={handleApproveAck} disabled={approving} style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', background: approving ? '#d4cdc5' : '#4a7c59', color: '#fdfcfa',
                  border: 'none', borderRadius: '3px', cursor: approving ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>{approving ? 'Approving...' : 'Approve Confirmation'}</button>
                <button onClick={() => setMarkupMode(true)} style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', background: 'transparent', color: '#4a4a4a',
                  border: '1.5px solid #d4cdc5', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
                }}>Request Changes</button>
              </div>
            </div>
          )}

          {/* Acknowledgement Markup Form */}
          {markupMode && (
            <div style={{ ...cardStyle, borderLeft: '4px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.75rem' }}>Submit Confirmation Changes</h3>
              <p style={{ fontSize: '0.85rem', color: '#4a4a4a', marginBottom: '1rem' }}>Upload your marked-up order confirmation and add notes.</p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Change Notes</label>
                <textarea value={markupNote} onChange={e => setMarkupNote(e.target.value)} placeholder="Describe the changes needed..." rows={3}
                  style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem', border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa', color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <FileUploader onFilesSelected={setMarkupFiles} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={handleSubmitAckMarkup} disabled={submittingMarkup || markupFiles.length === 0} style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', background: submittingMarkup ? '#d4cdc5' : '#b87333', color: '#fdfcfa',
                  border: 'none', borderRadius: '3px', cursor: submittingMarkup ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>{submittingMarkup ? 'Submitting...' : 'Submit Changes'}</button>
                <button onClick={() => { setMarkupMode(false); setMarkupFiles([]); setMarkupNote(''); }} style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600,
                  background: 'none', border: 'none', color: '#8a8279', cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
              </div>
            </div>
          )}

          {/* SHIPPING PAYMENT Banner */}
          {needsShippingPayment && order.quickbooks_shipping_invoice_id && (
            <div style={{ ...cardStyle, background: '#fef9f0', borderLeft: '4px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.35rem' }}>Shipping Payment Required</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.5, marginBottom: '1rem' }}>
                Your order has shipped. Pay the shipping balance to complete delivery.
              </p>
              <a href={`https://app.qbo.intuit.com/app/invoice?txnId=${order.quickbooks_shipping_invoice_id}`}
                target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-block', padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa',
                  borderRadius: '3px', textDecoration: 'none',
                }}>Pay Shipping Invoice{order.shipping_amount ? ` — $${order.shipping_amount.toLocaleString()}` : ''}</a>
            </div>
          )}

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Order Total</div>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.6rem', fontWeight: 400, color: '#b87333' }}>${order.total_amount?.toLocaleString()}</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Order Payment</div>
              <div style={{ marginTop: '0.25rem' }}><StatusBadge status={order.payment_status} /></div>
            </div>
            {order.shipping_amount != null && (
              <div style={cardStyle}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Shipping</div>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.3rem', fontWeight: 400, color: '#2d2d2d' }}>${order.shipping_amount.toLocaleString()}</div>
                <div style={{ marginTop: '0.25rem' }}><StatusBadge status={order.shipping_payment_status} size="sm" /></div>
              </div>
            )}
            {order.estimated_delivery && (
              <div style={cardStyle}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Est. Delivery</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#2d2d2d' }}>{new Date(order.estimated_delivery).toLocaleDateString()}</div>
              </div>
            )}
          </div>

          {/* Shipping Info */}
          {(order.shipping_tracking || order.shipping_carrier) && (
            <div style={{ ...cardStyle, borderLeft: '3px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>Shipping Information</h3>
              {order.shipping_carrier && <div style={{ fontSize: '0.88rem', marginBottom: '0.4rem' }}><strong>Carrier:</strong> {order.shipping_carrier}</div>}
              {order.shipping_tracking && <div style={{ fontSize: '0.88rem' }}><strong>Tracking:</strong> <span style={{ color: '#b87333', fontWeight: 500 }}>{order.shipping_tracking}</span></div>}
            </div>
          )}

          {/* Factory Acknowledgement Files */}
          {ackFiles.length > 0 && (
            <div style={{ ...cardStyle, borderLeft: '3px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>
                Factory Order Confirmation
                <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#8a8279', marginLeft: '0.5rem' }}>({ackFiles.length} file{ackFiles.length > 1 ? 's' : ''})</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ackFiles.map(f => (
                  <button key={f.id} onClick={() => downloadFile(f)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem', background: '#f7f4f0', border: 'none', borderRadius: '3px',
                    cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                  }}>
                    <span style={{ color: '#2d2d2d', fontWeight: 500 }}>{f.file_name}</span>
                    <span style={{ color: '#b87333', fontSize: '0.75rem', fontWeight: 600 }}>Download</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dealer Markup Files on Acknowledgement */}
          {ackMarkupFiles.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>Your Confirmation Markup</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ackMarkupFiles.map(f => (
                  <button key={f.id} onClick={() => downloadFile(f)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem', background: '#f7f4f0', border: 'none', borderRadius: '3px',
                    cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                  }}>
                    <span style={{ color: '#2d2d2d', fontWeight: 500 }}>{f.file_name}</span>
                    <span style={{ color: '#b87333', fontSize: '0.75rem', fontWeight: 600 }}>Download</span>
                  </button>
                ))}
              </div>
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
