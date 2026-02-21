import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderFile, OrderStatusUpdate, Dealer } from '../../lib/types';
import { getValidNextOrderStatuses, ORDER_STATUS_LABELS } from '../../lib/admin-utils';
import StatusBadge from './ui/StatusBadge';
import StatusTimeline from './ui/StatusTimeline';
import FileUploader from './ui/FileUploader';
import { notifyStatusChange } from '../../lib/notifications';

interface OrderDetailProps {
  orderId: string;
  dealer: Dealer;
  onNavigate: (path: string) => void;
  isAdmin?: boolean;
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

export default function OrderDetail({ orderId, dealer, onNavigate, isAdmin }: OrderDetailProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [updates, setUpdates] = useState<OrderStatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [markupMode, setMarkupMode] = useState(false);
  const [markupFiles, setMarkupFiles] = useState<File[]>([]);
  const [markupNote, setMarkupNote] = useState('');
  const [submittingMarkup, setSubmittingMarkup] = useState(false);
  const [approving, setApproving] = useState(false);

  // Admin state
  const [adminStatus, setAdminStatus] = useState('');
  const [adminStatusNote, setAdminStatusNote] = useState('');
  const [adminUpdating, setAdminUpdating] = useState(false);
  const [adminFiles, setAdminFiles] = useState<File[]>([]);
  const [adminFileCategory, setAdminFileCategory] = useState<'acknowledgement' | 'acknowledgement_revision'>('acknowledgement');
  const [adminUploading, setAdminUploading] = useState(false);
  const [paymentLinkInput, setPaymentLinkInput] = useState('');
  const [savingPaymentLink, setSavingPaymentLink] = useState(false);
  const [qbOrderInvoice, setQbOrderInvoice] = useState('');
  const [qbShippingInvoice, setQbShippingInvoice] = useState('');
  const [savingQb, setSavingQb] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [carrierInput, setCarrierInput] = useState('');
  const [estDeliveryInput, setEstDeliveryInput] = useState('');
  const [savingShipping, setSavingShipping] = useState(false);
  const [savingPaymentStatus, setSavingPaymentStatus] = useState(false);

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
    if (ordRes.data) {
      setPaymentLinkInput(ordRes.data.payment_link || '');
      setQbOrderInvoice(ordRes.data.quickbooks_order_invoice_id || '');
      setQbShippingInvoice(ordRes.data.quickbooks_shipping_invoice_id || '');
      setTrackingInput(ordRes.data.shipping_tracking || '');
      setCarrierInput(ordRes.data.shipping_carrier || '');
      setEstDeliveryInput(ordRes.data.estimated_delivery || '');
    }
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
        const { error: uploadErr } = await supabase.storage.from('order-files').upload(path, file);
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
        const { error: insertErr } = await supabase.from('order_files').insert({
          order_id: order.id, file_name: file.name, file_path: path,
          file_type: file.type || 'application/octet-stream', file_size: file.size,
          category: 'acknowledgement_markup', uploaded_by: 'dealer',
        });
        if (insertErr) throw new Error(`File record failed: ${insertErr.message}`);
      }
      await supabase.from('orders').update({ status: 'acknowledgement_changes' }).eq('id', order.id);
      if (markupNote) {
        await supabase.from('order_status_updates').insert({
          order_id: order.id, old_status: order.status, new_status: 'acknowledgement_changes',
          note: markupNote, updated_by: 'dealer',
        });
      }
      notifyStatusChange('order', order.id, order.status, 'acknowledgement_changes', markupNote || undefined);
      setMarkupMode(false); setMarkupFiles([]); setMarkupNote('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Markup submission failed: ${err.message || 'Unknown error'}`);
    }
    setSubmittingMarkup(false);
  };

  // Dealer approves factory acknowledgement
  const handleApproveAck = async () => {
    if (!order) return;
    setApproving(true);
    await supabase.from('orders').update({ status: 'acknowledgement_approved' }).eq('id', order.id);
    await supabase.from('order_status_updates').insert({
      order_id: order.id, old_status: order.status, new_status: 'acknowledgement_approved',
      note: 'Dealer approved order confirmation', updated_by: 'dealer',
    });
    notifyStatusChange('order', order.id, order.status, 'acknowledgement_approved', 'Dealer approved order confirmation');
    await loadData();
    setApproving(false);
  };

  // ── Admin actions ──
  const handleAdminStatusUpdate = async () => {
    if (!order || !adminStatus) return;
    setAdminUpdating(true);
    const updateData: Record<string, any> = { status: adminStatus };
    if (adminStatus === 'order_paid') updateData.payment_status = 'paid';
    if (adminStatus === 'shipping_paid') updateData.shipping_payment_status = 'paid';
    if (adminStatus === 'in_production') updateData.production_started_at = new Date().toISOString();
    if (adminStatus === 'shipped') updateData.shipped_at = new Date().toISOString();
    if (adminStatus === 'delivered') updateData.delivered_at = new Date().toISOString();

    await supabase.from('orders').update(updateData).eq('id', order.id);
    await supabase.from('order_status_updates').insert({
      order_id: order.id, old_status: order.status, new_status: adminStatus,
      note: adminStatusNote || null, updated_by: 'admin',
    });
    notifyStatusChange('order', order.id, order.status, adminStatus, adminStatusNote || undefined);
    setAdminStatus('');
    setAdminStatusNote('');
    await loadData();
    setAdminUpdating(false);
  };

  const handleAdminFileUpload = async () => {
    if (!order || adminFiles.length === 0) return;
    setAdminUploading(true);
    try {
      for (const file of adminFiles) {
        const path = `${order.dealer_id}/${order.id}/admin-ack-${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('order-files').upload(path, file);
        if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);
        const { error: insertErr } = await supabase.from('order_files').insert({
          order_id: order.id, file_name: file.name, file_path: path,
          file_type: file.type || 'application/octet-stream', file_size: file.size,
          category: adminFileCategory, uploaded_by: 'admin',
        });
        if (insertErr) throw new Error(`File record failed: ${insertErr.message}`);
      }
      // Auto-update status when uploading acknowledgement files
      const statusUpdates: Record<string, Record<string, string>> = {
        acknowledgement: { sent_to_factory: 'acknowledgement_review' },
        acknowledgement_revision: { acknowledgement_changes: 'acknowledgement_review' },
      };
      const newStatus = statusUpdates[adminFileCategory]?.[order.status];
      if (newStatus) {
        await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
        await supabase.from('order_status_updates').insert({
          order_id: order.id, old_status: order.status, new_status: newStatus,
          note: `Uploaded ${adminFileCategory === 'acknowledgement' ? 'order confirmation' : 'revised confirmation'}`, updated_by: 'admin',
        });
        notifyStatusChange('order', order.id, order.status, newStatus, `${adminFileCategory === 'acknowledgement' ? 'Order confirmation' : 'Revised confirmation'} uploaded`);
      }
      setAdminFiles([]);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Upload failed: ${err.message || 'Unknown error'}`);
    }
    setAdminUploading(false);
  };

  const handleUpdatePaymentStatus = async (field: 'payment_status' | 'shipping_payment_status', value: string) => {
    if (!order) return;
    setSavingPaymentStatus(true);
    await supabase.from('orders').update({ [field]: value }).eq('id', order.id);
    await loadData();
    setSavingPaymentStatus(false);
  };

  const handleSavePaymentLink = async () => {
    if (!order) return;
    setSavingPaymentLink(true);
    await supabase.from('orders').update({ payment_link: paymentLinkInput || null }).eq('id', order.id);
    await loadData();
    setSavingPaymentLink(false);
  };

  const handleSaveQb = async () => {
    if (!order) return;
    setSavingQb(true);
    await supabase.from('orders').update({
      quickbooks_order_invoice_id: qbOrderInvoice || null,
      quickbooks_shipping_invoice_id: qbShippingInvoice || null,
    }).eq('id', order.id);
    await loadData();
    setSavingQb(false);
  };

  const handleSaveShipping = async () => {
    if (!order) return;
    setSavingShipping(true);
    await supabase.from('orders').update({
      shipping_tracking: trackingInput || null,
      shipping_carrier: carrierInput || null,
      estimated_delivery: estDeliveryInput || null,
    }).eq('id', order.id);
    await loadData();
    setSavingShipping(false);
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

  const ackFiles = files.filter(f => f.category === 'acknowledgement' || f.category === 'acknowledgement_revision');
  const ackMarkupFiles = files.filter(f => f.category === 'acknowledgement_markup');
  const canReviewAck = !isAdmin && order.status === 'acknowledgement_review';
  const needsOrderPayment = !isAdmin && order.status === 'pending_order_payment';
  const needsShippingPayment = !isAdmin && order.status === 'pending_shipping_payment';
  const validNextStatuses = isAdmin ? getValidNextOrderStatuses(order.status) : [];

  const cardStyle: React.CSSProperties = {
    padding: '1.5rem', background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.88rem', border: '1.5px solid #d4cdc5',
    borderRadius: '3px', background: '#fdfcfa', color: '#1a1a1a', fontFamily: 'inherit', outline: 'none',
  };
  const btnPrimary: React.CSSProperties = {
    padding: '0.55rem 1.2rem', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa', border: 'none',
    borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
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

          {/* ── ADMIN CONTROLS ── */}
          {isAdmin && (
            <div style={{ ...cardStyle, background: '#f0f7ff', borderLeft: '4px solid #4a7c9b' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '1rem', color: '#2d5a7b' }}>Admin Controls</h3>

              {/* Status Update */}
              {validNextStatuses.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={labelStyle}>Update Status</label>
                  <select value={adminStatus} onChange={e => setAdminStatus(e.target.value)} style={{ ...inputStyle, marginBottom: '0.5rem' }}>
                    <option value="">Select next status...</option>
                    {validNextStatuses.map(s => (
                      <option key={s} value={s}>{ORDER_STATUS_LABELS[s] || s}</option>
                    ))}
                  </select>
                  <textarea value={adminStatusNote} onChange={e => setAdminStatusNote(e.target.value)}
                    placeholder="Optional note for status change..." rows={2}
                    style={{ ...inputStyle, resize: 'vertical', marginBottom: '0.5rem' }} />
                  <button onClick={handleAdminStatusUpdate} disabled={!adminStatus || adminUpdating}
                    style={{ ...btnPrimary, opacity: !adminStatus || adminUpdating ? 0.5 : 1 }}>
                    {adminUpdating ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              )}

              {/* Upload Acknowledgement */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Upload Order Confirmation</label>
                <div style={{ marginBottom: '0.5rem' }}>
                  <select value={adminFileCategory} onChange={e => setAdminFileCategory(e.target.value as any)} style={inputStyle}>
                    <option value="acknowledgement">Order Confirmation</option>
                    <option value="acknowledgement_revision">Revised Confirmation</option>
                  </select>
                </div>
                <FileUploader onFilesSelected={setAdminFiles} />
                {adminFiles.length > 0 && (
                  <button onClick={handleAdminFileUpload} disabled={adminUploading} style={{ ...btnPrimary, marginTop: '0.5rem', opacity: adminUploading ? 0.5 : 1 }}>
                    {adminUploading ? 'Uploading...' : `Upload ${adminFiles.length} file${adminFiles.length > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              {/* Payment Link */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Payment Link (visible to dealer)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input value={paymentLinkInput} onChange={e => setPaymentLinkInput(e.target.value)}
                    placeholder="https://pay.stripe.com/..." style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={handleSavePaymentLink} disabled={savingPaymentLink}
                    style={{ ...btnPrimary, opacity: savingPaymentLink ? 0.5 : 1 }}>
                    {savingPaymentLink ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Payment Status */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Payment Status</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Order Payment</div>
                    <select value={order?.payment_status || 'unpaid'} onChange={e => handleUpdatePaymentStatus('payment_status', e.target.value)} disabled={savingPaymentStatus} style={inputStyle}>
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Shipping Payment</div>
                    <select value={order?.shipping_payment_status || 'unpaid'} onChange={e => handleUpdatePaymentStatus('shipping_payment_status', e.target.value)} disabled={savingPaymentStatus} style={inputStyle}>
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* QuickBooks Invoice IDs */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>QuickBooks Invoice IDs</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input value={qbOrderInvoice} onChange={e => setQbOrderInvoice(e.target.value)} placeholder="Order Invoice ID" style={{ ...inputStyle, flex: 1 }} />
                  <input value={qbShippingInvoice} onChange={e => setQbShippingInvoice(e.target.value)} placeholder="Shipping Invoice ID" style={{ ...inputStyle, flex: 1 }} />
                </div>
                <button onClick={handleSaveQb} disabled={savingQb} style={{ ...btnPrimary, opacity: savingQb ? 0.5 : 1 }}>
                  {savingQb ? 'Saving...' : 'Save Invoice IDs'}
                </button>
              </div>

              {/* Shipping Info */}
              <div>
                <label style={labelStyle}>Shipping Information</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="Tracking Number" style={inputStyle} />
                  <input value={carrierInput} onChange={e => setCarrierInput(e.target.value)} placeholder="Carrier (e.g., FedEx, DHL)" style={inputStyle} />
                  <input type="date" value={estDeliveryInput} onChange={e => setEstDeliveryInput(e.target.value)} style={inputStyle} />
                </div>
                <button onClick={handleSaveShipping} disabled={savingShipping} style={{ ...btnPrimary, opacity: savingShipping ? 0.5 : 1 }}>
                  {savingShipping ? 'Saving...' : 'Save Shipping Info'}
                </button>
              </div>
            </div>
          )}

          {/* ORDER PAYMENT Banner */}
          {needsOrderPayment && (order.payment_link || order.quickbooks_order_invoice_id) && (
            <div style={{ ...cardStyle, background: '#fef9f0', borderLeft: '4px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.35rem' }}>Order Payment Required</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.5, marginBottom: '1rem' }}>
                Your design has been approved and the order is ready. Complete payment to proceed.
              </p>
              {order.payment_link ? (
                <a href={order.payment_link}
                  target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-block', padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600,
                    letterSpacing: '0.08em', textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa',
                    borderRadius: '3px', textDecoration: 'none',
                  }}>Pay for Order{order.total_amount ? ` — $${order.total_amount.toLocaleString()}` : ''}</a>
              ) : order.quickbooks_order_invoice_id ? (
                <a href={`https://app.qbo.intuit.com/app/invoice?txnId=${order.quickbooks_order_invoice_id}`}
                  target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-block', padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600,
                    letterSpacing: '0.08em', textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa',
                    borderRadius: '3px', textDecoration: 'none',
                  }}>Pay Order Invoice{order.total_amount ? ` — $${order.total_amount.toLocaleString()}` : ''}</a>
              ) : null}
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
                <label style={labelStyle}>Change Notes</label>
                <textarea value={markupNote} onChange={e => setMarkupNote(e.target.value)} placeholder="Describe the changes needed..." rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <FileUploader onFilesSelected={setMarkupFiles} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={handleSubmitAckMarkup} disabled={submittingMarkup || markupFiles.length === 0} style={{
                  ...btnPrimary, opacity: submittingMarkup || markupFiles.length === 0 ? 0.5 : 1,
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {f.category === 'acknowledgement_revision' && <span style={{ fontSize: '0.65rem', background: '#e8f0fe', color: '#2d5a7b', padding: '0.15rem 0.4rem', borderRadius: '2px', fontWeight: 600 }}>REVISED</span>}
                      <span style={{ color: '#b87333', fontSize: '0.75rem', fontWeight: 600 }}>Download</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dealer Markup Files on Acknowledgement */}
          {ackMarkupFiles.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>
                {isAdmin ? 'Dealer Confirmation Markup' : 'Your Confirmation Markup'}
              </h3>
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
