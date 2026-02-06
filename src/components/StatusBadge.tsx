import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'Yes' | 'No' | 'Pending' | 'Correct' | 'Wrong' | 'Not Reviewed';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStyles = () => {
    switch (status) {
      case 'Yes':
      case 'Correct':
        return 'status-badge-success';
      case 'No':
      case 'Wrong':
        return 'status-badge-error';
      case 'Pending':
      case 'Not Reviewed':
        return 'status-badge-neutral';
      default:
        return 'status-badge-neutral';
    }
  };

  return (
    <span className={cn('status-badge', getStyles(), className)}>
      {status}
    </span>
  );
}
