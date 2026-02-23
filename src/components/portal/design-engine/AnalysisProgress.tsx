import React, { useEffect, useState, useRef } from 'react';
import type { Dealer, IntakeData, AIAnalysis, MappedItem, ValidationIssue } from '../../../lib/types';
import type { UploadedFile } from './DesignEngine';
import { supabase } from '../../../lib/supabase';
import { matchPositionsToSKUs } from '../../../lib/sku-matcher';
import { validateLayout } from '../../../lib/constraint-validator';

interface AnalysisProgressProps {
  intakeData: IntakeData;
  uploadedFiles: UploadedFile[];
  dealer: Dealer;
  onComplete: (analysis: AIAnalysis, items: MappedItem[], issues: ValidationIssue[]) => void;
  onError: (error: string) => void;
}

type AnalysisPhase = 'uploading' | 'pass1' | 'pass2' | 'pass3' | 'matching' | 'validating' | 'done';

const PHASE_LABELS: Record<AnalysisPhase, string> = {
  uploading: 'Uploading drawings to cloud storage...',
  pass1: 'AI is analyzing your drawings (this typically takes 2-4 minutes)...',
  pass2: 'AI is identifying cabinets and reading dimensions...',
  pass3: 'Cross-validating dimensions and layout (almost done)...',
  matching: 'Matching cabinet positions to ProLine SKUs...',
  validating: 'Running constraint validation...',
  done: 'Analysis complete!',
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_TIME_MS = 480000; // 8 minutes — large drawings with many images need more time

// Claude Vision recommends max 1568px on longest side — larger images get downscaled internally
// but still cost more tokens and processing time. Resizing client-side saves significant time.
const MAX_IMAGE_DIMENSION = 1568;

async function resizeImage(file: File): Promise<File> {
  // Only resize image files
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;

      // Skip if already within bounds
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
        resolve(file);
        return;
      }

      // Calculate new dimensions maintaining aspect ratio
      const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
      const newW = Math.round(width * scale);
      const newH = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, newW, newH);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        } else {
          resolve(file); // fallback to original
        }
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original on error
    };
    img.src = url;
  });
}

