import { createClient } from "@supabase/supabase-js";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { Database } from "../types.js";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

// Custom request interface structure
export interface RequestContext {
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

/**
 * Authentication middleware that verifies a user's JWT from the
 * Authorization header and creates a request-specific Supabase client.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing Bearer Token" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Invalid token format" });
    }

    const userSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: { user }, error } = await userSupabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: `Unauthorized: ${error?.message || "Invalid session"}` });
    }

    req.context = {
      supabase: userSupabase,
      userId: user.id,
    };

    next();
  } catch (err: any) {
    return res.status(401).json({ error: `Unauthorized: ${err.message}` });
  }
}

/**
 * Optional authentication middleware that binds a public Supabase client
 * if no token is found, or an authenticated client if a valid token is present.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        const userSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const { data: { user } } = await userSupabase.auth.getUser(token);
        if (user) {
          req.context = {
            supabase: userSupabase,
            userId: user.id,
          };
          return next();
        }
      }
    }
  } catch (e) {}

  // Fallback to anonymous client
  const publicSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  req.context = {
    supabase: publicSupabase,
    userId: "",
  };
  
  next();
}
