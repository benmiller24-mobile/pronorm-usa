import React from 'react';

interface WizardProgressProps {
  currentStep: number;
  steps: string[];
}

// Abbreviated labels for mobile (max ~6 chars)
const SHORT_LABELS: Record<string, string> = {
  'Project Info': 'Info',
  'Cabinets': 'Cabs',
  'Hardware & Drawer': 'H/W',
  'Appliances': 'Appl.',
  'Plumbing & Surfaces': 'P & S',
  'Upload & Review': 'Upload',
};

export default function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  return (
    <>
      {/* Desktop progress bar */}
      <div className="wizard-progress-desktop" style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {steps.map((label, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          const isLast = i === steps.length - 1;

          return (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px', flex: isLast ? 'none' : 1 }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                  background: isCompleted ? '#4a7c59' : isActive ? '#b87333' : '#e8e4df',
                  color: isCompleted || isActive ? '#fdfcfa' : '#8a8279',
                  border: isActive ? '3px solid rgba(184,115,51,0.3)' : 'none',
                  transition: 'all 0.3s ease',
                }}>
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span style={{
                  marginTop: '0.4rem', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.03em',
                  textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2,
                  color: isActive ? '#b87333' : isCompleted ? '#4a7c59' : '#8a8279',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </div>
              {!isLast && (
                <div style={{
                  flex: 1, height: '2px', minWidth: '20px',
                  background: isCompleted ? '#4a7c59' : '#e8e4df',
                  marginTop: '-1.2rem', transition: 'background 0.3s ease',
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile progress bar — compact circles + short labels */}
      <div className="wizard-progress-mobile" style={{ display: 'none', marginBottom: '1.5rem' }}>
        {/* Step indicator text */}
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8a8279', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Step {currentStep + 1} of {steps.length}: <span style={{ color: '#b87333' }}>{steps[currentStep]}</span>
        </div>
        {/* Progress dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          {steps.map((label, i) => {
            const isCompleted = i < currentStep;
            const isActive = i === currentStep;
            const isLast = i === steps.length - 1;

            return (
              <React.Fragment key={i}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: isLast ? 'none' : 1, minWidth: 0 }}>
                  <div style={{
                    width: isActive ? '30px' : '26px', height: isActive ? '30px' : '26px',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.68rem', fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                    background: isCompleted ? '#4a7c59' : isActive ? '#b87333' : '#e8e4df',
                    color: isCompleted || isActive ? '#fdfcfa' : '#8a8279',
                    border: isActive ? '2px solid rgba(184,115,51,0.3)' : 'none',
                    transition: 'all 0.3s ease', flexShrink: 0,
                  }}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <span style={{
                    marginTop: '0.25rem', fontSize: '0.5rem', fontWeight: 600,
                    textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1,
                    color: isActive ? '#b87333' : isCompleted ? '#4a7c59' : '#8a8279',
                    whiteSpace: 'nowrap',
                  }}>
                    {SHORT_LABELS[label] || label}
                  </span>
                </div>
                {!isLast && (
                  <div style={{
                    flex: 1, height: '2px', minWidth: '8px',
                    background: isCompleted ? '#4a7c59' : '#e8e4df',
                    marginTop: '-0.8rem', transition: 'background 0.3s ease',
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </>
  );
}
