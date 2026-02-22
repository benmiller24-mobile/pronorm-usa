import React, { useState } from 'react';

interface AddToOrderModalProps {
  item: {
    s: string;
    d: string;
    w: number;
    pt: 'price_group' | 'material';
    p: Record<string, number>;
    pg: number;
  };
  onConfirm: (quantity: number, priceGroup: number) => void;
  onCancel: () => void;
}

export default function AddToOrderModal({ item, onConfirm, onCancel }: AddToOrderModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [priceGroup, setPriceGroup] = useState(item.pg);

  const priceGroupOptions = item.pt === 'material'
    ? ['K', 'KS', 'LU', 'L', 'H', 'H1', 'H2', 'F', 'FE', 'G']
    : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '10'];

  const getAvailablePriceGroups = () => {
    return Object.keys(item.p).map(Number).sort((a, b) => a - b);
  };

  const availableGroups = getAvailablePriceGroups();
  const selectedPrice = item.p[priceGroup.toString()] || 0;

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fdfcfa',
        borderRadius: '6px',
        padding: '2rem',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
      }}>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '1.3rem',
          fontWeight: 500,
          color: '#1a1a1a',
          marginBottom: '0.5rem',
        }}>
          Add to Order
        </h3>
        <p style={{
          fontSize: '0.85rem',
          color: '#8a8279',
          marginBottom: '1.5rem',
          fontWeight: 500,
        }}>
          {item.s}
        </p>

        {/* Quantity */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#4a4a4a',
            marginBottom: '0.5rem',
          }}>
            Quantity
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: '100%',
              padding: '0.6rem',
              fontSize: '0.9rem',
              border: '1px solid #d4cdc5',
              borderRadius: '3px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Price Group */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#4a4a4a',
            marginBottom: '0.5rem',
          }}>
            Price Group / Material
          </label>
          <select
            value={priceGroup}
            onChange={(e) => setPriceGroup(parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '0.6rem',
              fontSize: '0.9rem',
              border: '1px solid #d4cdc5',
              borderRadius: '3px',
              fontFamily: 'inherit',
              background: '#fff',
            }}
          >
            {availableGroups.map((group) => {
              const label = item.pt === 'material'
                ? priceGroupOptions[group] || group
                : group;
              return (
                <option key={group} value={group}>
                  {label} — {formatPrice(item.p[group.toString()] || 0)}
                </option>
              );
            })}
          </select>
        </div>

        {/* Price Summary */}
        <div style={{
          background: '#f7f4f0',
          padding: '1rem',
          borderRadius: '3px',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <span style={{ color: '#8a8279' }}>Unit Price:</span>
            <span style={{ fontWeight: 600, color: '#2d2d2d' }}>{formatPrice(selectedPrice)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: '#8a8279' }}>Line Total:</span>
            <span style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '1.1rem',
              fontWeight: 500,
              color: '#b87333',
            }}>
              {formatPrice(selectedPrice * quantity)}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '0.65rem',
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
            onClick={() => onConfirm(quantity, priceGroup)}
            style={{
              flex: 1,
              padding: '0.65rem',
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
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
