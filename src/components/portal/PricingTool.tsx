import React, { useState, useEffect } from 'react';
import type { Dealer } from '../../lib/types';
import PricingBrowse from './pricing/PricingBrowse';
import PricingSearch from './pricing/PricingSearch';
import PricingOrder from './pricing/PricingOrder';

export interface PricingToolProps {
  dealer: Dealer;
  onNavigate: (path: string) => void;
}

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
}

export interface SpecialConstructionSelection {
  sku: string;
  description: string;
  price: number;
  inputValue?: string;
}

export interface OrderLineItem {
  sku: string;
  description: string;
  width: number;
  doorOrientation: string | null;
  priceGroup: number;
  unitPrice: number;
  quantity: number;
  productLine: string;
  category: string;
  height: number;
  specialConstructions?: SpecialConstructionSelection[];
}

export default function PricingTool({ dealer, onNavigate }: PricingToolProps) {
  const [activeTab, setActiveTab] = useState('browse');
  const [catalogData, setCatalogData] = useState<CatalogData | null>(null);
  const [searchData, setSearchData] = useState<SearchItem[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderLineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [freight, setFreight] = useState(0);
  const [specialConstructionsData, setSpecialConstructionsData] = useState<any>(null);

  // Load catalog and special constructions on mount
  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch('/data/pricing-catalog.json');
        const data = await response.json();
        setCatalogData(data);
      } catch (error) {
        console.error('Failed to load catalog:', error);
      } finally {
        setCatalogLoading(false);
      }
    }
    async function loadSpecialConstructions() {
      try {
        const response = await fetch('/data/special-constructions.json');
        const data = await response.json();
        setSpecialConstructionsData(data);
      } catch (error) {
        console.error('Failed to load special constructions:', error);
      }
    }
    loadCatalog();
    loadSpecialConstructions();
  }, []);

  // Load search data lazily when search tab is opened
  useEffect(() => {
    if (activeTab === 'search' && !searchData) {
      async function loadSearch() {
        setSearchLoading(true);
        try {
          const response = await fetch('/data/pricing-search.json');
          const data = await response.json();
          setSearchData(data);
        } catch (error) {
          console.error('Failed to load search data:', error);
        } finally {
          setSearchLoading(false);
        }
      }
      loadSearch();
    }
  }, [activeTab, searchData]);

  const addToOrder = (item: OrderLineItem) => {
    setOrderItems([...orderItems, item]);
  };

  const removeFromOrder = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index: number, updates: Partial<OrderLineItem>) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], ...updates };
    setOrderItems(newItems);
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.75rem 1.5rem',
    fontSize: '0.85rem',
    fontWeight: isActive ? 600 : 400,
    background: isActive ? '#b87333' : 'transparent',
    color: isActive ? '#fdfcfa' : '#4a4a4a',
    border: 'none',
    borderRadius: '3px 3px 0 0',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 200ms',
  });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '2rem',
          fontWeight: 400,
          color: '#1a1a1a',
          marginBottom: '0.25rem',
        }}>
          Pricing Tool
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#8a8279' }}>
          Browse catalog, search products, and build orders with dealer pricing
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '2rem',
        borderBottom: '2px solid #e8e0d8',
      }}>
        <button
          onClick={() => setActiveTab('browse')}
          style={tabButtonStyle(activeTab === 'browse')}
        >
          Browse Catalog
        </button>
        <button
          onClick={() => setActiveTab('search')}
          style={tabButtonStyle(activeTab === 'search')}
        >
          Search
        </button>
        <button
          onClick={() => setActiveTab('order')}
          style={tabButtonStyle(activeTab === 'order')}
        >
          My Order
          {orderItems.length > 0 && (
            <span style={{
              marginLeft: '0.5rem',
              background: '#b87333',
              color: '#fdfcfa',
              borderRadius: '10px',
              padding: '0.1rem 0.4rem',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}>
              {orderItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'browse' && (
          catalogLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>
              Loading catalog...
            </div>
          ) : catalogData ? (
            <PricingBrowse
              catalogData={catalogData}
              onAddToOrder={addToOrder}
              specialConstructionsData={specialConstructionsData}
            />
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#d9534f' }}>
              Failed to load catalog
            </div>
          )
        )}

        {activeTab === 'search' && (
          searchLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#8a8279' }}>
              Loading search index...
            </div>
          ) : searchData ? (
            <PricingSearch
              searchData={searchData}
              onAddToOrder={addToOrder}
            />
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#d9534f' }}>
              Failed to load search data
            </div>
          )
        )}

        {activeTab === 'order' && (
          <PricingOrder
            items={orderItems}
            discount={discount}
            freight={freight}
            onDisountChange={setDiscount}
            onFreightChange={setFreight}
            onRemoveItem={removeFromOrder}
            onUpdateItem={updateOrderItem}
          />
        )}
      </div>
    </div>
  );
}
