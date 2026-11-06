import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isValidEmailFormat } from '../lib/authValidation';
import { SUPPORT_WHATSAPP_URL } from '../lib/support';

export function LoginPage({ onBack }) {
  const navigate = useNavigate();
  const { authLoading, authError, login, setAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleBack = () => {
    if (onBack) onBack();
    else navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !isValidEmailFormat(email)) {
      return setAuthError('Enter a valid email address');
    }
    if (!password) {
      return setAuthError('Enter your password');
    }
    const ok = await login(email.trim(), password);
    if (ok) navigate('/dashboard');
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row selection:bg-[#174b35] selection:text-white">
      {/* Left Column: Authentication Form */}
      <div className="flex-1 lg:w-1/2 xl:w-[48%] flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16 xl:px-20 bg-white">
        {/* Top: Logo & Back link */}
        <div className="flex items-center justify-between w-full">
          <Link to="/" className="inline-block focus:outline-hidden">
            <img
              src="/images/track-farm-logo-horizontal.jpg"
              alt="Track Farm"
              width={470}
              height={96}
              className="h-9 sm:h-10 w-auto"
            />
          </Link>

          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer group"
          >
            <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            <span>Back to site</span>
          </button>
        </div>

        {/* Center: Auth Form Container */}
        <div className="w-full max-w-md mx-auto my-auto py-10">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950 font-heading">
                Welcome Back!
              </h1>
              <p className="text-sm text-neutral-500 mt-2.5 leading-relaxed">
                Sign in to access your dashboard and continue managing your farm records with precision.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {authError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{authError}</span>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block" htmlFor="login-email">
                  Email
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
                    <Mail size={18} />
                  </div>
                  <input
                    id="login-email"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-hidden focus:border-[#174b35] focus:ring-1 focus:ring-[#174b35] transition-all placeholder:text-neutral-400"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    disabled={authLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block" htmlFor="login-password">
                  Password
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
                    <Lock size={18} />
                  </div>
                  <input
                    id="login-password"
                    className="w-full pl-10 pr-11 py-3 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-hidden focus:border-[#174b35] focus:ring-1 focus:ring-[#174b35] transition-all placeholder:text-neutral-400"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={authLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 text-neutral-400 hover:text-neutral-600 transition-colors p-1 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="flex justify-end pt-1">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-[#174b35] hover:text-[#0f3825] hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-5 bg-[#174b35] hover:bg-[#0f3825] active:bg-[#092518] text-white font-semibold rounded-xl shadow-sm text-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                disabled={authLoading}
              >
                {authLoading ? (
                  <>
                    <div className="spinner !w-4 !h-4 !border-white/40 !border-t-white" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-neutral-500">
                Don't have an account?{' '}
                <Link to="/signup" className="font-semibold text-[#174b35] hover:underline">
                  Create an account
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-700 hover:underline"
          >
            Trouble signing in? Message us on WhatsApp
          </a>
          <div>© {new Date().getFullYear()} TrackFarm</div>
        </div>
      </div>

      {/* Right Column: Full-Bleed Brand/Testimonial Section (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[52%] relative flex-col justify-center px-12 xl:px-20 py-16 text-white overflow-hidden bg-neutral-900">
        {/* Natural background photo with light blur, no green layover */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-[2.5px] scale-105"
          style={{
            backgroundImage: "url('/images/jam.avif')",
          }}
        />
        {/* Soft neutral dark scrim for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20" />

        {/* Content Container */}
        <div className="relative z-10 max-w-lg space-y-10">
          {/* Main Headline */}
          <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-bold tracking-tight text-white leading-[1.2] font-heading">
            Designed for the Daily Realities of Modern Poultry Farming.
          </h2>

          {/* Mission / Value Statement */}
          <div className="space-y-6">
            <div className="h-1 w-12 rounded-full bg-[#d9ed69]" />
            <p className="text-base xl:text-lg text-emerald-100/90 leading-relaxed font-normal">
              From day-old arrival to market harvest, TrackFarm eliminates scattered paper notebooks, untracked feed bags, and guesswork in your pens.
            </p>

            {/* Farm Types / Coverage */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-emerald-100 border border-white/15 backdrop-blur-sm">
                Broiler Batches
              </span>
              <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-emerald-100 border border-white/15 backdrop-blur-sm">
                Commercial Layers
              </span>
              <span className="inline-flex items-center rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-emerald-100 border border-white/15 backdrop-blur-sm">
                Breeder Operations
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
