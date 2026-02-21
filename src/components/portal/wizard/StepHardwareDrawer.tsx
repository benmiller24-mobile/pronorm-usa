import React from 'react';
import type { DesignPacketData, ValidationError } from '../../../lib/design-packet-types';
import { DRAWERBOX_OPTIONS, TOEKICK_MATERIALS } from '../../../lib/design-packet-types';

interface Props {
  data: DesignPacketData;
  onChange: (data: DesignPacketData) => void;
  errors: ValidationError[];
}

export default function StepHardwareDrawer({ data, onChange, errors }: Props) {
  const hw = data.hardwareDetails;
  const dt = data.drawerToekick;

  const updateHw = (field: string, value: string | boolean) => {
    onChange({ ...data, hardwareDetails: { ...hw, [field]: value } });
  };
  const updateDt = (field: string, value: string | boolean) => {
    onChange({ ...data, drawerToekick: { ...dt, [field]: value } });
  };

  const err = (field: string) => errors.find(e => e.field === field)?.message;

  return (
    <div>
      <h2 style={sectionTitle}>Hardware, Drawer & Toekick</h2>
      <p style={sectionDesc}>Specify hardware selections, drawerbox type, and toekick preferences.</p>

      {/* Hardware Section */}
      <h3 style={subTitle}>Hardware</h3>
      <p style={hintText}>Include codes and/or finishes where possible.</p>

      <div style={grid2}>
        <Field label="Pulls — Code">
          <input style={inputStyle} type="text" value={hw.pullsCode} onChange={e => updateHw('pullsCode', e.target.value)} placeholder="e.g. 843" />
        </Field>
        <Field label="Pulls — Finish">
          <input style={inputStyle} type="text" value={hw.pullsFinish} onChange={e => updateHw('pullsFinish', e.target.value)} placeholder="e.g. Brushed Brass" />
        </Field>
      </div>
      <div style={grid2}>
        <Field label="Knobs — Code">
          <input style={inputStyle} type="text" value={hw.knobsCode} onChange={e => updateHw('knobsCode', e.target.value)} placeholder="Code" />
        </Field>
        <Field label="Knobs — Finish">
          <input style={inputStyle} type="text" value={hw.knobsFinish} onChange={e => updateHw('knobsFinish', e.target.value)} placeholder="Finish" />
        </Field>
      </div>

      <label style={checkboxLabel}>
        <input type="checkbox" checked={hw.tipOnPushToOpen} onChange={e => updateHw('tipOnPushToOpen', e.target.checked)} style={checkboxStyle} />
        Tip-On / Push to Open
      </label>

      <div style={{ ...grid2, marginTop: '1rem' }}>
        <Field label="X-Gola Channel Color">
          <input style={inputStyle} type="text" value={hw.xGolaChannelColor} onChange={e => updateHw('xGolaChannelColor', e.target.value)} placeholder="Color" />
        </Field>
        <Field label="Y-Line Metal Edge Color">
          <input style={inputStyle} type="text" value={hw.yLineMetalEdgeColor} onChange={e => updateHw('yLineMetalEdgeColor', e.target.value)} placeholder="Color" />
        </Field>
      </div>

      {/* Drawerbox Section */}
      <div style={{ borderTop: '1px solid #e8e4df', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
        <h3 style={subTitle}>Drawerbox — ProTech X</h3>
        <p style={hintText}>Select your drawer system from the ProTech X range.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
          {DRAWERBOX_OPTIONS.map(opt => (
            <label key={opt.value} style={{ ...checkboxLabel, padding: '0.5rem 0.75rem', border: `1.5px solid ${dt.drawerboxSelection === opt.value ? '#b87333' : '#e8e4df'}`, borderRadius: '3px', background: dt.drawerboxSelection === opt.value ? 'rgba(184,115,51,0.05)' : 'transparent' }}>
              <input type="radio" name="drawerboxSel" value={opt.value} checked={dt.drawerboxSelection === opt.value}
                onChange={() => updateDt('drawerboxSelection', opt.value)} style={{ accentColor: '#b87333' }} />
              {opt.label}
            </label>
          ))}
        </div>

        <label style={checkboxLabel}>
          <input type="checkbox" checked={dt.nonSlipMats} onChange={e => updateDt('nonSlipMats', e.target.checked)} style={checkboxStyle} />
          Non-Slip Drawer Mats
        </label>
      </div>

      {/* Toekick Section */}
      <div style={{ borderTop: '1px solid #e8e4df', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
        <h3 style={subTitle}>Toekick</h3>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {TOEKICK_MATERIALS.map(tm => (
            <label key={tm.value} style={chipStyle(dt.toekickMaterial === tm.value)}>
              <input type="radio" name="toekick" value={tm.value} checked={dt.toekickMaterial === tm.value}
                onChange={() => updateDt('toekickMaterial', tm.value)} style={{ display: 'none' }} />
              {tm.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={labelStyleDef}>{label}</label>
      {children}
      {error && <span style={errStyleDef}>{error}</span>}
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.35rem', fontWeight: 400, marginBottom: '0.25rem', color: '#1a1a1a' };
const sectionDesc: React.CSSProperties = { fontSize: '0.82rem', color: '#8a8279', marginBottom: '1.5rem' };
const subTitle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.6rem' };
const hintText: React.CSSProperties = { fontSize: '0.78rem', color: '#8a8279', marginBottom: '1rem', marginTop: '-0.25rem' };
const labelStyleDef: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem',
  border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa',
  color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const errStyleDef: React.CSSProperties = { display: 'block', fontSize: '0.72rem', color: '#c44536', marginTop: '0.25rem' };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };
const checkboxLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#1a1a1a', cursor: 'pointer', marginBottom: '0.5rem' };
const checkboxStyle: React.CSSProperties = { accentColor: '#b87333', width: '16px', height: '16px' };

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 500,
    border: `1.5px solid ${active ? '#b87333' : '#d4cdc5'}`, borderRadius: '3px', cursor: 'pointer',
    background: active ? 'rgba(184,115,51,0.08)' : '#fdfcfa', color: active ? '#b87333' : '#4a4a4a',
    fontFamily: 'inherit', transition: 'all 0.15s ease',
  };
}
