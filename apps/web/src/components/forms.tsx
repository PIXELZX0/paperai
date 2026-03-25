import { useState } from "react";

export function InlineForm(props: {
  fields: Array<{
    name: string;
    label: string;
    type?: string;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
    rows?: number;
    emptyLabel?: string;
  }>;
  submitLabel: string;
  disabled?: boolean;
  onSubmit(values: Record<string, string>): Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (props.disabled) {
          return;
        }
        setBusy(true);
        try {
          await props.onSubmit(values);
          setValues({});
        } finally {
          setBusy(false);
        }
      }}
    >
      {props.fields.map((field) => (
        <label key={field.name} className="grid gap-1 text-sm text-zinc-300">
          <span>{field.label}</span>
          {field.options ? (
            <select
              className="rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-white outline-none ring-0 disabled:opacity-50"
              value={values[field.name] ?? ""}
              disabled={props.disabled || busy}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field.name]: event.target.value }));
              }}
            >
              <option value="">{field.emptyLabel ?? "None"}</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              className="rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-white outline-none ring-0 disabled:opacity-50"
              rows={field.rows ?? 3}
              value={values[field.name] ?? ""}
              placeholder={field.placeholder}
              disabled={props.disabled || busy}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field.name]: event.target.value }));
              }}
            />
          ) : (
            <input
              className="rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-white outline-none ring-0 disabled:opacity-50"
              type={field.type ?? "text"}
              value={values[field.name] ?? ""}
              placeholder={field.placeholder}
              disabled={props.disabled || busy}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field.name]: event.target.value }));
              }}
            />
          )}
        </label>
      ))}
      <button
        className="rounded-2xl bg-cyan-400 px-4 py-2 font-medium text-zinc-950 disabled:opacity-50"
        disabled={busy || props.disabled}
      >
        {busy ? "Working..." : props.submitLabel}
      </button>
    </form>
  );
}
