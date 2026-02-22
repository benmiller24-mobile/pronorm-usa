import React from 'react';
import type { OrderLineItem } from '../PricingTool';

interface PricingOrderProps {
  items: OrderLineItem[];
  discount: number;
  freight: number;
  onDisountChange: (discount: number) => void;
  onFreightChange: (freight: number) => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, updates: Partial<OrderLineItem>) => void;
}

export default function PricingOrder({
  items,
  discount,
  freight,
  onDisountChange,
  onFreightChange,
  onRemoveItem,
  onUpdateItem,
}: PricingOrderProps) {
  const formatPrice = (price: number) => {
    return `€${price.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const discountAmount = subtotal * (discount / 100);
  const discountedTotal = subtotal - discountAmount;
  const grandTotal = discountedTotal + freight;

  const handleDownloadJSON = () => {
    const orderData = {
      items,
      subtotal,
      discount,
      discountAmount,
      discountedTotal,
      freight,
      grandTotal,
      createdAt: new Date().toISOString(),
    };
    const dataStr = JSON.stringify(orderData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `order-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (items.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        background: '#fdfcfa',
        border: '1px solid #e8e0d8',
        borderRadius: '4px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '1.1rem',
          color: '#8a8279',
          marginBottom: '0.5rem',
        }}>
          Your order is empty
        </div>
        <p style={{ fontSize: '0.85rem', color: '#8a8279' }}>
          Add items from the Browse or Search tabs to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Order Table */}
      <div style={{
        marginBottom: '2rem',
        overflowX: 'auto',
        border: '1px solid #e8e0d8',
        borderRadius: '4px',
      }}>
        <table style={{
          width: '100%',
          background: '#fdfcfa',
          borderCollapse: 'collapse',
          fontSize: '0.85rem',
        }}>
          <thead>
            <tr style={{ background: '#f7f4f0', borderBottom: '2px solid #e8e0d8' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#4a4a4a', width: '80px' }}>
                SKU
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#4a4a4a' }}>
                Description
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#4a4a4a', width: '70px' }}>
                Width
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#4a4a4a', width: '100px' }}>
                Price Grp
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#4a4a4a', width: '90px' }}>
                Unit Price
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#4a4a4a', width: '80px' }}>
                Qty
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#4a4a4a', width: '100px' }}>
                Line Total
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: '#4a4a4a', width: '50px' }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={index}
                style={{
                  borderBottom: '1px solid #e8e0d8',
                  background: index % 2 === 0 ? '#fdfcfa' : '#f9f8f6',
                }}
              >
                <td style={{ padding: '0.75rem', color: '#b87333', fontWeight: 600 }}>
                  {item.sku}
                </td>
                <td style={{ padding: '0.75rem', color: '#2d2d2d' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.description}</div>
                  <div style={{ fontSize: '0.7rem', color: '#8a8279' }}>
                    {item.productLine} / {item.category}
                  </div>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center', color: '#2d2d2d' }}>
                  {item.width}mm
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center', color: '#2d2d2d' }}>
                  {item.priceGroup}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#2d2d2d' }}>
                  {formatPrice(item.unitPrice)}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => onUpdateItem(index, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    style={{
                      width: '50px',
                      padding: '0.4rem',
                      fontSize: '0.85rem',
                      border: '1px solid #d4cdc5',
                      borderRadius: '3px',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                    }}
                  />
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', color: '#b87333', fontWeight: 600 }}>
                  {formatPrice(item.unitPrice * item.quantity)}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <button
                    onClick={() => onRemoveItem(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#d9534f',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                    }}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem',
      }}>
        {/* Left: Pricing Details */}
        <div style={{
          background: '#fdfcfa',
          border: '1px solid #e8e0d8',
          borderRadius: '4px',
          padding: '1.5rem',
        }}>
          <h3 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '1.15rem',
            fontWeight: 500,
            color: '#1a1a1a',
            marginBottom: '1rem',
          }}>
            Order Summary
          </h3>

          {/* Subtotal */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid #e8e0d8',
            marginBottom: '0.75rem',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#8a8279' }}>Subtotal:</span>
            <span style={{ fontWeight: 600, color: '#2d2d2d' }}>{formatPrice(subtotal)}</span>
          </div>

          {/* Discount */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid #e8e0d8',
            marginBottom: '0.75rem',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#8a8279', whiteSpace: 'nowrap' }}>Discount:</span>
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flex: 1 }}>
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => onDisountChange(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                style={{
                  width: '60px',
                  padding: '0.4rem',
                  fontSize: '0.85rem',
                  border: '1px solid #d4cdc5',
                  borderRadius: '3px',
                  fontFamily: 'inherit',
                }}
              />
              <span style={{ color: '#8a8279' }}>%</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#2d2d2d' }}>
                {formatPrice(discountAmount)}
              </span>
            </div>
          </div>

          {/* Discounted Total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid #e8e0d8',
            marginBottom: '0.75rem',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#8a8279' }}>After Discount:</span>
            <span style={{ fontWeight: 600, color: '#2d2d2d' }}>{formatPrice(discountedTotal)}</span>
          </div>

          {/* Freight */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            paddingBottom: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: '#8a8279', whiteSpace: 'nowrap' }}>Freight:</span>
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flex: 1 }}>
              <span style={{ color: '#8a8279' }}>€</span>
              <input
                type="number"
                min="0"
                value={freight}
                onChange={(e) => onFreightChange(Math.max(0, parseFloat(e.target.value) || 0))}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  fontSize: '0.85rem',
                  border: '1px solid #d4cdc5',
                  borderRadius: '3px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Grand Total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1rem',
            borderTop: '2px solid #b87333',
          }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '1rem',
              fontWeight: 600,
              color: '#1a1a1a',
            }}>
              Grand Total:
            </span>
            <span style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '1.4rem',
              fontWeight: 500,
              color: '#b87333',
            }}>
              {formatPrice(grandTotal)}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <h3 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '1.15rem',
            fontWeight: 500,
            color: '#1a1a1a',
            marginBottom: '1rem',
          }}>
            Actions
          </h3>
          <button
            onClick={handleDownloadJSON}
            style={{
              padding: '0.85rem 1.5rem',
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
            Download Order (JSON)
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '0.85rem 1.5rem',
              background: '#f7f4f0',
              color: '#4a4a4a',
              border: '1.5px solid #d4cdc5',
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
            Print Order
          </button>
          <div style={{
            padding: '1rem',
            background: '#fef9f0',
            border: '1px solid #f0e8e0',
            borderRadius: '3px',
            fontSize: '0.78rem',
            color: '#8a8279',
            marginTop: '1rem',
          }}>
            <strong style={{ color: '#b87333' }}>Note:</strong> Download your order as JSON for further processing or import into your ERP system.
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none;
          }
          table {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
