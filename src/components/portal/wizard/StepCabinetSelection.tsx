import React from 'react';
import type { DesignPacketData, ValidationError } from '../../../lib/design-packet-types';
import { PRODUCT_LINES, INTERIOR_COLORS } from '../../../lib/design-packet-types';

interface Props {
  data: DesignPacketData;
  onChange: (data: DesignPacketData) => void;
  errors: ValidationError[];
}

export default function StepCabinetSelection({ data, onChange, errors }: Props) {
  const cab = data.cabinetDetails;
  const update = (field: string, value: string | boolean) => {
    onChange({ ...data, cabinetDetails: { ...cab, [field]: value } });
  };
  const err = (field: string) => errors.find(e => e.field === field)?.message;

  return (
    <div>
      <h2 style={sectionTitle}>Cabinet Selection</h2>
      <p style={sectionDesc}>Choose your Pronorm product line and cabinet specifications.</p>

      <h3 style={subTitle}>Product Line *</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {PRODUCT_LINES.map(pl => (
          <label key={pl.value} style={chipStyle(cab.productLine === pl.value)}>
            <input type="radio" name="productLine" value={pl.value} checked={cab.productLine === pl.value}
              onChange={() => update('productLine', pl.value)} style={{ display: 'none' }} />
            {pl.label}
          </label>
        ))}
      </div>
      {err('productLine') && <span style={errStyle}>{err('productLine')}</span>}

      <div style={{ ...grid2, marginTop: '1.25rem' }}>
        <Field label="Range Code (2-4 Letters) *" error={err('rangeCode')}>
          <input style={inputStyle(!!err('rangeCode'))} type="text" value={cab.rangeCode} onChange={e => update('rangeCode', e.target.value.toUpperCase())} placeholder="e.g. KS, KSLG" maxLength={4} />
        </Field>
        <Field label="Style Code (3-4 Digits) *" error={err('styleCode')}>
          <input style={inputStyle(!!err('styleCode'))} type="text" value={cab.styleCode} onChange={e => update('styleCode', e.target.value)} placeholder="e.g. 7090" maxLength={4} />
        </Field>
      </div>

      <div style={grid2}>
        <Field label="Door Price Group (0-10)" error={err('doorPriceGroup')}>
          <select style={inputStyle(false)} value={cab.doorPriceGroup} onChange={e => update('doorPriceGroup', e.target.value)}>
            <option value="">Select...</option>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i)}>{i}</option>
            ))}
          </select>
        </Field>
        <Field label="Finish Color *" error={err('finishColor')}>
          <input style={inputStyle(!!err('finishColor'))} type="text" value={cab.finishColor} onChange={e => update('finishColor', e.target.value)} placeholder="e.g. Mondial, Alpine White" />
        </Field>
      </div>

      <div style={{ borderTop: '1px solid #e8e4df', marginTop: '1.25rem', paddingTop: '1.25rem' }}>
        <h3 style={subTitle}>Box Details</h3>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Interior Color *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {INTERIOR_COLORS.map(ic => (
              <label key={ic.value} style={chipStyle(cab.interiorColor === ic.value)}>
                <input type="radio" name="interiorColor" value={ic.value} checked={cab.interiorColor === ic.value}
                  onChange={() => update('interiorColor', ic.value)} style={{ display: 'none' }} />
                {ic.label}
              </label>
            ))}
          </div>
          {err('interiorColor') && <span style={errStyle}>{err('interiorColor')}</span>}
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <label style={checkboxLabel}>
            <input type="checkbox" checked={cab.finishedEnds} onChange={e => update('finishedEnds', e.target.checked)} style={checkboxStyle} />
            Finished Ends {cab.interiorColor !== 'white' && <span style={{ fontSize: '0.72rem', color: '#8a8279' }}>(white interior only)</span>}
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" checked={cab.paneledEnds} onChange={e => update('paneledEnds', e.target.checked)} style={checkboxStyle} />
            Paneled Ends <span style={{ fontSize: '0.72rem', color: '#8a8279' }}>(all materials)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <span style={errStyle}>{error}</span>}
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.35rem', fontWeight: 400, marginBottom: '0.25rem', color: '#1a1a1a' };
const sectionDesc: React.CSSProperties = { fontSize: '0.82rem', color: '#8a8279', marginBottom: '1.5rem' };
const subTitle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.6rem' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' };
const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem',
  border: `1.5px solid ${hasError ? '#c44536' : '#d4cdc5'}`, borderRadius: '3px', background: '#fdfcfa',
  color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
});
const errStyle: React.CSSProperties = { display: 'block', fontSize: '0.72rem', color: '#c44536', marginTop: '0.25rem' };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };
const checkboxLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#1a1a1a', cursor: 'pointer' };
const checkboxStyle: React.CSSProperties = { accentColor: '#b87333', width: '16px', height: '16px' };

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 500,
    border: `1.5px solid ${active ? '#b87333' : '#d4cdc5'}`, borderRadius: '3px', cursor: 'pointer',
    background: active ? 'rgba(184,115,51,0.08)' : '#fdfcfa', color: active ? '#b87333' : '#4a4a4a',
    fontFamily: 'inherit', transition: 'all 0.15s ease',
  };
}
