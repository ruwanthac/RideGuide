import type { FirebaseError } from 'firebase/app';

export function formatAuthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as FirebaseError).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/configuration-not-found':
      return 'Firebase Auth is not configured for this project. In Firebase Console, open Authentication, click Get started, and enable Email/Password sign-in.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled in Firebase. Enable it in Firebase Console > Authentication > Sign-in method.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Something went wrong. Please try again.';
  }
}
