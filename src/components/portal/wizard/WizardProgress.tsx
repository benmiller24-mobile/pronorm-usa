import React from 'react';

interface WizardProgressProps {
  currentStep: number;
  steps: string[];
}

export default function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
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
  );
}
