"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { User, Auth } from "firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postSessionCookie(idToken: string): Promise<void> {
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const authRef = useRef<Auth | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function init() {
      const { getFirebaseAuth } = await import("@/lib/firebase/client");
      const { onAuthStateChanged } = await import("firebase/auth");
      const auth = getFirebaseAuth();
      authRef.current = auth;

      unsubscribe = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setLoading(false);
        if (u) {
          const idToken = await u.getIdToken();
          await postSessionCookie(idToken);
        } else {
          await fetch("/api/auth/session", { method: "DELETE" });
        }
      });
    }

    init();
    return () => unsubscribe?.();
  }, []);

  const getAuth = useCallback(async (): Promise<Auth> => {
    if (authRef.current) return authRef.current;
    const { getFirebaseAuth } = await import("@/lib/firebase/client");
    const auth = getFirebaseAuth();
    authRef.current = auth;
    return auth;
  }, []);

  const signInEmail = useCallback(
    async (email: string, password: string) => {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const auth = await getAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await postSessionCookie(idToken);
    },
    [getAuth],
  );

  const signUpEmail = useCallback(
    async (email: string, password: string) => {
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      const auth = await getAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await postSessionCookie(idToken);
    },
    [getAuth],
  );

  const signInGoogle = useCallback(async () => {
    const { signInWithPopup, GoogleAuthProvider } = await import(
      "firebase/auth"
    );
    const auth = await getAuth();
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const idToken = await cred.user.getIdToken();
    await postSessionCookie(idToken);
  }, [getAuth]);

  const signOut = useCallback(async () => {
    const { signOut: fbSignOut } = await import("firebase/auth");
    const auth = await getAuth();
    await fbSignOut(auth);
  }, [getAuth]);

  return (
    <AuthContext.Provider
      value={{ user, loading, signInEmail, signUpEmail, signInGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
