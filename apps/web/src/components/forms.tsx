import { useEffect, useState } from "react";

const fieldClassName =
  "paper-input rounded-[1.25rem] px-3.5 py-2.5 text-[0.95rem] outline-none ring-0 transition disabled:cursor-not-allowed disabled:opacity-50";

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
  initialValues?: Record<string, string>;
  onSubmit(values: Record<string, string>): Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    props.initialValues ?? {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(props.initialValues ?? {});
  }, [props.initialValues]);

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (props.disabled) {
          return;
        }
        setError(null);
        setBusy(true);
        try {
          await props.onSubmit(values);
          setValues(props.initialValues ?? {});
        } catch (err) {
          setError(err instanceof Error ? err.message : "Request failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {props.fields.map((field) => {
        const fieldId = `inline-form-${field.name}`;
        return (
          <label
            key={field.name}
            htmlFor={fieldId}
            className="grid gap-1.5 text-sm text-zinc-300"
          >
            <span className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-zinc-500">
              {field.label}
            </span>
            {field.options ? (
              <select
                id={fieldId}
                className={fieldClassName}
                value={values[field.name] ?? ""}
                disabled={props.disabled || busy}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }));
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
                id={fieldId}
                className={fieldClassName}
                rows={field.rows ?? 3}
                value={values[field.name] ?? ""}
                placeholder={field.placeholder}
                disabled={props.disabled || busy}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }));
                }}
              />
            ) : (
              <input
                id={fieldId}
                className={fieldClassName}
                type={field.type ?? "text"}
                value={values[field.name] ?? ""}
                placeholder={field.placeholder}
                disabled={props.disabled || busy}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }));
                }}
              />
            )}
          </label>
        );
      })}
      <button
        type="submit"
        className="paper-accent-button rounded-[1.3rem] px-4 py-3 text-sm font-semibold tracking-[0.04em] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy || props.disabled}
      >
        {busy ? "Working..." : props.submitLabel}
      </button>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </form>
  );
}
