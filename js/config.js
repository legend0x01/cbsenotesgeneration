/* =========================================================================
 * SITE CONFIG
 * Paste your Supabase project URL and anon (public) key here to turn on
 * "Sign in with Google" and cloud-saved notes. See SUPABASE_SETUP.md.
 *
 * The anon key is meant to be public: Row Level Security in
 * supabase/schema.sql makes sure each student can only read and write
 * their own notes. NEVER put the service_role key here.
 *
 * Leave both empty and the site still works, saving notes in the browser only.
 * ========================================================================= */
window.NCERT_CONFIG = {
  supabaseUrl: 'https://xvjaigzelvitfwxkpezy.supabase.co',
  supabaseAnonKey: 'sb_publishable_jYtiSpqylPmNtQKZmM7adQ_NeYAoeP3',  // publishable (public) key

  // Free built-in AI (NVIDIA Nemotron, via the /api/generate server function) for
  // signed-in students without a working Gemini key. The NVIDIA keys are NOT here:
  // they are secret environment variables on Vercel (NVIDIA_API_KEYS).
  freeAI: true,

  // Public contact email shown on the Privacy Policy and Terms pages.
  contactEmail: 'traderabhinav699@gmail.com'
};
