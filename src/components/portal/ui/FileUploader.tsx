import React, { useState, useRef, useCallback } from 'react';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxSizeMB?: number;
  accept?: string;
  existingFiles?: { name: string; size: number }[];
}

const ACCEPTED_TYPES = '.pdf,.docx,.doc,.jpg,.jpeg,.png,.dwg,.dxf,.xlsx,.xls';

export default function FileUploader({
  onFilesSelected,
  maxSizeMB = 50,
  accept = ACCEPTED_TYPES,
  existingFiles = [],
}: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter(f => f.size <= maxSizeMB * 1024 * 1024);
    const updated = [...files, ...fileArray];
    setFiles(updated);
    onFilesSelected(updated);
  }, [files, maxSizeMB, onFilesSelected]);

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesSelected(updated);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragOver ? '#b87333' : '#d4cdc5'}`,
          borderRadius: '4px',
          padding: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#faf8f5' : '#fdfcfa',
          transition: 'all 200ms',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '2rem', color: '#b5aca3', marginBottom: '0.5rem' }}>+</div>
        <p style={{ fontSize: '0.9rem', color: '#4a4a4a' }}>
          Drag & drop files here, or <span style={{ color: '#b87333', fontWeight: 600 }}>browse</span>
        </p>
        <p style={{ fontSize: '0.75rem', color: '#8a8279', marginTop: '0.35rem' }}>
          PDF, DOCX, JPG, PNG, DWG, XLSX — up to {maxSizeMB}MB each
        </p>
      </div>

      {files.length > 0 && (
        <ul style={{ listStyle: 'none', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {files.map((file, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.6rem 0.8rem', background: '#f7f4f0', borderRadius: '3px', fontSize: '0.85rem',
            }}>
              <span style={{ color: '#2d2d2d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {file.name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: '#8a8279', fontSize: '0.75rem' }}>{formatSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={{
                    background: 'none', border: 'none', color: '#c44536', cursor: 'pointer',
                    fontSize: '1rem', lineHeight: 1, padding: '0 0.25rem',
                  }}
                >
                  &times;
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
