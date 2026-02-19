import React from 'react';

interface TimelineStep {
  label: string;
  status: 'completed' | 'active' | 'upcoming';
  date?: string;
  note?: string;
}

interface StatusTimelineProps {
  steps: TimelineStep[];
}

export default function StatusTimeline({ steps }: StatusTimelineProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: '1rem', minHeight: i < steps.length - 1 ? '60px' : 'auto' }}>
          {/* Dot + Line */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px' }}>
            <div style={{
              width: step.status === 'active' ? '14px' : '10px',
              height: step.status === 'active' ? '14px' : '10px',
              borderRadius: '50%',
              background: step.status === 'completed' ? '#4a7c59'
                : step.status === 'active' ? '#b87333'
                : '#d4cdc5',
              border: step.status === 'active' ? '3px solid rgba(184, 115, 51, 0.3)' : 'none',
              flexShrink: 0,
              marginTop: '4px',
            }} />
            {i < steps.length - 1 && (
              <div style={{
                width: '2px',
                flex: 1,
                background: step.status === 'completed' ? '#4a7c59' : '#e8e4df',
                marginTop: '4px',
              }} />
            )}
          </div>
          {/* Content */}
          <div style={{ paddingBottom: '1rem' }}>
            <div style={{
              fontSize: '0.88rem',
              fontWeight: step.status === 'active' ? 600 : 400,
              color: step.status === 'upcoming' ? '#b5aca3' : '#2d2d2d',
            }}>
              {step.label}
            </div>
            {step.date && (
              <div style={{ fontSize: '0.75rem', color: '#8a8279', marginTop: '2px' }}>{step.date}</div>
            )}
            {step.note && (
              <div style={{ fontSize: '0.8rem', color: '#4a4a4a', marginTop: '4px' }}>{step.note}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
