import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Order, Dealer } from '../../lib/types';
import FileUploader from './ui/FileUploader';

interface WarrantyFormProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

export default function WarrantyForm({ dealer, onNavigate }: WarrantyFormProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('orders').select('*').eq('dealer_id', dealer.id).order('created_at', { ascending: false });
      setOrders(data || []);
      setLoading(false);
    }
    load();
  }, [dealer.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) { setError('Please select an order.'); return; }
    if (!description.trim()) { setError('Please describe the issue.'); return; }
    setSubmitting(true);
    setError('');

    try {
      const { data: claim, error: claimErr } = await supabase
        .from('warranty_claims')
        .insert({ order_id: selectedOrderId, dealer_id: dealer.id, description: description.trim() })
        .select()
        .single();

      if (claimErr || !claim) throw claimErr || new Error('Failed to create warranty claim');

      // Upload files
      for (const file of files) {
        const path = `${dealer.id}/${claim.id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('warranty-files').upload(path, file);
        if (uploadErr) { console.error('Upload error:', uploadErr); continue; }
        await supabase.from('warranty_files').insert({
          warranty_id: claim.id,
          file_name: file.name,
          file_path: path,
        });
      }

      onNavigate('/dealer-portal/warranty');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem',
    border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa',
    color: '#1a1a1a', fontFamily: 'inherit', outline: 'none',
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#8a8279' }}>Loading...</div>;

  return (
    <div>
      <button onClick={() => onNavigate('/dealer-portal/warranty')} style={{
        background: 'none', border: 'none', color: '#b87333', fontSize: '0.78rem', fontWeight: 600,
        cursor: 'pointer', marginBottom: '1rem', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>&larr; Back to Warranty Claims</button>

      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400, marginBottom: '0.35rem' }}>
        Submit Warranty Claim
      </h1>
      <p style={{ fontSize: '0.85rem', color: '#8a8279', marginBottom: '2rem' }}>
        Select the order and describe the issue. Upload photos or documentation to support your claim.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '700px' }}>
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fdf0ef', border: '1px solid #f5c6cb', color: '#c44536', fontSize: '0.82rem', borderRadius: '3px', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Related Order *</label>
          {orders.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>No orders found. You need a delivered order to submit a warranty claim.</p>
          ) : (
            <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)} required style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="">Select an order...</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.order_number} — ${o.total_amount?.toLocaleString()}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>Issue Description *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue — what is damaged, defective, or missing? Include cabinet/part numbers if available."
            rows={5}
            required
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={labelStyle}>Supporting Photos / Documents</label>
          <FileUploader onFilesSelected={setFiles} maxSizeMB={20} accept=".jpg,.jpeg,.png,.pdf,.docx" />
        </div>

        <button type="submit" disabled={submitting || orders.length === 0} style={{
          padding: '0.85rem 2.5rem', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', background: submitting ? '#d4cdc5' : '#b87333', color: '#fdfcfa',
          border: 'none', borderRadius: '3px', cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}>
          {submitting ? 'Submitting...' : 'Submit Claim'}
        </button>
      </form>
    </div>
  );
}
