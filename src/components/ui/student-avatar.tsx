import { useMemo, useState } from "react";

interface StudentAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const COLOR_PALETTES = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
];

const SIZE_CLASSES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

/** Extracts a 2-letter uppercase initial from a student's name (e.g. "Nero Noel" -> "NN"). */
export function getInitials(name: string): string {
  if (!name) return "??";
  const clean = name.trim().replace(/\s+/g, " ");
  const parts = clean.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts[0].length >= 2) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return parts[0].substring(0, 1).toUpperCase();
}

/** Deterministic color picker based on name string. */
function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
}

export function StudentAvatar({ name, imageUrl, size = "sm", className = "" }: StudentAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const palette = useMemo(() => getColor(name), [name]);
  const sizeClass = SIZE_CLASSES[size];

  if (imageUrl && !imageError) {
    return (
      <img
        src={imageUrl}
        alt={name}
        onError={() => setImageError(true)}
        className={`inline-block rounded-full object-cover shadow-sm border border-border/60 ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase tracking-wider border shadow-sm select-none ${sizeClass} ${palette} ${className}`}
    >
      {initials}
    </div>
  );
}
