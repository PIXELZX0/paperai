import type { PropsWithChildren, ReactNode } from "react";

export function Panel(props: PropsWithChildren<{ title: string; actions?: ReactNode }>) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">{props.title}</h2>
        {props.actions}
      </div>
      {props.children}
    </section>
  );
}
