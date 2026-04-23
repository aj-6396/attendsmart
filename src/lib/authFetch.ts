/**
 * Authenticated API helper
 * 
 * Wraps fetch() to automatically include the Supabase JWT token
 * in the Authorization header for all API calls.
 */
import { supabase } from '../supabase';

/**
 * Makes an authenticated API request by including the current session JWT.
 * Falls back to regular fetch if no session is available.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
