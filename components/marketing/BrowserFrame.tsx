import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/cn";

/**
 * Frames a real product screenshot like a browser window — three "traffic
 * light" dots and a fake address bar — so it reads clearly as "this is the
 * actual app", not stock art. Used for the desktop (staff-facing) screens.
 */
export function BrowserFrame({
  src,
  alt,
  url,
  className,
  priority,
  sizes = "(min-width: 1024px) 640px, 100vw",
}: {
  src: StaticImageData;
  alt: string;
  url: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface shadow-xl",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning" />
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <span className="ml-2 truncate rounded-md bg-bg px-3 py-1 text-xs text-fg-subtle">
          {url}
        </span>
      </div>
      <Image
        src={src}
        alt={alt}
        placeholder="blur"
        priority={priority}
        sizes={sizes}
        className="h-auto w-full"
      />
    </div>
  );
}
