import React, { useState, useRef, useCallback } from 'react';
import type { IntakeData } from '../../../lib/types';
import type { UploadedFile } from './DesignEngine';

interface DrawingUploadProps {
  intakeData: IntakeData;
  initialFiles: UploadedFile[];
  onSubmit: (files: UploadedFile[]) => void;
  onBack: () => void;
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png';
const MAX_SIZE_MB = 10;

const cardStyle: React.CSSProperties = {
  background: '#fdfcfa',
  border: '1px solid rgba(26,26,26,0.08)',
  borderRadius: '4px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#4a4a4a',
  marginBottom: '0.4rem',
};

export default function DrawingUpload({ intakeData, initialFiles, onSubmit, onBack }: DrawingUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
  const [dragOver, setDragOver] = useState<string | null>(null); // which drop zone
  const floorplanRef = useRef<HTMLInputElement>(null);
  const elevationRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const hasFloorplan = files.some(f => f.category === 'floorplan');
  const wallsWithElevations = new Set(
    files.filter(f => f.category === 'elevation').map(f => f.wallLabel)
  );

  const addFile = (file: File, category: 'floorplan' | 'elevation', wallLabel?: string) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File "${file.name}" exceeds ${MAX_SIZE_MB}MB limit.`);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setFiles(prev => {
      // Replace if same category+wall already exists
      const filtered = prev.filter(f => {
        if (category === 'floorplan') return f.category !== 'floorplan';
        return !(f.category === 'elevation' && f.wallLabel === wallLabel);
      });
      return [...filtered, { file, category, wallLabel, previewUrl }];
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const f = prev[index];
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = useCallback((e: React.DragEvent, category: 'floorplan' | 'elevation', wallLabel?: string) => {
    e.preventDefault();
    setDragOver(null);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFile(droppedFiles[0], category, wallLabel);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent, zone: string) => {
    e.preventDefault();
    setDragOver(zone);
  };

  const handleSubmit = () => {
    if (!hasFloorplan) {
      alert('A floor plan is required.');
      return;
    }
    onSubmit(files);
  };

  const dropZoneStyle = (zone: string, hasFile: boolean): React.CSSProperties => ({
    border: `2px dashed ${dragOver === zone ? '#b87333' : hasFile ? '#4a7c59' : '#d4cdc5'}`,
    borderRadius: '4px',
    padding: '1.5rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 200ms',
    background: dragOver === zone ? 'rgba(184, 115, 51, 0.04)' : hasFile ? 'rgba(74, 124, 89, 0.04)' : 'transparent',
  });

  return (
    <div>
      {/* Floor Plan */}
      <div style={cardStyle}>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '1.15rem',
          fontWeight: 400,
          color: '#1a1a1a',
          marginBottom: '0.5rem',
        }}>
          Floor Plan <span style={{ color: '#c44536', fontSize: '0.8rem' }}>*required</span>
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#8a8279', marginBottom: '1rem' }}>
          Upload the top-down floor plan showing the room layout. This helps the AI understand wall positions, windows, and doors.
        </p>

        <div
          style={dropZoneStyle('floorplan', hasFloorplan)}
          onClick={() => floorplanRef.current?.click()}
          onDrop={e => handleDrop(e, 'floorplan')}
          onDragOver={e => handleDragOver(e, 'floorplan')}
          onDragLeave={() => setDragOver(null)}
        >
          <input
            ref={floorplanRef}
            type="file"
            accept={ACCEPTED_TYPES}
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files?.[0]) addFile(e.target.files[0], 'floorplan');
              e.target.value = '';
            }}
          />
          {hasFloorplan ? (
            <div>
              {files.filter(f => f.category === 'floorplan').map((f, idx) => {
                const fIdx = files.indexOf(f);
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                    {f.file.type.startsWith('image/') && (
                      <img src={f.previewUrl} alt="Floor plan" style={{ maxHeight: '120px', maxWidth: '200px', borderRadius: '3px' }} />
                    )}
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4a7c59' }}>✓ {f.file.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#8a8279' }}>
                        {(f.file.size / 1024).toFixed(0)} KB
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); removeFile(fIdx); }}
                        style={{
                          marginTop: '0.35rem', fontSize: '0.7rem', color: '#c44536', background: 'none',
                          border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                        }}
                      >
                        Replace
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '1.5rem', color: '#d4cdc5', marginBottom: '0.5rem' }}>⬆</div>
              <div style={{ fontSize: '0.85rem', color: '#8a8279' }}>
                Drag & drop or click to upload floor plan
              </div>
              <div style={{ fontSize: '0.72rem', color: '#b5aca3', marginTop: '0.25rem' }}>
                PDF, JPG, or PNG — max {MAX_SIZE_MB}MB
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wall Elevations */}
      <div style={cardStyle}>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '1.15rem',
          fontWeight: 400,
          color: '#1a1a1a',
          marginBottom: '0.5rem',
        }}>
          Wall Elevations
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#8a8279', marginBottom: '1.25rem' }}>
          Upload an elevation drawing for each wall. Walls without elevations will be analyzed from the floor plan only (lower accuracy).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {intakeData.walls.map((wall) => {
            const hasElev = wallsWithElevations.has(wall.label);
            const elevFile = files.find(f => f.category === 'elevation' && f.wallLabel === wall.label);
            const zone = `elev_${wall.label}`;

            return (
              <div
                key={wall.label}
                style={dropZoneStyle(zone, hasElev)}
                onClick={() => elevationRefs.current[wall.label]?.click()}
                onDrop={e => handleDrop(e, 'elevation', wall.label)}
                onDragOver={e => handleDragOver(e, zone)}
                onDragLeave={() => setDragOver(null)}
              >
                <input
                  ref={el => { elevationRefs.current[wall.label] = el; }}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files?.[0]) addFile(e.target.files[0], 'elevation', wall.label);
                    e.target.value = '';
                  }}
                />
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: hasElev ? '#4a7c59' : '#4a4a4a',
                  marginBottom: '0.5rem',
                }}>
                  Wall {wall.label} — {wall.length_cm}cm
                  {wall.hasWindow && ' (window)'}
                  {wall.hasDoor && ' (door)'}
                </div>

                {hasElev && elevFile ? (
                  <div>
                    {elevFile.file.type.startsWith('image/') && (
                      <img src={elevFile.previewUrl} alt={`Wall ${wall.label}`}
                        style={{ maxHeight: '80px', maxWidth: '180px', borderRadius: '3px', marginBottom: '0.35rem' }}
                      />
                    )}
                    <div style={{ fontSize: '0.78rem', color: '#4a7c59', fontWeight: 600 }}>
                      ✓ {elevFile.file.name}
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeFile(files.indexOf(elevFile)); }}
                      style={{
                        marginTop: '0.25rem', fontSize: '0.68rem', color: '#c44536', background: 'none',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                      }}
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.85rem', color: '#b5aca3' }}>
                      Drop or click to upload
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Missing elevations warning */}
        {intakeData.walls.some(w => !wallsWithElevations.has(w.label)) && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(184, 115, 51, 0.06)',
            border: '1px solid rgba(184, 115, 51, 0.15)',
            borderRadius: '3px',
            fontSize: '0.8rem',
            color: '#8a8279',
          }}>
            ⚠ Walls without elevation drawings will have lower AI accuracy.
            {' '}
            <strong style={{ color: '#b87333' }}>
              Missing: {intakeData.walls.filter(w => !wallsWithElevations.has(w.label)).map(w => w.label).join(', ')}
            </strong>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: 'transparent',
            border: '1.5px solid #d4cdc5',
            color: '#4a4a4a',
            borderRadius: '3px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasFloorplan}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: hasFloorplan ? '#b87333' : '#d4cdc5',
            color: '#fdfcfa',
            border: 'none',
            borderRadius: '3px',
            cursor: hasFloorplan ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            transition: 'background 200ms',
          }}
          onMouseEnter={e => { if (hasFloorplan) e.currentTarget.style.background = '#a0642d'; }}
          onMouseLeave={e => { if (hasFloorplan) e.currentTarget.style.background = '#b87333'; }}
        >
          Analyze Drawings →
        </button>
      </div>
    </div>
  );
}
