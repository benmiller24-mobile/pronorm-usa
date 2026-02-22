import React, { useState, useCallback, useMemo } from 'react';
import type { OrderLineItem } from '../PricingTool';
import AddToOrderModal from './AddToOrderModal';

interface SearchItem {
  s: string;
  d: string;
  w: number;
  pl: string;
  cat: string;
  ch: number;
  pt: 'price_group' | 'material';
  p: Record<string, number>;
  dr: string | null;
  img?: string;
}

interface PricingSearchProps {
  searchData: SearchItem[];
  onAddToOrder: (item: OrderLineItem) => void;
}

export default function PricingSearch({ searchData, onAddToOrder }: PricingSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear previous timer
    if (debounceTimer) clearTimeout(debounceTimer);

    // Set new debounced search
    const timer = setTimeout(() => {
      setDebouncedQuery(value.toLowerCase());
    }, 300);

    setDebounceTimer(timer);
  }, [debounceTimer]);

  const results = useMemo(() => {
    if (!debouncedQuery) return [];

    return searchData.filter((item) => {
      const query = debouncedQuery;
      return (
        item.s.toLowerCase().includes(query) ||
        item.d.toLowerCase().includes(query)
      );
    }).slice(0, 100); // Limit to 100 results
  }, [debouncedQuery, searchData]);

  const handleAddClick = (item: SearchItem) => {
    setSelectedItem(item);
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
      productLine: selectedItem.pl,
      category: selectedItem.cat,
      height: selectedItem.ch,
    });
    setModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div>
      {/* Search Bar */}
      <div style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Search by SKU or description... (e.g., UR 45, Base unit)"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '0.8rem 1rem',
            fontSize: '0.95rem',
            border: '1px solid #d4cdc5',
            borderRadius: '4px',
            fontFamily: 'inherit',
            background: '#fdfcfa',
          }}
        />
        <div style={{
          fontSize: '0.78rem',
          color: '#8a8279',
          marginTop: '0.5rem',
        }}>
          {debouncedQuery && `Found ${results.length} result${results.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Results */}
      {results.length === 0 && debouncedQuery ? (
        <div style={{
          padding: '2rem',
          background: '#fdfcfa',
          border: '1px solid #e8e0d8',
          borderRadius: '4px',
          textAlign: 'center',
          color: '#8a8279',
        }}>
          No results found for "{debouncedQuery}"
        </div>
      ) : results.length === 0 ? (
        <div style={{
          padding: '2rem',
          background: '#fdfcfa',
          border: '1px solid #e8e0d8',
          borderRadius: '4px',
          textAlign: 'center',
          color: '#8a8279',
        }}>
          Start typing to search for products
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {results.map((item) => (
            <SearchResultCard
              key={`${item.pl}-${item.cat}-${item.ch}-${item.s}`}
              item={item}
              onAddClick={() => handleAddClick(item)}
            />
          ))}
        </div>
      )}

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

function SearchResultCard({ item, onAddClick }: { item: any; onAddClick: () => void }) {
  const formatPrice = (price: number) => {
    return `€${price.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const basePrice = Math.min(...Object.values(item.p));
  const maxPrice = Math.max(...Object.values(item.p));

  return (
    <div style={{
      background: '#fdfcfa',
      border: '1px solid #e8e0d8',
      borderRadius: '4px',
      padding: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    }}>
      {/* Diagram image */}
      {item.img && (
        <div style={{
          flexShrink: 0,
          width: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={`/data/diagrams/${item.img}`}
            alt={item.s}
            style={{
              maxWidth: '70px',
              maxHeight: '90px',
              objectFit: 'contain',
              borderRadius: '2px',
            }}
            loading="lazy"
          />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <h4 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '1.1rem',
          fontWeight: 500,
          color: '#b87333',
          marginBottom: '0.25rem',
        }}>
          {item.s}
        </h4>
        {item.d && (
          <p style={{
            fontSize: '0.78rem',
            color: '#8a8279',
            marginBottom: '0.5rem',
            lineHeight: 1.4,
          }}>
            {item.d}
          </p>
        )}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          fontSize: '0.78rem',
          color: '#4a4a4a',
        }}>
          <span><strong>Line:</strong> {item.pl}</span>
          <span><strong>Category:</strong> {item.cat}</span>
          <span><strong>Height:</strong> {item.ch}mm</span>
          <span><strong>Width:</strong> {item.w}mm</span>
          {item.dr && <span><strong>Door:</strong> {item.dr}</span>}
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '0.75rem',
        whiteSpace: 'nowrap',
      }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '0.7rem',
            color: '#8a8279',
            fontWeight: 600,
            marginBottom: '0.25rem',
            letterSpacing: '0.05em',
          }}>
            Price Range
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '0.95rem',
            fontWeight: 500,
            color: '#2d2d2d',
          }}>
            {formatPrice(basePrice)} – {formatPrice(maxPrice)}
          </div>
        </div>
        <button
          onClick={onAddClick}
          style={{
            padding: '0.6rem 1.2rem',
            background: '#b87333',
            color: '#fdfcfa',
            border: 'none',
            borderRadius: '3px',
            fontSize: '0.75rem',
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
  );
}
