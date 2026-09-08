import { createClient } from "@supabase/supabase-js";


const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY;


if (
  !supabaseUrl
  || !supabaseAnonKey
) {
  throw new Error(
    "VITE_SUPABASE_URL ou "
    + "VITE_SUPABASE_ANON_KEY manquant"
  );
}


export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
);
