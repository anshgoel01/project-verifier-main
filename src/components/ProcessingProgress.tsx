import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { ProcessingProgress as ProgressType } from '@/types/submission';

interface ProcessingProgressProps {
  progress: ProgressType;
}

export function ProcessingProgress({ progress }: ProcessingProgressProps) {
  const { total, completed, processing, errors } = progress;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = completed === total && processing === 0;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-card rounded-xl border shadow-sm animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-success" />
          ) : (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          )}
          <h3 className="font-semibold text-foreground">
            {isComplete ? 'Verification Complete' : 'Verifying Submissions'}
          </h3>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {percentage}%
        </span>
      </div>

      <Progress value={percentage} className="h-2 mb-4" />

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-secondary rounded-lg">
          <div className="flex items-center justify-center gap-1.5 text-success mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-lg font-semibold">{completed}</span>
          </div>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>

        <div className="p-3 bg-secondary rounded-lg">
          <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-lg font-semibold">{processing}</span>
          </div>
          <p className="text-xs text-muted-foreground">Processing</p>
        </div>

        <div className="p-3 bg-secondary rounded-lg">
          <div className="flex items-center justify-center gap-1.5 text-destructive mb-1">
            <AlertCircle className="w-4 h-4" />
            <span className="text-lg font-semibold">{errors}</span>
          </div>
          <p className="text-xs text-muted-foreground">Errors</p>
        </div>
      </div>
    </div>
  );
}
