import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Loader2, ScanFace, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/layout/PageHeader";
import { livenessService } from "@/services/biometricService";
import { cn } from "@/lib/utils";

type ChallengeId = "left" | "right" | "blink" | "smile";

const CHALLENGES: { id: ChallengeId; prompt: string; icon: typeof Eye }[] = [
  { id: "left", prompt: "Turn your head slowly to the left", icon: ArrowLeft },
  { id: "right", prompt: "Turn your head slowly to the right", icon: ArrowRight },
  { id: "blink", prompt: "Blink twice", icon: Eye },
  { id: "smile", prompt: "Smile", icon: Smile },
];

const SECONDS_PER_CHALLENGE = 4;

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Guided liveness challenge. The user must complete a randomised sequence of head
 * movements before any image is captured and sent to the verification server.
 */
export function LivenessChallenge({ onPassed }: { onPassed: () => void }) {
  const [sequence, setSequence] = useState<typeof CHALLENGES>([]);
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(SECONDS_PER_CHALLENGE);
  const [running, setRunning] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = () => {
    setSequence(shuffled(CHALLENGES).slice(0, 3));
    setIndex(0);
    setSeconds(SECONDS_PER_CHALLENGE);
    setError(null);
    setRunning(true);
  };

  const finish = useCallback(async () => {
    stop();
    setRunning(false);
    setEvaluating(true);
    const outcome = await livenessService.evaluate();
    setEvaluating(false);
    if (outcome.ok) {
      onPassed();
    } else {
      setError(outcome.message);
    }
  }, [onPassed, stop]);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s > 1) return s - 1;
        setIndex((i) => {
          const next = i + 1;
          if (next >= sequence.length) {
            void finish();
            return i;
          }
          return next;
        });
        return SECONDS_PER_CHALLENGE;
      });
    }, 1000);
    return stop;
  }, [running, sequence.length, finish, stop]);

  const current = sequence[index];
  const Icon = current?.icon ?? ScanFace;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Liveness check</h3>
          <p className="text-xs text-muted-foreground">
            Complete the movements below. The image is only captured after the challenge passes.
          </p>
        </div>
        {running && (
          <StatusBadge tone="info" pulse>
            Step {index + 1} of {sequence.length}
          </StatusBadge>
        )}
      </div>

      <div
        className={cn(
          "relative mx-auto flex aspect-[4/5] w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border",
          running ? "border-primary/50 bg-primary/5" : "border-border bg-secondary",
        )}
      >
        <div
          className={cn(
            "absolute h-[70%] w-[58%] rounded-[50%] border-2 border-dashed",
            running ? "border-primary/70" : "border-border",
          )}
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center gap-2 px-6 text-center">
          {evaluating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <p className="text-sm font-medium text-foreground">
                Sending liveness sequence to the server…
              </p>
            </>
          ) : running && current ? (
            <>
              <Icon className="h-9 w-9 text-primary" aria-hidden />
              <p aria-live="polite" className="text-sm font-semibold text-foreground">
                {current.prompt}
              </p>
              <p className="text-xs text-muted-foreground">{seconds}s remaining</p>
            </>
          ) : (
            <>
              <ScanFace className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">Hold your phone at eye level</p>
              <p className="text-xs text-muted-foreground">
                You will be asked to move your head in a random order.
              </p>
            </>
          )}
        </div>
      </div>

      {running && (
        <ol className="flex justify-center gap-2">
          {sequence.map((step, i) => (
            <li
              key={step.id}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                i < index
                  ? "border-success bg-success/15 text-success"
                  : i === index
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              {i < index ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : i + 1}
            </li>
          ))}
        </ol>
      )}

      {error && <ErrorState title="Liveness check failed" description={error} />}

      {!running && !evaluating && (
        <div className="flex justify-center">
          <Button onClick={start}>{error ? "Retry liveness check" : "Start liveness check"}</Button>
        </div>
      )}
    </div>
  );
}
