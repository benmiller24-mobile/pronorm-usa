import React from 'react';
import type { DesignPacketData, ValidationError, CountertopEntry } from '../../../lib/design-packet-types';
import { BACKSPLASH_MATERIALS, BACKSPLASH_HEIGHTS } from '../../../lib/design-packet-types';

interface Props {
  data: DesignPacketData;
  onChange: (data: DesignPacketData) => void;
  errors: ValidationError[];
}

export default function StepPlumbingSurfaces({ data, onChange }: Props) {
  const updateSink = (which: 'primarySink' | 'prepSink', field: string, value: string) => {
    onChange({ ...data, [which]: { ...data[which], [field]: value } });
  };

  const updateCountertop = (index: number, field: keyof CountertopEntry, value: string) => {
    const updated = [...data.countertops];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...data, countertops: updated });
  };

  const updateBacksplash = (field: string, value: string) => {
    onChange({ ...data, backsplash: { ...data.backsplash, [field]: value } });
  };

  return (
    <div>
      <h2 style={sectionTitle}>Plumbing & Surfaces</h2>
      <p style={sectionDesc}>Specify sink, countertop, and backsplash details.</p>

      {/* Plumbing Fixtures */}
      <h3 style={subTitle}>Plumbing Fixtures</h3>

      <SinkSection label="Primary Sink" sink={data.primarySink} onChange={(f, v) => updateSink('primarySink', f, v)} />
      <SinkSection label="Prep Sink" sink={data.prepSink} onChange={(f, v) => updateSink('prepSink', f, v)} />

      {/* Countertops */}
      <div style={{ borderTop: '1px solid #e8e4df', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
        <h3 style={subTitle}>Countertops</h3>

        {data.countertops.map((ct, i) => (
          <div key={i} style={cardStyle}>
            <span style={cardLabel}>{ct.label || `Countertop ${i + 1}`}</span>
            <div style={grid2}>
              <Field label="Material">
                <input style={inputStyle} type="text" value={ct.material} onChange={e => updateCountertop(i, 'material', e.target.value)} placeholder="e.g. Neolith, Quartz" />
              </Field>
              <Field label="Color">
                <input style={inputStyle} type="text" value={ct.color} onChange={e => updateCountertop(i, 'color', e.target.value)} placeholder="e.g. Himalayan Crystal" />
              </Field>
            </div>
            <div style={grid2}>
              <Field label="Thickness">
                <input style={inputStyle} type="text" value={ct.thickness} onChange={e => updateCountertop(i, 'thickness', e.target.value)} placeholder="e.g. 12mm" />
              </Field>
              <Field label="Special Details">
                <input style={inputStyle} type="text" value={ct.specialDetails} onChange={e => updateCountertop(i, 'specialDetails', e.target.value)} placeholder="e.g. miter edge 50mm, waterfall" />
              </Field>
            </div>
          </div>
        ))}
      </div>

      {/* Backsplash */}
      <div style={{ borderTop: '1px solid #e8e4df', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
        <h3 style={subTitle}>Backsplash</h3>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Material</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {BACKSPLASH_MATERIALS.map(bm => (
              <label key={bm.value} style={chipStyle(data.backsplash.material === bm.value)}>
                <input type="radio" name="backsplashMat" value={bm.value} checked={data.backsplash.material === bm.value}
                  onChange={() => updateBacksplash('material', bm.value)} style={{ display: 'none' }} />
                {bm.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Height</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {BACKSPLASH_HEIGHTS.map(bh => (
              <label key={bh.value} style={chipStyle(data.backsplash.height === bh.value)}>
                <input type="radio" name="backsplashHt" value={bh.value} checked={data.backsplash.height === bh.value}
                  onChange={() => updateBacksplash('height', bh.value)} style={{ display: 'none' }} />
                {bh.label}
              </label>
            ))}
          </div>
          {data.backsplash.height === 'custom' && (
            <div style={{ marginTop: '0.75rem' }}>
              <input style={inputStyle} type="text" value={data.backsplash.customHeight || ''} onChange={e => updateBacksplash('customHeight', e.target.value)} placeholder="e.g. 200 mm" />
            </div>
          )}
        </div>

        <Field label="Color">
          <input style={inputStyle} type="text" value={data.backsplash.color} onChange={e => updateBacksplash('color', e.target.value)} placeholder="e.g. Himalayan Crystal" />
        </Field>
      </div>
    </div>
  );
}

// ── Sink Sub-component ──

function SinkSection({ label, sink, onChange }: {
  label: string;
  sink: { bowlType: string; mountingType: string; dimensions: string; colorFinish: string };
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div style={cardStyle}>
      <span style={cardLabel}>{label}</span>
      <div style={grid2}>
        <Field label="Single or Double Bowl">
          <select style={inputStyle} value={sink.bowlType} onChange={e => onChange('bowlType', e.target.value)}>
            <option value="">Select...</option>
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="large_single">Large Single</option>
          </select>
        </Field>
        <Field label="Mounting Type">
          <input style={inputStyle} type="text" value={sink.mountingType} onChange={e => onChange('mountingType', e.target.value)} placeholder="e.g. Undermount, Drop-in" />
        </Field>
      </div>
      <div style={grid2}>
        <Field label="Dimensions (mm)">
          <input style={inputStyle} type="text" value={sink.dimensions} onChange={e => onChange('dimensions', e.target.value)} placeholder="e.g. 810 x 480 mm" />
        </Field>
        <Field label="Color / Finish">
          <input style={inputStyle} type="text" value={sink.colorFinish} onChange={e => onChange('colorFinish', e.target.value)} placeholder="e.g. Stainless Steel" />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.35rem', fontWeight: 400, marginBottom: '0.25rem', color: '#1a1a1a' };
const sectionDesc: React.CSSProperties = { fontSize: '0.82rem', color: '#8a8279', marginBottom: '1.5rem' };
const subTitle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.6rem' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.3rem' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.87rem',
  border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa',
  color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' };
const cardStyle: React.CSSProperties = { padding: '1rem 1.25rem', marginBottom: '0.75rem', border: '1px solid #e8e4df', borderRadius: '4px', background: '#fdfcfa' };
const cardLabel: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.75rem' };

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 500,
    border: `1.5px solid ${active ? '#b87333' : '#d4cdc5'}`, borderRadius: '3px', cursor: 'pointer',
    background: active ? 'rgba(184,115,51,0.08)' : '#fdfcfa', color: active ? '#b87333' : '#4a4a4a',
    fontFamily: 'inherit', transition: 'all 0.15s ease',
  };
}
