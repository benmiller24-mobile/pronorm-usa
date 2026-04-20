import React, { useRef } from 'react';
import type { DesignPacketData, ValidationError, ApplianceEntry } from '../../../lib/design-packet-types';
import { APPLIANCE_TYPES } from '../../../lib/design-packet-types';

interface Props {
  data: DesignPacketData;
  onChange: (data: DesignPacketData) => void;
  errors: ValidationError[];
  /** In-memory spec PDFs keyed by appliance type (types are unique per project).
   *  File objects can't live in `data.appliances` because they're not JSON-serializable;
   *  the wizard holds them and uploads them on Save Draft or Submit. */
  specFiles: Record<string, File | null>;
  onSpecFileChange: (applianceType: string, file: File | null) => void;
}

export default function StepAppliances({ data, onChange, specFiles, onSpecFileChange }: Props) {
  const appliances = data.appliances;
  const selectedTypes = appliances.map(a => a.type);

  // One hidden <input type="file"> per row, keyed by appliance type (not index)
  // so the right input fires even if the user removed a row above it.
  const specInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const toggleAppliance = (type: string) => {
    if (selectedTypes.includes(type)) {
      onChange({ ...data, appliances: appliances.filter(a => a.type !== type) });
      // Drop any in-memory spec file for the removed row so we don't upload an orphan.
      onSpecFileChange(type, null);
    } else {
      onChange({
        ...data,
        appliances: [
          ...appliances,
          { type, manufacturer: '', modelNumber: '', dimensions: '', isPaneled: false, specFilePath: null, specFileName: null },
        ],
      });
    }
  };

  const updateAppliance = (index: number, field: keyof ApplianceEntry, value: string | boolean) => {
    const updated = [...appliances];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...data, appliances: updated });
  };

  const clearPersistedSpec = (index: number) => {
    const app = appliances[index];
    const updated = [...appliances];
    updated[index] = { ...updated[index], specFilePath: null, specFileName: null };
    onChange({ ...data, appliances: updated });
    onSpecFileChange(app.type, null);
  };

  return (
    <div>
      <h2 style={sectionTitle}>Appliances</h2>
      <p style={sectionDesc}>Select which appliances are included in this project, then fill in the details for each. Attach a spec-sheet PDF per appliance so the Pronorm design team has exact dimensions and cutouts.</p>

      <h3 style={subTitle}>Select Appliances</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.5rem' }}>
        {APPLIANCE_TYPES.map(type => (
          <label key={type} style={chipStyle(selectedTypes.includes(type))}>
            <input type="checkbox" checked={selectedTypes.includes(type)}
              onChange={() => toggleAppliance(type)} style={{ display: 'none' }} />
            {type}
          </label>
        ))}
      </div>

      {appliances.length > 0 && (
        <div>
          <h3 style={subTitle}>Appliance Details</h3>
          {appliances.map((app, i) => {
            const pendingFile = specFiles[app.type] || null;
            const hasPersisted = !!app.specFilePath;
            return (
              <div key={app.type} style={appCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a' }}>{app.type}</span>
                  <button type="button" onClick={() => toggleAppliance(app.type)} style={removeBtn}>Remove</button>
                </div>
                <div className="wizard-grid-2" style={grid4}>
                  <div>
                    <label style={labelStyle}>Manufacturer</label>
                    <input style={inputStyle} type="text" value={app.manufacturer} onChange={e => updateAppliance(i, 'manufacturer', e.target.value)} placeholder="e.g. Fisher Paykel" />
                  </div>
                  <div>
                    <label style={labelStyle}>Model #</label>
                    <input style={inputStyle} type="text" value={app.modelNumber} onChange={e => updateAppliance(i, 'modelNumber', e.target.value)} placeholder="e.g. T30IR905SP" />
                  </div>
                  <div>
                    <label style={labelStyle}>Dimensions</label>
                    <input style={inputStyle} type="text" value={app.dimensions} onChange={e => updateAppliance(i, 'dimensions', e.target.value)} placeholder="e.g. 756mm x 2029mm" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.15rem' }}>
                    <label style={checkboxLabel}>
                      <input type="checkbox" checked={app.isPaneled} onChange={e => updateAppliance(i, 'isPaneled', e.target.checked)} style={checkboxStyle} />
                      Paneled
                    </label>
                  </div>
                </div>

                {/* Per-row spec PDF attach */}
                <div style={specRow}>
                  <input
                    ref={el => { specInputRefs.current[app.type] = el; }}
                    type="file"
                    accept="application/pdf,.pdf"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                      onSpecFileChange(app.type, file);
                      // Reset so re-selecting the same filename re-triggers onChange.
                      if (e.target) e.target.value = '';
                    }}
                  />
                  <button type="button" style={attachBtnStyle}
                    onClick={() => specInputRefs.current[app.type]?.click()}>
                    {pendingFile || hasPersisted ? 'Replace spec sheet' : 'Attach spec sheet (PDF)'}
                  </button>
                  {pendingFile && (
                    <>
                      <span style={attachedFileStyle}>
                        <span style={{ color: '#b87333', marginRight: '0.3rem' }}>●</span>
                        {pendingFile.name}
                        <span style={pendingBadge}>pending upload</span>
                      </span>
                      <button type="button" style={clearAttachBtn}
                        onClick={() => onSpecFileChange(app.type, null)}>
                        remove
                      </button>
                    </>
                  )}
                  {!pendingFile && hasPersisted && (
                    <>
                      <span style={attachedFileStyle}>
                        <span style={{ color: '#5a9e4b', marginRight: '0.3rem' }}>✓</span>
                        {app.specFileName || 'Spec sheet attached'}
                      </span>
                      <button type="button" style={clearAttachBtn}
                        onClick={() => clearPersistedSpec(i)}>
                        remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {appliances.length === 0 && (
        <div style={emptyState}>
          Select appliances above to add their details. You can skip this step if no appliances are specified yet.
        </div>
      )}
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.35rem', fontWeight: 400, marginBottom: '0.25rem', color: '#1a1a1a' };
const sectionDesc: React.CSSProperties = { fontSize: '0.82rem', color: '#8a8279', marginBottom: '1.5rem' };
const subTitle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.6rem' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.3rem' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem',
  border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa',
  color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const grid4: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem' };
const checkboxLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#1a1a1a', cursor: 'pointer' };
const checkboxStyle: React.CSSProperties = { accentColor: '#b87333', width: '16px', height: '16px' };
const appCard: React.CSSProperties = {
  padding: '1rem 1.25rem', marginBottom: '0.75rem', border: '1px solid #e8e4df', borderRadius: '4px', background: '#fdfcfa',
};
const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#c44536', fontSize: '0.72rem', fontWeight: 600,
  cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'inherit',
};
const emptyState: React.CSSProperties = {
  padding: '2rem', textAlign: 'center', fontSize: '0.85rem', color: '#8a8279',
  border: '1.5px dashed #d4cdc5', borderRadius: '4px',
};
const specRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
  marginTop: '0.85rem', paddingTop: '0.7rem', borderTop: '1px dashed #e8e4df',
};
const attachBtnStyle: React.CSSProperties = {
  background: '#fdfcfa', border: '1.5px solid #b87333', color: '#b87333',
  fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
  padding: '0.45rem 0.9rem', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
};
const attachedFileStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', fontSize: '0.82rem', color: '#1a1a1a',
  maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const pendingBadge: React.CSSProperties = {
  marginLeft: '0.5rem', padding: '0.1rem 0.45rem', background: 'rgba(184,115,51,0.12)',
  color: '#b87333', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em',
  textTransform: 'uppercase', borderRadius: '2px',
};
const clearAttachBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8a8279', fontSize: '0.72rem',
  cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: 500,
    border: `1.5px solid ${active ? '#b87333' : '#d4cdc5'}`, borderRadius: '3px', cursor: 'pointer',
    background: active ? 'rgba(184,115,51,0.08)' : '#fdfcfa', color: active ? '#b87333' : '#4a4a4a',
    fontFamily: 'inherit', transition: 'all 0.15s ease',
  };
}
