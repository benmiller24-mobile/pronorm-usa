import React, { useState } from 'react';
import type { OrderLineItem } from '../PricingTool';
import AddToOrderModal from './AddToOrderModal';

interface CatalogItem {
  s: string;
  d: string;
  w: number;
  dr: string | null;
  pt: 'price_group' | 'material';
  p: Record<string, number>;
  pg: number;
}

interface CatalogData {
  [productLine: string]: {
    [category: string]: {
      [height: string]: CatalogItem[];
    };
  };
}

interface PricingBrowseProps {
  catalogData: CatalogData;
  onAddToOrder: (item: OrderLineItem) => void;
}

export default function PricingBrowse({ catalogData, onAddToOrder }: PricingBrowseProps) {
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedHeight, setSelectedHeight] = useState<string | null>(null);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem & { productLine: string; category: string; height: string } | null>(null);

  const productLines = Object.keys(catalogData).sort();

  const getCategories = (line: string) => {
    return Object.keys(catalogData[line] || {}).sort();
  };

  const getHeights = (line: string, category: string) => {
    return Object.keys(catalogData[line]?.[category] || {}).sort((a, b) => parseInt(a) - parseInt(b));
  };

  const getItems = (line: string, category: string, height: string) => {
    return catalogData[line]?.[category]?.[height] || [];
  };

  const handleAddClick = (item: CatalogItem, line: string, category: string, height: string) => {
    setSelectedItem({ ...item, productLine: line, category, height });
    setModalOpen(true);
  };

  const handleConfirmAdd = (quantity: number, priceGroup: number) => {
    if (!selectedItem) return;
    onAddToOrder({
      sku: selectedItem.s,
      description: selectedItem.d,
      width: selectedItem.w,
      doorOrientation: selectedItem.dr || 'N/A',
      priceGroup,
      unitPrice: selectedItem.p[priceGroup.toString()] || 0,
      quantity,
      productLine: selectedItem.productLine,
      category: selectedItem.category,
      height: parseInt(selectedItem.height),
    });
    setModalOpen(false);
    setSelectedItem(null);
  };

  const sidebarStyle: React.CSSProperties = {
    width: '280px',
    background: '#fdfcfa',
    border: '1px solid #e8e0d8',
    borderRadius: '4px',
    marginRight: '2rem',
    padding: '1rem',
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 300px)',
  };

  const treeNodeStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    borderRadius: '3px',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  const activeNodeStyle: React.CSSProperties = {
    ...treeNodeStyle,
    background: '#b87333',
    color: '#fdfcfa',
    fontWeight: 600,
  };

  const inactiveNodeStyle: React.CSSProperties = {
    ...treeNodeStyle,
    background: 'transparent',
    color: '#2d2d2d',
  };

  return (
    <div style={{ display: 'flex', gap: '0' }}>
      {/* Sidebar Tree */}
      <div style={sidebarStyle}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8279', marginBottom: '0.75rem' }}>
          Product Lines
        </div>
        {productLines.map((line) => {
          const categories = getCategories(line);
          const isLineExpanded = expandedLine === line;
          return (
            <div key={line}>
              <button
                onClick={() => {
                  setSelectedLine(line);
                  setSelectedCategory(null);
                  setSelectedHeight(null);
                  setExpandedLine(isLineExpanded ? null : line);
                }}
                style={{
                  ...((selectedLine === line && !selectedCategory) ? activeNodeStyle : inactiveNodeStyle),
                  border: 'none',
                  fontFamily: 'inherit',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>
                  {isLineExpanded ? '▼' : '▶'}
                </span>
                {line}
              </button>
              {isLineExpanded && (
                <div style={{ paddingLeft: '1rem', borderLeft: '1px solid #d4cdc5' }}>
                  {categories.map((category) => {
                    const heights = getHeights(line, category);
                    const isCategoryExpanded = expandedCategory === `${line}/${category}`;
                    return (
                      <div key={category}>
                        <button
                          onClick={() => {
                            setSelectedLine(line);
                            setSelectedCategory(category);
                            setSelectedHeight(null);
                            setExpandedCategory(isCategoryExpanded ? null : `${line}/${category}`);
                          }}
                          style={{
                            ...((selectedLine === line && selectedCategory === category && !selectedHeight) ? activeNodeStyle : inactiveNodeStyle),
                            border: 'none',
                            fontFamily: 'inherit',
                            width: '100%',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: '0.8rem' }}>
                            {isCategoryExpanded ? '▼' : '▶'}
                          </span>
                          {category}
                        </button>
                        {isCategoryExpanded && (
                          <div style={{ paddingLeft: '1rem', borderLeft: '1px solid #d4cdc5' }}>
                            {heights.map((height) => (
                              <button
                                key={height}
                                onClick={() => {
                                  setSelectedLine(line);
                                  setSelectedCategory(category);
                                  setSelectedHeight(height);
                                }}
                                style={{
                                  ...((selectedLine === line && selectedCategory === category && selectedHeight === height) ? activeNodeStyle : inactiveNodeStyle),
                                  border: 'none',
                                  fontFamily: 'inherit',
                                  width: '100%',
                                  textAlign: 'left',
                                }}
                              >
                                <span style={{ fontSize: '0.65rem' }}>•</span>
                                {height}mm
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        {selectedLine && selectedCategory && selectedHeight ? (
          <SKUList
            items={getItems(selectedLine, selectedCategory, selectedHeight)}
            onAddClick={(item) => handleAddClick(item, selectedLine, selectedCategory, selectedHeight)}
          />
        ) : (
          <div style={{
            padding: '2rem',
            background: '#fdfcfa',
            border: '1px solid #e8e0d8',
            borderRadius: '4px',
            textAlign: 'center',
            color: '#8a8279',
          }}>
            Select a product line, category, and carcase height to view SKUs
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && selectedItem && (
        <AddToOrderModal
          item={selectedItem}
          onConfirm={handleConfirmAdd}
          onCancel={() => {
            setModalOpen(false);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}

function SKUList({ items, onAddClick }: { items: any[]; onAddClick: (item: any) => void }) {
  return (
    <div>
      {items.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>
          No SKUs found
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {items.map((item) => (
            <SKUCard
              key={item.s}
              item={item}
              onAddClick={() => onAddClick(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SKUCard({ item, onAddClick }: { item: any; onAddClick: () => void }) {
  const priceGroupLabels = ['N', '0', '1', '2', '3', '4', '5', '6', '7', '8', '10'];
  const materialLabels = ['K', 'KS', 'LU', 'L', 'H', 'H1', 'H2', 'F', 'FE', 'G'];
  const labels = item.pt === 'material' ? materialLabels : priceGroupLabels;

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div style={{
      background: '#fdfcfa',
      border: '1px solid #e8e0d8',
      borderRadius: '4px',
      padding: '1.25rem',
    }}>
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '1.15rem',
          fontWeight: 500,
          color: '#b87333',
          marginBottom: '0.25rem',
        }}>
          {item.s}
        </h4>
        {item.d && (
          <p style={{ fontSize: '0.78rem', color: '#8a8279', lineHeight: 1.4 }}>
            {item.d}
          </p>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
        marginBottom: '1rem',
        fontSize: '0.78rem',
      }}>
        <div>
          <span style={{ color: '#8a8279', fontWeight: 600 }}>Width:</span>{' '}
          <span style={{ color: '#2d2d2d' }}>{item.w}mm</span>
        </div>
        {item.dr && (
          <div>
            <span style={{ color: '#8a8279', fontWeight: 600 }}>Door:</span>{' '}
            <span style={{ color: '#2d2d2d' }}>{item.dr}</span>
          </div>
        )}
      </div>

      {/* Price Grid */}
      <div style={{
        marginBottom: '1.25rem',
        background: '#f7f4f0',
        padding: '0.75rem',
        borderRadius: '3px',
        overflowX: 'auto',
      }}>
        <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {labels.map((label) => (
                <th
                  key={label}
                  style={{
                    padding: '0.4rem 0.3rem',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: '#4a4a4a',
                    borderBottom: '1px solid #d4cdc5',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {labels.map((label) => {
                const priceKey = item.pt === 'material'
                  ? label
                  : label === 'N' ? '0' : label;
                const price = item.p[priceKey] || 0;
                return (
                  <td
                    key={label}
                    style={{
                      padding: '0.35rem 0.3rem',
                      textAlign: 'center',
                      color: '#2d2d2d',
                      borderBottom: '1px solid #d4cdc5',
                    }}
                  >
                    {formatPrice(price)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <button
        onClick={onAddClick}
        style={{
          width: '100%',
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
        Add to Order
      </button>
    </div>
  );
}
