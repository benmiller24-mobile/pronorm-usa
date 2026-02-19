import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Project, ProjectFile, Dealer } from '../../lib/types';
import StatusBadge from './ui/StatusBadge';
import StatusTimeline from './ui/StatusTimeline';

interface ProjectDetailProps {
  projectId: string;
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

const PROJECT_STEPS = ['submitted', 'in_review', 'quoted', 'approved'];
const STEP_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  in_review: 'In Review',
  quoted: 'Quote Provided',
  revision_requested: 'Revision Requested',
  approved: 'Approved',
};

export default function ProjectDetail({ projectId, dealer, onNavigate }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [projRes, filesRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_files').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: true }),
      ]);
      setProject(projRes.data);
      setFiles(filesRes.data || []);
      setLoading(false);
    }
    load();
  }, [projectId]);

  const downloadFile = async (file: ProjectFile) => {
    const { data } = await supabase.storage.from('project-files').createSignedUrl(file.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#8a8279' }}>Loading...</div>;
  if (!project) return <div style={{ padding: '3rem', textAlign: 'center', color: '#c44536' }}>Project not found.</div>;

  const currentIdx = PROJECT_STEPS.indexOf(project.status);
  const timelineSteps = PROJECT_STEPS.map((step, i) => ({
    label: STEP_LABELS[step],
    status: (i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'upcoming') as 'completed' | 'active' | 'upcoming',
    date: i === 0 ? new Date(project.created_at).toLocaleDateString() : undefined,
  }));

  // If revision_requested, insert it
  if (project.status === 'revision_requested') {
    timelineSteps.splice(2, 0, {
      label: STEP_LABELS.revision_requested,
      status: 'active',
      date: new Date(project.updated_at).toLocaleDateString(),
    });
  }

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
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400 }}>
          {project.job_name}
        </h1>
        <StatusBadge status={project.status} />
      </div>
      {project.client_name && <p style={{ fontSize: '0.88rem', color: '#8a8279', marginBottom: '2rem' }}>Client: {project.client_name}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Message */}
          {project.message && (
            <div style={cardStyle}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>Project Notes</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{project.message}</p>
            </div>
          )}

          {/* Quote */}
          {project.quote_amount && (
            <div style={{ ...cardStyle, borderLeft: '3px solid #b87333' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Quote</h3>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2rem', fontWeight: 400, color: '#b87333' }}>
                ${project.quote_amount.toLocaleString()}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          {project.admin_notes && (
            <div style={{ ...cardStyle, background: '#fef9f0' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Notes from Pronorm Team</h3>
              <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{project.admin_notes}</p>
            </div>
          )}

          {/* Files */}
          <div style={cardStyle}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.75rem' }}>Uploaded Files</h3>
            {files.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>No files uploaded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {files.map(f => (
                  <button key={f.id} onClick={() => downloadFile(f)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem', background: '#f7f4f0', border: 'none', borderRadius: '3px',
                    cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                  }}>
                    <span style={{ color: '#2d2d2d', fontWeight: 500 }}>{f.file_name}</span>
                    <span style={{ color: '#b87333', fontSize: '0.75rem', fontWeight: 600 }}>Download</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Timeline */}
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
