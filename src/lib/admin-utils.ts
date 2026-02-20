/* ── Admin Utility Helpers ── */

import type { ProjectStatus, OrderStatus } from './types';

/* Valid next statuses that an admin can transition a project to */
export function getValidNextProjectStatuses(current: ProjectStatus): ProjectStatus[] {
  const transitions: Record<ProjectStatus, ProjectStatus[]> = {
    submitted: ['in_design'],
    in_design: ['design_delivered'],
    design_delivered: [],            // Dealer action: approve or request changes
    changes_requested: ['design_revised'],
    design_revised: [],              // Dealer action: approve or request changes again
    approved: [],                    // Terminal state for project phase
  };
  return transitions[current] || [];
}

/* Valid next statuses that an admin can transition an order to */
export function getValidNextOrderStatuses(current: OrderStatus): OrderStatus[] {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    pending_order_payment: ['order_paid'],
    order_paid: ['sent_to_factory'],
    sent_to_factory: ['acknowledgement_review'],
    acknowledgement_review: [],        // Dealer action: approve or request changes
    acknowledgement_changes: ['acknowledgement_review'],  // Admin re-uploads revised ack
    acknowledgement_approved: ['in_production'],
    in_production: ['shipped'],
    shipped: ['pending_shipping_payment', 'delivered'],
    pending_shipping_payment: ['shipping_paid'],
    shipping_paid: ['delivered'],
    delivered: [],                     // Terminal state
  };
  return transitions[current] || [];
}

/* Human-readable status labels */
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  in_design: 'In Design',
  design_delivered: 'Design Delivered',
  changes_requested: 'Changes Requested',
  design_revised: 'Design Revised',
  approved: 'Approved',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_order_payment: 'Pending Order Payment',
  order_paid: 'Order Paid',
  sent_to_factory: 'Sent to Factory',
  acknowledgement_review: 'Ack. Review',
  acknowledgement_changes: 'Ack. Changes',
  acknowledgement_approved: 'Ack. Approved',
  in_production: 'In Production',
  shipped: 'Shipped',
  pending_shipping_payment: 'Pending Shipping Payment',
  shipping_paid: 'Shipping Paid',
  delivered: 'Delivered',
};
