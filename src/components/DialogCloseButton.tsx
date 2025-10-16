import type { ButtonHTMLAttributes } from 'react';

interface DialogCloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

const baseStyles =
  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]/30 focus:ring-offset-2 focus:ring-offset-slate-900';

export function DialogCloseButton({ className = '', ...props }: DialogCloseButtonProps) {
  return (
    <button type="button" aria-label="Close dialog" className={`${baseStyles} ${className}`.trim()} {...props}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}
