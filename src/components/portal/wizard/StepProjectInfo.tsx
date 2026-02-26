import React from 'react';
import type { DesignPacketData, ValidationError } from '../../../lib/design-packet-types';
import { PROJECT_TYPES, SKU_SIZE_OPTIONS } from '../../../lib/design-packet-types';

interface Props {
  data: DesignPacketData;
  onChange: (data: DesignPacketData) => void;
  errors: ValidationError[];
}

export default function StepProjectInfo({ data, onChange, errors }: Props) {
  const info = data.generalInfo;
  const update = (field: string, value: string) => {
    onChange({ ...data, generalInfo: { ...info, [field]: value } });
  };
  const err = (field: string) => errors.find(e => e.field === field)?.message;

  return (
    <div>
      <h2 style={sectionTitle}>Project Information</h2>
      <p style={sectionDesc}>Enter the basic details for this project.</p>

      <div className="wizard-grid-2" style={grid2}>
        <Field label="Job Name *" error={err('jobName')}>
          <input style={inputStyle(!!err('jobName'))} type="text" value={info.jobName} onChange={e => update('jobName', e.target.value)} placeholder="e.g. Miller Kitchen" />
        </Field>
        <Field label="Client Name *" error={err('clientName')}>
          <input style={inputStyle(!!err('clientName'))} type="text" value={info.clientName} onChange={e => update('clientName', e.target.value)} placeholder="e.g. John & Jane Miller" />
        </Field>
      </div>

      <div className="wizard-grid-2" style={grid2}>
        <Field label="Cell Phone" error={err('cellPhone')}>
          <input style={inputStyle(false)} type="tel" value={info.cellPhone} onChange={e => update('cellPhone', e.target.value)} placeholder="e.g. 480-993-9224" />
        </Field>
        <Field label="Email" error={err('email')}>
          <input style={inputStyle(false)} type="email" value={info.email} onChange={e => update('email', e.target.value)} placeholder="e.g. ben@company.com" />
        </Field>
      </div>

      <Field label="Job Address *" error={err('jobAddress')}>
        <input style={inputStyle(!!err('jobAddress'))} type="text" value={info.jobAddress} onChange={e => update('jobAddress', e.target.value)} placeholder="Full street address, city, state, zip" />
      </Field>

      <Field label="Room *" error={err('room')}>
        <input style={inputStyle(!!err('room'))} type="text" value={info.room} onChange={e => update('room', e.target.value)} placeholder="e.g. Kitchen, Master Bath, Laundry" />
      </Field>

      <div style={{ borderTop: '1px solid #e8e4df', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
        <h3 style={subTitle}>Type of Project *</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {PROJECT_TYPES.map(pt => (
            <label key={pt.value} style={chipStyle(info.projectType === pt.value)}>
              <input type="radio" name="projectType" value={pt.value} checked={info.projectType === pt.value}
                onChange={() => update('projectType', pt.value)} style={{ display: 'none' }} />
              {pt.label}
            </label>
          ))}
        </div>
        {err('projectType') && <span style={errStyle}>{err('projectType')}</span>}
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <h3 style={subTitle}>SKU Size Selection *</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {SKU_SIZE_OPTIONS.map(s => (
            <label key={s.value} style={chipStyle(info.skuSize === s.value)}>
              <input type="radio" name="skuSize" value={s.value} checked={info.skuSize === s.value}
                onChange={() => update('skuSize', s.value)} style={{ display: 'none' }} />
              {s.label}
            </label>
          ))}
        </div>
        {err('skuSize') && <span style={errStyle}>{err('skuSize')}</span>}
      </div>
    </div>
  );
}

// ── Shared sub-components & styles ──

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <span style={errStyle}>{error}</span>}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.35rem', fontWeight: 400, marginBottom: '0.25rem', color: '#1a1a1a',
};
const sectionDesc: React.CSSProperties = {
  fontSize: '0.82rem', color: '#8a8279', marginBottom: '1.5rem',
};
const subTitle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.6rem',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
  textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem',
};
const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem',
  border: `1.5px solid ${hasError ? '#c44536' : '#d4cdc5'}`, borderRadius: '3px', background: '#fdfcfa',
  color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
});
const errStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', color: '#c44536', marginTop: '0.25rem',
};
const grid2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem',
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 500,
    border: `1.5px solid ${active ? '#b87333' : '#d4cdc5'}`, borderRadius: '3px', cursor: 'pointer',
    background: active ? 'rgba(184,115,51,0.08)' : '#fdfcfa', color: active ? '#b87333' : '#4a4a4a',
    fontFamily: 'inherit', transition: 'all 0.15s ease',
  };
}
