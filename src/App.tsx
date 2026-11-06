import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './lib/supabase'

type Profile = { full_name: string; role: 'student' | 'teacher' | 'admin' }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setMessage(error.message)
        else setProfile(data as Profile)
      })
  }, [session])

  async function signIn(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setMessage(error ? error.message : 'Check your email for a sign-in link.')
  }

  if (!isSupabaseConfigured) {
    return (
      <main>
        <h1>BigChange Academy Hub</h1>
        <p>
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add
          your project URL and publishable key.
        </p>
      </main>
    )
  }

  return (
    <main>
      <h1>BigChange Academy Hub</h1>
      {session ? (
        <>
          <p>
            Signed in as <strong>{profile?.full_name || session.user.email}</strong>
            {profile && <> ({profile.role})</>}
          </p>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </>
      ) : (
        <form onSubmit={signIn}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">Send sign-in link</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </main>
  )
}
