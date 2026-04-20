import { useEffect, useState } from 'react'
import { getAllDecisions, type Decision } from '../api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { History, Search, Bot, User, ShieldAlert } from 'lucide-react'
import { Input } from '../components/ui/Input'

export function HitlLog() {
  const [rows, setRows] = useState<Decision[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    getAllDecisions().then(setRows)
  }, [])

  const filtered = rows.filter(r => 
    r.product_name.toLowerCase().includes(search.toLowerCase()) || 
    String(r.id).toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="success">Approved</Badge>
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge variant="warning">Pending</Badge>
    }
  }

  const getModeBadge = (mode: string) => {
    return mode === 'autonomous' 
      ? <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"><Bot size={12} className="mr-1"/> Autonomous</Badge>
      : <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><ShieldAlert size={12} className="mr-1"/> Advisory</Badge>
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="text-brand-500" />
            Audit Log
          </h1>
          <p className="text-slate-500 mt-1">Review the historical actions taken by the agent and humans.</p>
        </div>
        <div className="relative w-64">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
           <Input 
             className="pl-9" 
             placeholder="Search product or ID..."
             value={search}
             onChange={(e) => setSearch(e.target.value)}
           />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Decision ID</th>
                <th className="px-6 py-4">Target Product</th>
                <th className="px-6 py-4">Action Type</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4">Mode</th>
                <th className="px-6 py-4">Resolution</th>
                <th className="px-6 py-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{String(row.id).split('-')[0]}...</td>
                  <td className="px-6 py-4 font-medium">{row.product_name}</td>
                  <td className="px-6 py-4 capitalize">{row.type.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${row.confidence > 0.8 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.max(0, Math.min(100, row.confidence * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono">{(row.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getModeBadge(row.mode)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                       {getStatusBadge(row.status)}
                       {row.resolved_by && (
                         <span className="text-[10px] flex items-center text-slate-400">
                            <User size={10} className="mr-1"/> {row.resolved_by}
                         </span>
                       )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {new Date(row.created_at).toLocaleString(undefined, {
                       month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
