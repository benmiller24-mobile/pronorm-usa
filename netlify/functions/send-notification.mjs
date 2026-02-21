import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'ben.miller24@gmail.com';
const PORTAL_URL = 'https://www.pronormusa.com';

const STATUS_LABELS = {
  // Project statuses
  submitted: 'Submitted',
  in_design: 'In Design',
  design_delivered: 'Design Delivered',
  changes_requested: 'Changes Requested',
  design_revised: 'Design Revised',
  approved: 'Approved',
  // Order statuses
  pending_order_payment: 'Pending Order Payment',
  order_paid: 'Order Paid',
  sent_to_factory: 'Sent to Factory',
  acknowledgement_review: 'Review Order Confirmation',
  acknowledgement_changes: 'Confirmation Changes Submitted',
  acknowledgement_approved: 'Confirmation Approved',
  in_production: 'In Production',
  shipped: 'Shipped',
  pending_shipping_payment: 'Pending Shipping Payment',
  shipping_paid: 'Shipping Paid',
  delivered: 'Delivered',
};

function label(status) {
  return STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildEmailHTML({ entityType, entityName, entityRef, oldStatus, newStatus, note, portalPath }) {
  const isProject = entityType === 'project';
  const heading = isProject ? 'Design Status Update' : 'Order Status Update';
  const typeLabel = isProject ? 'Project' : 'Order';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f4f0;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f0;padding:32px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;">
  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:24px 32px;">
    <span style="color:#b87333;font-size:22px;font-weight:400;font-family:Georgia,serif;letter-spacing:0.02em;">Pronorm USA</span>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:20px;font-weight:400;color:#1a1a1a;">${heading}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#4a4a4a;line-height:1.6;">
      ${typeLabel} <strong>${entityName}</strong>${entityRef ? ` (${entityRef})` : ''} has been updated.
    </p>
    <!-- Status Change -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td style="padding:12px 16px;background:#f7f4f0;border-radius:4px;">
        <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#8a8279;font-weight:600;">Status Change</span><br>
        <span style="font-size:15px;color:#4a4a4a;">${label(oldStatus)}</span>
        <span style="color:#b87333;font-weight:600;margin:0 8px;">&rarr;</span>
        <span style="font-size:15px;color:#1a1a1a;font-weight:600;">${label(newStatus)}</span>
      </td>
    </tr>
    </table>
    ${note ? `<p style="margin:0 0 24px;font-size:13px;color:#4a4a4a;line-height:1.5;padding:12px 16px;background:#fef9f0;border-left:3px solid #b87333;border-radius:2px;"><strong>Note:</strong> ${note}</p>` : ''}
    <!-- CTA -->
    <a href="${PORTAL_URL}${portalPath}" style="display:inline-block;padding:12px 28px;background:#b87333;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;border-radius:3px;">View ${typeLabel}</a>
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:20px 32px;background:#fdfcfa;border-top:1px solid #f0ebe4;">
    <p style="margin:0;font-size:11px;color:#8a8279;line-height:1.5;">
      Pronorm USA &mdash; German Fitted Kitchens<br>
      You are receiving this because you are part of the project team.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export const handler = async function (event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing Supabase credentials' }) };
  }
  if (!resendApiKey) {
    // Silently skip if Resend not configured yet
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Notifications disabled â no RESEND_API_KEY' }) };
  }

  // Verify JWT
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Missing authorization token' }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const anonClient = createClient(supabaseUrl, process.env.PUBLIC_SUPABASE_ANON_KEY || serviceRoleKey);
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);

  if (authErr || !user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { type, id, oldStatus, newStatus, note } = body;

  if (!type || !id || !oldStatus || !newStatus) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'type, id, oldStatus, and newStatus are required' }) };
  }

  try {
    let entityName = '';
    let entityRef = '';
    let dealerId = '';
    let portalPath = '';

    if (type === 'project') {
      const { data: project } = await supabaseAdmin.from('projects').select('*').eq('id', id).single();
      if (!project) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Project not found' }) };
      entityName = project.job_name || project.client_name || 'Untitled Project';
      entityRef = project.client_name && project.job_name ? project.client_name : '';
      dealerId = project.dealer_id;
      portalPath = `/dealer-portal/projects/${id}`;
    } else if (type === 'order') {
      const { data: order } = await supabaseAdmin.from('orders').select('*, projects(job_name)').eq('id', id).single();
      if (!order) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Order not found' }) };
      entityName = order.order_number || 'Order';
      entityRef = order.projects?.job_name || '';
      dealerId = order.dealer_id;
      portalPath = `/dealer-portal/orders/${id}`;
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'type must be "project" or "order"' }) };
    }

    // Get all recipients: dealer + linked designers + admin
    const { data: teamMembers } = await supabaseAdmin
      .from('dealers')
      .select('email, contact_name, role')
      .or(`id.eq.${dealerId},parent_dealer_id.eq.${dealerId}`);

    const recipientEmails = new Set();
    recipientEmails.add(ADMIN_EMAIL);
    if (teamMembers) {
      for (const m of teamMembers) {
        if (m.email) recipientEmails.add(m.email.toLowerCase());
      }
    }

    const emails = [...recipientEmails];
    if (emails.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No recipients found' }) };
    }

    const subject = type === 'project'
      ? `Design Update: ${entityName} â ${label(newStatus)}`
      : `Order Update: ${entityName} â ${label(newStatus)}`;

    const html = buildEmailHTML({
      entityType: type,
      entityName,
      entityRef,
      oldStatus,
      newStatus,
      note: note || '',
      portalPath,
    });

    // Send via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pronorm USA <notifications@pronormusa.com>',
        to: emails,
        subject,
        html,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult);
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ message: 'Status updated but email failed', error: resendResult }),
      };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ message: `Notifications sent to ${emails.length} recipients`, recipients: emails }),
    };
  } catch (err) {
    console.error('Notification error:', err);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ message: 'Status updated but notification failed', error: err.message }),
    };
  }
};
