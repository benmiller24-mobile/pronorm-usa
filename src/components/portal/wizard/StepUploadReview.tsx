import React, { useState } from 'react';
import type { DesignPacketData, ValidationError } from '../../../lib/design-packet-types';
import {
  PROJECT_TYPES, STYLE_OPTIONS, PRODUCT_LINES, INTERIOR_COLORS,
  DRAWERBOX_STD_OPTIONS, DRAWERBOX_WOOD_OPTIONS, TOEKICK_MATERIALS,
  BACKSPLASH_MATERIALS, BACKSPLASH_HEIGHTS, getOptionLabel,
} from '../../../lib/design-packet-types';
import FileUploader from '../ui/FileUploader';

interface Props {
  data: DesignPacketData;
  files: File[];
  onFilesSelected: (files: File[]) => void;
  errors: ValidationError[];
  dealerName: string;
}

export default function StepUploadReview({ data, files, onFilesSelected, errors, dealerName }: Props) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    project: true, cabinet: true, hardware: true, appliances: true, plumbing: true,
  });

  const toggle = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const fileErr = errors.find(e => e.field === 'files')?.message;
  const g = data.generalInfo;
  const c = data.cabinetDetails;
  const h = data.hardwareDetails;
  const d = data.drawerToekick;
  const bs = data.backsplash;
  const allDrawerOpts = [...DRAWERBOX_STD_OPTIONS, ...DRAWERBOX_WOOD_OPTIONS];

  return (
    <div>
      <h2 style={sectionTitle}>Upload Drawings & Review</h2>
      <p style={sectionDesc}>Upload your floor plan, elevations, and perspectives, then review all your answers before submitting.</p>

      {/* File Upload */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={subTitle}>Upload Drawings *</h3>
        <p style={hintText}>
          Upload floor plan, elevations, perspectives, and any other supporting documents. Drawings must include ceiling heights, soffit heights, wall lengths, and window/door sizes.
        </p>
        <FileUploader onFilesSelected={onFilesSelected} />
        {files.length > 0 && <p style={{ fontSize: '0.8rem', color: '#4a7c59', marginTop: '0.5rem' }}>{files.length} file(s) selected</p>}
        {fileErr && <span style={errStyle}>{fileErr}</span>}
      </div>

      {/* Review Summary */}
      <div style={{ borderTop: '1px solid #e8e4df', paddingTop: '1.5rem' }}>
        <h3 style={subTitle}>Review Your Answers</h3>
        <p style={hintText}>Please verify the information below is correct before submitting.</p>

        {/* Project Info */}
        <ReviewSection title="Project Information" section="project" expanded={expandedSections.project} onToggle={toggle}>
          <ReviewRow label="Dealer" value={dealerName} />
          <ReviewRow label="Job Name" value={g.jobName} />
          <ReviewRow label="Client Name" value={g.clientName} />
          <ReviewRow label="Phone" value={g.cellPhone} />
          <ReviewRow label="Email" value={g.email} />
          <ReviewRow label="Address" value={g.jobAddress} />
          <ReviewRow label="Room" value={g.room} />
          <ReviewRow label="Project Type" value={getOptionLabel(PROJECT_TYPES, g.projectType)} />
          <ReviewRow label="Style" value={getOptionLabel(STYLE_OPTIONS, g.style)} />
        </ReviewSection>

        {/* Cabinet Details */}
        <ReviewSection title="Cabinet Selection" section="cabinet" expanded={expandedSections.cabinet} onToggle={toggle}>
          <ReviewRow label="Product Line" value={getOptionLabel(PRODUCT_LINES, c.productLine)} />
          <ReviewRow label="Range Code" value={c.rangeCode} />
          <ReviewRow label="Style Code" value={c.styleCode} />
          <ReviewRow label="Door Price Group" value={c.doorPriceGroup} />
          <ReviewRow label="Finish Color" value={c.finishColor} />
          <ReviewRow label="Interior Color" value={getOptionLabel(INTERIOR_COLORS, c.interiorColor)} />
          <ReviewRow label="Finished Ends" value={c.finishedEnds ? 'Yes' : 'No'} />
          <ReviewRow label="Paneled Ends" value={c.paneledEnds ? 'Yes' : 'No'} />
        </ReviewSection>

        {/* Hardware, Drawer & Toekick */}
        <ReviewSection title="Hardware, Drawer & Toekick" section="hardware" expanded={expandedSections.hardware} onToggle={toggle}>
          {(h.pullsCode || h.pullsFinish) && <ReviewRow label="Pulls" value={[h.pullsCode, h.pullsFinish].filter(Boolean).join(' — ')} />}
          {(h.knobsCode || h.knobsFinish) && <ReviewRow label="Knobs" value={[h.knobsCode, h.knobsFinish].filter(Boolean).join(' — ')} />}
          {h.tipOnPushToOpen && <ReviewRow label="Tip-On / Push to Open" value="Yes" />}
          {h.xGolaChannelColor && <ReviewRow label="X-Gola Channel Color" value={h.xGolaChannelColor} />}
          {h.yLineMetalEdgeColor && <ReviewRow label="Y-Line Metal Edge Color" value={h.yLineMetalEdgeColor} />}
          {d.drawerboxCategory && <ReviewRow label="Drawerbox" value={`${d.drawerboxCategory === 'std' ? 'STD' : 'Wood Laminate'}${d.drawerboxSelection ? ` — ${getOptionLabel(allDrawerOpts, d.drawerboxSelection)}` : ''}`} />}
          <ReviewRow label="Non-Slip Mats" value={d.nonSlipMats ? 'Yes' : 'No'} />
          {d.toekickMaterial && <ReviewRow label="Toekick" value={`${getOptionLabel(TOEKICK_MATERIALS, d.toekickMaterial)}${d.toekickHeight ? ` (${d.toekickHeight})` : ''}`} />}
        </ReviewSection>

        {/* Appliances */}
        <ReviewSection title={`Appliances (${data.appliances.length})`} section="appliances" expanded={expandedSections.appliances} onToggle={toggle}>
          {data.appliances.length === 0 && <span style={{ fontSize: '0.82rem', color: '#8a8279' }}>None specified</span>}
          {data.appliances.map((a, i) => (
            <div key={i} style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: i < data.appliances.length - 1 ? '1px solid #f0ece7' : 'none' }}>
              <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{a.type}</span>
              <span style={{ fontSize: '0.8rem', color: '#4a4a4a', marginLeft: '0.75rem' }}>
                {[a.manufacturer, a.modelNumber, a.dimensions].filter(Boolean).join(' · ')}
                {a.isPaneled ? ' · Paneled' : ''}
              </span>
            </div>
          ))}
        </ReviewSection>

        {/* Plumbing & Surfaces */}
        <ReviewSection title="Plumbing & Surfaces" section="plumbing" expanded={expandedSections.plumbing} onToggle={toggle}>
          {(data.primarySink.bowlType || data.primarySink.mountingType) && (
            <>
              <span style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#4a4a4a' }}>Primary Sink</span>
              <ReviewRow label="Bowl Type" value={data.primarySink.bowlType} />
              <ReviewRow label="Mounting" value={data.primarySink.mountingType} />
              <ReviewRow label="Dimensions" value={data.primarySink.dimensions} />
              <ReviewRow label="Color/Finish" value={data.primarySink.colorFinish} />
            </>
          )}
          {(data.prepSink.bowlType || data.prepSink.mountingType) && (
            <>
              <span style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#4a4a4a', display: 'block', marginTop: '0.5rem' }}>Prep Sink</span>
              <ReviewRow label="Bowl Type" value={data.prepSink.bowlType} />
              <ReviewRow label="Mounting" value={data.prepSink.mountingType} />
            </>
          )}
          {data.countertops.filter(ct => ct.material || ct.color).map((ct, i) => (
            <React.Fragment key={i}>
              <span style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#4a4a4a', display: 'block', marginTop: '0.5rem' }}>{ct.label}</span>
              <ReviewRow label="Material" value={ct.material} />
              <ReviewRow label="Color" value={ct.color} />
              <ReviewRow label="Thickness" value={ct.thickness} />
              {ct.specialDetails && <ReviewRow label="Details" value={ct.specialDetails} />}
            </React.Fragment>
          ))}
          {bs.material && (
            <>
              <span style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#4a4a4a', display: 'block', marginTop: '0.5rem' }}>Backsplash</span>
              <ReviewRow label="Material" value={getOptionLabel(BACKSPLASH_MATERIALS, bs.material)} />
              <ReviewRow label="Height" value={getOptionLabel(BACKSPLASH_HEIGHTS, bs.height)} />
              {bs.color && <ReviewRow label="Color" value={bs.color} />}
            </>
          )}
        </ReviewSection>
      </div>
    </div>
  );
}

