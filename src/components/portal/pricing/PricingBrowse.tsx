import React, { useState, useMemo } from 'react';
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
  img?: string;
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
    width: '240px',
    minWidth: '240px',
    background: '#fdfcfa',
    border: '1px solid #e8e0d8',
    borderRadius: '4px',
    marginRight: '1.5rem',
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

      {/* Main Content — Price Book View */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedLine && selectedCategory && selectedHeight ? (
          <PriceBookView
            items={getItems(selectedLine, selectedCategory, selectedHeight)}
            onAddClick={(item) => handleAddClick(item, selectedLine, selectedCategory, selectedHeight)}
            category={selectedCategory}
            height={selectedHeight}
            line={selectedLine}
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


/**
 * Groups SKU items by their shared image (product group from price book),
 * then displays each group as a full-width price book section image
 * with an "Add to Order" button per individual SKU.
 */
function PriceBookView({ items, onAddClick, category, height, line }: {
  items: any[];
  onAddClick: (item: any) => void;
  category: string;
  height: string;
  line: string;
}) {
  // Group items by their image (items sharing same image = same product group)
  const groups = useMemo(() => {
    const byImage: Record<string, any[]> = {};
    const noImage: any[] = [];

    for (const item of items) {
      if (item.img) {
        if (!byImage[item.img]) byImage[item.img] = [];
        byImage[item.img].push(item);
      } else {
        noImage.push(item);
      }
    }

    // Sort groups by first SKU
    const sorted = Object.entries(byImage).sort(([, a], [, b]) =>
      a[0].s.localeCompare(b[0].s)
    );

    return { sorted, noImage };
  }, [items]);

  if (items.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>
        No SKUs found
      </div>
    );
  }

  return (
    <div>
      {/* Section header */}
      <div style={{
        marginBottom: '1.25rem',
        paddingBottom: '0.75rem',
        borderBottom: '2px solid #b87333',
      }}>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '1.35rem',
          fontWeight: 500,
          color: '#2d2d2d',
          marginBottom: '0.25rem',
        }}>
          {category}
        </h3>
        <span style={{ fontSize: '0.82rem', color: '#8a8279' }}>
          {line} — Carcase height {height}mm — {items.length} SKU{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Product groups as price book sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {groups.sorted.map(([imgSrc, groupItems]) => (
          <ProductGroupCard
            key={imgSrc}
            imgSrc={imgSrc}
            items={groupItems}
            onAddClick={onAddClick}
          />
        ))}

        {/* Items without images */}
        {groups.noImage.length > 0 && (
          <div style={{
            background: '#fdfcfa',
            border: '1px solid #e8e0d8',
            borderRadius: '4px',
            padding: '1.25rem',
          }}>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#8a8279',
              marginBottom: '1rem',
            }}>
              Additional SKUs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {groups.noImage.map((item) => (
                <CompactSKURow key={item.s} item={item} onAddClick={() => onAddClick(item)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function ProductGroupCard({ imgSrc, items, onAddClick }: {
  imgSrc: string;
  items: any[];
  onAddClick: (item: any) => void;
}) {
  return (
    <div style={{
      background: '#fdfcfa',
      border: '1px solid #e8e0d8',
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      {/* Full-width price book section image */}
      <div style={{
        width: '100%',
        background: '#fff',
        borderBottom: '1px solid #e8e0d8',
        overflow: 'auto',
      }}>
        <img
          src={`/data/diagrams/${imgSrc}`}
          alt={items[0]?.s || 'Product group'}
          style={{
            display: 'block',
            width: '100%',
            minWidth: '700px',
            height: 'auto',
          }}
          loading="lazy"
        />
      </div>

      {/* SKU action row */}
      <div style={{
        padding: '0.75rem 1rem',
        background: '#f7f4f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 600,
          color: '#8a8279',
          letterSpacing: '0.04em',
          marginRight: '0.5rem',
        }}>
          Add to order:
        </span>
        {items.map((item) => (
          <button
            key={item.s}
            onClick={() => onAddClick(item)}
            title={`${item.s}${item.d ? ' — ' + item.d : ''} (${item.w}cm${item.dr ? ', ' + item.dr : ''})`}
            style={{
              padding: '0.4rem 0.75rem',
              background: '#b87333',
              color: '#fdfcfa',
              border: 'none',
              borderRadius: '3px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 200ms',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#a0642d';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#b87333';
            }}
          >
            {item.s}
          </button>
        ))}
      </div>
    </div>
  );
}


function CompactSKURow({ item, onAddClick }: { item: any; onAddClick: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.5rem 0.75rem',
      background: '#f7f4f0',
      borderRadius: '3px',
      gap: '1rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 500,
          color: '#b87333',
          fontSize: '0.95rem',
          marginRight: '0.75rem',
        }}>
          {item.s}
        </span>
        {item.d && (
          <span style={{ fontSize: '0.78rem', color: '#8a8279' }}>
            {item.d}
          </span>
        )}
      </div>
      <button
        onClick={onAddClick}
        style={{
          padding: '0.35rem 0.75rem',
          background: '#b87333',
          color: '#fdfcfa',
          border: 'none',
          borderRadius: '3px',
          fontSize: '0.72rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
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
  );
}
