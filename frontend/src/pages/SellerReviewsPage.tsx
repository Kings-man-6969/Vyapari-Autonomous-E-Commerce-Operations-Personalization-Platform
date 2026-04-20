import { Card } from '../components/ui/Card'
import { MessageSquare, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function SellerReviewsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="text-brand-500" />
          All Store Reviews
        </h1>
        <p className="text-slate-500 mt-1">A consolidated view of customer feedback.</p>
      </div>

      <Card className="p-12 text-center flex flex-col items-center">
         <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 text-brand-500 rounded-full flex items-center justify-center mb-6">
            <MessageSquare size={32} />
         </div>
         <h3 className="text-xl font-bold mb-2">Review Management Moved</h3>
         <p className="text-slate-500 max-w-md mb-6">
           We've upgraded the review interface to include autonomous agent drafts. All review handling is now located in the targeted Review Approvals portal.
         </p>
         <Link to="/hitl/reviews">
           <Button>
             Go to Review Approvals <ArrowRight className="ml-2" size={16} />
           </Button>
         </Link>
      </Card>
    </div>
  )
}
