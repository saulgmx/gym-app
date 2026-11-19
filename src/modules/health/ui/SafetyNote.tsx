import type { HTMLAttributes, ReactNode } from 'react';
import styles from './pain.module.css';

// Amber notice shared by PainNotice and the red flags (plan §6.9). Internal to health/ui: it moves
// to shared only when another module needs it (P-7). The icon is decorative.
export function SafetyNote({
  children,
  ...rest
}: { children: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>) {
  return (
    <div className={styles.note} {...rest}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 3 2 20h20L12 3Zm0 6v5m0 3v.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p>{children}</p>
    </div>
  );
}
