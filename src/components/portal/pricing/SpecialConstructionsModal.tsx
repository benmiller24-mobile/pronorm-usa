import React, { useState } from 'react';

export interface SpecialConstruction {
  sku: string;
  description: string;
  price: number;
  img?: string | null;
  input?: { label: string; placeholder?: string };
  notes?: string;
  seq?: number;
}

export interface SelectedConstruction {
  sku: string;
  description: string;
  price: number;
  inputValue?: string;
}

interface SpecialConstructionsModalProps {
  constructions: SpecialConstruction[];
  onConfirm: (selected: SelectedConstruction[]) => void;
  onCancel: () => void;
  initialSelected?: SelectedConstruction[];
}

export default function SpecialConstructionsModal({
  constructions,
  onConfirm,
  onCancel,
  initialSelected = [],
}: SpecialConstructionsModalProps) {
  const [selected, setSelected] = useState<SelectedConstruction[]>(initialSelected);
  const [inputValues, setInputValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    initialSelected.forEach((s) => {
      if (s.inputValue) init[s.sku] = s.inputValue;
    });
    return init;
  });
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const isSelected = (sku: string) => selected.some((s) => s.sku === sku);

  const toggleSelect = (item: SpecialConstruction) => {
    if (isSelected(item.sku)) {
      setSelected(selected.filter((s) => s.sku !== item.sku));
    } else {
      setSelected([
        ...selected,
        {
          sku: item.sku,
          description: item.description,
          price: item.price,
          inputValue: inputValues[item.sku] || undefined,
        },
      ]);
    }
  };

  const updateInput = (sku: string, value: string) => {
    setInputValues({ ...inputValues, [sku]: value });
    setSelected(
      selected.map((s) =>
        s.sku === sku ? { ...s, inputValue: value } : s
      )
    );
  };

  const totalSurcharge = selected.reduce((sum, s) => sum + s.price, 0);

  const formatPrice = (price: number) =>
    `€${price.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        style={{
          background: '#fdfcfa',
          borderRadius: '6px',
          maxWidth: '900px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e8e0d8',
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '1.3rem',
              fontWeight: 500,
              color: '#1a1a1a',
              marginBottom: '0.25rem',
            }}
          >
            Special Constructions
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#8a8279' }}>
            Select modifications to apply to this base unit. Surcharges are added to the base price.
          </p>
        </div>

        {/* Selected items summary bar */}
        {selected.length > 0 && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              background: '#f7f4f0',
              borderBottom: '1px solid #e8e0d8',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4a4a4a', marginRight: '0.25rem' }}>
              Selected:
            </span>
            {selected.map((s) => (
              <span
                key={s.sku}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#b87333',
                  color: '#fdfcfa',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                }}
              >
                {s.sku} ({formatPrice(s.price)})
                <button
                  onClick={() => setSelected(selected.filter((x) => x.sku !== s.sku))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fdfcfa',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#b87333',
              }}
            >
              Total: {formatPrice(totalSurcharge)}
            </span>
          </div>
        )}

        {/* Scrollable list of constructions */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.5rem',
          }}
        >
          {constructions.map((item) => {
            const active = isSelected(item.sku);
            return (
              <div
                key={item.sku}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  borderRadius: '4px',
                  border: active ? '2px solid #b87333' : '1px solid #e8e0d8',
                  background: active ? '#fef9f0' : '#fdfcfa',
                  transition: 'all 150ms',
                  alignItems: 'flex-start',
                }}
              >
                {/* Image */}
                {item.img && (
                  <div
                    style={{
                      width: '200px',
                      minWidth: '200px',
                      cursor: 'pointer',
                    }}
                    onClick={() => setZoomedImage(`/data/diagrams/${item.img}`)}
                  >
                    <img
                      src={`/data/diagrams/${item.img}`}
                      alt={item.description}
                      style={{
                        width: '100%',
                        borderRadius: '3px',
                        border: '1px solid #e8e0d8',
                      }}
                    />
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#b87333',
                          marginRight: '0.5rem',
                        }}
                      >
                        {item.sku}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#2d2d2d' }}>
                        {item.description}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#2d2d2d',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.price === 0 ? 'No surcharge' : formatPrice(item.price)}
                    </span>
                  </div>

                  {item.notes && (
                    <p style={{ fontSize: '0.72rem', color: '#8a8279', marginTop: '0.25rem', lineHeight: 1.4 }}>
                      {item.notes}
                    </p>
                  )}

                  {/* Input field (shown when selected and item requires input) */}
                  {active && item.input && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#4a4a4a',
                          marginBottom: '0.25rem',
                        }}
                      >
                        {item.input.label}
                      </label>
                      <input
                        type="text"
                        value={inputValues[item.sku] || ''}
                        onChange={(e) => updateInput(item.sku, e.target.value)}
                        placeholder={item.input.placeholder}
                        style={{
                          width: '200px',
                          padding: '0.4rem 0.6rem',
                          fontSize: '0.82rem',
                          border: '1px solid #d4cdc5',
                          borderRadius: '3px',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  )}

                  {/* Select/Deselect button */}
                  <button
                    onClick={() => toggleSelect(item)}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.35rem 0.8rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      border: active ? '1.5px solid #b87333' : '1.5px solid #d4cdc5',
                      borderRadius: '3px',
                      background: active ? '#b87333' : 'transparent',
                      color: active ? '#fdfcfa' : '#4a4a4a',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 150ms',
                    }}
                  >
                    {active ? 'Remove' : 'Select'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e8e0d8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '0.85rem', color: '#4a4a4a' }}>
            {selected.length > 0 && (
              <span>
                <strong>{selected.length}</strong> selected — Total surcharge:{' '}
                <strong style={{ color: '#b87333' }}>{formatPrice(totalSurcharge)}</strong>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '0.6rem 1.2rem',
                background: '#f7f4f0',
                color: '#4a4a4a',
                border: '1px solid #d4cdc5',
                borderRadius: '3px',
                fontSize: '0.78rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 200ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#e8e0d8';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f7f4f0';
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(selected)}
              style={{
                padding: '0.6rem 1.2rem',
                background: '#b87333',
                color: '#fdfcfa',
                border: 'none',
                borderRadius: '3px',
                fontSize: '0.78rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 200ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#a0642d';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#b87333';
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>

      {/* Image zoom overlay */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={zoomedImage}
            alt="Zoomed view"
            style={{
              maxWidth: '95%',
              maxHeight: '90vh',
              borderRadius: '4px',
              boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      )}
    </div>
  );
}
