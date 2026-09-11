import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/authApi'
import ConnectionGraphic from '../components/ConnectionGraphic'
import { useAuthStore } from '../store/authStore'

/* ── variants ────────────────────────────────────────────────────────── */
const titleContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.13, delayChildren: 0.4 } },
}
const titleWord = {
  hidden:  { opacity: 0, x: -20, filter: 'blur(6px)' },
  visible: { opacity: 1, x:   0, filter: 'blur(0px)',
             transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
}
const taglineVar = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y:  0, transition: { duration: 0.5, delay: 1.15 } },
}
const bgVar  = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.7 } } }
const barVar = {
  hidden:  { opacity: 0, scaleX: 0 },
  visible: { opacity: 1, scaleX: 1, transition: { duration: 0.4, delay: 0.28 } },
}
const cardVar = {
  hidden:  { opacity: 0, y: 30, x: 0,   scale: 0.97 },
  visible: { opacity: 1, y: -50, x: -80, scale: 1,
             transition: { duration: 0.55, delay: 0.42, ease: [0.16, 1, 0.3, 1] as const } },
}
const formVar = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.72 } },
}
const fv = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}
const wordmarkVar = {
  hidden:  { opacity: 0, y: -8 },
  visible: { opacity: 1, y:  0, transition: { duration: 0.3, delay: 0.15 } },
}

