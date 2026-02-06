 import { cn } from '@/lib/utils';
 
 interface JobStatusBadgeProps {
  status: string | null | undefined;
   className?: string;
 }
 
 export function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  const normalizedStatus = status || 'Unknown';
  
   const getStyles = () => {
    switch (normalizedStatus) {
       case 'Completed':
         return 'bg-success/10 text-success border-success/20';
      case 'Completed with Errors':
      case 'Completed (Partial)':
        return 'bg-warning/10 text-warning border-warning/20';
       case 'Processing':
         return 'bg-primary/10 text-primary border-primary/20';
       case 'Queued':
        return 'bg-muted text-muted-foreground border-muted';
       case 'Failed':
       case 'Cancelled':
         return 'bg-destructive/10 text-destructive border-destructive/20';
       default:
         return 'bg-muted text-muted-foreground border-muted';
     }
   };
 
   return (
     <span className={cn(
       'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
       getStyles(),
       className
     )}>
      {normalizedStatus}
     </span>
   );
 }