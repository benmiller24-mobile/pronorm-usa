import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Project, ProjectFile, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';
import StatusTimeline from './ui/StatusTimeline';
import FileUploader from './ui/FileUploader';

interface ProjectDetailProps {
  projectId: string;
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

const STEP_LABELS: Record<string, string> = {
  submitted: 'Design Packet Submitted',
  in_design: 'Pronorm Designing',
  design_delivered: 'Design Delivered for Review',
  changes_requested: 'Changes Marked Up',
  design_revised: 'Design Revised',
  approved: 'Design Approved — Ready for Order',
};

const CATEGORY_LABELS: Record<string, string> = {
  submission: 'Your Design Packet',
  design_output: 'Design Output from Pronorm',
  dealer_markup: 'Your Marked-Up Changes',
  design_revision: 'Revised Design from Pronorm',
};

export default function ProjectDetail({ projectId, dealer, onNavigate }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [markupMode, setMarkupMode] = useState(false);
  const [markupFiles, setMarkupFiles] = useState<File[]>([]);
  const [markupNote, setMarkupNote] = useState('');
  const [submittingMarkup, setSubmittingMarkup] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    const [projRes, filesRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('project_files').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: true }),
    ]);
    setProject(projRes.data);
    setFiles(filesRes.data || []);
    setLoading(false);
  }

  const downloadFile = async (file: ProjectFile) => {
    const { data } = await supabase.storage.from('project-files').createSignedUrl(file.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleSubmitMarkup = async () => {
    if (!project || markupFiles.length === 0) return;
    setSubmittingMarkup(true);
    try {
      for (const file of markupFiles) {
        const path = `${dealer.id}/${project.id}/markup-${Date.now()}-${file.name}`;
        await supabase.storage.from('project-files').upload(path, file);
        await supabase.from('project_files').insert({
          project_id: project.id, file_name: file.name, file_path: path,
          file_type: file.type || 'application/octet-stream', file_size: file.size,
          category: 'dealer_markup', uploaded_by: 'dealer',
        });
      }
      await supabase.from('projects').update({
        status: 'changes_requested',
        admin_notes: markupNote ? (project.admin_notes ? project.admin_notes + '\n\n---\nDealer markup notes: ' + markupNote : 'Dealer markup notes: ' + markupNote) : project.admin_notes,
      }).eq('id', project.id);
      setMarkupMode(false); setMarkupFiles([]); setMarkupNote('');
      await loadData();
    } catch (err) { console.error(err); }
    setSubmittingMarkup(false);
  };

  const handleApprove = async () => {
    if (!project) return;
    setApproving(true);
    await supabase.from('projects').update({ status: 'approved' }).eq('id', project.id);
    await loadData();
    setApproving(false);
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#8a8279' }}>Loading...</div>;
  if (!project) return <div style={{ padding: '3rem', textAlign: 'center', color: '#c44536' }}>Project not found.</div>;

  // Build timeline dynamically
  const hasChanges = files.some(f => f.category === 'dealer_markup');
  const hasRevisions = files.some(f => f.category === 'design_revision');
  const baseSteps = ['submitted', 'in_design', 'design_delivered'];
  if (hasChanges) baseSteps.push('changes_requested');
  if (hasRevisions) baseSteps.push('design_revised');
  baseSteps.push('approved');

  const currentIdx = baseSteps.indexOf(project.status);
  const timelineSteps = baseSteps.map((step, i) => ({
    label: STEP_LABELS[step],
    status: (i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'upcoming') as 'completed' | 'active' | 'upcoming',
    date: step === 'submitted' ? new Date(project.created_at).toLocaleDateString() : undefined,
  }));

  // Group files by category
  const filesByCategory = files.reduce((acc, f) => {
    const cat = f.category || 'submission';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {} as Record<string, ProjectFile[]>);

  const canAct = ['design_delivered', 'design_revised'].includes(project.status);
  const cardStyle: React.CSSProperties = {
    padding: '1.5rem', background: '#fdfcfa', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '4px',
  };

  return (
    <div>
      <button onClick={() => onNavigate('/dealer-portal/projects')} style={{
        background: 'none', border: 'none', color: '#b87333', fontSize: '0.78rem', fontWeight: 600,
        cursor: 'pointer', marginBottom: '1rem', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>&larr; Back to Projects</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400 }}>{project.job_name}</h1>
        <StatusBadge status={project.status} />
      </div>
      {project.client_name && <p style={{ fontSize: '0.88rem', color: '#8a8279', marginBottom: '2rem' }}>Client: {project.client_name}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }} className="portal-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Action Banner */}
          {canAct && !markupMode && (
            <div style={{ ...cardStyle, background: '#fef9f0', borderLeft: '4px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.35rem' }}>Your Action Required</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.5, marginBottom: '1rem' }}>
                Review the design output package below. Approve the design to proceed to ordering, or upload marked-up files with your requested changes.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={handleApprove} disabled={approving} style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', background: approving ? '#d4cdc5' : '#4a7c59', color: '#fdfcfa',
                  border: 'none', borderRadius: '3px', cursor: approving ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>{approving ? 'Approving...' : 'Approve Design'}</button>
                <button onClick={() => setMarkupMode(true)} style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', background: 'transparent', color: '#4a4a4a',
                  border: '1.5px solid #d4cdc5', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
                }}>Request Changes</button>
              </div>
            </div>
          )}

          {/* Markup Form */}
          {markupMode && (
            <div style={{ ...cardStyle, borderLeft: '4px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.2rem', fontWeight: 500, marginBottom: '0.75rem' }}>Submit Changes</h3>
              <p style={{ fontSize: '0.85rem', color: '#4a4a4a', marginBottom: '1rem' }}>Upload your marked-up design files and add notes. Pronorm will revise the design based on your feedback.</p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Change Notes</label>
                <textarea value={markupNote} onChange={e => setMarkupNote(e.target.value)} placeholder="Describe your requested changes..." rows={3}
                  style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem', border: '1.5px solid #d4cdc5', borderRadius: '3px', background: '#fdfcfa', color: '#1a1a1a', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#4a4a4a', marginBottom: '0.4rem' }}>Marked-Up Files</label>
                <FileUploader onFilesSelected={setMarkupFiles} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={handleSubmitMarkup} disabled={submittingMarkup || markupFiles.length === 0} style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', background: submittingMarkup ? '#d4cdc5' : '#b87333', color: '#fdfcfa',
                  border: 'none', borderRadius: '3px', cursor: submittingMarkup ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>{submittingMarkup ? 'Submitting...' : 'Submit Changes'}</button>
                <button onClick={() => { setMarkupMode(false); setMarkupFiles([]); setMarkupNote(''); }} style={{
                  padding: '0.7rem 1.5rem', fontSize: '0.78rem', fontWeight: 600,
                  background: 'none', border: 'none', color: '#8a8279', cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Notes */}
          {project.message && (
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>Project Notes</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{project.message}</p>
            </div>
          )}

          {/* Quote */}
          {project.quote_amount != null && (
            <div style={{ ...cardStyle, borderLeft: '3px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Quote</h3>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2rem', fontWeight: 400, color: '#b87333' }}>${project.quote_amount.toLocaleString()}</div>
            </div>
          )}

          {/* Admin Notes */}
          {project.admin_notes && (
            <div style={{ ...cardStyle, background: '#fef9f0' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Notes from Pronorm Team</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{project.admin_notes}</p>
            </div>
          )}

          {/* Files grouped by category */}
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const catFiles = filesByCategory[cat];
            if (!catFiles || catFiles.length === 0) return null;
            const isOutput = cat === 'design_output' || cat === 'design_revision';
            return (
              <div key={cat} style={{ ...cardStyle, borderLeft: isOutput ? '3px solid #b87333' : undefined }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>
                  {label}
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#8a8279', marginLeft: '0.5rem' }}>({catFiles.length} file{catFiles.length > 1 ? 's' : ''})</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {catFiles.map(f => (
                    <button key={f.id} onClick={() => downloadFile(f)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.6rem 0.8rem', background: '#f7f4f0', border: 'none', borderRadius: '3px',
                      cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                    }}>
                      <span style={{ color: '#2d2d2d', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{f.file_name}</span>
                      <span style={{ color: '#b87333', fontSize: '0.75rem', fontWeight: 600 }}>Download</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '1rem' }}>Progress</h3>
          <StatusTimeline steps={timelineSteps} />
          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#8a8279' }}>
            Submitted: {new Date(project.created_at).toLocaleDateString()}<br />
            Last updated: {new Date(project.updated_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
