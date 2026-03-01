import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "operator" | "viewer";

export interface Profile {
    id: string;
    full_name: string | null;
    role: UserRole;
    created_at: string;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    role: UserRole | null;
    loading: boolean;
    logout: () => Promise<void>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum time (ms) to wait for getSession() before treating it as a failure. */
const SESSION_TIMEOUT_MS = 8_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Race a promise against a timeout.  Rejects with a clear error if the
 * original promise hasn't settled within `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
        ),
    ]);
}

/**
 * Best-effort removal of the Supabase auth token from localStorage.
 * The key format is `sb-<project-ref>-auth-token`.
 */
function clearSupabaseLocalStorage(): void {
    try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // localStorage may be unavailable (e.g. in some privacy modes)
    }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    // Mounted flag – prevents state updates after unmount and stops async
    // callbacks from racing against cleanup.
    const mountedRef = useRef(true);

    // Abort controller – lets us cancel in-flight profile fetches on logout
    // or unmount so they don't write stale data into state.
    const profileAbortRef = useRef<AbortController | null>(null);

    // We call useNavigate here so logout can use router navigation instead of
    // window.location (which destroys React state and causes flash-of-content).
    const navigate = useNavigate();

    // ── Safe state setters (only if still mounted) ───────────────────────────

    const safeSetSession = useCallback((s: Session | null) => {
        if (mountedRef.current) setSession(s);
    }, []);

    const safeSetProfile = useCallback((p: Profile | null) => {
        if (mountedRef.current) setProfile(p);
    }, []);

    const safeSetLoading = useCallback((l: boolean) => {
        if (mountedRef.current) setLoading(l);
    }, []);

    // ── Profile loader ───────────────────────────────────────────────────────
    // Isolated so it can never block the UI.  Errors are caught and logged;
    // failure simply means profile stays null (the rest of the app still works).

    const loadProfile = useCallback(async (userId: string) => {
        // Cancel any previous in-flight profile request
        profileAbortRef.current?.abort();
        const controller = new AbortController();
        profileAbortRef.current = controller;

        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (controller.signal.aborted) return;

            if (!error && data) {
                safeSetProfile(data as Profile);
            } else {
                console.warn("[Auth] Profile fetch failed:", error?.message);
                safeSetProfile(null);
            }
        } catch (err: any) {
            if (err?.name === "AbortError") return; // intentional cancellation
            console.warn("[Auth] Profile fetch exception:", err);
            safeSetProfile(null);
        }
    }, [safeSetProfile]);

    // ── Hard reset – nuclear option for unrecoverable auth state ─────────────

    const hardReset = useCallback(async () => {
        try {
            await supabase.auth.signOut();
        } catch {
            // signOut itself may fail if the lock is deadlocked — ignore
        }
        clearSupabaseLocalStorage();
        safeSetSession(null);
        safeSetProfile(null);
        safeSetLoading(false);
    }, [safeSetSession, safeSetProfile, safeSetLoading]);

    // ── Logout ───────────────────────────────────────────────────────────────

    const logout = useCallback(async () => {
        // 1. Cancel any in-flight profile fetch
        profileAbortRef.current?.abort();

        // 2. Sign out from Supabase (clears server-side session & localStorage)
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.warn("[Auth] signOut error during logout:", err);
            // Even if signOut fails, we still clear local state below
        }

        // 3. Clear React state
        safeSetSession(null);
        safeSetProfile(null);

        // 4. Navigate using the router (preserves React tree, no full reload)
        navigate("/login", { replace: true });
    }, [navigate, safeSetSession, safeSetProfile]);

    // ── Bootstrap + listener ─────────────────────────────────────────────────

    useEffect(() => {
        mountedRef.current = true;

        // ── 0. Offline guard ─────────────────────────────────────────────────
        // If the browser is offline there is zero chance the refresh POST will
        // succeed. Rather than letting Supabase retry indefinitely (which leads
        // to the ERR_INTERNET_DISCONNECTED loop), we bail immediately.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            console.warn("[Auth] Browser is offline – skipping session restore");
            safeSetSession(null);
            safeSetLoading(false);
            // We still set up the listener below so the app reacts when the
            // user signs in after going back online.
        } else {
            // ── 1. Restore session with a timeout ────────────────────────────
            // getSession() reads the stored refresh token from localStorage and
            // exchanges it for a fresh access token via a network request.
            // If that request hangs (e.g. network drop, lock deadlock), we kill
            // it after SESSION_TIMEOUT_MS and hard-reset into a signed-out state.
            (async () => {
                try {
                    const { data, error } = await withTimeout(
                        supabase.auth.getSession(),
                        SESSION_TIMEOUT_MS,
                        "getSession",
                    );

                    if (!mountedRef.current) return;

                    if (error) {
                        console.error("[Auth] getSession error:", error.message);
                        await hardReset();
                        return;
                    }

                    const restoredSession = data.session;
                    safeSetSession(restoredSession);

                    if (restoredSession?.user) {
                        // Fire-and-forget profile load – never blocks loading
                        loadProfile(restoredSession.user.id);
                    }

                    safeSetLoading(false);
                } catch (err: any) {
                    if (!mountedRef.current) return;

                    // Covers: timeout, NavigatorLockAcquireTimeoutError, network
                    // errors, and any other unexpected failure.
                    const isLockError = err?.name === "NavigatorLockAcquireTimeoutError";
                    console.error(
                        `[Auth] Session restore failed${isLockError ? " (lock deadlock)" : ""}:`,
                        err,
                    );
                    await hardReset();
                }
            })();
        }

        // ── 2. Auth state change listener ────────────────────────────────────
        // We only act on the three events that represent real state transitions.
        // TOKEN_REFRESHED and USER_UPDATED are ignored to avoid unnecessary
        // profile refetches and state churn.
        const { data: listener } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!mountedRef.current) return;

                switch (event) {
                    case "INITIAL_SESSION":
                        // This fires once with the same data getSession() returns.
                        // We already handled it above, but if getSession timed out
                        // and the listener fires later, we can pick it up here.
                        if (newSession) {
                            safeSetSession(newSession);
                            loadProfile(newSession.user.id);
                        }
                        safeSetLoading(false);
                        break;

                    case "SIGNED_IN":
                        safeSetSession(newSession);
                        if (newSession?.user) {
                            loadProfile(newSession.user.id);
                        }
                        safeSetLoading(false);
                        break;

                    case "SIGNED_OUT":
                        profileAbortRef.current?.abort();
                        safeSetSession(null);
                        safeSetProfile(null);
                        safeSetLoading(false);
                        break;

                    // TOKEN_REFRESHED / USER_UPDATED — intentionally ignored.
                    // We do NOT refetch the profile on token refresh because:
                    //  a) The profile hasn't changed (only the JWT expiry has)
                    //  b) Fetching on every refresh quadruples DB calls for no benefit
                    //  c) If the refresh itself came from a retry loop, acting on it
                    //     would amplify the problem
                    default:
                        break;
                }
            },
        );

        // ── 3. Cleanup ──────────────────────────────────────────────────────
        return () => {
            mountedRef.current = false;
            profileAbortRef.current?.abort();
            listener.subscription.unsubscribe();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Render ───────────────────────────────────────────────────────────────
    // IMPORTANT: We ALWAYS render children.  We never block the entire React
    // tree behind a loading spinner.  The `loading` flag is exposed in context
    // so that individual routes (e.g. ProtectedRoute) can show their own
    // loading UI while still allowing the router and other non-protected
    // content to render normally.

    return (
        <AuthContext.Provider
            value={{
                session,
                user: session?.user ?? null,
                profile,
                role: profile?.role ?? null,
                loading,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};
