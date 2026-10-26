'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Lock, Mail, User, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient, setStoredToken, setStoredUser } from '@/lib/api-client';
import { loginWithGoogle, registerWithEmail } from '@/lib/firebase';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('Kanishk');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignUp = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      await loginWithGoogle();
      router.push('/dashboard');
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return;
      }
      setError(
        err?.message?.includes('unauthorized-domain')
          ? 'Domain not authorized in Firebase Console. Please add localhost to Authorized Domains.'
          : err instanceof Error
          ? err.message
          : 'Google sign-up failed. Please try again.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      // Attempt Firebase registration
      try {
        await registerWithEmail(email, password, fullName);
        router.push('/dashboard');
        return;
      } catch (fbErr: any) {
        // Fallback to local FastAPI backend register
        const res = await apiClient<{ access_token: string; user: { email: string; full_name?: string } }>(
          '/api/v1/auth/register',
          {
            method: 'POST',
            body: JSON.stringify({ email, password, display_name: fullName, full_name: fullName }),
          }
        );
        setStoredToken(res.access_token);
        setStoredUser(res.user || { email, full_name: fullName });
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#000000] flex flex-col justify-center items-center px-4 py-12">
      {/* Back to Landing Page Button */}
      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors py-2 px-3 rounded-xl hover:bg-white/[0.05]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </Link>

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-3">
            <img
              src="/logo-icon-white.png"
              alt="VAANI"
              className="h-8 w-auto object-contain"
            />
            <span className="font-semibold text-xl text-white tracking-tight">VAANI</span>
          </Link>
          <h2 className="text-lg font-semibold text-white tracking-tight">Create your account</h2>
          <p className="text-xs text-zinc-400 mt-1">Get started with conversational voice AI agents</p>
        </div>

        {/* Card */}
        <div className="bg-[#121215] rounded-2xl p-7 sm:p-8 shadow-2xl space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Firebase Google Sign-Up */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || loading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1c1c20] hover:bg-[#25252b] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2.5 border border-white/[0.08] disabled:opacity-50"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign up with Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-white/[0.08] w-full" />
            <span className="bg-[#121215] px-3 text-[10px] text-zinc-500 uppercase tracking-wider absolute">
              or register with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Kanishk"
                  className="w-full bg-[#1c1c20] focus:bg-[#232328] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none transition-colors border-0 focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kanishk@example.com"
                  className="w-full bg-[#1c1c20] focus:bg-[#232328] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none transition-colors border-0 focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min 6 characters)"
                  className="w-full bg-[#1c1c20] focus:bg-[#232328] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none transition-colors border-0 focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-white/[0.06] text-center text-xs text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="text-white font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
