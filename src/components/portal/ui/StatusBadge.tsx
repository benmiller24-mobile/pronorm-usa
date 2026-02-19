import React from 'react';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  // Project statuses
  submitted:           { bg: '#e8e4df', text: '#4a4a4a', label: 'Submitted' },
  in_review:           { bg: '#fef3cd', text: '#856404', label: 'In Review' },
  quoted:              { bg: '#d4edda', text: '#155724', label: 'Quoted' },
  revision_requested:  { bg: '#fff3cd', text: '#856404', label: 'Revision Requested' },
  approved:            { bg: '#d4edda', text: '#155724', label: 'Approved' },
  // Order statuses
  pending_payment:     { bg: '#fef3cd', text: '#856404', label: 'Pending Payment' },
  paid:                { bg: '#d4edda', text: '#155724', label: 'Paid' },
  in_production:       { bg: '#cce5ff', text: '#004085', label: 'In Production' },
  shipped:             { bg: '#d1ecf1', text: '#0c5460', label: 'Shipped' },
  delivered:           { bg: '#d4edda', text: '#155724', label: 'Delivered' },
  // Payment statuses
  unpaid:              { bg: '#f8d7da', text: '#721c24', label: 'Unpaid' },
  partial:             { bg: '#fff3cd', text: '#856404', label: 'Partial' },
  // Warranty statuses
  under_review:        { bg: '#fef3cd', text: '#856404', label: 'Under Review' },
  resolved:            { bg: '#d4edda', text: '#155724', label: 'Resolved' },
  denied:              { bg: '#f8d7da', text: '#721c24', label: 'Denied' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_COLORS[status] || { bg: '#e8e4df', text: '#4a4a4a', label: status };
  const fontSize = size === 'sm' ? '0.65rem' : '0.72rem';
  const padding = size === 'sm' ? '0.2rem 0.5rem' : '0.25rem 0.65rem';

  return (
    <span style={{
      display: 'inline-block',
      fontSize,
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      padding,
      borderRadius: '3px',
      background: config.bg,
      color: config.text,
      whiteSpace: 'nowrap',
    }}>
      {config.label}
    </span>
  );
}
