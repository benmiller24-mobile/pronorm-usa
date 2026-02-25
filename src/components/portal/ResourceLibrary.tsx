import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  dealer: any;
  onNavigate: (path: string) => void;
  isAdmin?: boolean;
}

const CATEGORIES = [
  { key: 'all', label: 'All Resources' },
  { key: 'catalogs', label: 'Catalogs & Brochures' },
  { key: 'pricing', label: 'Pricing & Spec Sheets' },
  { key: 'training', label: 'Training Materials' },
  { key: 'marketing', label: 'Marketing Assets' },
  { key: 'technical', label: 'Technical Documents' },
  { key: 'ordering', label: 'Ordering Guides' },
  { key: 'warranty', label: 'Warranty & Support' },
];

const FILE_ICONS: Record<string, string> = {
  pdf: '\u{1F4C4}',
  doc: '\u{1F4DD}',
  docx: '\u{1F4DD}',
  xls: '\u{1F4CA}',
  xlsx: '\u{1F4CA}',
  ppt: '\u{1F4CA}',
  pptx: '\u{1F4CA}',
  jpg: '\u{1F5BC}',
  jpeg: '\u{1F5BC}',
  png: '\u{1F5BC}',
  mp4: '\u{1F3AC}',
  zip: '\u{1F4E6}',
};

export default function ResourceLibrary({ dealer, onNavigate, isAdmin }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', description: '', category: 'catalogs' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => { loadResources(); }, []);

  async function loadResources() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setResources(data || []);
    } catch (err) {
      console.error('Error loading resources:', err);
    }
    setLoading(false);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadData.title.trim()) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split('.').pop() || '';
      const filePath = `resources/${Date.now()}-${uploadFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('dealer-resources')
        .upload(filePath, uploadFile);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from('dealer-resources')
        .getPublicUrl(filePath);
      const { error: insertErr } = await supabase.from('resources').insert({
        title: uploadData.title.trim(),
        description: uploadData.description.trim(),
        category: uploadData.category,
        file_url: urlData.publicUrl,
        file_name: uploadFile.name,
        file_type: ext,
        file_size: uploadFile.size,
        uploaded_by: dealer.id
      });
      if (insertErr) throw insertErr;
      setUploadData({ title: '', description: '', category: 'catalogs' });
      setUploadFile(null);
      setShowUpload(false);
      loadResources();
    } catch (err) {
      console.error('Error uploading resource:', err);
      alert('Error uploading resource. Please try again.');
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await supabase.from('resources').delete().eq('id', id);
      loadResources();
    } catch (err) {
      console.error('Error deleting resource:', err);
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => FILE_ICONS[type.toLowerCase()] || '\u{1F4CE}';

  const filtered = resources
    .filter(r => activeCategory === 'all' || r.category === activeCategory)
    .filter(r => !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  // ── Styles ──
  const copper = '#b87333';
  const dark = '#2d2d2d';
  const sand = '#f5f0eb';
  const ivory = '#faf8f5';

  const btnPrimary: React.CSSProperties = {
    background: copper, color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 20px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    fontSize: 14, fontWeight: 600
  };

  const btnSecondary: React.CSSProperties = {
    background: 'transparent', color: dark, border: '1px solid #d5d0cb',
    borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif', fontSize: 13
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid #d5d0cb',
    borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif',
    outline: 'none', boxSizing: 'border-box'
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid #e5e0db',
    padding: '20px', display: 'flex', gap: 16, alignItems: 'flex-start',
    transition: 'box-shadow 0.2s'
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: dark, margin: 0 }}>
            Resource Library
          </h1>
          <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0', fontFamily: 'DM Sans, sans-serif' }}>
            Access catalogs, training materials, marketing assets & more
          </p>
        </div>
        {isAdmin && (
          <button style={btnPrimary} onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? 'Cancel' : '+ Upload Resource'}
          </button>
        )}
      </div>

      {/* Upload Form (Admin only) */}
      {showUpload && isAdmin && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e0db', padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 16, fontWeight: 600, color: dark, marginTop: 0 }}>Upload New Resource</h3>
          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600 }}>Title *</label>
                <input style={inputStyle} value={uploadData.title} onChange={e => setUploadData({ ...uploadData, title: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600 }}>Category</label>
                <select style={inputStyle} value={uploadData.category} onChange={e => setUploadData({ ...uploadData, category: e.target.value })}>
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600 }}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={uploadData.description}
                onChange={e => setUploadData({ ...uploadData, description: e.target.value })} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600 }}>File *</label>
              <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} required
                style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14 }} />
            </div>
            <button type="submit" style={btnPrimary} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Resource'}</button>
          </form>
        </div>
      )}

      {/* Search + Category Filters */}
      <div style={{ marginBottom: 24 }}>
        <input style={{ ...inputStyle, maxWidth: 400, marginBottom: 16 }} placeholder="Search resources..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setActiveCategory(c.key)} style={{
              ...btnSecondary, fontSize: 13, padding: '7px 14px',
              background: activeCategory === c.key ? copper : 'transparent',
              color: activeCategory === c.key ? '#fff' : dark,
              border: activeCategory === c.key ? 'none' : '1px solid #d5d0cb'
            }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resource Cards */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#999', fontFamily: 'DM Sans, sans-serif' }}>Loading resources...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#999', fontFamily: 'DM Sans, sans-serif' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>\u{1F4DA}</div>
          <p style={{ fontSize: 16 }}>No resources found</p>
          <p style={{ fontSize: 14 }}>
            {searchQuery ? 'Try a different search term' : 'Resources will appear here once uploaded by your Pronorm representative'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(r => (
            <div key={r.id} style={cardStyle}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>{getFileIcon(r.file_type)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 600, color: dark }}>{r.title}</h3>
                    {r.description && (
                      <p style={{ margin: '0 0 8px', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#777', lineHeight: 1.4 }}>{r.description}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" style={{
                      ...btnPrimary, fontSize: 12, padding: '6px 14px', textDecoration: 'none', display: 'inline-block'
                    }}>Download</a>
                    {isAdmin && (
                      <button onClick={() => handleDelete(r.id)} style={{ ...btnSecondary, fontSize: 12, padding: '6px 12px', color: '#c0392b' }}>Delete</button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#999', fontFamily: 'DM Sans, sans-serif' }}>
                  <span>{CATEGORIES.find(c => c.key === r.category)?.label || r.category}</span>
                  <span>{r.file_name}</span>
                  <span>{formatFileSize(r.file_size)}</span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
