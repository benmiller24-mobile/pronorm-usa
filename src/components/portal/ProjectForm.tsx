import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Dealer } from '../../lib/types';
import FileUploader from './ui/FileUploader';

// Structured spec shapes stored under projects.design_packet_data.specs.
// All fields optional so dealers can fill in what they know and ship later.
// specFile is only used in-form; on submit it is uploaded and its storage
// path is persisted back onto the row as specFilePath (plus a row in
// project_files so it shows in the Files list).
interface ApplianceRow {
  type: string;
  brand: string;
  model: string;
  dimensions: string;
  notes: string;
  specFile: File | null;
}
interface HardwareBlock {
  style: string; brand: string; model: string; finish: string; notes: string;
}
interface PlumbingRow {
  type: string; brand: string; model: string; finish: string; notes: string;
}

const emptyAppliance = (): ApplianceRow => ({
  type: '', brand: '', model: '', dimensions: '', notes: '', specFile: null,
});
const emptyPlumbing  = (): PlumbingRow  => ({ type: '', brand: '', model: '', finish: '', notes: '' });

interface ProjectFormProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

// Build a human-readable label for an appliance's spec PDF so the
// project_files list reads "Wolf DF366 Range — spec.pdf" rather than
// an opaque filename. Falls back gracefully when fields are blank.
function applianceSpecLabel(a: ApplianceRow, rawName: string): string {
  const parts = [a.brand, a.model || a.type].filter(Boolean);
  const prefix = parts.length ? parts.join(' ') : (a.type || 'Appliance');
  return `${prefix} — ${rawName}`;
}

// Slugify for storage paths so they stay URL-safe.
function slugify(s: string): string {
  return (s || 'appliance').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'appliance';
}

