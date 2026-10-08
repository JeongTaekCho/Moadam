"use client";
import Image from "next/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
export function Button({
  variant = "primary",
  size = "normal",
  loading,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "normal" | "small";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`button ${variant} ${size} disabled:pointer-events-none focus-visible:ring-4 focus-visible:ring-brand-200 ${className}`}
      aria-busy={loading}
    >
      {loading ? "처리 중…" : children}
    </button>
  );
}
export function TextField({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const errorId = useId();
  return (
    <label className="field">
      <span>{label}</span>
      <input
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <small id={errorId} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function Textarea({
  label,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
}) {
  const errorId = useId();
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <small id={errorId} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function Select({
  label,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
}) {
  const errorId = useId();
  return (
    <label className="field">
      <span>{label}</span>
      <select
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      >
        {children}
      </select>
      {error && (
        <small id={errorId} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Avatar({
  name,
  src,
  className = "",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span className={`avatar ${className}`} aria-label={name}>
      {src && src !== failedSrc ? (
        <Image
          unoptimized
          src={src}
          width={64}
          height={64}
          alt=""
          onError={() => setFailedSrc(src)}
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
export function UserIdentity({
  profile,
  id,
  label,
}: {
  profile?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
  id?: string;
  label?: string;
}) {
  const name =
    profile?.display_name || (id ? `멤버 ${id.slice(0, 8)}` : "멤버");
  return (
    <span className="user-identity">
      <Avatar name={name} src={profile?.avatar_url} />
      <span>
        {label && <small>{label} </small>}
        {name}
      </span>
    </span>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`card rounded-panel bg-surface border-line ${className}`}
    >
      {children}
    </section>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={title}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (outside) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="row between">
        <h2>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="닫기">
          ✕
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmDialog({
  title,
  onConfirm,
  onClose,
  loading,
}: {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog title="삭제 확인" onClose={onClose}>
      <p>
        {title} 삭제하시겠습니까? 연결된 데이터도 삭제되며 복구할 수 없습니다.
      </p>
      <div className="row">
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          삭제
        </Button>
      </div>
    </Dialog>
  );
}
export function Dropdown({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="dropdown">
      <summary>{label}</summary>
      <div className="menu">{children}</div>
    </details>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <Button
          key={item}
          role="tab"
          aria-selected={item === value}
          variant="secondary"
          onClick={() => onChange(item)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              const offset = e.key === "ArrowRight" ? 1 : -1;
              onChange(
                items[
                  (items.indexOf(item) + offset + items.length) % items.length
                ],
              );
              const target = e.currentTarget.parentElement?.children[
                (items.indexOf(item) + offset + items.length) % items.length
              ] as HTMLElement;
              target?.focus();
            }
          }}
        >
          {item}
        </Button>
      ))}
    </div>
  );
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <div role="status" className="toast">
      {message}
    </div>
  ) : null;
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p className="muted">{description}</p>
    </div>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="error">
      {message}{" "}
      {onRetry && (
        <Button variant="secondary" size="small" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}
