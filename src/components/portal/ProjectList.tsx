import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Project, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';

interface ProjectListProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

const STATUS_FILTERS = ['all', 'submitted', 'in_review', 'quoted', 'revision_requested', 'approved'] as const;

export default function ProjectList({ dealer, onNavigate }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('projects').select('*').eq('dealer_id', dealer.id).order('created_at', { ascending: false });
      setProjects(data || []);
      setLoading(false);
    }
    load();
  }, [dealer.id]);

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400 }}>Projects</h1>
          <p style={{ fontSize: '0.85rem', color: '#8a8279', marginTop: '0.2rem' }}>{projects.length} total projects</p>
        </div>
        <button onClick={() => onNavigate('/dealer-portal/projects/new')} style={{
          padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa', border: 'none',
          borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
        }}>+ New Project</button>
      </div>

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
                {['Job Name', 'Client', 'Status', 'Quote', 'Submitted'].map(h => (
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
