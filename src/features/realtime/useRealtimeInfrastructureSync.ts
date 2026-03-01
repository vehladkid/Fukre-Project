// =============================================================================
// src/features/realtime/useRealtimeInfrastructureSync.ts
// =============================================================================
// Single Supabase channel — coordinates zero-latency intelligence updates.
//
// On any infrastructure_assets change:
//   1. IMMEDIATE  → triggerOptimisticUpdate(payload)
//                   Each hook instantly mutates its local cache + setState
//                   → charts/KPIs update BEFORE any network call completes
//
//   2. BACKGROUND → setTimeout 1500ms → triggerIntelligenceRefresh()
//                   Silently re-fetches from DB views to correct any mismatch
//                   → user never sees inconsistency
//
// This is the same pattern used by Google Maps, trading dashboards, etc.
// =============================================================================

import { useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    triggerOptimisticUpdate,
    triggerIntelligenceRefresh,
    type RealtimePayload,
} from '../../lib/intelligenceRefresh';

const CHANNEL_NAME = 'uiip-infrastructure-sync';
let revalidationTimer: ReturnType<typeof setTimeout> | null = null;

export function useRealtimeInfrastructureSync(): void {
    useEffect(() => {
        const channel = supabase
            .channel(CHANNEL_NAME)
            .on('system' as any, {}, (status: any) => {
                // Check browser DevTools console to confirm subscription status
                if (status === 'SUBSCRIBED') {
                    console.log('%c[UIIP Realtime] ✅ Channel SUBSCRIBED — live sync active', 'color: #10b981; font-weight: bold');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('[UIIP Realtime] ❌ Channel error:', status, '— Check Supabase Realtime settings');
                }
            })
            .on(
                'postgres_changes',
                {
                    event: '*',       // INSERT | UPDATE | DELETE
                    schema: 'public',
                    table: 'infrastructure_assets',
                },
                (payload) => {
                    console.log('[UIIP Realtime] 📡 Event received:', payload.eventType, payload.new ?? payload.old);

                    const typedPayload: RealtimePayload = {
                        eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                        new: (payload.new as Record<string, any>) ?? {},
                        old: (payload.old as Record<string, any>) ?? {},
                    };

                    // ── Step 1: Instant optimistic mutation ───────────────────
                    triggerOptimisticUpdate(typedPayload);

                    // ── Step 2: Silent background revalidation ────────────────
                    if (revalidationTimer) clearTimeout(revalidationTimer);
                    revalidationTimer = setTimeout(() => {
                        console.log('[UIIP Realtime] 🔄 Background revalidation firing...');
                        triggerIntelligenceRefresh();
                        revalidationTimer = null;
                    }, 1500);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('%c[UIIP Realtime] ✅ Supabase channel connected', 'color: #10b981; font-weight: bold');
                } else {
                    console.warn('[UIIP Realtime] Channel status:', status);
                }
            });

        return () => {
            if (revalidationTimer) {
                clearTimeout(revalidationTimer);
                revalidationTimer = null;
            }
            supabase.removeChannel(channel);
        };
    }, []);
}
