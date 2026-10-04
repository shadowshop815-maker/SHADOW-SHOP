import { useState, useRef, useEffect, type ReactNode } from "react";
import { AlertTriangle, PackageOpen, ChevronLeft, ChevronRight, X, Search } from "lucide-react";

export function PageHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Loading() {
  return <div className="loading"><span />Loading live data…</div>;
}

export function ErrorState({ error }: { error: Error | null }) {
  return error ? (
    <div className="empty error">
      <AlertTriangle />
      <h2>Couldn’t load this view</h2>
      <p>{error.message}</p>
    </div>
  ) : null;
}

export function Empty({ label = "No records found" }: { label?: string }) {
  return (
    <div className="empty">
      <PackageOpen />
      <h2>{label}</h2>
    </div>
  );
}

export type Pagination = { page: number; pages: number; total: number; limit: number };

export function Pager({ value, onChange }: { value: Pagination; onChange: (p: number) => void }) {
  return (
    <div className="pager">
      <span>{value.total} records · Page {value.page} of {Math.max(1, value.pages)}</span>
      <div>
        <button disabled={value.page <= 1} onClick={() => onChange(value.page - 1)}><ChevronLeft /></button>
        <button disabled={value.page >= value.pages} onClick={() => onChange(value.page + 1)}><ChevronRight /></button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop">
      <section className="drawer" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close modal"><X size={18} /></button>
        </header>
        <div className="drawer-body">{children}</div>
      </section>
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`pill ${value.toLowerCase()}`}>{value.replaceAll("_", " ")}</span>;
}

export function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} required={required} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

export function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea rows={4} required={required} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

export function Toolbar({ search, onSearch, placeholder = "Search records…", children }: { search: string; onSearch: (s: string) => void; placeholder?: string; children?: ReactNode }) {
  const [localValue, setLocalValue] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local value in sync if parent resets (e.g. clear from outside)
  useEffect(() => { setLocalValue(search); }, [search]);

  const commit = (val: string) => {
    if (timer.current) clearTimeout(timer.current);
    onSearch(val);
  };

  const handleChange = (val: string) => {
    setLocalValue(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(val), 400);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-search-box">
        <Search className="search-icon" size={16} />
        <input 
          type="text"
          placeholder={placeholder} 
          value={localValue} 
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && commit(localValue)}
          className="toolbar-search-input"
        />
        {localValue ? (
          <button 
            type="button" 
            className="search-clear-btn" 
            onClick={() => { setLocalValue(""); commit(""); }} 
            title="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function RequestTable({ title, eyebrow, description, loading, error, empty, pager, onPage, children }: { title: string; eyebrow: string; description: string; loading: boolean; error: Error | null; empty: boolean; pager?: Pagination; onPage: (p: number) => void; children: ReactNode }) {
  return (
    <>
      <PageHead eyebrow={eyebrow} title={title} description={description} />
      <section className="card">
        {loading ? <Loading /> : error ? <ErrorState error={error} /> : empty ? <Empty /> : (
          <>
            <div className="table-wrap">{children}</div>
            {pager && <Pager value={pager} onChange={onPage} />}
          </>
        )}
      </section>
    </>
  );
}
