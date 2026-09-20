import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { 
  SlidersHorizontal, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Star, 
  Zap, 
  Check, 
  RotateCcw,
  Tag,
  Truck,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [facets, setFacets] = useState({ brands: [], price_limits: { min_price: 0, max_price: 200000 }, categories: [] });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 24, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [nlAnalysis, setNlAnalysis] = useState(null);

  // Mobile Filter Drawer Toggle
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');

  // Active Filter Params
  const selectedCategory = searchParams.get('category') || '';
  const selectedBrands = searchParams.get('brand') ? searchParams.get('brand').split(',').map(b => b.trim()).filter(Boolean) : [];
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const minRating = searchParams.get('min_rating') || '';
  const minDiscount = searchParams.get('min_discount') || '';
  const fastDelivery = searchParams.get('fast_delivery') === 'true';
  const currentSort = searchParams.get('sort') || 'newest';
  const searchQuery = searchParams.get('q') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Local inputs for custom price range
  const [localMinPrice, setLocalMinPrice] = useState(minPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice);

  useEffect(() => {
    setLocalMinPrice(minPrice);
    setLocalMaxPrice(maxPrice);
  }, [minPrice, maxPrice]);

  // Fetch Categories & Facets on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catRes, facetRes] = await Promise.all([
          api.get('/categories'),
          api.get('/products/facets')
        ]);
        if (catRes.data?.success) setCategories(catRes.data.data.categories || []);
        if (facetRes.data?.success) setFacets(facetRes.data.data);
      } catch (err) {
        console.error('Failed to load explore facets:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch Products based on all active parameters
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        let url = `/products?sort=${currentSort}&limit=24&page=${currentPage}`;
        if (selectedCategory) url += `&category_id=${selectedCategory}`;
        if (selectedBrands.length > 0) url += `&brand=${encodeURIComponent(selectedBrands.join(','))}`;
        if (minPrice) url += `&min_price=${minPrice}`;
        if (maxPrice) url += `&max_price=${maxPrice}`;
        if (minRating) url += `&min_rating=${minRating}`;
        if (minDiscount) url += `&min_discount=${minDiscount}`;
        if (fastDelivery) url += `&fast_delivery=true`;
        if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;

        const res = await api.get(url);
        if (res.data?.success) {
          setProducts(res.data.data.products || []);
          if (res.data.data.pagination) {
            setPagination(res.data.data.pagination);
          }
          setNlAnalysis(res.data.data.nl_analysis || null);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, selectedBrands.join(','), minPrice, maxPrice, minRating, minDiscount, fastDelivery, currentSort, searchQuery, currentPage]);

  // Helper to update search params
  const updateParams = (updater) => {
    const params = new URLSearchParams(searchParams);
    updater(params);
    params.set('page', '1');
    setSearchParams(params);
  };

  const toggleBrand = (brandName) => {
    updateParams((params) => {
      let current = params.get('brand') ? params.get('brand').split(',').map(b => b.trim()).filter(Boolean) : [];
      if (current.includes(brandName)) {
        current = current.filter(b => b !== brandName);
      } else {
        current.push(brandName);
      }
      if (current.length > 0) {
        params.set('brand', current.join(','));
      } else {
        params.delete('brand');
      }
    });
  };

  const handlePricePreset = (min, max) => {
    updateParams((params) => {
      if (min !== undefined && min !== null && min !== '') params.set('min_price', min);
      else params.delete('min_price');

      if (max !== undefined && max !== null && max !== '') params.set('max_price', max);
      else params.delete('max_price');
    });
  };

  const applyCustomPrice = (e) => {
    e?.preventDefault();
    updateParams((params) => {
      if (localMinPrice) params.set('min_price', localMinPrice);
      else params.delete('min_price');

      if (localMaxPrice) params.set('max_price', localMaxPrice);
      else params.delete('max_price');
    });
  };

  const handleRatingChange = (rating) => {
    updateParams((params) => {
      if (minRating === String(rating)) {
        params.delete('min_rating');
      } else {
        params.set('min_rating', rating);
      }
    });
  };

  const handleDiscountChange = (discount) => {
    updateParams((params) => {
      if (minDiscount === String(discount)) {
        params.delete('min_discount');
      } else {
        params.set('min_discount', discount);
      }
    });
  };

  const handleFastDeliveryToggle = () => {
    updateParams((params) => {
      if (fastDelivery) {
        params.delete('fast_delivery');
      } else {
        params.set('fast_delivery', 'true');
      }
    });
  };

  const handleCategorySelect = (catId) => {
    updateParams((params) => {
      if (catId) {
        params.set('category', catId);
      } else {
        params.delete('category');
      }
    });
  };

  const handleSortChange = (sort) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', sort);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    params.set('sort', 'newest');
    setSearchParams(params);
  };

  // Count how many active filters
  const activeFilterCount = (selectedCategory ? 1 : 0) +
    selectedBrands.length +
    (minPrice || maxPrice ? 1 : 0) +
    (minRating ? 1 : 0) +
    (minDiscount ? 1 : 0) +
    (fastDelivery ? 1 : 0);

  // Filtered brands by local search
  const displayedBrands = (facets.brands || []).filter(b => 
    b.name && b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  // Reusable Filter Sections (for Desktop Sidebar and Mobile Drawer)
  const FilterControls = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Fast Delivery (Amazon Prime Benchmark) */}
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Delivery Speed
        </h4>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '8px',
          backgroundColor: fastDelivery ? '#f0fdf4' : '#f8fafc',
          border: fastDelivery ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
          transition: 'all 0.15s ease'
        }}>
          <input
            type="checkbox"
            checked={fastDelivery}
            onChange={handleFastDeliveryToggle}
            style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={15} fill="#16a34a" color="#16a34a" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>
              Next-Day Delivery
            </span>
          </div>
        </label>
      </div>

      {/* 2. Brand Facets with Search & Live Counts */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Brands ({facets.brands?.length || 0})
          </h4>
          {selectedBrands.length > 0 && (
            <button
              onClick={() => updateParams(p => p.delete('brand'))}
              style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Brand search filter if > 5 brands */}
        {facets.brands?.length > 5 && (
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Search brand..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 28px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>
        )}

        <div style={{
          maxHeight: '220px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingRight: '4px',
          scrollbarWidth: 'thin'
        }}>
          {displayedBrands.map((b) => {
            const isChecked = selectedBrands.includes(b.name);
            return (
              <label
                key={b.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  color: isChecked ? '#0f172a' : '#475569',
                  fontWeight: isChecked ? 700 : 500,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  backgroundColor: isChecked ? '#f1f5f9' : 'transparent',
                  transition: 'background-color 0.1s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleBrand(b.name)}
                    style={{ width: '15px', height: '15px', accentColor: '#0f172a', cursor: 'pointer' }}
                  />
                  <span>{b.name}</span>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  ({b.count})
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. Price Filter (Presets + Custom Inputs) */}
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Price Range (₹)
        </h4>

        {/* Quick Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
          {[
            { label: 'Under ₹1,000', min: '', max: '1000' },
            { label: '₹1,000 - ₹5,000', min: '1000', max: '5000' },
            { label: '₹5,000 - ₹20,000', min: '5000', max: '20000' },
            { label: '₹20,000 - ₹50,000', min: '20000', max: '50000' },
            { label: 'Over ₹50,000', min: '50000', max: '' }
          ].map((preset, idx) => {
            const isSelected = minPrice === preset.min && maxPrice === preset.max;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handlePricePreset(isSelected ? '' : preset.min, isSelected ? '' : preset.max)}
                style={{
                  textAlign: 'left',
                  fontSize: '12.5px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  color: isSelected ? '#0f172a' : '#475569',
                  backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {isSelected ? '✓ ' : ''}{preset.label}
              </button>
            );
          })}
        </div>

        {/* Custom Min / Max Inputs */}
        <form onSubmit={applyCustomPrice} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="number"
            placeholder="₹ Min"
            value={localMinPrice}
            onChange={(e) => setLocalMinPrice(e.target.value)}
            style={{
              width: '75px',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              outline: 'none'
            }}
          />
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
          <input
            type="number"
            placeholder="₹ Max"
            value={localMaxPrice}
            onChange={(e) => setLocalMaxPrice(e.target.value)}
            style={{
              width: '75px',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Go
          </button>
        </form>
      </div>

      {/* 4. Customer Ratings (4★ & Above, 3★ & Above) */}
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Customer Reviews
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { stars: '4', label: '4★ & above' },
            { stars: '3', label: '3★ & above' },
            { stars: '2', label: '2★ & above' }
          ].map((r) => {
            const isSelected = minRating === r.stars;
            return (
              <button
                key={r.stars}
                type="button"
                onClick={() => handleRatingChange(r.stars)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? '#fef3c7' : 'transparent',
                  color: isSelected ? '#92400e' : '#334155',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      fill={i < parseInt(r.stars, 10) ? '#f59e0b' : '#e2e8f0'}
                      color={i < parseInt(r.stars, 10) ? '#f59e0b' : '#e2e8f0'}
                    />
                  ))}
                </div>
                <span>& Up</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Discount Percentage */}
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Discounts & Offers
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { value: '50', label: '50% Off or more' },
            { value: '25', label: '25% Off or more' },
            { value: '10', label: '10% Off or more' }
          ].map((disc) => {
            const isSelected = minDiscount === disc.value;
            return (
              <button
                key={disc.value}
                type="button"
                onClick={() => handleDiscountChange(disc.value)}
                style={{
                  textAlign: 'left',
                  fontSize: '12.5px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  color: isSelected ? '#dc2626' : '#475569',
                  backgroundColor: isSelected ? '#fef2f2' : 'transparent',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {isSelected ? '✓ ' : ''}{disc.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: '1440px' }}>
      {/* Top Title & Total Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.4px' }}>
            {searchQuery ? `Search Results for "${searchQuery}"` : (selectedCategory ? (categories.find(c => c.id === selectedCategory)?.name || 'Category Items') : 'Explore Verified Marketplace')}
          </h1>
          <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
            Showing {products.length} of {pagination.total} genuine branded items with verified delivery & authentic warranty
          </p>
        </div>

        {/* Sort Dropdown (Desktop & Laptop) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Sort by:</span>
          <select
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#0f172a'
            }}
          >
            <option value="newest">Featured & Newest</option>
            <option value="rating_desc">Avg. Customer Review</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* AI Natural Language Query Intent Banner */}
      {nlAnalysis && nlAnalysis.is_natural_language && (
        <div style={{
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
          border: '1px solid #ddd6fe',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#4c1d95', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>AI Natural Language Search Active</span>
                <span style={{ fontSize: '10px', backgroundColor: '#7c3aed', color: '#fff', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                  pgvector Semantic Core
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#5b21b6', marginTop: '3px' }}>
                Semantic core identified: <strong>"{nlAnalysis.clean_query}"</strong>
              </div>
            </div>
          </div>

          {/* Inferred Intent Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {nlAnalysis.applied_intent?.max_price && (
              <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '16px', backgroundColor: '#ffffff', color: '#6d28d9', fontWeight: 700, border: '1px solid #c4b5fd' }}>
                Under ₹{nlAnalysis.applied_intent.max_price.toLocaleString('en-IN')}
              </span>
            )}
            {nlAnalysis.applied_intent?.min_price && (
              <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '16px', backgroundColor: '#ffffff', color: '#6d28d9', fontWeight: 700, border: '1px solid #c4b5fd' }}>
                Above ₹{nlAnalysis.applied_intent.min_price.toLocaleString('en-IN')}
              </span>
            )}
            {nlAnalysis.applied_intent?.brand && (
              <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '16px', backgroundColor: '#ffffff', color: '#6d28d9', fontWeight: 700, border: '1px solid #c4b5fd' }}>
                Brand: {nlAnalysis.applied_intent.brand}
              </span>
            )}
            {nlAnalysis.applied_intent?.min_rating && (
              <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '16px', backgroundColor: '#ffffff', color: '#6d28d9', fontWeight: 700, border: '1px solid #c4b5fd' }}>
                Top Rated ({nlAnalysis.applied_intent.min_rating}★+)
              </span>
            )}
            {nlAnalysis.applied_intent?.fast_delivery && (
              <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '16px', backgroundColor: '#ffffff', color: '#6d28d9', fontWeight: 700, border: '1px solid #c4b5fd' }}>
                ⚡ Next-Day Delivery
              </span>
            )}
          </div>
        </div>
      )}

      {/* Horizontal Category Carousel / Strip */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px', scrollbarWidth: 'none' }}>
        <button
          onClick={() => handleCategorySelect('')}
          style={{
            padding: '7px 16px',
            borderRadius: '20px',
            backgroundColor: !selectedCategory ? '#0f172a' : '#ffffff',
            color: !selectedCategory ? '#ffffff' : '#334155',
            border: !selectedCategory ? '1px solid #0f172a' : '1px solid #e2e8f0',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySelect(cat.id)}
            style={{
              padding: '7px 16px',
              borderRadius: '20px',
              backgroundColor: selectedCategory === cat.id ? '#0f172a' : '#ffffff',
              color: selectedCategory === cat.id ? '#ffffff' : '#334155',
              border: selectedCategory === cat.id ? '1px solid #0f172a' : '1px solid #e2e8f0',
              fontSize: '12.5px',
              fontWeight: selectedCategory === cat.id ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* MOBILE FILTER & SORT BAR (Visible only on screens < 960px) */}
      <div className="explore-mobile-filter-bar">
        <button
          onClick={() => setMobileFilterOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: activeFilterCount > 0 ? '#0f172a' : '#f1f5f9',
            color: activeFilterCount > 0 ? '#ffffff' : '#0f172a',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <SlidersHorizontal size={15} />
          <span>Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            style={{
              fontSize: '12px',
              color: '#dc2626',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Active Filter Chips / Badges Row */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Active Filters:</span>

          {fastDelivery && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '16px', backgroundColor: '#f0fdf4', color: '#16a34a', fontSize: '11.5px', fontWeight: 700, border: '1px solid #bbf7d0' }}>
              ⚡ Next-Day Delivery
              <X size={13} style={{ cursor: 'pointer' }} onClick={handleFastDeliveryToggle} />
            </span>
          )}

          {selectedBrands.map((b) => (
            <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '16px', backgroundColor: '#f1f5f9', color: '#0f172a', fontSize: '11.5px', fontWeight: 700, border: '1px solid #e2e8f0' }}>
              Brand: {b}
              <X size={13} style={{ cursor: 'pointer' }} onClick={() => toggleBrand(b)} />
            </span>
          ))}

          {(minPrice || maxPrice) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '16px', backgroundColor: '#f1f5f9', color: '#0f172a', fontSize: '11.5px', fontWeight: 700, border: '1px solid #e2e8f0' }}>
              Price: {minPrice ? `₹${parseInt(minPrice, 10).toLocaleString('en-IN')}` : '₹0'} - {maxPrice ? `₹${parseInt(maxPrice, 10).toLocaleString('en-IN')}` : 'Any'}
              <X size={13} style={{ cursor: 'pointer' }} onClick={() => handlePricePreset('', '')} />
            </span>
          )}

          {minRating && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '16px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '11.5px', fontWeight: 700, border: '1px solid #fde68a' }}>
              {minRating}★ & Above
              <X size={13} style={{ cursor: 'pointer' }} onClick={() => handleRatingChange(minRating)} />
            </span>
          )}

          {minDiscount && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '16px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '11.5px', fontWeight: 700, border: '1px solid #fecaca' }}>
              {minDiscount}% Off or more
              <X size={13} style={{ cursor: 'pointer' }} onClick={() => handleDiscountChange(minDiscount)} />
            </span>
          )}

          <button
            onClick={clearAllFilters}
            style={{
              fontSize: '11.5px',
              color: '#2563eb',
              fontWeight: 700,
              textDecoration: 'underline',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* MAIN TWO-COLUMN EXPLORE ARCHITECTURE */}
      <div className="explore-container">
        {/* DESKTOP / LAPTOP LEFT FACETED SIDEBAR (Sticky) */}
        <aside className="explore-sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SlidersHorizontal size={16} /> Filters
            </h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}
              >
                Clear all
              </button>
            )}
          </div>

          <FilterControls />
        </aside>

        {/* RIGHT MAIN PRODUCT CATALOG */}
        <main className="explore-main-content">
          {loading ? (
            <div className="product-grid-catalog">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} style={{ height: '360px', borderRadius: '12px' }} className="skeleton" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '64px 20px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Search size={26} color="#64748b" />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                No matching products found
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto 20px' }}>
                Try removing some filters or adjusting your search keyword to see more genuine marketplace items.
              </p>
              <button
                onClick={clearAllFilters}
                className="btn-primary"
                style={{ padding: '10px 20px' }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <>
              <div className="product-grid-catalog">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Responsive Pagination Bar */}
              {pagination.pages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '24px 0',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="btn-outline"
                    style={{
                      padding: '8px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      opacity: currentPage <= 1 ? 0.4 : 1,
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>

                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                    Page {currentPage} of {pagination.pages}
                  </span>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= pagination.pages}
                    className="btn-outline"
                    style={{
                      padding: '8px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      opacity: currentPage >= pagination.pages ? 0.4 : 1,
                      cursor: currentPage >= pagination.pages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* MOBILE SLIDE-OVER FILTER DRAWER */}
      {mobileFilterOpen && (
        <div className="mobile-filter-drawer-overlay" onClick={() => setMobileFilterOpen(false)}>
          <div className="mobile-filter-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} />
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Filter Products {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                </span>
              </div>
              <button
                onClick={() => setMobileFilterOpen(false)}
                style={{ padding: '6px', cursor: 'pointer', borderRadius: '4px', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <FilterControls />
            </div>

            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              display: 'flex',
              gap: '12px'
            }}>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#475569',
                    backgroundColor: '#ffffff'
                  }}
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="btn-primary"
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                View Results ({pagination.total})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
