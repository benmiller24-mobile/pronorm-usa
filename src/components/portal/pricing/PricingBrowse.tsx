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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const plOrder: Record<string, number> = { 'proline': 0, 'x-line': 1, 'y-line': 2, 'living': 3 };
  const productLines = Object.keys(catalogData).sort((a, b) => (plOrder[a] ?? 99) - (plOrder[b] ?? 99));

  const getCategories = (line: string) => {
    const cats = Object.keys(catalogData[line] || {});
    // Sort categories by the minimum page number of their items (PDF sequence)
    return cats.sort((a, b) => {
      const minPgA = Math.min(...Object.values(catalogData[line]?.[a] || {}).flatMap((items: any) => (items as CatalogItem[]).map((i: CatalogItem) => i.pg || 9999)));
      const minPgB = Math.min(...Object.values(catalogData[line]?.[b] || {}).flatMap((items: any) => (items as CatalogItem[]).map((i: CatalogItem) => i.pg || 9999)));
      return minPgA - minPgB;
    });
  };

  const getHeights = (line: string, category: string) => {
    const heights = Object.keys(catalogData[line]?.[category] || {});
    // Sort by minimum page number within each height group (PDF sequence)
    return heights.sort((a, b) => {
      const itemsA = catalogData[line]?.[category]?.[a] || [];
      const itemsB = catalogData[line]?.[category]?.[b] || [];
      const minPgA = Math.min(...itemsA.map((i: CatalogItem) => i.pg || 9999));
      const minPgB = Math.min(...itemsB.map((i: CatalogItem) => i.pg || 9999));
      return minPgA - minPgB;
    });
  };

  const getItems = (line: string, category: string, height: string) => {
    const items = catalogData[line]?.[category]?.[height] || [];
    // Sort items by page number (PDF sequence)
    return [...items].sort((a: CatalogItem, b: CatalogItem) => (a.pg || 9999) - (b.pg || 9999));
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
            onZoomImage={setZoomedImage}
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

      {/* Add to Order Modal */}
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

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            padding: '2rem',
          }}
        >
          <img
            src={`/data/diagrams/${zoomedImage}`}
            alt="Zoomed product group"
            style={{
              maxWidth: '95vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '4px',
              boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
            }}
          />
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1.5rem',
            color: '#fff',
            fontSize: '0.8rem',
            opacity: 0.7,
          }}>
            Click anywhere to close
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * Groups items by shared image and shows price book sections with
 * only the items from the current filtered view as Add buttons.
 */
function PriceBookView({ items, onAddClick, category, height, line, onZoomImage }: {
  items: any[];
  onAddClick: (item: any) => void;
  category: string;
  height: string;
  line: string;
  onZoomImage: (img: string) => void;
}) {
  // Group items by their image
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
            onZoomImage={onZoomImage}
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
                <CompactSKURow
                  key={item.s}
                  item={item}
                  onAddClick={() => onAddClick(item)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function ProductGroupCard({ imgSrc, items, onAddClick, onZoomImage }: {
  imgSrc: string;
  items: any[];
  onAddClick: (item: any) => void;
  onZoomImage: (img: string) => void;
}) {
  return (
    <div style={{
      background: '#fdfcfa',
      border: '1px solid #e8e0d8',
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      {/* Full-width price book section image — click to zoom */}
      <div
        onClick={() => onZoomImage(imgSrc)}
        style={{
          width: '100%',
          background: '#fff',
          borderBottom: '1px solid #e8e0d8',
          cursor: 'zoom-in',
          position: 'relative',
        }}
      >
        <img
          src={`/data/diagrams/${imgSrc}`}
          alt={items[0]?.s || 'Product group'}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
          }}
          loading="lazy"
        />
        <div style={{
          position: 'absolute',
          bottom: '0.5rem',
          right: '0.5rem',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          padding: '0.2rem 0.5rem',
          borderRadius: '3px',
          fontSize: '0.65rem',
        }}>
          Click to zoom
        </div>
      </div>

      {/* SKU action buttons */}
      <div style={{
        padding: '0.75rem 1rem',
        background: '#f7f4f0',
      }}>
        <div style={{
          fontSize: '0.72rem',
          fontWeight: 600,
          color: '#8a8279',
          letterSpacing: '0.04em',
          marginBottom: '0.5rem',
        }}>
          Add to order:
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          alignItems: 'center',
        }}>
          {items.map((item) => (
            <button
              key={item.s}
              onClick={() => onAddClick(item)}
              title={`${item.s}${item.d ? ' — ' + item.d : ''} (${item.w}cm${item.dr ? ', ' + item.dr : ''})`}
              style={{
                padding: '0.35rem 0.6rem',
                background: '#b87333',
                color: '#fdfcfa',
                border: 'none',
                borderRadius: '3px',
                fontSize: '0.7rem',
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
