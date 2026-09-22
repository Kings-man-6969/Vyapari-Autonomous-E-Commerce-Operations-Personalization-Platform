import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Boxes, 
  Search, 
  Archive, 
  Eye, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  CheckSquare,
  Square,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';
import api from '../services/api';

export const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  // Filtering & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Facet Options
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  // Stats & Pagination Metadata
  const [counts, setCounts] = useState({ all: 0, active: 0, archived: 0, draft: 0, out_of_stock: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, pages: 1 });

  // Bulk Selection & Moderation Modal
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [moderatingProduct, setModeratingProduct] = useState(null); // product object or null
  const [moderationReason, setModerationReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Brands and Categories Facets once on mount
  useEffect(() => {
    const loadFacets = async () => {
      try {
        const [facetsRes, catsRes] = await Promise.all([
          api.get('/products/facets').catch(() => null),
          api.get('/categories').catch(() => null)
        ]);

        if (facetsRes?.data?.data?.brands) {
          setBrands(facetsRes.data.data.brands);
        }
        if (catsRes?.data?.data?.categories) {
          setCategories(catsRes.data.data.categories);
        } else if (catsRes?.data?.data?.flat) {
          setCategories(catsRes.data.data.flat);
        }
      } catch (err) {
        console.error('Failed to load catalog facets:', err);
      }
    };
    loadFacets();
  }, []);

  // Fetch paginated products from server
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder
      };

      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (brandFilter !== 'all') params.seller = brandFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const res = await api.get('/admin/products', { params });
      if (res.data?.success) {
        setProducts(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        } else if (res.data.total !== undefined) {
          setPagination({
            total: res.data.total,
            page: res.data.page || 1,
            limit: res.data.limit || limit,
            pages: res.data.pages || 1
          });
        }
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err) {
      console.error('Failed to load admin products:', err);
      setActionMsg({
        type: 'error',
        text: 'Failed to load catalog products. Please check network connection.'
      });
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, debouncedSearch, brandFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchProducts();
    setSelectedIds(new Set());
  }, [fetchProducts]);

  // Status Filter Tab Change
  const handleStatusTabChange = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setBrandFilter('all');
    setCategoryFilter('all');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
  };

  // Single Item Moderation
  const submitSingleModeration = async (targetStatus) => {
    if (!moderatingProduct) return;
    setIsProcessing(true);
    try {
      const res = await api.put(`/admin/products/${moderatingProduct.id}/moderate`, {
        status: targetStatus,
        reason: moderationReason.trim() || undefined
      });

      if (res.data?.success) {
        setActionMsg({
          type: 'success',
          text: `"${moderatingProduct.title}" listing updated to ${targetStatus}.`
        });
        setModeratingProduct(null);
        setModerationReason('');
        fetchProducts();
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update listing status.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk Moderation Action
  const handleBulkAction = async (targetStatus) => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmed = window.confirm(`Are you sure you want to mark ${count} selected products as "${targetStatus}"?`);
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const res = await api.post('/admin/products/bulk-moderate', {
        product_ids: Array.from(selectedIds),
        status: targetStatus,
        reason: `Admin bulk action: ${targetStatus}`
      });

      if (res.data?.success) {
        setActionMsg({
          type: 'success',
          text: `Successfully updated ${res.data.updated_count || count} products to ${targetStatus}.`
        });
        setSelectedIds(new Set());
        fetchProducts();
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Bulk moderation failed.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk Selection Checkboxes
  const handleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const handleToggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Generate pagination page numbers window
  const getPageNumbers = () => {
    const current = pagination.page;
    const total = pagination.pages;
    const delta = 2;
    const range = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) {
      range.unshift('...');
    }
    if (current + delta < total - 1) {
      range.push('...');
    }

    range.unshift(1);
    if (total > 1) {
      range.push(total);
    }

    return range;
  };

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="heading-whisper" style={{ fontSize: '26px', color: '#ffffff', margin: 0, letterSpacing: '0.015em' }}>
            Catalog Governance & Moderation
          </h1>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginTop: '6px' }}>
            Audit, filter, and moderate {pagination.total.toLocaleString()} cross-merchant listings across 58 verified brand stores.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '12px' }}
            title="Refresh Catalog Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMsg.text && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
          color: actionMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {actionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{actionMsg.text}</span>
          </div>
          <button 
            onClick={() => setActionMsg({ type: '', text: '' })}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Status Filter Tabs with Live Badges */}
      <div style={{
        backgroundColor: 'var(--color-gunmetal-dark)',
        border: '1px solid var(--color-border-steel)',
        borderRadius: '14px',
        padding: '12px 16px',
        marginBottom: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Products', count: counts.all },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'archived', label: 'Archived / Flagged', count: counts.archived },
            { id: 'draft', label: 'Drafts', count: counts.draft },
            { id: 'out_of_stock', label: 'Out of Stock', count: counts.out_of_stock }
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleStatusTabChange(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: isActive ? 'var(--color-titanium-brushed)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--color-silver-glow)',
                  border: `1px solid ${isActive ? 'var(--color-border-chrome)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '9999px',
                    backgroundColor: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? 'var(--color-icy-steel)' : 'var(--color-ash-label)'
                  }}>
                    {tab.count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Total Matches Indicator */}
        <div style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.75 }}>
          Matched: <strong style={{ color: '#ffffff' }}>{pagination.total.toLocaleString()}</strong> items
        </div>
      </div>

      {/* Control Bar: Search & Select Dropdowns */}
      <div style={{
        backgroundColor: 'var(--color-gunmetal-dark)',
        border: '1px solid var(--color-border-steel)',
        borderRadius: '14px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 320px', maxWidth: '480px' }}>
          {/* Real-time Server Search */}
          <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--color-border-steel)',
            borderRadius: '10px',
            padding: '8px 14px'
          }}>
            <Search size={15} color="var(--color-ash-label)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search 10,000 products by title, brand, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: '#ffffff',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--color-ash-label)', cursor: 'pointer', padding: '0 2px' }}
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Brand Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Brand:</span>
            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setPage(1);
              }}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--color-border-steel)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                color: '#ffffff',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Brands (58)</option>
              {brands.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.count})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--color-border-steel)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                color: '#ffffff',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c.slug} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--color-border-steel)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                color: '#ffffff',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="stock-asc">Stock: Low to High</option>
              <option value="title-asc">Title: A to Z</option>
            </select>
          </div>

          {/* Reset button */}
          {(debouncedSearch || statusFilter !== 'all' || brandFilter !== 'all' || categoryFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div style={{
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '10px',
          padding: '10px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-icy-steel)' }}>
              {selectedIds.size} product{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ background: 'none', border: 'none', color: 'var(--color-silver-glow)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Deselect All
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => handleBulkAction('active')}
              disabled={isProcessing}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#4ade80',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ShieldCheck size={13} />
              <span>Bulk Activate</span>
            </button>

            <button
              onClick={() => handleBulkAction('archived')}
              disabled={isProcessing}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Archive size={13} />
              <span>Bulk Archive / Flag</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Catalog Products Table */}
      {loading ? (
        <div style={{
          backgroundColor: 'var(--color-gunmetal-dark)',
          border: '1px solid var(--color-border-steel)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} style={{ height: '54px', marginBottom: '12px', borderRadius: '8px' }} className="skeleton" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--color-gunmetal-dark)',
          border: '1px solid var(--color-border-steel)',
          borderRadius: '16px',
          textAlign: 'center',
          padding: '64px 24px'
        }}>
          <Boxes size={48} color="var(--color-ash-label)" style={{ marginBottom: '16px' }} />
          <h3 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', marginBottom: '6px' }}>
            No products match criteria
          </h3>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px auto' }}>
            No items found matching the selected brand, status, or search query.
          </p>
          <button
            onClick={handleResetFilters}
            className="btn-outline"
            style={{ padding: '8px 18px', fontSize: '12px' }}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--color-gunmetal-dark)',
          border: '1px solid var(--color-border-steel)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-steel)', backgroundColor: 'rgba(0, 0, 0, 0.25)' }}>
                  <th style={{ width: '40px', padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      onClick={handleSelectAll}
                      style={{ background: 'none', border: 'none', color: 'var(--color-silver-glow)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Select all on this page"
                    >
                      {selectedIds.size > 0 && selectedIds.size === products.length ? (
                        <CheckSquare size={16} color="var(--color-icy-steel)" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ash-label)' }}>Listing & Details</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ash-label)' }}>Official Store</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ash-label)' }}>Category</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ash-label)' }}>Price (INR)</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ash-label)' }}>Stock</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ash-label)' }}>Status</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-ash-label)' }}>Moderation</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const images = Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? JSON.parse(p.images || '[]') : []);
                  const imgUrl = images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
                  const isSelected = selectedIds.has(p.id);

                  return (
                    <tr 
                      key={p.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleSelect(p.id)}
                          style={{ background: 'none', border: 'none', color: isSelected ? 'var(--color-icy-steel)' : 'var(--color-ash-label)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={imgUrl}
                            alt={p.title}
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              backgroundColor: 'rgba(0,0,0,0.4)',
                              border: '1px solid var(--color-border-steel)'
                            }}
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div style={{ maxWidth: '340px' }}>
                            <Link 
                              to={`/products/${p.id}`} 
                              target="_blank" 
                              style={{ 
                                fontWeight: 500, 
                                fontSize: '13px', 
                                color: '#ffffff', 
                                textDecoration: 'none',
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                              title={p.title}
                            >
                              {p.title}
                            </Link>
                            <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '2px', fontFamily: 'monospace' }}>
                              ID: {p.id.slice(0, 8)}...{p.id.slice(-4)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 500,
                          backgroundColor: 'var(--color-titanium-brushed)',
                          border: '1px solid var(--color-border-steel)',
                          color: '#ffffff'
                        }}>
                          {p.store_name || 'Brand Store'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.85 }}>
                          {p.category_name || 'General'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#ffffff' }}>
                          ₹{parseFloat(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: (p.inventory_count || p.stock_qty || 0) < 15 ? '#f87171' : 'var(--color-silver-glow)'
                        }}>
                          {(p.inventory_count !== undefined ? p.inventory_count : p.stock_qty) || 0} units
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className={`status-pill status-${p.status}`}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <Link
                            to={`/products/${p.id}`}
                            target="_blank"
                            title="View product storefront page"
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border-steel)',
                              color: 'var(--color-silver-glow)',
                              display: 'flex',
                              alignItems: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.04)'
                            }}
                          >
                            <Eye size={14} />
                          </Link>
                          <button
                            onClick={() => {
                              setModeratingProduct(p);
                              setModerationReason('');
                            }}
                            title="Moderate Listing Status"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border-chrome)',
                              color: p.status === 'archived' ? 'var(--color-icy-steel)' : '#fbbf24',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'var(--color-titanium-brushed)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            <Archive size={12} />
                            <span>Moderate</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* High-Efficiency Server Pagination Footer */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--color-border-steel)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.8 }}>
                Showing <strong>{((pagination.page - 1) * pagination.limit) + 1}</strong> – <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of <strong>{pagination.total.toLocaleString()}</strong> listings
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--color-border-steel)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Page Navigation Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setPage(1)}
                disabled={pagination.page <= 1}
                title="First Page"
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-steel)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: pagination.page <= 1 ? 'var(--color-ash-label)' : '#ffffff',
                  cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: pagination.page <= 1 ? 0.4 : 1
                }}
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                title="Previous Page"
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-steel)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: pagination.page <= 1 ? 'var(--color-ash-label)' : '#ffffff',
                  cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: pagination.page <= 1 ? 0.4 : 1
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {/* Numbered pages */}
              {getPageNumbers().map((num, idx) => {
                if (num === '...') {
                  return (
                    <span key={`dots-${idx}`} style={{ padding: '0 6px', color: 'var(--color-ash-label)', fontSize: '12px' }}>
                      ...
                    </span>
                  );
                }
                const isCurrent = pagination.page === num;
                return (
                  <button
                    key={`page-${num}`}
                    onClick={() => setPage(num)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: isCurrent ? 700 : 500,
                      backgroundColor: isCurrent ? 'var(--color-icy-steel)' : 'transparent',
                      color: isCurrent ? '#000000' : 'var(--color-silver-glow)',
                      border: `1px solid ${isCurrent ? 'var(--color-icy-steel)' : 'var(--color-border-steel)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    {num}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={pagination.page >= pagination.pages}
                title="Next Page"
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-steel)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: pagination.page >= pagination.pages ? 'var(--color-ash-label)' : '#ffffff',
                  cursor: pagination.page >= pagination.pages ? 'not-allowed' : 'pointer',
                  opacity: pagination.page >= pagination.pages ? 0.4 : 1
                }}
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setPage(pagination.pages)}
                disabled={pagination.page >= pagination.pages}
                title="Last Page"
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border-steel)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: pagination.page >= pagination.pages ? 'var(--color-ash-label)' : '#ffffff',
                  cursor: pagination.page >= pagination.pages ? 'not-allowed' : 'pointer',
                  opacity: pagination.page >= pagination.pages ? 0.4 : 1
                }}
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Modal */}
      {moderatingProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-chrome)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '26px',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', margin: 0 }}>
                  Moderate Product Listing
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.8, marginTop: '4px' }}>
                  Update lifecycle status and audit compliance.
                </p>
              </div>
              <button
                onClick={() => setModeratingProduct(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-ash-label)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--color-border-steel)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '18px'
            }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#ffffff', marginBottom: '4px' }}>
                {moderatingProduct.title}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>
                Store: <span style={{ color: 'var(--color-icy-steel)' }}>{moderatingProduct.store_name}</span> &bull; Current Status: <strong style={{ color: '#ffffff', textTransform: 'capitalize' }}>{moderatingProduct.status}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-silver-glow)', marginBottom: '6px' }}>
                Reason / Internal Audit Notes (Optional):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Verified brand authenticity compliance / Policy revision"
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--color-border-steel)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: '#ffffff',
                  fontSize: '12px',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setModeratingProduct(null)}
                disabled={isProcessing}
                className="btn-outline"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Cancel
              </button>
              {moderatingProduct.status !== 'archived' && (
                <button
                  onClick={() => submitSingleModeration('archived')}
                  disabled={isProcessing}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    cursor: 'pointer'
                  }}
                >
                  Archive / Block
                </button>
              )}
              {moderatingProduct.status !== 'active' && (
                <button
                  onClick={() => submitSingleModeration('active')}
                  disabled={isProcessing}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'var(--color-icy-steel)',
                    border: 'none',
                    color: '#000000',
                    cursor: 'pointer'
                  }}
                >
                  Approve / Activate
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;
