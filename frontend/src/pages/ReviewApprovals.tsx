import { useEffect, useState } from 'react'
import { approveReview, getReviews, rejectReview, type Review } from '../api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { MessageSquare, AlertTriangle, Send, XCircle, User, Bot, ThumbsUp, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function ReviewApprovals() {
  const [draftReady, setDraftReady] = useState<Review[]>([])
  const [escalated, setEscalated] = useState<Review[]>([])
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'drafts' | 'escalated'>('drafts')

  const load = async () => {
    const [ready, flagged] = await Promise.all([getReviews('draft_ready'), getReviews('escalated')])
    setDraftReady(ready)
    setEscalated(flagged)
  }

  useEffect(() => {
    load()
  }, [])

  const approve = async (review: Review) => {
    const textarea = document.getElementById(`draft-${review.id}`) as HTMLTextAreaElement
    const finalResponse = textarea ? textarea.value : (review.draft_response ?? '')
    
    await approveReview(review.id, finalResponse)
    setMessage(`Published response for review on ${review.product_id}`)
    load()
  }

  const reject = async (review: Review) => {
    await rejectReview(review.id)
    setMessage(`Rejected draft for review on ${review.product_id}`)
    load()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="text-brand-500" />
          Review Management
        </h1>
        <p className="text-slate-500 mt-1">Approve AI-generated responses or manually handle escalations.</p>
      </div>

      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-sm">
          <CheckCircle2 size={16} /> {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'drafts' 
              ? 'border-brand-500 text-brand-600 dark:text-brand-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('drafts')}
        >
          <Bot size={16} />
          Pending AI Drafts
          <Badge variant="secondary" className="ml-2 bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">{draftReady.length}</Badge>
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'escalated' 
              ? 'border-red-500 text-red-600 dark:text-red-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('escalated')}
        >
          <AlertTriangle size={16} />
          Escalations
          {escalated.length > 0 && <span className="flex w-2 h-2 rounded-full bg-red-500"></span>}
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'drafts' && (
          <>
            {draftReady.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                <p className="text-slate-500">No pending AI responses. You're all caught up!</p>
              </div>
            ) : (
              <div className="grid gap-6">
                <AnimatePresence>
                  {draftReady.map((review) => (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={review.id}>
                      <Card className="overflow-hidden">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={review.sentiment === 'positive' ? 'success' : review.sentiment === 'negative' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                                {review.sentiment}
                              </Badge>
                              <span className="text-amber-500 font-bold text-sm">{review.stars}★</span>
                            </div>
                            <span className="font-mono text-xs text-slate-500">Product: {review.product_id}</span>
                          </div>
                          <Badge variant="outline" className="text-brand-600 border-brand-200 bg-brand-50">Draft Ready</Badge>
                        </div>

                        <div className="p-6 grid md:grid-cols-2 gap-6">
                          <div>
                            <div className="flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300 font-semibold">
                              <User size={16} /> Customer Review
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 italic">
                              "{review.text}"
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-3 text-brand-600 dark:text-brand-400 font-semibold">
                              <Bot size={16} /> AI Suggested Response
                            </div>
                            <textarea 
                              id={`draft-${review.id}`}
                              className="w-full min-h-[100px] p-4 text-sm bg-brand-50/50 dark:bg-brand-900/10 rounded-lg border border-brand-100 dark:border-brand-900/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
                              defaultValue={review.draft_response ?? ''} 
                            />
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
                          <Button variant="outline" onClick={() => reject(review)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <XCircle className="mr-2" size={16} /> Discard Response
                          </Button>
                          <Button onClick={() => approve(review)}>
                            <Send className="mr-2" size={16} /> Publish Response
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {activeTab === 'escalated' && (
          <>
            {escalated.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <ThumbsUp className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-slate-500">No escalated reviews. Great job!</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {escalated.map((review) => (
                  <Card key={review.id} className="border-red-200 dark:border-red-900/50 overflow-hidden">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/50 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
                        <AlertTriangle size={18} /> ESCALATED
                      </div>
                      <span className="text-amber-500 font-bold">{review.stars}★</span>
                    </div>
                    <div className="p-6">
                      <p className="text-slate-500 text-xs font-mono mb-4">Product: {review.product_id}</p>
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg mb-6 text-slate-800 dark:text-slate-200">
                        "{review.text}"
                      </div>
                      <label className="block text-sm font-medium mb-2">Manual Response Required</label>
                      <textarea 
                        className="w-full min-h-[100px] p-4 text-sm rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none bg-white dark:bg-slate-950"
                        placeholder="Address the customer's concerns manually..." 
                      />
                      <div className="mt-4 flex justify-end">
                        <Button>Submit Manual Response</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
