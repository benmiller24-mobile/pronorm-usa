import React from 'react';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  /* ── Project statuses ── */
  submitted:              { bg: '#e8e4df', text: '#4a4a4a', label: 'Submitted' },
  in_design:              { bg: '#e2d9f3', text: '#5b3d8f', label: 'In Design' },
  design_delivered:       { bg: '#cce5ff', text: '#004085', label: 'Design Delivered' },
  changes_requested:      { bg: '#fff3cd', text: '#856404', label: 'Changes Requested' },
  design_revised:         { bg: '#d1ecf1', text: '#0c5460', label: 'Design Revised' },
  approved:               { bg: '#d4edda', text: '#155724', label: 'Approved' },

  /* ── Order statuses ── */
  pending_order_payment:    { bg: '#fef3cd', text: '#856404', label: 'Awaiting Payment' },
  order_paid:               { bg: '#d4edda', text: '#155724', label: 'Order Paid' },
  sent_to_factory:          { bg: '#e2d9f3', text: '#5b3d8f', label: 'Sent to Factory' },
  acknowledgement_review:   { bg: '#cce5ff', text: '#004085', label: 'Review Confirmation' },
  acknowledgement_changes:  { bg: '#fff3cd', text: '#856404', label: 'Confirmation Changes' },
  acknowledgement_approved: { bg: '#d4edda', text: '#155724', label: 'Confirmation Approved' },
  in_production:            { bg: '#e2d9f3', text: '#5b3d8f', label: 'In Production' },
  shipped:                  { bg: '#d1ecf1', text: '#0c5460', label: 'Shipped' },
  pending_shipping_payment: { bg: '#fef3cd', text: '#856404', label: 'Shipping Payment Due' },
  shipping_paid:            { bg: '#d4edda', text: '#155724', label: 'Shipping Paid' },
  delivered:                { bg: '#d4edda', text: '#155724', label: 'Delivered' },

  /* ── Payment statuses ── */
  unpaid:   { bg: '#f8d7da', text: '#721c24', label: 'Unpaid' },
  partial:  { bg: '#fff3cd', text: '#856404', label: 'Partial' },
  paid:     { bg: '#d4edda', text: '#155724', label: 'Paid' },

  /* ── Warranty statuses ── */
  under_review: { bg: '#fef3cd', text: '#856404', label: 'Under Review' },
  resolved:     { bg: '#d4edda', text: '#155724', label: 'Resolved' },
  denied:       { bg: '#f8d7da', text: '#721c24', label: 'Denied' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_COLORS[status] || { bg: '#e8e4df', text: '#4a4a4a', label: status.replace(/_/g, ' ') };
  const fontSize = size === 'sm' ? '0.62rem' : '0.7rem';
  const padding = size === 'sm' ? '0.18rem 0.45rem' : '0.25rem 0.6rem';

  return (
    <span style={{
      display: 'inline-block',
      fontSize,
      fontWeight: 600,
      letterSpacing: '0.04em',
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