// ── Sub-components ──

function ReviewSection({ title, section, expanded, onToggle, children }: {
  title: string; section: string; expanded: boolean; onToggle: (s: string) => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '0.5rem', border: '1px solid #e8e4df', borderRadius: '4px', overflow: 'hidden' }}>
      <button type="button" onClick={() => onToggle(section)} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.7rem 1rem', background: '#fdfcfa', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1a1a' }}>{title}</span>
        <span style={{ fontSize: '0.75rem', color: '#8a8279' }}>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && <div style={{ padding: '0.5rem 1rem 0.75rem' }}>{children}</div>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: '0.75rem', padding: '0.2rem 0', fontSize: '0.82rem' }}>
      <span style={{ color: '#8a8279', minWidth: '120px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1a1a1a' }}>{value}</span>
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.35rem', fontWeight: 400, marginBottom: '0.25rem', color: '#1a1a1a' };
const sectionDesc: React.CSSProperties = { fontSize: '0.82rem', color: '#8a8279', marginBottom: '1.5rem' };
const subTitle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.6rem' };
const hintText: React.CSSProperties = { fontSize: '0.78rem', color: '#8a8279', marginBottom: '0.75rem', marginTop: '-0.25rem' };
const errStyle: React.CSSProperties = { display: 'block', fontSize: '0.72rem', color: '#c44536', marginTop: '0.25rem' };
