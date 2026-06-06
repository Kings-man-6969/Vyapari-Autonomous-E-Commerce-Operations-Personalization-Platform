import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { Database } from "./types.js";

dotenv.config({ path: "../.env" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

if (!SUPABASE_URL) {
  console.error("[Supabase] SUPABASE_URL is missing in environment variables.");
}

// Service role client (bypasses RLS). Used for trusted admin/system operations only.
export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// Public client. Used for general operations.
export const supabasePublic = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);