/* ── Google icon ─────────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

/* ── Eye icons ───────────────────────────────────────────────────────── */
function EyeOpen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function EyeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const reduced  = useReducedMotion() ?? false

  const [displayName,  setDisplayName]  = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [shake,        setShake]        = useState(false)
  const [showPass,     setShowPass]     = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)

  const [nameErr,      setNameErr]      = useState(false)
  const [emailErr,     setEmailErr]     = useState(false)
  const [passErr,      setPassErr]      = useState(false)
  const [confirmErr,   setConfirmErr]   = useState(false)

  const triggerShake = () => {
    if (reduced) return
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const nErr = !displayName.trim()
    const eErr = !email.trim()
    const pErr = password.length < 8
    const cErr = password !== confirm || !confirm

    if (nErr || eErr || pErr || cErr) {
      setNameErr(nErr)
      setEmailErr(eErr)
      setPassErr(pErr)
      setConfirmErr(cErr)
      if (pErr) setError('Password must be at least 8 characters.')
      else if (cErr) setError('Passwords do not match.')
      triggerShake()
      return
    }

    setNameErr(false); setEmailErr(false); setPassErr(false); setConfirmErr(false)
    setLoading(true)
    try {
      const { data } = await authApi.register(email, password, displayName)
      setAuth(data)
      navigate('/setup')
    } catch (err: any) {
      setError(err.response?.status === 409
        ? 'That email is already registered.'
        : 'Something went wrong. Try again.')
      setEmailErr(true)
      triggerShake()
    } finally { setLoading(false) }
  }

  const init = reduced ? 'visible' : 'hidden'

  return (
    <div className="relative overflow-hidden" style={{ height: '100vh', background: '#020d1f' }}>

      {/* ── blurred network bg ─── */}
      <motion.div className="absolute inset-0"
        variants={bgVar} initial={init} animate="visible"
        style={{ filter: 'blur(2px)', transform: 'scale(1.03)' }}>
        <ConnectionGraphic reduced={reduced} />
      </motion.div>

      {/* ── dark overlay ─── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg,rgba(2,13,31,0.65) 0%,rgba(2,13,31,0.45) 50%,rgba(2,13,31,0.70) 100%)' }}/>

      {/* ── page shell ─── */}
      <div className="relative z-10 flex flex-col" style={{ height: '100vh' }}>

        {/* top bar */}
        <motion.div className="flex items-center px-10 py-4 flex-shrink-0"
          variants={wordmarkVar} initial={init} animate="visible">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#2dd4bf,#0ea5e9)' }}>
              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-white">
                <circle cx="10" cy="7" r="3.2"/>
                <path d="M3 17c0-3.87 3.13-7 7-7s7 3.13 7 7"/>
              </svg>
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">Combined Studies</span>
          </div>
        </motion.div>

        {/* ── main two-column area ── */}
        <div className="flex-1 flex items-center">

          {/* LEFT 55% — title */}
          <div className="w-[55%] flex items-center justify-center px-10 lg:px-16">
            <div className="max-w-[500px] w-full" style={{ transform: 'translateY(-56px)' }}>

              {/* accent bar */}
              <motion.div className="w-10 h-[3px] rounded-full mb-7 origin-left"
                style={{ background: 'linear-gradient(90deg,#2dd4bf,#0ea5e9)' }}
                variants={barVar} initial={init} animate="visible"/>

              {/* title */}
              <motion.div className="mb-6"
                variants={titleContainer} initial={init} animate="visible">
                <div className="flex items-baseline gap-x-3 mb-1 flex-wrap">
                  {['Join', 'the'].map((w, i) => (
                    <motion.span key={i} variants={titleWord}
                      className="text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
                      {w}
                    </motion.span>
                  ))}
                </div>
                <div className="flex items-baseline gap-x-2 flex-wrap">
                  {['Community'].map((w, i) => (
                    <motion.span key={i} variants={titleWord}
                      className="text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight"
                      style={{ color: '#2dd4bf' }}>
                      {w}
                    </motion.span>
                  ))}
                </div>
              </motion.div>

              {/* tagline */}
              <motion.div variants={taglineVar} initial={init} animate="visible">
                <p className="text-white/65 text-base font-medium leading-relaxed mb-1">
                  Share what you know. Learn what you don't.
                </p>
                <p className="text-white/30 text-sm">
                  Connect with peers from around the world.
                </p>
              </motion.div>

              {/* feature hints */}
              <motion.div className="mt-8 flex flex-col gap-3"
                variants={taglineVar} initial={init} animate="visible">
                {[
                  { icon: '🎯', text: 'Get matched with the right study partners' },
                  { icon: '💬', text: 'Learn through real conversations' },
                  { icon: '⭐', text: 'Build your reputation as a peer teacher' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-base">{f.icon}</span>
                    <span className="text-white/40 text-sm">{f.text}</span>
                  </div>
                ))}
              </motion.div>

            </div>
          </div>

          {/* RIGHT 45% — glass card */}
          <div className="w-[45%] flex items-center justify-center px-8 lg:px-14">
            <motion.div className="w-full max-w-[410px]"
              variants={cardVar} initial={init} animate="visible">

              <div className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(9,22,50,0.80)',
                  backdropFilter: 'blur(28px)',
                  WebkitBackdropFilter: 'blur(28px)',
                  border: '1px solid rgba(45,212,191,0.18)',
                  boxShadow: '0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
                }}>

                {/* gradient top bar */}
                <div className="h-[3px]"
                  style={{ background: 'linear-gradient(90deg,#2dd4bf,#0ea5e9,#6366f1)' }}/>

                <div className="p-6">
                  <motion.div variants={formVar} initial={init} animate="visible">

                    {/* heading */}
                    <motion.div variants={fv} className="mb-4">
                      <h2 className="text-xl font-bold text-white mb-0.5">Create your account</h2>
                      <p className="text-white/40 text-xs">Free forever. No credit card required.</p>
                    </motion.div>

                    <form onSubmit={handleSubmit} noValidate>

                      {/* display name */}
                      <motion.div variants={fv} className="mb-3">
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
                          Display Name
                        </label>
                        <input
                          type="text" value={displayName}
                          onChange={(e) => { setDisplayName(e.target.value); setNameErr(false) }}
                          onFocus={() => setNameErr(false)}
                          placeholder="Your name"
                          autoComplete="name"
                          maxLength={100}
                          className={`w-full px-4 py-2 rounded-xl text-sm font-medium outline-none transition-all duration-200 glass-input${nameErr ? ' glass-input-error' : ''}${shake ? ' input-shake' : ''}`}
                        />
                      </motion.div>

                      {/* email */}
                      <motion.div variants={fv} className="mb-3">
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
                          Email
                        </label>
                        <input
                          type="email" value={email}
                          onChange={(e) => { setEmail(e.target.value); setEmailErr(false) }}
                          onFocus={() => setEmailErr(false)}
                          placeholder="you@example.com"
                          autoComplete="email"
                          className={`w-full px-4 py-2 rounded-xl text-sm font-medium outline-none transition-all duration-200 glass-input${emailErr ? ' glass-input-error' : ''}${shake ? ' input-shake' : ''}`}
                        />
                      </motion.div>

                      {/* password */}
                      <motion.div variants={fv} className="mb-3">
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
                          Password
                          <span className="text-white/25 font-normal ml-1 normal-case tracking-normal">min 8 chars</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPass ? 'text' : 'password'} value={password}
                            onChange={(e) => { setPassword(e.target.value); setPassErr(false); setConfirmErr(false) }}
                            onFocus={() => setPassErr(false)}
                            placeholder="••••••••"
                            autoComplete="new-password"
                            className={`w-full px-4 py-2 pr-11 rounded-xl text-sm font-medium outline-none transition-all duration-200 glass-input${passErr ? ' glass-input-error' : ''}${shake ? ' input-shake' : ''}`}
                          />
                          <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors duration-150">
                            {showPass ? <EyeOff/> : <EyeOpen/>}
                          </button>
                        </div>
                      </motion.div>

                      {/* confirm password */}
                      <motion.div variants={fv} className="mb-4">
                        <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirm ? 'text' : 'password'} value={confirm}
                            onChange={(e) => { setConfirm(e.target.value); setConfirmErr(false) }}
                            onFocus={() => setConfirmErr(false)}
                            placeholder="••••••••"
                            autoComplete="new-password"
                            className={`w-full px-4 py-2 pr-11 rounded-xl text-sm font-medium outline-none transition-all duration-200 glass-input${confirmErr ? ' glass-input-error' : ''}${shake ? ' input-shake' : ''}`}
                          />
                          <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors duration-150">
                            {showConfirm ? <EyeOff/> : <EyeOpen/>}
                          </button>
                        </div>
                      </motion.div>

                      {/* error */}
                      {error && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-300 rounded-xl px-4 py-2.5 mb-4"
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                          {error}
                        </motion.p>
                      )}

                      {/* create account */}
                      <motion.div variants={fv}>
                        <button type="submit" disabled={loading}
                          className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            background: loading ? 'rgba(20,184,166,0.55)' : 'linear-gradient(135deg,#0d9488,#0ea5e9)',
                            boxShadow:  loading ? 'none' : '0 8px 24px rgba(13,148,136,0.35)',
                          }}>
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                              Creating account…
                            </span>
                          ) : 'Create account'}
                        </button>
                      </motion.div>

                      {/* OR divider */}
                      <motion.div variants={fv} className="flex items-center gap-3 mt-4 mb-3">
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.09)' }}/>
                        <span className="text-xs text-white/30">or</span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.09)' }}/>
                      </motion.div>

                      {/* Google button */}
                      <motion.div variants={fv} className="mb-4">
                        <button type="button"
                          className="w-full flex items-center justify-center gap-3 py-2 px-4 rounded-xl text-sm font-semibold text-white/85 transition-all duration-150 active:scale-[0.99]"
                          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.13)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)' }}>
                          <GoogleIcon/>
                          Continue with Google
                        </button>
                      </motion.div>

                      {/* sign in link */}
                      <motion.p variants={fv} className="text-center text-sm text-white/35">
                        Already have an account?{' '}
                        <Link to="/login"
                          className="font-semibold transition-colors duration-150"
                          style={{ color: '#2dd4bf' }}>
                          Sign in
                        </Link>
                      </motion.p>

                    </form>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>

      {/* ── styles ─────────────────────────────────────────────────────── */}
      <style>{`
        .glass-input {
          background: rgba(255,255,255,0.07) !important;
          color: white !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
        }
        .glass-input::placeholder { color: rgba(255,255,255,0.28) !important; }
        .glass-input:focus {
          background: rgba(255,255,255,0.11) !important;
          border-color: rgba(45,212,191,0.55) !important;
          box-shadow: 0 0 0 3px rgba(45,212,191,0.12) !important;
        }
        .glass-input-error {
          border-color: rgba(239,68,68,0.75) !important;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.15) !important;
        }
        .glass-input-error:focus {
          border-color: rgba(239,68,68,0.85) !important;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.22) !important;
        }
        .glass-input:-webkit-autofill,
        .glass-input:-webkit-autofill:hover,
        .glass-input:-webkit-autofill:focus {
          -webkit-text-fill-color: white !important;
          -webkit-box-shadow: 0 0 0 1000px rgba(9,22,50,0.95) inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .input-shake { animation: shake 0.35s ease-in-out; }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-4px); }
          40%      { transform: translateX(4px); }
          60%      { transform: translateX(-3px); }
          80%      { transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}
