/**
 * Shared authentication helper for API routes.
 * Extracts and verifies the user from the Authorization header JWT,
 * so APIs don't trust client-supplied user IDs.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Verifies the JWT from the Authorization header and returns the authenticated user.
 * Returns null if the token is invalid or missing.
 */
export async function getAuthenticatedUser(req: any): Promise<{ id: string; email: string } | null> {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return null;

    return { id: user.id, email: user.email || '' };
  } catch {
    return null;
  }
}
