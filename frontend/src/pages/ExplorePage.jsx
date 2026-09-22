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
  Tag, 
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
  const brandParam = searchParams.get('brand') || '';
  const selectedBrands = brandParam ? brandParam.split(',').map(b => b.trim()).filter(Boolean) : [];
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
        if (catRes.data?.success) {
          const list = catRes.data?.data?.categories || catRes.data?.categories || (Array.isArray(catRes.data?.data) ? catRes.data.data : []);
          setCategories(list);
        }
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
  }, [selectedCategory, brandParam, minPrice, maxPrice, minRating, minDiscount, fastDelivery, currentSort, searchQuery, currentPage]);

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

  const activeFilterCount = (selectedCategory ? 1 : 0) +
    selectedBrands.length +
    (minPrice || maxPrice ? 1 : 0) +
    (minRating ? 1 : 0) +
    (minDiscount ? 1 : 0) +
    (fastDelivery ? 1 : 0);

  const displayedBrands = (facets.brands || []).filter(b => 
    b.name && b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const FilterControls = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Express Delivery */}
      <div>
        <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ash-label)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Delivery Speed
        </h4>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '8px',
          backgroundColor: fastDelivery ? 'rgba(56, 189, 248, 0.12)' : 'var(--color-titanium-brushed)',
          border: fastDelivery ? '1px solid var(--color-icy-steel)' : '1px solid var(--color-border-steel)',
          transition: 'all 0.15s ease'
        }}>
          <input
            type="checkbox"
            checked={fastDelivery}
            onChange={handleFastDeliveryToggle}
            style={{ width: '15px', height: '15px', accentColor: 'var(--color-icy-steel)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} color="var(--color-icy-steel)" />
            <span style={{ fontSize: '13px', fontWeight: 500, color: fastDelivery ? 'var(--color-icy-steel)' : '#ffffff' }}>
              Express 2-Day Delivery
            </span>
          </div>
        </label>
      </div>

      {/* 2. Brand Facets with Search & Live Counts */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Brands ({facets.brands?.length || 0})
          </h4>
          {selectedBrands.length > 0 && (
            <button
              onClick={() => updateParams(p => p.delete('brand'))}
              style={{ fontSize: '11px', color: 'var(--color-icy-steel)', fontWeight: 500 }}
            >
              Reset
            </button>
          )}
        </div>

        {facets.brands?.length > 5 && (
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search size={13} color="var(--color-ash-label)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Search brand..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 28px',
                borderRadius: '6px',
                border: '1px solid var(--color-iron-veil)',
                backgroundColor: 'var(--color-deep-canopy)',
                color: '#ffffff',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>
        )}

        <div style={{
          maxHeight: '200px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          paddingRight: '4px'
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
                  color: isChecked ? '#ffffff' : 'var(--color-tide-pool)',
                  fontWeight: isChecked ? 600 : 400,
                  cursor: 'pointer',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  backgroundColor: isChecked ? 'var(--color-deep-canopy)' : 'transparent',
                  transition: 'background-color 0.1s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleBrand(b.name)}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--color-icy-steel)', cursor: 'pointer' }}
                  />
                  <span>{b.name}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-slate-caption)' }}>
                  ({b.count})
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. Price Filter (Presets + Custom Inputs) */}
      <div>
        <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-slate-caption)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Price Range (INR)
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textAlign: 'left',
                  fontSize: '12px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  color: isSelected ? 'var(--color-icy-steel)' : 'var(--color-steel-mist)',
                  backgroundColor: isSelected ? 'var(--color-slate-chrome)' : 'transparent',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                {isSelected && <Check size={12} color="var(--color-icy-steel)" />}
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={applyCustomPrice} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="number"
            placeholder="Min"
            value={localMinPrice}
            onChange={(e) => setLocalMinPrice(e.target.value)}
            style={{
              width: '75px',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid var(--color-iron-veil)',
              backgroundColor: 'var(--color-deep-canopy)',
              color: '#ffffff',
              fontSize: '12px',
              outline: 'none'
            }}
          />
          <span style={{ color: 'var(--color-ash-label)', fontSize: '12px' }}>-</span>
          <input
            type="number"
            placeholder="Max"
            value={localMaxPrice}
            onChange={(e) => setLocalMaxPrice(e.target.value)}
            style={{
              width: '75px',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid var(--color-iron-veil)',
              backgroundColor: 'var(--color-deep-canopy)',
              color: '#ffffff',
              fontSize: '12px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              backgroundColor: '#ffffff',
              color: '#02090a',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Go
          </button>
        </form>
      </div>

      {/* 4. Customer Ratings */}
      <div>
        <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ash-label)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Customer Rating
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { stars: '4', label: '4 & above' },
            { stars: '3', label: '3 & above' },
            { stars: '2', label: '2 & above' }
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
                  backgroundColor: isSelected ? 'var(--color-deep-canopy)' : 'transparent',
                  color: isSelected ? '#ffffff' : 'var(--color-tide-pool)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12.5px'
                }}
              >
                <Star size={13} fill="var(--color-icy-steel)" stroke="none" />
                <span style={{ fontWeight: isSelected ? 600 : 400 }}>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Discount Filter */}
      <div>
        <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-slate-caption)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Discount
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { disc: '10', label: '10% off or more' },
            { disc: '20', label: '20% off or more' },
            { disc: '30', label: '30% off or more' },
            { disc: '50', label: '50% off or more' }
          ].map((disc) => {
            const isSelected = minDiscount === disc.disc;
            return (
              <button
                key={disc.disc}
                type="button"
                onClick={() => handleDiscountChange(disc.disc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textAlign: 'left',
                  fontSize: '12.5px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  color: isSelected ? 'var(--color-icy-steel)' : 'var(--color-steel-mist)',
                  backgroundColor: isSelected ? 'var(--color-slate-chrome)' : 'transparent',
                  fontWeight: isSelected ? 600 : 400,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {isSelected && <Check size={12} color="var(--color-icy-steel)" />}
                <span>{disc.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: 'var(--color-abyssal-ink)', minHeight: '100vh', padding: '32px 0' }}>
      <div className="container" style={{ maxWidth: '1400px' }}>
        {/* Top Title & Total Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className="heading-whisper" style={{ fontSize: '24px', marginBottom: '4px' }}>
              {searchQuery ? `Search results for "${searchQuery}"` : (selectedCategory ? (categories.find(c => c.id === selectedCategory)?.name || 'All Products') : 'All Products')}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-tide-pool)' }}>
              Showing {products.length} of {pagination.total} products
            </p>
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort by:</span>
            <select
              value={currentSort}
              onChange={(e) => handleSortChange(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-iron-veil)',
                backgroundColor: 'var(--color-deep-canopy)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                color: '#ffffff',
                outline: 'none'
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
            background: 'var(--color-forest-floor)',
            border: '1px solid var(--color-iron-veil)',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-slate-chrome)',
                border: '1px solid var(--color-border-steel)',
                color: 'var(--color-icy-steel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Smart Search Filters</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-steel-mist)', marginTop: '2px' }}>
                  Matching items for: <strong style={{ color: '#ffffff' }}>"{nlAnalysis.clean_query}"</strong>
                </div>
              </div>
            </div>

            {/* Inferred Intent Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {nlAnalysis.applied_intent?.max_price && (
                <span className="badge badge-neutral">
                  Under ₹{nlAnalysis.applied_intent.max_price.toLocaleString('en-IN')}
                </span>
              )}
              {nlAnalysis.applied_intent?.min_price && (
                <span className="badge badge-neutral">
                  Above ₹{nlAnalysis.applied_intent.min_price.toLocaleString('en-IN')}
                </span>
              )}
              {nlAnalysis.applied_intent?.brand && (
                <span className="badge badge-neutral">
                  Brand: {nlAnalysis.applied_intent.brand}
                </span>
              )}
              {nlAnalysis.applied_intent?.min_rating && (
                <span className="badge badge-mint">
                  <Star size={11} fill="var(--color-icy-steel)" stroke="none" />
                  {nlAnalysis.applied_intent.min_rating}+ Stars
                </span>
              )}
              {nlAnalysis.applied_intent?.fast_delivery && (
                <span className="badge badge-mint">
                  <Zap size={11} />
                  Express Delivery
                </span>
              )}
            </div>
          </div>
        )}

        {/* Horizontal Category Carousel */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => handleCategorySelect('')}
            style={{
              padding: '7px 16px',
              borderRadius: 'var(--radius-pills)',
              backgroundColor: !selectedCategory ? '#ffffff' : 'var(--color-forest-floor)',
              color: !selectedCategory ? '#02090a' : 'var(--color-tide-pool)',
              border: !selectedCategory ? '1px solid #ffffff' : '1px solid var(--color-iron-veil)',
              fontSize: '12px',
              fontWeight: !selectedCategory ? 600 : 500,
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
                borderRadius: 'var(--radius-pills)',
                backgroundColor: selectedCategory === cat.id ? '#ffffff' : 'var(--color-forest-floor)',
                color: selectedCategory === cat.id ? '#02090a' : 'var(--color-tide-pool)',
                border: selectedCategory === cat.id ? '1px solid #ffffff' : '1px solid var(--color-iron-veil)',
                fontSize: '12px',
                fontWeight: selectedCategory === cat.id ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Mobile Filter & Sort Bar */}
        <div className="explore-mobile-filter-bar">
          <button
            onClick={() => setMobileFilterOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-deep-canopy)',
              border: '1px solid var(--color-iron-veil)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
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
                color: 'var(--color-error)',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Active Filter Badges */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active:</span>

            {fastDelivery && (
              <span className="badge badge-mint" style={{ cursor: 'pointer' }} onClick={handleFastDeliveryToggle}>
                <Zap size={11} />
                Express Delivery
                <X size={12} style={{ marginLeft: '4px' }} />
              </span>
            )}

            {selectedBrands.map((b) => (
              <span key={b} className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => toggleBrand(b)}>
                Brand: {b}
                <X size={12} style={{ marginLeft: '4px' }} />
              </span>
            ))}

            {(minPrice || maxPrice) && (
              <span className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => handlePricePreset('', '')}>
                ₹{minPrice ? parseInt(minPrice, 10).toLocaleString('en-IN') : '0'} - {maxPrice ? `₹${parseInt(maxPrice, 10).toLocaleString('en-IN')}` : 'Any'}
                <X size={12} style={{ marginLeft: '4px' }} />
              </span>
            )}

            {minRating && (
              <span className="badge badge-mint" style={{ cursor: 'pointer' }} onClick={() => handleRatingChange(minRating)}>
                <Star size={11} fill="var(--color-icy-steel)" stroke="none" />
                {minRating}+ Stars
                <X size={12} style={{ marginLeft: '4px' }} />
              </span>
            )}

            {minDiscount && (
              <span className="badge badge-neutral" style={{ cursor: 'pointer' }} onClick={() => handleDiscountChange(minDiscount)}>
                {minDiscount}% Off
                <X size={12} style={{ marginLeft: '4px' }} />
              </span>
            )}

            <button
              onClick={clearAllFilters}
              style={{
                fontSize: '12px',
                color: 'var(--color-icy-steel)',
                fontWeight: 500,
                cursor: 'pointer',
                marginLeft: '4px'
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Two-Column Faceted Catalog */}
        <div className="explore-container">
          {/* Desktop Left Faceted Sidebar */}
          <aside className="explore-sidebar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border-steel)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <SlidersHorizontal size={14} color="var(--color-icy-steel)" /> Filters
              </h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  style={{ fontSize: '11px', color: 'var(--color-error)', fontWeight: 500, cursor: 'pointer' }}
                >
                  Clear all
                </button>
              )}
            </div>

            <FilterControls />
          </aside>

          {/* Right Product Grid */}
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
                backgroundColor: 'var(--color-forest-floor)',
                borderRadius: '12px',
                border: '1px solid var(--color-iron-veil)'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-deep-canopy)', border: '1px solid var(--color-iron-veil)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Search size={22} color="var(--color-tide-pool)" />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#ffffff', marginBottom: '8px' }}>
                  No matching products found
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--color-tide-pool)', maxWidth: '400px', margin: '0 auto 20px' }}>
                  Try relaxing price constraints or clearing active filters to broaden your catalog view.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="btn-primary"
                  style={{ padding: '10px 24px' }}
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

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    padding: '24px 0',
                    borderTop: '1px solid var(--color-iron-veil)'
                  }}>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="btn-outline"
                      style={{
                        padding: '8px 16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        opacity: currentPage <= 1 ? 0.3 : 1,
                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ChevronLeft size={15} /> Previous
                    </button>

                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-tide-pool)' }}>
                      Page {currentPage} of {pagination.pages}
                    </span>

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= pagination.pages}
                      className="btn-outline"
                      style={{
                        padding: '8px 16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        opacity: currentPage >= pagination.pages ? 0.3 : 1,
                        cursor: currentPage >= pagination.pages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Mobile Slide-Over Drawer */}
        {mobileFilterOpen && (
          <div className="mobile-filter-drawer-overlay" onClick={() => setMobileFilterOpen(false)}>
            <div className="mobile-filter-drawer-content" onClick={(e) => e.stopPropagation()}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--color-iron-veil)',
                backgroundColor: 'var(--color-deep-canopy)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SlidersHorizontal size={16} color="var(--color-icy-steel)" />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                    Filter Catalog {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                  </span>
                </div>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  style={{ padding: '6px', cursor: 'pointer', color: 'var(--color-ash-label)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <FilterControls />
              </div>

              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--color-iron-veil)',
                backgroundColor: 'var(--color-deep-canopy)',
                display: 'flex',
                gap: '12px'
              }}>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 'var(--radius-pills)',
                      border: '1px solid var(--color-iron-veil)',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-tide-pool)',
                      backgroundColor: 'transparent'
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
                    padding: '10px',
                    fontSize: '12px'
                  }}
                >
                  View ({pagination.total})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
