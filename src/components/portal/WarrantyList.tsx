import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { WarrantyClaim, Order, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';

interface WarrantyListProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

export default function WarrantyList({ dealer, onNavigate }: WarrantyListProps) {
  const [claims, setClaims] = useState<(WarrantyClaim & { order_number?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: warData } = await supabase.from('warranty_claims').select('*').eq('dealer_id', dealer.id).order('created_at', { ascending: false });
      if (!warData || warData.length === 0) { setClaims([]); setLoading(false); return; }

      // Fetch related order numbers
      const orderIds = [...new Set(warData.map(w => w.order_id))];
      const { data: ordData } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
      const orderMap = new Map(ordData?.map(o => [o.id, o.order_number]) || []);

      setClaims(warData.map(w => ({ ...w, order_number: orderMap.get(w.order_id) })));
      setLoading(false);
    }
    load();
  }, [dealer.id]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400 }}>Warranty Claims</h1>
          <p style={{ fontSize: '0.85rem', color: '#8a8279', marginTop: '0.2rem' }}>{claims.length} total claims</p>
        </div>
        <button onClick={() => onNavigate('/dealer-portal/warranty/new')} style={{
          padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa', border: 'none',
          borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
        }}>+ New Claim</button>
      </div>

      <div style={{ background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>Loading...</div>
        ) : claims.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>No warranty claims.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8e4df' }}>
                {['Order', 'Description', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Date' ? 'right' : 'left', padding: '0.75rem 1rem', fontWeight: 600, color: '#4a4a4a', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f0ebe4' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#1a1a1a' }}>{c.order_number || '\u2014'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#4a4a4a', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={c.status} /></td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#8a8279' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
