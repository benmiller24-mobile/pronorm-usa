import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Project, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';

interface ProjectListProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
  isAdmin?: boolean;
}

const STATUS_FILTERS = ['all', 'submitted', 'in_design', 'design_delivered', 'changes_requested', 'design_revised', 'approved'] as const;

export default function ProjectList({ dealer, onNavigate, isAdmin }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('all');

  useEffect(() => {
    if (isAdmin) {
      // Load all dealers for the dropdown
      supabase.from('dealers').select('*').neq('role', 'admin').order('company_name').then(({ data }) => {
        setDealers(data || []);
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (isAdmin) {
        if (selectedDealerId !== 'all') {
          query = query.eq('dealer_id', selectedDealerId);
        }
      } else {
        query = query.eq('dealer_id', dealer.id);
      }
      const { data } = await query;
      setProjects(data || []);
      setLoading(false);
    }
    load();
  }, [dealer.id, isAdmin, selectedDealerId]);

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);

  // Map dealer_id to company name for admin view
  const dealerMap = new Map(dealers.map(d => [d.id, d.company_name]));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400 }}>
            {isAdmin ? 'All Projects' : 'Projects'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#8a8279', marginTop: '0.2rem' }}>{projects.length} total projects</p>
        </div>
        {!isAdmin && (
          <button onClick={() => onNavigate('/dealer-portal/projects/new')} style={{
            padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa', border: 'none',
            borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
          }}>+ New Project</button>
        )}
      </div>

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

      {/* Filters */}
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

      {/* Table */}
      <div style={{ background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>No projects found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8e4df' }}>
                {(isAdmin ? ['Job Name', 'Dealer', 'Client', 'Status', 'Quote', 'Submitted'] : ['Job Name', 'Client', 'Status', 'Quote', 'Submitted']).map(h => (
                  <th key={h} style={{ textAlign: h === 'Quote' || h === 'Submitted' ? 'right' : 'left', padding: '0.75rem 1rem', fontWeight: 600, color: '#4a4a4a', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => onNavigate(`/dealer-portal/projects/${p.id}`)} style={{ borderBottom: '1px solid #f0ebe4', cursor: 'pointer', transition: 'background 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#1a1a1a' }}>{p.job_name}</td>
                  {isAdmin && (
                    <td style={{ padding: '0.75rem 1rem', color: '#4a4a4a', fontSize: '0.82rem' }}>{dealerMap.get(p.dealer_id) || '—'}</td>
                  )}
                  <td style={{ padding: '0.75rem 1rem', color: '#4a4a4a' }}>{p.client_name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={p.status} /></td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#2d2d2d', fontWeight: 500 }}>
                    {p.quote_amount ? `$${p.quote_amount.toLocaleString()}` : '\u2014'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#8a8279' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
