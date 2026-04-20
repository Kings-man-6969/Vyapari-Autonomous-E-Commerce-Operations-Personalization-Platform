import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createProduct,
  deleteProduct,
  getProduct,
  updateProduct,
  type Product,
  type ProductCreatePayload,
  type ProductUpdatePayload,
} from '../api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { PackagePlus, Save, Trash2 } from 'lucide-react'

const categories = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports'] as const

type FormState = ProductCreatePayload

const defaultState: FormState = {
  name: '',
  category: 'Electronics',
  price: 0,
  cost: 0,
  stock: 0,
  description: '',
}

function mapProductToForm(product: Product): FormState {
  return {
    name: product.name,
    category: product.category as FormState['category'],
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    description: product.description ?? '',
  }
}

export function SellerProductFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<FormState>(defaultState)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)
    getProduct(id)
      .then((product) => setForm(mapProductToForm(product)))
      .catch(() => setError('Could not load product details.'))
      .finally(() => setLoading(false))
  }, [id])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async () => {
    setError('')
    setMessage('')
    setSaving(true)

    try {
      if (isEdit && id) {
        const body: ProductUpdatePayload = {
          name: form.name,
          category: form.category,
          price: Number(form.price),
          cost: Number(form.cost),
          stock: Number(form.stock),
          description: form.description,
        }
        await updateProduct(id, body)
        setMessage('Product updated successfully.')
      } else {
        await createProduct({
          name: form.name,
          category: form.category,
          price: Number(form.price),
          cost: Number(form.cost),
          stock: Number(form.stock),
          description: form.description,
        })
        setMessage('Product created successfully.')
      }
      navigate('/seller/inventory')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!id) return
    setSaving(true)
    try {
      await deleteProduct(id)
      navigate('/seller/inventory')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-8 text-center text-slate-500">
        Loading product form...
      </Card>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PackagePlus className="text-brand-500" />
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isEdit ? 'Update catalog details and pricing.' : 'Create a new catalog item with guardrail checks.'}
          </p>
        </div>
        <Badge variant="outline" className="self-start md:self-auto">
          {isEdit ? `Editing ${id}` : 'New product'}
        </Badge>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
          {message}
        </div>
      )}

      <Card className="p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Product Name</label>
            <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Product name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Category</label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm"
              value={form.category}
              onChange={(e) => updateField('category', e.target.value as FormState['category'])}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Price (₹)</label>
            <Input type="number" min="1" step="0.01" value={form.price} onChange={(e) => updateField('price', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Cost (₹)</label>
            <Input type="number" min="1" step="0.01" value={form.cost} onChange={(e) => updateField('cost', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Stock</label>
            <Input type="number" min="0" step="1" value={form.stock} onChange={(e) => updateField('stock', Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Description</label>
            <Input value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Optional description" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          {isEdit && (
            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={remove} disabled={saving}>
              <Trash2 size={16} className="mr-2" /> Delete
            </Button>
          )}
          <Button onClick={submit} disabled={saving}>
            <Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save Product'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