export default function ProjectForm({ dealer, onNavigate }: ProjectFormProps) {
  const [jobName, setJobName] = useState('');
  const [clientName, setClientName] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  // Appliances are row-based and each row can carry its own spec PDF.
  const [appliances, setAppliances] = useState<ApplianceRow[]>([emptyAppliance()]);
  const [hardware, setHardware] = useState<HardwareBlock>({ style: '', brand: '', model: '', finish: '', notes: '' });
  const [plumbing, setPlumbing] = useState<PlumbingRow[]>([emptyPlumbing()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // One hidden <input type="file"> per appliance row, triggered by its button.
  // We key refs by row index; React re-indexes when a row is removed, which is
  // fine because we only use the ref imperatively inside the button handler.
  const specInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName.trim()) { setError('Job name is required.'); return; }
    setSubmitting(true);
    setError('');

    try {
      // A row counts as "content" if ANY field OR a spec file is present.
      const cleanedAppliancesInput = appliances.filter(a =>
        a.type || a.brand || a.model || a.dimensions || a.notes || a.specFile
      );
      const cleanedPlumbing = plumbing.filter(p =>
        p.type || p.brand || p.model || p.finish || p.notes
      );
      const hardwareHasContent = !!(hardware.style || hardware.brand || hardware.model || hardware.finish || hardware.notes);

      // Build the version of appliances we'll persist to the DB. We strip the
      // File object (it's not serializable) and leave a specFilePath slot we
      // populate AFTER uploads succeed.
      type PersistedAppliance = Omit<ApplianceRow, 'specFile'> & { specFilePath: string | null };
      const persistedAppliances: PersistedAppliance[] = cleanedAppliancesInput.map(a => ({
        type: a.type, brand: a.brand, model: a.model,
        dimensions: a.dimensions, notes: a.notes, specFilePath: null,
      }));

      const hasAnySpecs =
        persistedAppliances.length > 0 || cleanedPlumbing.length > 0 || hardwareHasContent;

      // Create project first so we can parent-link files by project.id.
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          dealer_id: dealer.id,
          job_name: jobName.trim(),
          client_name: clientName.trim(),
          message: message.trim(),
          design_packet_data: hasAnySpecs ? {
            specs: {
              appliances: persistedAppliances,
              hardware: hardwareHasContent ? hardware : null,
              plumbing: cleanedPlumbing,
            },
          } : null,
        })
        .select()
        .single();

      if (projErr || !project) throw projErr || new Error('Failed to create project');

      // Upload general design packet files.
      for (const file of files) {
        const path = `${dealer.id}/${project.id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file);
        if (uploadErr) {
          console.error('File upload error:', uploadErr);
          continue;
        }
        await supabase.from('project_files').insert({
          project_id: project.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          category: 'submission',
          uploaded_by: 'dealer',
        });
      }

      // Upload each appliance's spec sheet (if present) and link the storage
      // path back into the persistedAppliances array we'll update below.
      for (let i = 0; i < cleanedAppliancesInput.length; i++) {
        const a = cleanedAppliancesInput[i];
        if (!a.specFile) continue;
        const file = a.specFile;
        const slug = slugify([a.brand, a.model, a.type].filter(Boolean).join('-'));
        const path = `${dealer.id}/${project.id}/appliance-${slug}-${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file);
        if (uploadErr) {
          console.error('Appliance spec upload error:', uploadErr);
          continue;
        }
        await supabase.from('project_files').insert({
          project_id: project.id,
          file_name: applianceSpecLabel(a, file.name),
          file_path: path,
          file_type: file.type || 'application/pdf',
          file_size: file.size,
          category: 'appliance_spec',
          uploaded_by: 'dealer',
        });
        persistedAppliances[i].specFilePath = path;
      }

      // If any spec files attached, re-persist design_packet_data so the JSON
      // now includes the resolved specFilePath per appliance. Skip the update
      // when nothing changed to avoid an unnecessary round-trip.
      const anySpecPaths = persistedAppliances.some(a => a.specFilePath);
      if (anySpecPaths && hasAnySpecs) {
        await supabase
          .from('projects')
          .update({
            design_packet_data: {
              specs: {
                appliances: persistedAppliances,
                hardware: hardwareHasContent ? hardware : null,
                plumbing: cleanedPlumbing,
              },
            },
          })
          .eq('id', project.id);
      }

      onNavigate(`/dealer-portal/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem',
    border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa',
    color: '#1a1a1a', fontFamily: 'inherit', outline: 'none',
  };

  const smallInputStyle: React.CSSProperties = { ...inputStyle, padding: '0.5rem 0.7rem', fontSize: '0.82rem' };
  const sectionStyle: React.CSSProperties = {
    marginBottom: '2rem', padding: '1.25rem', background: '#fdfcfa',
    border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px',
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: '"Cormorant Garamond", Georgia, serif',
    fontSize: '1.15rem', fontWeight: 500, marginBottom: '0.25rem',
  };
  const sectionHelpStyle: React.CSSProperties = {
    fontSize: '0.78rem', color: '#8a8279', marginBottom: '0.85rem',
  };
  const rowRemoveBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: '#8a8279', fontSize: '0.72rem',
    fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
  };
  const addRowBtn: React.CSSProperties = {
    marginTop: '0.5rem', background: 'none', border: '1.5px dashed #d4cdc5', color: '#b87333',
    padding: '0.5rem 1rem', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
  };
  const attachBtnStyle: React.CSSProperties = {
    background: 'none', border: '1.5px solid #d4cdc5', color: '#b87333',
    padding: '0.35rem 0.8rem', fontSize: '0.72rem', fontWeight: 600,
    letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: '3px',
    cursor: 'pointer', fontFamily: 'inherit',
  };
  const attachedFileStyle: React.CSSProperties = {
    fontSize: '0.78rem', color: '#4a4a4a', fontStyle: 'italic',
  };
  const clearAttachBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: '#8a8279',
    fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
    marginLeft: '0.5rem', textDecoration: 'underline',
  };

  return (
    <div>
      <button onClick={() => onNavigate('/dealer-portal/projects')} style={{
        background: 'none', border: 'none', color: '#b87333', fontSize: '0.78rem', fontWeight: 600,
        cursor: 'pointer', marginBottom: '1rem', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>&larr; Back to Projects</button>

      <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400, marginBottom: '0.35rem' }}>
        Submit New Project
      </h1>
      <p style={{ fontSize: '0.85rem', color: '#8a8279', marginBottom: '2rem' }}>
        Provide job details and upload your design packet (questionnaire, appliance list, drawings, accessories).
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: '700px' }}>
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fdf0ef', border: '1px solid #f5c6cb', color: '#c44536', fontSize: '0.82rem', borderRadius: '3px', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>Job Name *</label>
            <input type="text" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="e.g. Miller Kitchen" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Client Name</label>
            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. John & Jane Miller" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>Message / Notes</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe the project scope, special requirements, timeline needs, etc."
            rows={5}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={labelStyle}>Design Packet Files</label>
          <p style={{ fontSize: '0.82rem', color: '#8a8279', marginBottom: '0.75rem' }}>
            Upload your completed questionnaire, appliance list, kitchen drawings/renders, and interior accessories document.
          </p>
          <FileUploader onFilesSelected={setFiles} />
        </div>

        {/* Appliances (optional) */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Appliances <span style={{ fontSize: '0.7rem', color: '#8a8279', fontWeight: 400 }}>(optional)</span></h3>
          <p style={sectionHelpStyle}>
            List each appliance you know so far. Attach a spec-sheet PDF per appliance so the Pronorm design team has exact dimensions and cutouts.
          </p>

          {appliances.map((a, i) => (
            <div key={i} style={{ padding: '0.75rem', border: '1px solid #e8e2d9', borderRadius: '3px', marginBottom: '0.6rem', background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <input type="text" placeholder="Type (e.g. Range)" value={a.type}
                  onChange={e => setAppliances(rows => rows.map((r, j) => j === i ? { ...r, type: e.target.value } : r))}
                  style={smallInputStyle} />
                <input type="text" placeholder="Brand" value={a.brand}
                  onChange={e => setAppliances(rows => rows.map((r, j) => j === i ? { ...r, brand: e.target.value } : r))}
                  style={smallInputStyle} />
                <input type="text" placeholder="Model #" value={a.model}
                  onChange={e => setAppliances(rows => rows.map((r, j) => j === i ? { ...r, model: e.target.value } : r))}
                  style={smallInputStyle} />
                <input type="text" placeholder={'Dimensions (e.g. 36")'} value={a.dimensions}
                  onChange={e => setAppliances(rows => rows.map((r, j) => j === i ? { ...r, dimensions: e.target.value } : r))}
                  style={smallInputStyle} />
              </div>
              <input type="text" placeholder="Notes (optional)" value={a.notes}
                onChange={e => setAppliances(rows => rows.map((r, j) => j === i ? { ...r, notes: e.target.value } : r))}
                style={{ ...smallInputStyle, marginBottom: '0.6rem' }} />

              {/* Per-row PDF attachment */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <input
                  ref={el => { specInputRefs.current[i] = el; }}
                  type="file"
                  accept="application/pdf,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                    setAppliances(rows => rows.map((r, j) => j === i ? { ...r, specFile: file } : r));
                    // Allow re-selecting the same file name after a clear.
                    if (e.target) e.target.value = '';
                  }}
                />
                <button type="button" style={attachBtnStyle}
                  onClick={() => specInputRefs.current[i]?.click()}>
                  {a.specFile ? 'Replace spec sheet' : 'Attach spec sheet (PDF)'}
                </button>
                {a.specFile && (
                  <>
                    <span style={attachedFileStyle}>{a.specFile.name}</span>
                    <button type="button" style={clearAttachBtn}
                      onClick={() => setAppliances(rows => rows.map((r, j) => j === i ? { ...r, specFile: null } : r))}>
                      remove
                    </button>
                  </>
                )}
              </div>

              {appliances.length > 1 && (
                <button type="button" style={rowRemoveBtn}
                  onClick={() => setAppliances(rows => rows.filter((_, j) => j !== i))}>
                  Remove appliance
                </button>
              )}
            </div>
          ))}
          <button type="button" style={addRowBtn}
            onClick={() => setAppliances(rows => [...rows, emptyAppliance()])}>
            + Add another appliance
          </button>
        </div>

        {/* Hardware (optional) */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Hardware <span style={{ fontSize: '0.7rem', color: '#8a8279', fontWeight: 400 }}>(optional)</span></h3>
          <p style={sectionHelpStyle}>Cabinet pulls / knobs.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input type="text" placeholder="Style (e.g. Pulls, Knobs)" value={hardware.style}
              onChange={e => setHardware(h => ({ ...h, style: e.target.value }))} style={smallInputStyle} />
            <input type="text" placeholder="Brand" value={hardware.brand}
              onChange={e => setHardware(h => ({ ...h, brand: e.target.value }))} style={smallInputStyle} />
            <input type="text" placeholder="Model #" value={hardware.model}
              onChange={e => setHardware(h => ({ ...h, model: e.target.value }))} style={smallInputStyle} />
            <input type="text" placeholder="Finish" value={hardware.finish}
              onChange={e => setHardware(h => ({ ...h, finish: e.target.value }))} style={smallInputStyle} />
          </div>
          <input type="text" placeholder="Notes (optional)" value={hardware.notes}
            onChange={e => setHardware(h => ({ ...h, notes: e.target.value }))} style={smallInputStyle} />
        </div>

        {/* Plumbing (optional) */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Plumbing <span style={{ fontSize: '0.7rem', color: '#8a8279', fontWeight: 400 }}>(optional)</span></h3>
          <p style={sectionHelpStyle}>Faucets, pot fillers, disposals, etc.</p>

          {plumbing.map((p, i) => (
            <div key={i} style={{ padding: '0.75rem', border: '1px solid #e8e2d9', borderRadius: '3px', marginBottom: '0.6rem', background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <input type="text" placeholder="Type (e.g. Main Sink Faucet)" value={p.type}
                  onChange={e => setPlumbing(rows => rows.map((r, j) => j === i ? { ...r, type: e.target.value } : r))}
                  style={smallInputStyle} />
                <input type="text" placeholder="Brand" value={p.brand}
                  onChange={e => setPlumbing(rows => rows.map((r, j) => j === i ? { ...r, brand: e.target.value } : r))}
                  style={smallInputStyle} />
                <input type="text" placeholder="Model #" value={p.model}
                  onChange={e => setPlumbing(rows => rows.map((r, j) => j === i ? { ...r, model: e.target.value } : r))}
                  style={smallInputStyle} />
                <input type="text" placeholder="Finish" value={p.finish}
                  onChange={e => setPlumbing(rows => rows.map((r, j) => j === i ? { ...r, finish: e.target.value } : r))}
                  style={smallInputStyle} />
              </div>
              <input type="text" placeholder="Notes (optional)" value={p.notes}
                onChange={e => setPlumbing(rows => rows.map((r, j) => j === i ? { ...r, notes: e.target.value } : r))}
                style={{ ...smallInputStyle, marginBottom: '0.4rem' }} />
              {plumbing.length > 1 && (
                <button type="button" style={rowRemoveBtn}
                  onClick={() => setPlumbing(rows => rows.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" style={addRowBtn}
            onClick={() => setPlumbing(rows => [...rows, emptyPlumbing()])}>
            + Add another plumbing fixture
          </button>
        </div>

        <button type="submit" disabled={submitting} style={{
          padding: '0.85rem 2.5rem', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', background: submitting ? '#d4cdc5' : '#b87333', color: '#fdfcfa',
          border: 'none', borderRadius: '3px', cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}>
          {submitting ? 'Submitting...' : 'Submit Project'}
        </button>
      </form>
    </div>
  );
}
