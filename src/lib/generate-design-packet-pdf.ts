import jsPDF from 'jspdf';
import type { DesignPacketData } from './design-packet-types';
import {
  PROJECT_TYPES, STYLE_OPTIONS, PRODUCT_LINES, INTERIOR_COLORS,
  DRAWERBOX_STD_OPTIONS, DRAWERBOX_WOOD_OPTIONS, TOEKICK_MATERIALS,
  BACKSPLASH_MATERIALS, BACKSPLASH_HEIGHTS, getOptionLabel,
} from './design-packet-types';

const COPPER = '#b87333';
const DARK = '#1a1a1a';
const MID = '#4a4a4a';
const LIGHT = '#8a8279';

export async function generateDesignPacketPDF(data: DesignPacketData, dealerName: string): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }
  }

  function drawHeader(text: string) {
    checkPage(14);
    doc.setFillColor(184, 115, 51);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(text.toUpperCase(), margin + 4, y + 5.5);
    y += 12;
    doc.setTextColor(26, 26, 26);
  }

  function drawRow(label: string, value: string) {
    if (!value) return;
    checkPage(7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(138, 130, 121);
    doc.text(label, margin + 2, y);
    doc.setTextColor(26, 26, 26);
    doc.text(value, margin + 52, y);
    y += 5.5;
  }

  function drawLine() {
    checkPage(4);
    doc.setDrawColor(228, 224, 223);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
  }

  // ── Title Block ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(184, 115, 51);
  doc.text('PRONORM USA', margin, y + 2);
  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(26, 26, 26);
  doc.text('Design Packet Summary', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(138, 130, 121);
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
  y += 10;
  drawLine();

  const g = data.generalInfo;
  const c = data.cabinetDetails;
  const h = data.hardwareDetails;
  const d = data.drawerToekick;
  const allDrawerOpts = [...DRAWERBOX_STD_OPTIONS, ...DRAWERBOX_WOOD_OPTIONS];

  // ── Project Information ──
  drawHeader('Project Information');
  drawRow('Dealer', dealerName);
  drawRow('Job Name', g.jobName);
  drawRow('Client Name', g.clientName);
  drawRow('Phone', g.cellPhone);
  drawRow('Email', g.email);
  drawRow('Address', g.jobAddress);
  drawRow('Room', g.room);
  drawRow('Project Type', getOptionLabel(PROJECT_TYPES, g.projectType));
  drawRow('Style', getOptionLabel(STYLE_OPTIONS, g.style));
  y += 3;

  // ── Cabinet Selection ──
  drawHeader('Cabinet Selection');
  drawRow('Product Line', getOptionLabel(PRODUCT_LINES, c.productLine));
  drawRow('Range Code', c.rangeCode);
  drawRow('Style Code', c.styleCode);
  drawRow('Door Price Group', c.doorPriceGroup);
  drawRow('Finish Color', c.finishColor);
  drawRow('Interior Color', getOptionLabel(INTERIOR_COLORS, c.interiorColor));
  drawRow('Finished Ends', c.finishedEnds ? 'Yes' : 'No');
  drawRow('Paneled Ends', c.paneledEnds ? 'Yes' : 'No');
  y += 3;

  // ── Hardware, Drawer & Toekick ──
  drawHeader('Hardware, Drawer & Toekick');
  if (h.pullsCode || h.pullsFinish) drawRow('Pulls', [h.pullsCode, h.pullsFinish].filter(Boolean).join(' — '));
  if (h.knobsCode || h.knobsFinish) drawRow('Knobs', [h.knobsCode, h.knobsFinish].filter(Boolean).join(' — '));
  if (h.tipOnPushToOpen) drawRow('Tip-On / Push to Open', 'Yes');
  if (h.xGolaChannelColor) drawRow('X-Gola Channel Color', h.xGolaChannelColor);
  if (h.yLineMetalEdgeColor) drawRow('Y-Line Metal Edge', h.yLineMetalEdgeColor);
  if (d.drawerboxCategory) {
    const catLabel = d.drawerboxCategory === 'std' ? 'STD' : 'Wood Laminate';
    const selLabel = d.drawerboxSelection ? getOptionLabel(allDrawerOpts, d.drawerboxSelection) : '';
    drawRow('Drawerbox', selLabel ? `${catLabel} — ${selLabel}` : catLabel);
  }
  drawRow('Non-Slip Mats', d.nonSlipMats ? 'Yes' : 'No');
  if (d.toekickMaterial) {
    drawRow('Toekick', `${getOptionLabel(TOEKICK_MATERIALS, d.toekickMaterial)}${d.toekickHeight ? ` (${d.toekickHeight})` : ''}`);
  }
  y += 3;

  // ── Appliances ──
  drawHeader(`Appliances (${data.appliances.length})`);
  if (data.appliances.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(138, 130, 121);
    doc.text('None specified', margin + 2, y);
    y += 6;
  } else {
    // Table header
    checkPage(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(74, 74, 74);
    doc.text('TYPE', margin + 2, y);
    doc.text('MANUFACTURER', margin + 38, y);
    doc.text('MODEL #', margin + 72, y);
    doc.text('DIMENSIONS', margin + 105, y);
    doc.text('PANELED', margin + 145, y);
    y += 2;
    drawLine();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(26, 26, 26);
    for (const a of data.appliances) {
      checkPage(7);
      doc.text(a.type, margin + 2, y);
      doc.text(a.manufacturer, margin + 38, y);
      doc.text(a.modelNumber, margin + 72, y);
      doc.text(a.dimensions, margin + 105, y);
      doc.text(a.isPaneled ? 'Yes' : '—', margin + 145, y);
      y += 5.5;
    }
  }
  y += 3;

  // ── Plumbing Fixtures ──
  const hasPrimary = data.primarySink.bowlType || data.primarySink.mountingType;
  const hasPrep = data.prepSink.bowlType || data.prepSink.mountingType;
  if (hasPrimary || hasPrep) {
    drawHeader('Plumbing Fixtures');
    if (hasPrimary) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Primary Sink', margin + 2, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      drawRow('Bowl Type', data.primarySink.bowlType);
      drawRow('Mounting', data.primarySink.mountingType);
      drawRow('Dimensions', data.primarySink.dimensions);
      drawRow('Color/Finish', data.primarySink.colorFinish);
    }
    if (hasPrep) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Prep Sink', margin + 2, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      drawRow('Bowl Type', data.prepSink.bowlType);
      drawRow('Mounting', data.prepSink.mountingType);
      drawRow('Dimensions', data.prepSink.dimensions);
      drawRow('Color/Finish', data.prepSink.colorFinish);
    }
    y += 3;
  }

  // ── Countertops ──
  const filledCountertops = data.countertops.filter(ct => ct.material || ct.color);
  if (filledCountertops.length > 0) {
    drawHeader('Countertops');
    for (const ct of filledCountertops) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(ct.label || 'Countertop', margin + 2, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      drawRow('Material', ct.material);
      drawRow('Color', ct.color);
      drawRow('Thickness', ct.thickness);
      if (ct.specialDetails) drawRow('Special Details', ct.specialDetails);
    }
    y += 3;
  }

  // ── Backsplash ──
  if (data.backsplash.material) {
    drawHeader('Backsplash');
    drawRow('Material', getOptionLabel(BACKSPLASH_MATERIALS, data.backsplash.material));
    drawRow('Height', getOptionLabel(BACKSPLASH_HEIGHTS, data.backsplash.height));
    if (data.backsplash.color) drawRow('Color', data.backsplash.color);
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(138, 130, 121);
    doc.text(`Pronorm USA — Design Packet Summary — Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  return doc.output('blob');
}
