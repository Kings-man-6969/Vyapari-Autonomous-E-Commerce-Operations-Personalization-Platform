import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-[#c0c1ff] to-[#8083ff] text-[#0d0096] uppercase tracking-[0.05em] shadow-[inset_0_1px_rgba(255,255,255,0.4),0_0_20px_rgba(192,193,255,0.15)] hover:shadow-[inset_0_1px_rgba(255,255,255,0.6),0_0_30px_rgba(192,193,255,0.3)] hover:-translate-y-0.5 font-bold",
        destructive: "bg-red-500 text-slate-50 hover:bg-red-600 shadow-sm hover:shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:-translate-y-0.5",
        outline: "border border-slate-200/20 bg-transparent hover:bg-slate-50/10 hover:text-slate-900 dark:border-slate-700/30 dark:hover:bg-slate-800/50 dark:hover:text-slate-50 premium-shadow",
        secondary: "bg-slate-100 dark:bg-[#2d3449] border border-slate-200 dark:border-[#464554]/15 text-slate-900 dark:text-[#dae2fd] hover:bg-slate-200 dark:hover:bg-[#31394d] shadow-sm",
        ghost: "hover:bg-slate-100/10 hover:text-slate-900 dark:hover:bg-[#2d3449]/50 dark:hover:text-slate-50",
        link: "text-[#c0c1ff] underline-offset-4 hover:underline",
        glass: "bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 text-slate-900 shadow-sm dark:bg-[#171f33]/60 dark:border-[#464554]/15 dark:hover:bg-[#222a3d]/80 dark:text-slate-50"
      },
      size: {
        default: "h-12 px-6 py-2 rounded-xl",
        sm: "h-9 rounded-lg px-3",
        lg: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
