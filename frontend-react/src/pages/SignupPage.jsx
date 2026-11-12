import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ArrowRight, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isValidEmailFormat, passwordError, suggestEmailCorrection } from '../lib/authValidation';
import { SUPPORT_WHATSAPP_URL } from '../lib/support';

export function SignupPage({ onBack }) {
  const navigate = useNavigate();
  const { authLoading, authError, signup, setAuthError } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [dismissedSuggestion, setDismissedSuggestion] = useState('');

  const handleBack = () => {
    if (onBack) onBack();
    else navigate('/');
  };

  const suggestion = useMemo(() => {
    const s = suggestEmailCorrection(email);
    return s && s !== dismissedSuggestion ? s : null;
  }, [email, dismissedSuggestion]);

  const pwError = password ? passwordError(password) : null;
  // Only flag a mismatch once they've typed something in the confirm box.
  const confirmError = confirmPassword && confirmPassword !== password ? "Passwords don't match" : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !isValidEmailFormat(email)) {
      return setAuthError('Enter a valid email address');
    }
    const pErr = passwordError(password);
    if (pErr) return setAuthError(pErr);
    if (!confirmPassword) return setAuthError('Confirm your password');
    if (confirmPassword !== password) return setAuthError("Passwords don't match");
    if (!agreeTerms) {
      return setAuthError('Please agree to the Terms & Conditions to continue');
    }

    // Save farmer name if provided for smooth onboarding prefill
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (fullName) {
      localStorage.setItem('farmbook_farmername', fullName);
    }

    const ok = await signup(email.trim(), password);
    if (ok) navigate('/onboarding');
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row selection:bg-[#174b35] selection:text-white">
      {/* Left Column: Full-Bleed Visual Image Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[50%] relative flex-col justify-between p-10 xl:p-14 text-white overflow-hidden bg-neutral-900">
        {/* Natural photo with light blur, no heavy green overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-[2.5px] scale-105"
          style={{
            backgroundImage: "url('/images/signup.avif')",
          }}
        />
        {/* Soft neutral dark scrim for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/15" />

        {/* Top Header inside Left Card (Back link) */}
        <div className="relative z-10 flex items-center justify-end w-full">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/25 hover:bg-black/40 text-white text-xs font-medium backdrop-blur-md border border-white/20 transition-all cursor-pointer group"
          >
            <span>Back to website</span>
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Bottom Headline & Highlights inside Left Card */}
        <div className="relative z-10 max-w-lg space-y-4">
          <div className="h-1 w-12 rounded-full bg-[#d9ed69]" />
          <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-bold tracking-tight text-white leading-[1.2] font-heading">
            Capturing Every Flock's Potential.
          </h2>
          <p className="text-sm xl:text-base text-neutral-200 leading-relaxed font-normal">
            Join modern poultry managers replacing messy paper records with automated mortality logs, FCR calculations, and vaccination reminders.
          </p>

          <div className="pt-2 flex items-center gap-3 text-xs text-neutral-300">
            <span className="inline-flex items-center gap-1">
              <span className="text-[#d9ed69] font-bold">✓</span> 100% Free to Start
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[#d9ed69] font-bold">✓</span> Setup in 60 Seconds
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[#d9ed69] font-bold">✓</span> Works on Any Phone
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="flex-1 lg:w-1/2 xl:w-[50%] flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16 xl:px-20 bg-white">
        {/* Mobile top navigation bar */}
        <div className="flex items-center justify-between w-full lg:hidden mb-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
        </div>

        {/* Center Form Container */}
        <div className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
          <div className="space-y-6">
            {/* Logo placed directly above Create an account */}
            <div>
              {/* <Link to="/" className="inline-block mb-5 focus:outline-hidden">
                <img
                  src="/images/track-farm-logo-horizontal.png"
                  alt="Track Farm"
                  width={470}
                  height={96}
                  className="h-9 sm:h-10 w-auto"
                /> */}
              {/* </Link> */}
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950 font-heading">
                Create an account
              </h1>
              <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-[#174b35] hover:underline">
                  Log in
                </Link>
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {authError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{authError}</span>
                </div>
              )}

              {/* First Name & Last Name (Side by Side) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 block" htmlFor="signup-firstname">
                    First name
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
                      <User size={16} />
                    </div>
                    <input
                      id="signup-firstname"
                      className="w-full pl-9 pr-3 py-3 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-hidden focus:border-[#174b35] focus:ring-1 focus:ring-[#174b35] transition-all placeholder:text-neutral-400"
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={authLoading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 block" htmlFor="signup-lastname">
                    Last name
                  </label>
                  <input
                    id="signup-lastname"
                    className="w-full px-3.5 py-3 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-hidden focus:border-[#174b35] focus:ring-1 focus:ring-[#174b35] transition-all placeholder:text-neutral-400"
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={authLoading}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block" htmlFor="signup-email">
                  Email
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
                    <Mail size={17} />
                  </div>
                  <input
                    id="signup-email"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-hidden focus:border-[#174b35] focus:ring-1 focus:ring-[#174b35] transition-all placeholder:text-neutral-400"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={authLoading}
                  />
                </div>
                {suggestion && (
                  <p className="text-xs text-amber-700 mt-1">
                    Did you mean{' '}
                    <button
                      type="button"
                      className="font-semibold underline underline-offset-2 cursor-pointer"
                      onClick={() => {
                        setEmail(suggestion);
                        setDismissedSuggestion(suggestion);
                      }}
                    >
                      {suggestion}
                    </button>
                    ?
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block" htmlFor="signup-password">
                  Password
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
                    <Lock size={17} />
                  </div>
                  <input
                    id="signup-password"
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
                <p className={`text-[11px] ${pwError ? 'text-amber-700' : 'text-neutral-400'}`}>
                  {pwError || 'At least 8 characters, with a letter and a number'}
                </p>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 block" htmlFor="signup-confirm-password">
                  Confirm password
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center justify-center">
                    <Lock size={17} />
                  </div>
                  <input
                    id="signup-confirm-password"
                    className={`w-full pl-10 pr-11 py-3 bg-white border rounded-xl text-neutral-900 text-sm focus:outline-hidden focus:ring-1 transition-all placeholder:text-neutral-400 ${
                      confirmError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'border-neutral-200 focus:border-[#174b35] focus:ring-[#174b35]'
                    }`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password again"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={authLoading}
                    autoComplete="new-password"
                    aria-invalid={confirmError ? true : undefined}
                    aria-describedby={confirmError ? "signup-confirm-password-hint" : undefined}
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
                {confirmError && (
                  <p id="signup-confirm-password-hint" className="text-[11px] text-red-600" role="alert">
                    {confirmError}
                  </p>
                )}
              </div>

              {/* Terms & Conditions Checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  id="agree-terms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-[#174b35] focus:ring-[#174b35] accent-[#174b35] cursor-pointer"
                />
                <label htmlFor="agree-terms" className="text-xs text-neutral-600 leading-tight cursor-pointer select-none">
                  I agree to the{' '}
                  <span className="text-[#174b35] font-semibold hover:underline">
                    Terms & Conditions
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-5 bg-[#174b35] hover:bg-[#0f3825] active:bg-[#092518] text-white font-semibold rounded-xl shadow-sm text-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                disabled={authLoading}
              >
                {authLoading ? (
                  <>
                    <div className="spinner !w-4 !h-4 !border-white/40 !border-t-white" />
                    <span>Creating your account…</span>
                  </>
                ) : (
                  <span>Create account</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-700 hover:underline"
          >
            Need help? Message us on WhatsApp
          </a>
          <div>© {new Date().getFullYear()} TrackFarm</div>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
