import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Dealer } from '../../lib/types';
import FileUploader from './ui/FileUploader';

// Structured spec shapes stored under projects.design_packet_data.specs.
// All fields optional so dealers can fill in what they know and ship later.
interface ApplianceRow {
  type: string; brand: string; model: string; dimensions: string; notes: string;
}
interface HardwareBlock {
  style: string; brand: string; model: string; finish: string; notes: string;
}
interface PlumbingRow {
  type: string; brand: string; model: string; finish: string; notes: string;
}

const emptyAppliance = (): ApplianceRow => ({ type: '', brand: '', model: '', dimensions: '', notes: '' });
const emptyPlumbing  = (): PlumbingRow  => ({ type: '', brand: '', model: '', finish: '', notes: '' });

interface ProjectFormProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

export default function ProjectForm({ dealer, onNavigate }: ProjectFormProps) {
  const [jobName, setJobName] = useState('');
  const [clientName, setClientName] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  // New: appliance / hardware / plumbing
  const [applianceSpecFiles, setApplianceSpecFiles] = useState<File[]>([]);
  const [appliances, setAppliances] = useState<ApplianceRow[]>([emptyAppliance()]);
  const [hardware, setHardware] = useState<HardwareBlock>({ style: '', brand: '', model: '', finish: '', notes: '' });
  const [plumbing, setPlumbing] = useState<PlumbingRow[]>([emptyPlumbing()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName.trim()) { setError('Job name is required.'); return; }
    setSubmitting(true);
    setError('');

    try {
      // Drop fully-empty spec rows so we don't persist noise.
      const cleanedAppliances = appliances.filter(a =>
        a.type || a.brand || a.model || a.dimensions || a.notes
      );
      const cleanedPlumbing = plumbing.filter(p =>
        p.type || p.brand || p.model || p.finish || p.notes
      );
      const hardwareHasContent = !!(hardware.style || hardware.brand || hardware.model || hardware.finish || hardware.notes);

      const specs = {
        appliances: cleanedAppliances,
        hardware: hardwareHasContent ? hardware : null,
        plumbing: cleanedPlumbing,
      };
      const hasAnySpecs =
        cleanedAppliances.length > 0 || cleanedPlumbing.length > 0 || hardwareHasContent;

      // Create project. Store structured specs inside the existing
      // design_packet_data JSONB column under a `specs` key.
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          dealer_id: dealer.id,
          job_name: jobName.trim(),
          client_name: clientName.trim(),
          message: message.trim(),
          design_packet_data: hasAnySpecs ? { specs } : null,
        })
        .select()
        .single();

      if (projErr || !project) throw projErr || new Error('Failed to create project');

      // Upload files
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

      // Upload appliance spec PDFs under their own category.
      for (const file of applianceSpecFiles) {
        const path = `${dealer.id}/${project.id}/appliance-${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file);
        if (uploadErr) {
          console.error('Appliance spec upload error:', uploadErr);
          continue;
        }
        await supabase.from('project_files').insert({
          project_id: project.id,
          file_name: file.name,
          file_path: path,
          file_type: file.type || 'application/pdf',
          file_size: file.size,
          category: 'appliance_spec',
          uploaded_by: 'dealer',
        });
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
            List each appliance you know so far. You can add spec-sheet PDFs below &mdash; they'll be attached alongside your drawings.
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
                style={{ ...smallInputStyle, marginBottom: '0.4rem' }} />
              {appliances.length > 1 && (
                <button type="button" style={rowRemoveBtn}
                  onClick={() => setAppliances(rows => rows.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" style={addRowBtn}
            onClick={() => setAppliances(rows => [...rows, emptyAppliance()])}>
            + Add another appliance
          </button>

          <div style={{ marginTop: '1rem' }}>
            <label style={{ ...labelStyle, marginTop: '0.5rem' }}>Appliance Spec Sheets (PDFs)</label>
            <FileUploader onFilesSelected={setApplianceSpecFiles} />
          </div>
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