export default function AnalysisProgress({ intakeData, uploadedFiles, dealer, onComplete, onError }: AnalysisProgressProps) {
  const [phase, setPhase] = useState<AnalysisPhase>('uploading');
  const [elapsedSec, setElapsedSec] = useState(0);
  const startTimeRef = useRef(Date.now());
  const hasStartedRef = useRef(false);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Run analysis
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    runAnalysis();
  }, []);

  async function pollForResult(jobId: string): Promise<AIAnalysis> {
    const deadline = Date.now() + MAX_POLL_TIME_MS;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      // Update phase based on elapsed time for visual feedback
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 45000) setPhase('pass2');
      if (elapsed > 120000) setPhase('pass3');

      const resp = await fetch(`/.netlify/functions/analysis-status?jobId=${jobId}`);
      if (!resp.ok) {
        throw new Error(`Status check failed (${resp.status})`);
      }

      const data = await resp.json();

      if (data.status === 'complete') {
        return data.result as AIAnalysis;
      }

      if (data.status === 'error') {
        throw new Error(data.error || 'AI analysis failed');
      }

      // data.status === 'processing' — keep polling
    }

    throw new Error('Analysis timed out after 8 minutes. Please try again with fewer or smaller drawings.');
  }

  async function runAnalysis() {
    try {
      // 1. Upload files to Supabase storage and get signed URLs
      setPhase('uploading');
      const imageUrls: Array<{ url: string; category: string; wallLabel?: string }> = [];

      for (const uf of uploadedFiles) {
        // Resize large images to max 1568px — saves significant Claude API processing time
        const optimizedFile = await resizeImage(uf.file);
        const path = `design-engine/${dealer.id}/${Date.now()}-${uf.file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('project-files')
          .upload(path, optimizedFile);

        if (uploadErr) {
          console.error('Upload error:', uploadErr);
          throw new Error(`Failed to upload ${uf.file.name}: ${uploadErr.message}`);
        }

        const { data: urlData } = await supabase.storage
          .from('project-files')
          .createSignedUrl(path, 3600);

        if (urlData?.signedUrl) {
          imageUrls.push({
            url: urlData.signedUrl,
            category: uf.category,
            wallLabel: uf.wallLabel,
          });
        }
      }

      // 2. Submit job to the Netlify Function (returns immediately with jobId)
      setPhase('pass1');

      const summaryResp = await fetch('/data/proline-catalog-summary.json');
      const catalogSummary = await summaryResp.json();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const submitResp = await fetch('/.netlify/functions/analyze-drawing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Async': 'true',
        },
        body: JSON.stringify({
          imageUrls,
          intake: {
            roomWidth: intakeData.roomWidth_cm,
            roomDepth: intakeData.roomDepth_cm,
            ceilingHeight: intakeData.ceilingHeight_cm,
            walls: intakeData.walls.map(w => ({
              label: w.label,
              length: w.length_cm,
              hasWindow: w.hasWindow,
              windowWidth: w.windowWidth_cm,
              windowHeight: w.windowHeight_cm,
              windowSillHeight: w.windowSillHeight_cm,
              hasDoor: w.hasDoor,
              doorWidth: w.doorWidth_cm,
              notes: w.notes,
            })),
            productLine: intakeData.productLine,
            baseUnitHeight: intakeData.baseUnitHeight,
            notes: intakeData.styleNotes,
          },
          catalogSummary,
        }),
      });

      if (!submitResp.ok) {
        const errText = await submitResp.text();
        let errMsg = `Failed to submit analysis (${submitResp.status})`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errMsg;
        } catch {
          errMsg += ': ' + errText.slice(0, 300);
        }
        throw new Error(errMsg);
      }

      const { jobId } = await submitResp.json();
      if (!jobId) throw new Error('No job ID returned from server');

      // 3. Poll for the result
      const aiAnalysis = await pollForResult(jobId);

      // Validate the analysis structure
      if (!aiAnalysis || typeof aiAnalysis !== 'object') {
        throw new Error('AI returned an invalid response. Please try again.');
      }
      if (!Array.isArray(aiAnalysis.walls)) {
        // Try to salvage if walls exists but isn't an array
        if (aiAnalysis.walls && typeof aiAnalysis.walls === 'object') {
          (aiAnalysis as any).walls = Object.values(aiAnalysis.walls);
        } else {
          throw new Error('AI did not return wall analysis data. Please try again with clearer drawings.');
        }
      }

      // 4. Match positions to SKUs
      setPhase('matching');
      const catalogResp = await fetch('/data/pricing-catalog.json');
      const fullCatalog = await catalogResp.json();
      const mappedItems = await matchPositionsToSKUs(aiAnalysis, fullCatalog, intakeData);

      // 5. Validate layout
      setPhase('validating');
      const validationIssues = validateLayout(mappedItems, intakeData);

      // 6. Done
      setPhase('done');
      setTimeout(() => {
        onComplete(aiAnalysis, mappedItems, validationIssues);
      }, 500);

    } catch (err: any) {
      console.error('Analysis error:', err);
      onError(err.message || 'Unknown error during analysis');
    }
  }

  const phaseIndex = Object.keys(PHASE_LABELS).indexOf(phase);
  const totalPhases = Object.keys(PHASE_LABELS).length;
  const progress = ((phaseIndex + 1) / totalPhases) * 100;

  return (
    <div style={{
      background: '#fdfcfa',
      border: '1px solid rgba(26,26,26,0.08)',
      borderRadius: '4px',
      padding: '3rem 2rem',
      textAlign: 'center',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      {/* Animated spinner */}
      <div style={{
        width: '60px',
        height: '60px',
        margin: '0 auto 1.5rem',
        border: '3px solid #f0ebe4',
        borderTop: '3px solid #b87333',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <h3 style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: '1.3rem',
        fontWeight: 400,
        color: '#1a1a1a',
        marginBottom: '0.75rem',
      }}>
        Analyzing Your Drawings
      </h3>

      <p style={{ fontSize: '0.88rem', color: '#4a4a4a', marginBottom: '1.5rem' }}>
        {PHASE_LABELS[phase]}
      </p>

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: '6px',
        background: '#f0ebe4',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: '#b87333',
          borderRadius: '3px',
          transition: 'width 500ms ease',
        }} />
      </div>

      {/* Phase checklist */}
      <div style={{ textAlign: 'left', maxWidth: '350px', margin: '0 auto' }}>
        {(Object.entries(PHASE_LABELS) as [AnalysisPhase, string][]).map(([p, label], i) => {
          const isDone = i < phaseIndex;
          const isActive = p === phase;
          return (
            <div key={p} style={{
              padding: '0.35rem 0',
              fontSize: '0.78rem',
              color: isDone ? '#4a7c59' : isActive ? '#b87333' : '#b5aca3',
              fontWeight: isActive ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.7rem' }}>
                {isDone ? '✓' : isActive ? '●' : '○'}
              </span>
              {label}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#b5aca3' }}>
        Elapsed: {elapsedSec}s
      </div>
    </div>
  );
}
