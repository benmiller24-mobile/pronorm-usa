import React, { useState, useMemo } from 'react';
import type { IntakeData, AIAnalysis, MappedItem, ValidationIssue } from '../../../lib/types';
import type { UploadedFile } from './DesignEngine';
import { validateLayout } from '../../../lib/constraint-validator';

interface AnalysisReviewProps {
  intakeData: IntakeData;
  aiAnalysis: AIAnalysis;
  mappedItems: MappedItem[];
  validationIssues: ValidationIssue[];
  uploadedFiles: UploadedFile[];
  onMappedItemsChange: (items: MappedItem[]) => void;
  onValidationIssuesChange: (issues: ValidationIssue[]) => void;
  onComplete: (items: MappedItem[]) => void;
  onBack: () => void;
}

const cardStyle: React.CSSProperties = {
  background: '#fdfcfa',
  border: '1px solid rgba(26,26,26,0.08)',
  borderRadius: '4px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
};

export default function AnalysisReview({
  intakeData,
  aiAnalysis,
  mappedItems,
  validationIssues,
  uploadedFiles,
  onMappedItemsChange,
  onValidationIssuesChange,
  onComplete,
  onBack,
}: AnalysisReviewProps) {
  const [activeWall, setActiveWall] = useState(intakeData.walls[0]?.label || 'A');
  const [editingItem, setEditingItem] = useState<string | null>(null);

  // Group items and issues by wall
  const itemsByWall = useMemo(() => {
    const map = new Map<string, MappedItem[]>();
    for (const item of mappedItems) {
      if (!map.has(item.wallLabel)) map.set(item.wallLabel, []);
      map.get(item.wallLabel)!.push(item);
    }
    return map;
  }, [mappedItems]);

  const issuesByWall = useMemo(() => {
    const map = new Map<string, ValidationIssue[]>();
    for (const issue of validationIssues) {
      if (!map.has(issue.wallLabel)) map.set(issue.wallLabel, []);
      map.get(issue.wallLabel)!.push(issue);
    }
    return map;
  }, [validationIssues]);

  const wallItems = itemsByWall.get(activeWall) || [];
  const wallIssues = issuesByWall.get(activeWall) || [];
  const wallDef = intakeData.walls.find(w => w.label === activeWall);
  const wallElevation = uploadedFiles.find(f => f.category === 'elevation' && f.wallLabel === activeWall);

  // Counts
  const errorCount = validationIssues.filter(i => i.severity === 'error').length;
  const warningCount = validationIssues.filter(i => i.severity === 'warning').length;
  const unconfirmedCount = mappedItems.filter(i => !i.confirmed).length;

  const canProceed = errorCount === 0 && unconfirmedCount === 0;

  const updateItem = (positionId: string, updates: Partial<MappedItem>) => {
    const newItems = mappedItems.map(item =>
      item.positionId === positionId ? { ...item, ...updates } : item
    );
    onMappedItemsChange(newItems);
    // Re-validate after changes
    const newIssues = validateLayout(newItems, intakeData);
    onValidationIssuesChange(newIssues);
  };

  const swapSKU = (positionId: string, altIndex: number) => {
    const item = mappedItems.find(i => i.positionId === positionId);
    if (!item || !item.alternatives[altIndex]) return;

    const alt = item.alternatives[altIndex];
    updateItem(positionId, {
      sku: alt.sku,
      description: alt.description,
      width_cm: alt.width_cm,
      matchScore: alt.matchScore,
      userOverride: true,
      confirmed: true,
      alternatives: [
        { sku: item.sku, description: item.description, width_cm: item.width_cm, matchScore: item.matchScore },
        ...item.alternatives.filter((_, i) => i !== altIndex),
      ],
    });
    setEditingItem(null);
  };

  const confirmItem = (positionId: string) => {
    updateItem(positionId, { confirmed: true });
  };

  const confirmAllOnWall = () => {
    const newItems = mappedItems.map(item =>
      item.wallLabel === activeWall ? { ...item, confirmed: true } : item
    );
    onMappedItemsChange(newItems);
    const newIssues = validateLayout(newItems, intakeData);
    onValidationIssuesChange(newIssues);
  };

  // Classify items into rows by SKU prefix
  function getCabinetRow(sku: string): 'base' | 'wall' | 'tall' {
    const s = sku.toUpperCase();
    if (s.startsWith('O')) return 'wall';  // O, OR, OG = wall/upper units
    if (s.startsWith('H') || s.startsWith('AH')) return 'tall'; // H, HS, HSP, HG, HP, AH
    return 'base'; // U, US, UE, UG, UR, DT and anything else
  }

  const wallLength = wallDef?.length_cm || 0;
  const baseItems = wallItems.filter(i => getCabinetRow(i.sku) === 'base');
  const upperItems = wallItems.filter(i => getCabinetRow(i.sku) === 'wall');
  const tallItems = wallItems.filter(i => getCabinetRow(i.sku) === 'tall');

  const baseTotal = baseItems.reduce((sum, i) => sum + i.width_cm, 0);
  const upperTotal = upperItems.reduce((sum, i) => sum + i.width_cm, 0);
  const tallTotal = tallItems.reduce((sum, i) => sum + i.width_cm, 0);

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return '#4a7c59';
    if (score >= 0.6) return '#b87333';
    return '#c44536';
  };

  const getConfidenceDots = (score: number) => {
    const filled = Math.round(score * 5);
    return '●'.repeat(filled) + '○'.repeat(5 - filled);
  };

  return (
    <div>
      {/* Summary bar */}
      <div style={{
        ...cardStyle,
        display: 'flex',
        alignItems: 'center',
        gap: '2rem',
        padding: '1rem 1.5rem',
      }}>
        <div style={{ fontSize: '0.85rem', color: '#1a1a1a' }}>
          <strong>{mappedItems.length}</strong> cabinets identified across <strong>{intakeData.walls.length}</strong> walls
        </div>
        {errorCount > 0 && (
          <div style={{ fontSize: '0.78rem', color: '#c44536', fontWeight: 600 }}>
            {errorCount} error{errorCount > 1 ? 's' : ''} to resolve
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ fontSize: '0.78rem', color: '#b87333', fontWeight: 600 }}>
            {warningCount} warning{warningCount > 1 ? 's' : ''}
          </div>
        )}
        {unconfirmedCount > 0 && (
          <div style={{ fontSize: '0.78rem', color: '#8a8279' }}>
            {unconfirmedCount} item{unconfirmedCount > 1 ? 's' : ''} need confirmation
          </div>
        )}
      </div>

      {/* AI notes/warnings */}
      {(aiAnalysis.notes.length > 0 || aiAnalysis.warnings.length > 0) && (
        <div style={{ ...cardStyle, padding: '1rem 1.5rem' }}>
          {aiAnalysis.notes.map((note, i) => (
            <div key={`n${i}`} style={{ fontSize: '0.82rem', color: '#4a4a4a', marginBottom: '0.35rem' }}>
              ℹ {note}
            </div>
          ))}
          {aiAnalysis.warnings.map((warn, i) => (
            <div key={`w${i}`} style={{ fontSize: '0.82rem', color: '#b87333', marginBottom: '0.35rem' }}>
              ⚠ {warn}
            </div>
          ))}
        </div>
      )}

      {/* Wall tabs */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '0',
        borderBottom: '2px solid #f0ebe4',
      }}>
        {intakeData.walls.map(w => {
          const isActive = w.label === activeWall;
          const wallErrors = (issuesByWall.get(w.label) || []).filter(i => i.severity === 'error').length;
          const wallItemCount = (itemsByWall.get(w.label) || []).length;
          return (
            <button
              key={w.label}
              onClick={() => setActiveWall(w.label)}
              style={{
                padding: '0.65rem 1.25rem',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.04em',
                background: isActive ? '#fdfcfa' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #b87333' : '2px solid transparent',
                color: isActive ? '#b87333' : '#8a8279',
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginBottom: '-2px',
                position: 'relative',
              }}
            >
              Wall {w.label} ({wallItemCount})
              {wallErrors > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#c44536',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Active wall content */}
      <div style={cardStyle}>
        {/* Elevation image */}
        {wallElevation && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '1rem',
            background: '#f7f4f0',
            borderRadius: '3px',
            textAlign: 'center',
          }}>
            <img
              src={wallElevation.previewUrl}
              alt={`Wall ${activeWall} elevation`}
              style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '3px' }}
            />
            <div style={{ fontSize: '0.72rem', color: '#8a8279', marginTop: '0.5rem' }}>
              Original elevation — Wall {activeWall} ({wallDef?.length_cm}cm)
            </div>
          </div>
        )}

        {/* Dimension bars — one per cabinet row */}
        {wallLength > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#4a4a4a',
              marginBottom: '0.75rem',
            }}>
              Dimension Check — Wall {activeWall} ({wallLength}cm)
            </div>

            {/* Render a dimension bar for each row type that has items */}
            {[
              { label: 'Upper Cabinets', items: upperItems, total: upperTotal, color: '#5b8db8' },
              { label: 'Tall Units', items: tallItems, total: tallTotal, color: '#8a6b94' },
              { label: 'Base Cabinets', items: baseItems, total: baseTotal, color: '#b87333' },
            ].filter(row => row.items.length > 0).map(row => {
              const gap = wallLength - row.total;
              return (
                <div key={row.label} style={{ marginBottom: '0.75rem' }}>
                  <div style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: row.color,
                    marginBottom: '0.3rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>{row.label} ({row.items.length})</span>
                    <span style={{
                      color: gap === 0 ? '#4a7c59' : gap > 0 ? '#8a8279' : '#c44536',
                    }}>
                      {row.total}cm / {wallLength}cm
                      {gap === 0 && ' ✓'}
                      {gap > 0 && gap <= 10 && ' ✓'}
                      {gap > 10 && ` (${gap}cm gap)`}
                      {gap < 0 && ` (${Math.abs(gap)}cm over!)`}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    height: '26px',
                    background: '#f0ebe4',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    border: '1px solid rgba(26,26,26,0.06)',
                  }}>
                    {row.items.map(item => (
                      <div
                        key={item.positionId}
                        style={{
                          width: `${(item.width_cm / wallLength) * 100}%`,
                          background: row.color + '30',
                          borderRight: '1px solid rgba(26,26,26,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          color: '#4a4a4a',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                        title={`${item.sku} — ${item.width_cm}cm`}
                        onClick={() => setEditingItem(item.positionId === editingItem ? null : item.positionId)}
                      >
                        {item.width_cm}
                      </div>
                    ))}
                    {gap > 0 && (
                      <div style={{
                        width: `${(gap / wallLength) * 100}%`,
                        background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 6px)',
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Validation issues for this wall */}
        {wallIssues.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            {wallIssues.map((issue, i) => (
              <div key={i} style={{
                padding: '0.6rem 0.85rem',
                marginBottom: '0.4rem',
                background: issue.severity === 'error' ? 'rgba(196, 69, 54, 0.06)' : 'rgba(184, 115, 51, 0.06)',
                border: `1px solid ${issue.severity === 'error' ? 'rgba(196, 69, 54, 0.15)' : 'rgba(184, 115, 51, 0.15)'}`,
                borderRadius: '3px',
                fontSize: '0.8rem',
                color: issue.severity === 'error' ? '#c44536' : '#8a8279',
              }}>
                <strong>{issue.severity === 'error' ? '✕' : '⚠'}</strong>{' '}
                {issue.message}
                {issue.suggestedFix && (
                  <span style={{ color: '#4a4a4a', fontStyle: 'italic' }}> — {issue.suggestedFix}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Cabinet position cards */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#4a4a4a',
          }}>
            Cabinet Positions ({wallItems.length})
          </div>
          <button
            type="button"
            onClick={confirmAllOnWall}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.68rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: '1px solid #4a7c59',
              color: '#4a7c59',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Confirm All on This Wall
          </button>
        </div>

        {wallItems.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#b5aca3', fontSize: '0.88rem' }}>
            No cabinets identified on Wall {activeWall}.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {wallItems.map(item => {
              const isEditing = editingItem === item.positionId;
              const confColor = getConfidenceColor(item.matchScore);
              return (
                <div
                  key={item.positionId}
                  style={{
                    padding: '1rem',
                    border: `1.5px solid ${isEditing ? '#b87333' : item.confirmed ? 'rgba(74,124,89,0.3)' : 'rgba(26,26,26,0.1)'}`,
                    borderRadius: '4px',
                    background: item.confirmed ? 'rgba(74,124,89,0.03)' : '#fdfcfa',
                    cursor: 'pointer',
                    transition: 'all 200ms',
                  }}
                  onClick={() => setEditingItem(isEditing ? null : item.positionId)}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1a1a1a' }}>
                      {item.sku}
                    </div>
                    {item.confirmed && (
                      <span style={{ fontSize: '0.7rem', color: '#4a7c59', fontWeight: 600 }}>✓</span>
                    )}
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: '0.78rem', color: '#4a4a4a', marginBottom: '0.5rem', minHeight: '2.2em' }}>
                    {item.description || 'No description'}
                  </div>

                  {/* Dimensions */}
                  <div style={{ fontSize: '0.75rem', color: '#8a8279', marginBottom: '0.4rem' }}>
                    {item.width_cm}cm × {item.height_cm}cm
                    {item.userOverride && (
                      <span style={{ color: '#b87333', marginLeft: '0.5rem', fontWeight: 600 }}>Manual</span>
                    )}
                  </div>

                  {/* Confidence */}
                  <div style={{ fontSize: '0.72rem', color: confColor, letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                    {getConfidenceDots(item.matchScore)}
                    <span style={{ marginLeft: '0.4rem', letterSpacing: '0' }}>
                      {(item.matchScore * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Price */}
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1a1a' }}>
                    {item.unitPrice > 0 ? `€${item.unitPrice.toLocaleString()}` : 'Price TBD'}
                  </div>

                  {/* Expanded edit area */}
                  {isEditing && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(26,26,26,0.08)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Confirm button */}
                      {!item.confirmed && (
                        <button
                          onClick={() => confirmItem(item.positionId)}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            background: '#4a7c59',
                            color: '#fdfcfa',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            marginBottom: '0.5rem',
                          }}
                        >
                          ✓ Confirm This Item
                        </button>
                      )}

                      {/* Alternatives */}
                      {item.alternatives.length > 0 && (
                        <div>
                          <div style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: '#8a8279',
                            marginBottom: '0.35rem',
                          }}>
                            Alternatives:
                          </div>
                          {item.alternatives.slice(0, 4).map((alt, ai) => (
                            <button
                              key={ai}
                              onClick={() => swapSKU(item.positionId, ai)}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.35rem 0.5rem',
                                marginBottom: '0.25rem',
                                background: 'rgba(247, 244, 240, 0.8)',
                                border: '1px solid rgba(26,26,26,0.06)',
                                borderRadius: '3px',
                                fontSize: '0.72rem',
                                color: '#4a4a4a',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                textAlign: 'left',
                              }}
                            >
                              <strong>{alt.sku}</strong> — {alt.width_cm}cm
                              <span style={{ color: '#b5aca3', marginLeft: '0.25rem' }}>
                                ({(alt.matchScore * 100).toFixed(0)}%)
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          ← Re-upload
        </button>
        <div style={{ textAlign: 'right' }}>
          {!canProceed && (
            <div style={{ fontSize: '0.75rem', color: '#c44536', marginBottom: '0.4rem' }}>
              {errorCount > 0 && `Resolve ${errorCount} error${errorCount > 1 ? 's' : ''}`}
              {errorCount > 0 && unconfirmedCount > 0 && ' and '}
              {unconfirmedCount > 0 && `confirm ${unconfirmedCount} item${unconfirmedCount > 1 ? 's' : ''}`}
              {' before generating proposal.'}
            </div>
          )}
          <button
            type="button"
            onClick={() => canProceed && onComplete(mappedItems)}
            disabled={!canProceed}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: canProceed ? '#b87333' : '#d4cdc5',
              color: '#fdfcfa',
              border: 'none',
              borderRadius: '3px',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            Generate Proposal →
          </button>
        </div>
      </div>
    </div>
  );
}
