import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      return null;
    } catch (e) {
      console.error('[useAuth] signIn:', e);
      const message = 'Não foi possível entrar com o Google. Tente novamente.';
      setError(message);
      return message;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return null;
    } catch (e) {
      console.error('[useAuth] signOut:', e);
      return 'Não foi possível sair da conta.';
    }
  };

  return { user, loading, error, signInWithGoogle, signOut };
}
