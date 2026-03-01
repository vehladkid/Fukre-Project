// =============================================================================
// src/lib/intelligenceRefresh.ts
// =============================================================================
// Dual-bus event coordinator:
//
//  Bus 1 — OPTIMISTIC (immediate)
//    triggerOptimisticUpdate(payload)
//    → registered callbacks mutate local cache + call setState instantly
//    → zero loading spinner, zero perceived latency
//
//  Bus 2 — REVALIDATION (background, ~1500ms later)
//    triggerIntelligenceRefresh()
//    → registered callbacks bust cache + re-fetch from DB views
//    → silently corrects any mismatch the optimistic update introduced
//
// Both buses are keyed maps so hooks register/deregister cleanly on mount/unmount.
// =============================================================================

// ── Realtime payload shape from Supabase postgres_changes ────────────────────
export interface RealtimePayload {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, any>;
    old: Record<string, any>;
}

// ── Bus 1: Optimistic ─────────────────────────────────────────────────────────
type OptimisticCallback = (payload: RealtimePayload) => void;
const optimisticCallbacks = new Map<string, OptimisticCallback>();

export function registerOptimisticCallback(key: string, cb: OptimisticCallback): void {
    optimisticCallbacks.set(key, cb);
}

export function deregisterOptimisticCallback(key: string): void {
    optimisticCallbacks.delete(key);
}

/** Fire all optimistic callbacks immediately — no loading state, no delay. */
export function triggerOptimisticUpdate(payload: RealtimePayload): void {
    optimisticCallbacks.forEach(cb => cb(payload));
}

// ── Bus 2: Full revalidation ──────────────────────────────────────────────────
type RefreshCallback = () => void;
const refreshCallbacks = new Map<string, RefreshCallback>();

export function registerRefreshCallback(key: string, cb: RefreshCallback): void {
    refreshCallbacks.set(key, cb);
}

export function deregisterRefreshCallback(key: string): void {
    refreshCallbacks.delete(key);
}

/** Fire all full-refresh callbacks — busts cache and re-fetches from DB views. */
export function triggerIntelligenceRefresh(): void {
    refreshCallbacks.forEach(cb => cb());
}
