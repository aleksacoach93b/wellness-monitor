'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import './test-launch-button.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
}

const TestLaunchButton = forwardRef<HTMLButtonElement, Props>(
  function TestLaunchButton({ icon: Icon, children, className = '', ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        className={`survey-test-launch ${className}`}
      >
        <span className="survey-test-launch-icon" aria-hidden="true">
          <Icon size={21} strokeWidth={1.8} />
        </span>
        <span className="survey-test-launch-label">{children}</span>
        <span className="survey-test-launch-arrow" aria-hidden="true">
          <ArrowUpRight size={20} strokeWidth={1.8} />
        </span>
      </button>
    )
  },
)

export default TestLaunchButton
