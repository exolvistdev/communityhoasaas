import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/**
 * The single pre-footer call to action. One button, always to /contact — every
 * marketing page routes to the same conversion point.
 */
export function CtaBand({
  heading,
  label = "Request a demo",
}: {
  heading: string;
  label?: string;
}) {
  return (
    <section className="bg-brand bg-gradient-to-br from-brand-hi to-brand text-brand-fg">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-semibold sm:text-xl">{heading}</p>
        <Link
          href="/contact"
          className={buttonClass({
            variant: "secondary",
            size: "lg",
            className: "w-full shrink-0 sm:w-auto",
          })}
        >
          {label}
        </Link>
      </div>
    </section>
  );
}
