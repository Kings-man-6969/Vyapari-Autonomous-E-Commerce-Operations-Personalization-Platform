import React, { useEffect, useState } from 'react'
import api from '../api'
import { PageHeader, Badge, Button, Loader, EmptyState, Card } from '../components/UI'

const statusColor = { pending: 'gray', draft_ready: 'blue', published: 'green', rejected: 'red', escalated: 'red' }
const sentimentColor = { positive: 'green', negative: 'red', neutral: 'yellow' }
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n)

function ReviewCard({ review, onApprove, onReject }) {
  const [draft, setDraft] = useState(review.draft_response || '')
  const [saving, setSaving] = useState(false)

  const handleApprove = async () => {
    setSaving(true)
    await onApprove(review.id, draft)
    setSaving(false)
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-600">{review.id}</span>
            <span className="text-xs text-gray-500">{review.product_id}</span>
            <span className="text-yellow-400 text-xs">{stars(review.stars)}</span>
          </div>
          <p className="text-xs text-gray-500">{review.user}</p>
        </div>
        <div className="flex gap-2">
          {review.sentiment && (
            <Badge label={review.sentiment} color={sentimentColor[review.sentiment]} />
          )}
          <Badge label={review.status.replace('_', ' ')} color={statusColor[review.status]} />
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-4 italic">"{review.text}"</p>

      {review.status === 'escalated' && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-4 py-3 text-xs text-red-300">
          ⚠️ Escalated: {review.escalation_reason} — requires manual response
        </div>
      )}

      {review.status === 'draft_ready' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Agent Draft Response</p>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            rows={3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => onReject(review.id)}>Reject</Button>
            <Button variant="success" onClick={handleApprove} disabled={saving || !draft.trim()}>
              {saving ? 'Publishing...' : 'Approve & Publish'}
            </Button>
          </div>
        </div>
      )}

      {review.status === 'published' && (
        <div className="bg-green-950/40 border border-green-800/40 rounded-lg px-4 py-3 text-sm text-green-300">
          ✓ Published: {review.draft_response}
        </div>
      )}
    </Card>
  )
}

export default function Reviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [filter, setFilter] = useState('all')

  const fetchReviews = async () => {
    const { data } = await api.get('/reviews')
    setReviews(data)
    setLoading(false)
  }

  useEffect(() => { fetchReviews() }, [])

  const processReviews = async () => {
    setProcessing(true)
    await api.post('/reviews/process')
    await fetchReviews()
    setProcessing(false)
  }

  const approve = async (id, response) => {
    await api.post(`/reviews/${id}/approve`, { response })
    await fetchReviews()
  }

  const reject = async (id) => {
    await api.post(`/reviews/${id}/reject`)
    await fetchReviews()
  }

  const statusOptions = ['all', 'pending', 'draft_ready', 'escalated', 'published', 'rejected']
  const counts = statusOptions.reduce((acc, s) => {
    acc[s] = s === 'all' ? reviews.length : reviews.filter(r => r.status === s).length
    return acc
  }, {})

  const filtered = filter === 'all' ? reviews : reviews.filter(r => r.status === filter)

  return (
    <div className="p-8">
      <PageHeader
        title="Customer Reviews"
        subtitle="Sentiment analysis and automated response drafting"
        action={
          <Button onClick={processReviews} disabled={processing}>
            {processing ? 'Processing...' : '⚡ Process Pending Reviews'}
          </Button>
        }
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {statusOptions.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s.replace('_', ' ')} ({counts[s]})
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        filtered.length === 0
          ? <EmptyState message="No reviews in this category. Click Process Reviews to begin." />
          : <div className="space-y-4">
              {filtered.map(r => (
                <ReviewCard key={r.id} review={r} onApprove={approve} onReject={reject} />
              ))}
            </div>
      )}
    </div>
  )
}
