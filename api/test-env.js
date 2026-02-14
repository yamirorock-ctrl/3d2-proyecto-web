export default function handler(req, res) {
  const envVars = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    VITE_SUPABASE_ANON_TOKEN: !!process.env.VITE_SUPABASE_ANON_TOKEN,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    VITE_GEMINI_API_KEY: !!process.env.VITE_GEMINI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  res.status(200).json(envVars);
}
