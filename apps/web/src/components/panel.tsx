import type { PropsWithChildren, ReactNode } from "react";

export function Panel(
  props: PropsWithChildren<{
    title: string;
    actions?: ReactNode;
    eyebrow?: string;
    className?: string;
    contentClassName?: string;
  }>,
) {
  return (
    <section
      className={`paper-panel rounded-[1.9rem] border p-5 backdrop-blur ${props.className ?? ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          {props.eyebrow ? (
            <p className="paper-shell-label text-[0.68rem] font-medium">
              {props.eyebrow}
            </p>
          ) : null}
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-200">
            {props.title}
          </h2>
        </div>
        {props.actions}
      </div>
      <div className={props.contentClassName}>{props.children}</div>
    </section>
  );
}
