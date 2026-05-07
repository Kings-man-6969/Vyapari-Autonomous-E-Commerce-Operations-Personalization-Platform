import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import Badge, { stockVariant } from '@/shared/components/Badge'
import DataTable from '@/shared/components/DataTable'
import StatCard from '@/shared/components/StatCard'
import Modal from '@/shared/components/Modal'
import Spinner from '@/shared/components/Spinner'

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports']

const emptyForm = { name: '', category: 'Electronics', price: '', cost: '', stock: '' }

export default function SellerInventory({ token }) {
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createForm, setCreateForm] = useState(emptyForm)
  const [editProduct, setEditProduct] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => { loadInventory() }, [token])

  async function loadInventory() {
    setLoading(true)
    try {
      const payload = await apiFetch('/products/seller/inventory', {}, token)
      setProducts(payload.products || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await apiFetch('/products/seller', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          category: createForm.category,
          price: Number(createForm.price),
          cost: Number(createForm.cost),
          stock: Number(createForm.stock),
        }),
      }, token)
      setCreateForm(emptyForm)
      setShowAddModal(false)
      toast.success('Product created successfully.')
      await loadInventory()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(product) {
    setEditProduct(product)
    setEditForm({
      name: product.name || '',
      category: product.category || 'Electronics',
      price: String(product.price ?? ''),
      cost: String(product.cost ?? ''),
      stock: String(product.stock ?? ''),
    })
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editProduct) return
    setSubmitting(true)
    try {
      await apiFetch(`/products/${editProduct.product_id}/seller`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          category: editForm.category,
          price: Number(editForm.price),
          cost: Number(editForm.cost),
          stock: Number(editForm.stock),
        }),
      }, token)
      setEditProduct(null)
      toast.success('Product updated successfully.')
      await loadInventory()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.product_id.toLowerCase().includes(search.toLowerCase())
  )

  const totalStock = products.reduce((s, p) => s + Number(p.stock || 0), 0)
  const totalValue = products.reduce((s, p) => s + Number(p.price || 0) * Number(p.stock || 0), 0)
  const criticalCount = products.filter((p) => Number(p.stock) < 5).length

  const columns = [
    {
      key: 'name', label: 'Product',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--c-text)', marginBottom: 2 }}>{p.name}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)' }}>{p.product_id}</div>
        </div>
      ),
    },
    {
      key: 'category', label: 'Category',
      render: (p) => <span style={{ color: 'var(--c-text-muted)', fontSize: 'var(--fs-sm)' }}>{p.category || '—'}</span>,
    },
    {
      key: 'price', label: 'Price', align: 'right',
      render: (p) => <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>₹{Number(p.price || 0).toFixed(2)}</span>,
    },
    {
      key: 'cost', label: 'Cost', align: 'right',
      render: (p) => <span style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>₹{Number(p.cost || 0).toFixed(2)}</span>,
    },
    {
      key: 'margin', label: 'Margin', align: 'right',
      render: (p) => {
        const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0
        return <Badge variant={margin >= 20 ? 'success' : margin >= 10 ? 'warning' : 'danger'}>{margin.toFixed(1)}%</Badge>
      },
    },
    {
      key: 'stock', label: 'Stock', align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{p.stock}</span>
          <Badge variant={stockVariant(p.stock)}>
            {Number(p.stock) < 5 ? 'Critical' : Number(p.stock) <= 20 ? 'Low' : 'OK'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions', label: '',
      render: (p) => (
        <button onClick={() => startEdit(p)} className="btn btn-secondary btn-sm">Edit</button>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inventory"
        description="Manage your product catalog, stock levels, and pricing. Keep SKUs synchronized."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadInventory} className="btn btn-secondary btn-sm" disabled={loading}>
              {loading ? <Spinner size="sm" /> : <RefreshIcon />} Refresh
            </button>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
              <PlusIcon /> Add Product
            </button>
          </div>
        }
      />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Products" value={products.length} variant="primary" />
        <StatCard label="Units in Stock" value={totalStock} variant="default" />
        <StatCard label="Stock Value" value={`₹${totalValue.toFixed(0)}`} variant="info" />
        <StatCard label="Critical Items" value={criticalCount} variant={criticalCount > 0 ? 'danger' : 'success'} />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="search"
          className="form-input"
          placeholder="Search by product name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey="product_id"
          loading={loading}
          emptyTitle="No products yet"
          emptyDescription="Create your first product using the 'Add Product' button above to get started."
        />
      </div>

      {/* Add Product Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Product">
        <ProductForm
          form={createForm}
          onChange={(k, v) => setCreateForm((c) => ({ ...c, [k]: v }))}
          onSubmit={handleCreate}
          onCancel={() => setShowAddModal(false)}
          submitting={submitting}
          submitLabel="Create Product"
        />
      </Modal>

      {/* Edit Product Modal */}
      <Modal open={!!editProduct} onClose={() => setEditProduct(null)} title={editProduct ? `Edit: ${editProduct.name}` : ''}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
          {editProduct?.product_id}
        </div>
        <ProductForm
          form={editForm}
          onChange={(k, v) => setEditForm((c) => ({ ...c, [k]: v }))}
          onSubmit={handleUpdate}
          onCancel={() => setEditProduct(null)}
          submitting={submitting}
          submitLabel="Save Changes"
        />
      </Modal>
    </div>
  )
}

function ProductForm({ form, onChange, onSubmit, onCancel, submitting, submitLabel }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-field">
        <label className="form-label">Product Name</label>
        <input className="form-input" value={form.name} onChange={(e) => onChange('name', e.target.value)} required placeholder="e.g. Wireless Headphones" />
      </div>
      <div className="form-field">
        <label className="form-label">Category</label>
        <select className="form-select" value={form.category} onChange={(e) => onChange('category', e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div className="form-field">
          <label className="form-label">Price (₹)</label>
          <input className="form-input" type="number" step="0.01" min="0" value={form.price} onChange={(e) => onChange('price', e.target.value)} required placeholder="0.00" />
        </div>
        <div className="form-field">
          <label className="form-label">Cost (₹)</label>
          <input className="form-input" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => onChange('cost', e.target.value)} required placeholder="0.00" />
        </div>
        <div className="form-field">
          <label className="form-label">Stock</label>
          <input className="form-input" type="number" min="0" value={form.stock} onChange={(e) => onChange('stock', e.target.value)} required placeholder="0" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={submitting}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <><Spinner size="sm" color="#fff" /> Saving…</> : submitLabel}
        </button>
      </div>
    </form>
  )
}

function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
}
function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
}
