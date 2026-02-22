import React, { useMemo, useState } from 'react';
import type { Dealer, IntakeData, MappedItem } from '../../../lib/types';

interface ProposalViewProps {
  intakeData: IntakeData;
  mappedItems: MappedItem[];
  dealer: Dealer;
  onBack: () => void;
}

const cardStyle: React.CSSProperties = {
  background: '#fdfcfa',
  border: '1px solid rgba(26,26,26,0.08)',
  borderRadius: '4px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
};

export default function ProposalView({ intakeData, mappedItems, dealer, onBack }: ProposalViewProps) {
  const [discount, setDiscount] = useState(0);
  const [freight, setFreight] = useState(0);

  // Group by wall
  const byWall = useMemo(() => {
    const map = new Map<string, MappedItem[]>();
    for (const item of mappedItems) {
      if (!map.has(item.wallLabel)) map.set(item.wallLabel, []);
      map.get(item.wallLabel)!.push(item);
    }
    return map;
  }, [mappedItems]);

  const subtotal = mappedItems.reduce((sum, i) => sum + i.unitPrice, 0);
  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount + freight;

  return (
    <div>
      {/* Proposal header */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '1.5rem',
              fontWeight: 400,
              color: '#1a1a1a',
              marginBottom: '0.25rem',
            }}>
              {intakeData.projectName}
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#8a8279' }}>
              {intakeData.roomType.charAt(0).toUpperCase() + intakeData.roomType.slice(1)} —{' '}
              {intakeData.roomWidth_cm}cm × {intakeData.roomDepth_cm}cm —{' '}
              ProLine — {mappedItems.length} items
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b87333' }}>
              Pronorm USA
            </div>
            <div style={{ fontSize: '0.78rem', color: '#8a8279' }}>
              {dealer.company_name}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b5aca3' }}>
              {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Itemized price table per wall */}
      {Array.from(byWall.entries()).map(([wallLabel, items]) => {
        const wallDef = intakeData.walls.find(w => w.label === wallLabel);
        const wallSubtotal = items.reduce((sum, i) => sum + i.unitPrice, 0);

        return (
          <div key={wallLabel} style={cardStyle}>
            <h3 style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '1.1rem',
              fontWeight: 400,
              color: '#1a1a1a',
              marginBottom: '1rem',
            }}>
              Wall {wallLabel}
              {wallDef && (
                <span style={{ fontSize: '0.82rem', color: '#8a8279', fontFamily: "'DM Sans', sans-serif", marginLeft: '0.75rem' }}>
                  {wallDef.length_cm}cm
                  {wallDef.hasWindow && ` — window ${wallDef.windowWidth_cm}cm`}
                  {wallDef.hasDoor && ` — door ${wallDef.doorWidth_cm}cm`}
                </span>
              )}
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #d4cdc5' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a' }}>
                    Position
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a' }}>
                    SKU
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a' }}>
                    Description
                  </th>
                  <th style={{ textAlign: 'center', padding: '0.5rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a' }}>
                    Width
                  </th>
                  <th style={{ textAlign: 'right', padding: '0.5rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4a4a' }}>
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.positionId} style={{ borderBottom: '1px solid rgba(26,26,26,0.05)' }}>
                    <td style={{ padding: '0.5rem', color: '#8a8279', fontSize: '0.78rem' }}>
                      {item.positionId}
                    </td>
                    <td style={{ padding: '0.5rem', fontWeight: 600, color: '#1a1a1a' }}>
                      {item.sku}
                    </td>
                    <td style={{ padding: '0.5rem', color: '#4a4a4a', maxWidth: '250px' }}>
                      {item.description}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', color: '#8a8279' }}>
                      {item.width_cm}cm
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: '#1a1a1a' }}>
                      €{item.unitPrice.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1.5px solid #d4cdc5' }}>
                  <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: '#4a4a4a' }}>
                    Wall {wallLabel} Subtotal:
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: '#1a1a1a' }}>
                    €{wallSubtotal.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}

      {/* Totals */}
      <div style={cardStyle}>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '1.1rem',
          fontWeight: 400,
          color: '#1a1a1a',
          marginBottom: '1rem',
        }}>
          Order Summary
        </h3>

        <div style={{ maxWidth: '350px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.85rem', color: '#4a4a4a' }}>
            <span>Subtotal ({mappedItems.length} items)</span>
            <span style={{ fontWeight: 600 }}>€{subtotal.toLocaleString()}</span>
          </div>

          {/* Discount */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#4a4a4a' }}>Discount</span>
              <input
                type="number"
                min={0}
                max={100}
                value={discount || ''}
                onChange={e => setDiscount(Number(e.target.value))}
                style={{
                  width: '50px',
                  padding: '0.25rem 0.4rem',
                  border: '1px solid #d4cdc5',
                  borderRadius: '3px',
                  fontSize: '0.82rem',
                  textAlign: 'right',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <span style={{ fontSize: '0.82rem', color: '#8a8279' }}>%</span>
            </div>
            {discountAmount > 0 && (
              <span style={{ fontSize: '0.85rem', color: '#4a7c59', fontWeight: 600 }}>
                -€{discountAmount.toLocaleString()}
              </span>
            )}
          </div>

          {/* Freight */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#4a4a4a' }}>Freight</span>
              <span style={{ fontSize: '0.82rem', color: '#8a8279' }}>€</span>
              <input
                type="number"
                min={0}
                value={freight || ''}
                onChange={e => setFreight(Number(e.target.value))}
                style={{
                  width: '80px',
                  padding: '0.25rem 0.4rem',
                  border: '1px solid #d4cdc5',
                  borderRadius: '3px',
                  fontSize: '0.82rem',
                  textAlign: 'right',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.75rem 0 0.4rem',
            borderTop: '2px solid #1a1a1a',
            marginTop: '0.5rem',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: '#1a1a1a',
          }}>
            <span>Total</span>
            <span>€{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
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
          ← Back to Review
        </button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: '1.5px solid #b87333',
              color: '#b87333',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onClick={() => alert('PDF export coming in Phase 3')}
          >
            Export PDF
          </button>
          <button
            type="button"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: '#b87333',
              color: '#fdfcfa',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onClick={() => alert('Send to Pricing Tool coming in Phase 3')}
          >
            Send to Pricing Tool
          </button>
        </div>
      </div>
    </div>
  );
}
