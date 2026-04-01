export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-accent"
          aria-hidden
        />
        <p className="type-meta text-xs text-muted">Loading…</p>
      </div>
    </div>
  );
}
