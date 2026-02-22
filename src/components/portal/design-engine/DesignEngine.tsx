import React, { useState, useEffect } from 'react';
import type { Dealer, IntakeData, WallDefinition, AIAnalysis, MappedItem, ValidationIssue } from '../../../lib/types';
import IntakeForm from './IntakeForm';
import DrawingUpload from './DrawingUpload';
import AnalysisProgress from './AnalysisProgress';
import AnalysisReview from './AnalysisReview';
import ProposalView from './ProposalView';

interface DesignEngineProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

export type WizardStep = 'intake' | 'upload' | 'analyzing' | 'review' | 'proposal';

const STEP_LABELS: Record<WizardStep, string> = {
  intake: 'Room Info',
  upload: 'Upload Drawings',
  analyzing: 'AI Analysis',
  review: 'Review & Edit',
  proposal: 'Proposal',
};

const STEP_ORDER: WizardStep[] = ['intake', 'upload', 'analyzing', 'review', 'proposal'];

export interface UploadedFile {
  file: File;
  category: 'floorplan' | 'elevation';
  wallLabel?: string; // for elevations
  previewUrl: string;
}

export default function DesignEngine({ dealer, onNavigate }: DesignEngineProps) {
  const [step, setStep] = useState<WizardStep>('intake');
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [mappedItems, setMappedItems] = useState<MappedItem[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);

  const handleIntakeSubmit = (data: IntakeData) => {
    setIntakeData(data);
    setStep('upload');
  };

  const handleUploadComplete = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    setStep('analyzing');
  };

  const handleAnalysisComplete = (analysis: AIAnalysis, items: MappedItem[], issues: ValidationIssue[]) => {
    setAiAnalysis(analysis);
    setMappedItems(items);
    setValidationIssues(issues);
    setStep('review');
  };

  const handleAnalysisError = (error: string) => {
    setAnalysisError(error);
    setStep('upload'); // go back to upload to retry
  };

  const handleReviewComplete = (items: MappedItem[]) => {
    setMappedItems(items);
    setStep('proposal');
  };

  const handleBackToReview = () => {
    setStep('review');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '1.8rem',
          fontWeight: 300,
          color: '#1a1a1a',
          marginBottom: '0.25rem',
        }}>
          Design Translation Engine
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>
          Upload drawings, map to Pronorm SKUs, generate proposals
        </p>
      </div>

      {/* Step indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        marginBottom: '2rem',
        background: '#fdfcfa',
        border: '1px solid rgba(26,26,26,0.08)',
        borderRadius: '4px',
        padding: '0',
        overflow: 'hidden',
      }}>
        {STEP_ORDER.map((s, i) => {
          const isActive = s === step;
          const isPast = i < stepIndex;
          const isFuture = i > stepIndex;
          return (
            <div
              key={s}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                textAlign: 'center',
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: isActive ? '#fdfcfa' : isPast ? '#b87333' : '#b5aca3',
                background: isActive ? '#b87333' : isPast ? 'rgba(184, 115, 51, 0.08)' : 'transparent',
                borderRight: i < STEP_ORDER.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none',
                cursor: isPast ? 'pointer' : 'default',
                transition: 'all 200ms',
              }}
              onClick={() => {
                if (isPast) setStep(s);
              }}
            >
              <span style={{ marginRight: '0.4rem', fontSize: '0.65rem' }}>
                {isPast ? '✓' : `${i + 1}`}
              </span>
              {STEP_LABELS[s]}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {analysisError && step === 'upload' && (
        <div style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          background: 'rgba(196, 69, 54, 0.08)',
          border: '1px solid rgba(196, 69, 54, 0.2)',
          borderRadius: '4px',
          color: '#c44536',
          fontSize: '0.85rem',
        }}>
          <strong>Analysis failed:</strong> {analysisError}. Please check your drawings and try again.
        </div>
      )}

      {/* Step content */}
      {step === 'intake' && (
        <IntakeForm onSubmit={handleIntakeSubmit} initialData={intakeData} />
      )}
      {step === 'upload' && intakeData && (
        <DrawingUpload
          intakeData={intakeData}
          initialFiles={uploadedFiles}
          onSubmit={handleUploadComplete}
          onBack={() => setStep('intake')}
        />
      )}
      {step === 'analyzing' && intakeData && (
        <AnalysisProgress
          intakeData={intakeData}
          uploadedFiles={uploadedFiles}
          dealer={dealer}
          onComplete={handleAnalysisComplete}
          onError={handleAnalysisError}
        />
      )}
      {step === 'review' && intakeData && aiAnalysis && (
        <AnalysisReview
          intakeData={intakeData}
          aiAnalysis={aiAnalysis}
          mappedItems={mappedItems}
          validationIssues={validationIssues}
          uploadedFiles={uploadedFiles}
          onMappedItemsChange={setMappedItems}
          onValidationIssuesChange={setValidationIssues}
          onComplete={handleReviewComplete}
          onBack={() => setStep('upload')}
        />
      )}
      {step === 'proposal' && intakeData && (
        <ProposalView
          intakeData={intakeData}
          mappedItems={mappedItems}
          dealer={dealer}
          onBack={handleBackToReview}
        />
      )}
    </div>
  );
}
