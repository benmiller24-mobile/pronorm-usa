import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Dealer } from '../../lib/types';
import FileUploader from './ui/FileUploader';

interface ProjectFormProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

export default function ProjectForm({ dealer, onNavigate }: ProjectFormProps) {
  const [jobName, setJobName] = useState('');
  const [clientName, setClientName] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName.trim()) { setError('Job name is required.'); return; }
    setSubmitting(true);
    setError('');

    try {
      // Create project
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({ dealer_id: dealer.id, job_name: jobName.trim(), client_name: clientName.trim(), message: message.trim() })
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
