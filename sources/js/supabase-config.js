// -----------------------------------------------------------------
// supabase-config.js — the ONLY place you configure the database.
//
// 1. Create a free project at https://supabase.com
// 2. Run supabase/schema.sql in the SQL Editor (see supabase/README.md)
// 3. Dashboard -> Project Settings -> API: copy the Project URL and the
//    "anon / publishable" key into the two values below.
//
// These two values are PUBLIC by design (they ship to every visitor's
// browser). Row Level Security in schema.sql is what protects the data.
// NEVER put the "service_role" / secret key in this file or anywhere in
// this repository.
// -----------------------------------------------------------------
window.SV_SUPABASE = {
  url: 'https://dvwajckwtjtrgskxlchx.supabase.co',          // e.g. https://abcdxyzcompany.supabase.co
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2d2FqY2t3dGp0cmdza3hsY2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NjA0MDIsImV4cCI6MjEwNzEzNjQwMn0.QdAF-3pavv0XIcnrN_Y0gqLyFmUfTNv8V6qIY8CT0ag', // e.g. eyJhbGciOi... or sb_publishable_...

  // Optional. The PDF/image processing tools need the Python services in PDFTools/.
  // Leave empty to show a "coming soon" notice on those tools. Once you deploy the
  // services somewhere (with CORS allowing your site), put their base URL here,
  // e.g. 'https://tools.yourdomain.com'.
  toolsApiBase: ''
};
