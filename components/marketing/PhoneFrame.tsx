import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/cn";

/**
 * Frames a real product screenshot as a phone — a dark bezel + home
 * indicator — for the resident-facing portal screens, which residents
 * actually use on their phone.
 */
export function PhoneFrame({
  src,
  alt,
  className,
  priority,
  sizes = "(min-width: 1024px) 300px, 70vw",
}: {
  src: StaticImageData;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[300px]", className)}>
      <div className="rounded-[2.25rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
        <div className="overflow-hidden rounded-[1.4rem] bg-white">
          <Image
            src={src}
            alt={alt}
            placeholder="blur"
            priority={priority}
            sizes={sizes}
            className="h-auto w-full"
          />
        </div>
        <div className="mx-auto my-2 h-1 w-20 rounded-full bg-neutral-700" />
      </div>
    </div>
  );
}
