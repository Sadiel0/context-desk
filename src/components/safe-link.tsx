import type { ReactNode } from "react";
import { safeHttpUrl } from "@/domain/urls";

export function SafeLink({
  href,
  children,
  className,
}: {
  href: string | null;
  children: ReactNode;
  className?: string;
}) {
  const safe = href ? safeHttpUrl(href) : null;
  if (!safe) return <span className={className}>{children}</span>;
  return (
    <a className={className ?? "text-link"} href={safe} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
