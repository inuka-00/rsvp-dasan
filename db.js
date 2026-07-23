const { createClient } = require('@supabase/supabase-js');

// Supabase environment variables with explicit placeholders
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_OR_SERVICE_ROLE_KEY';

if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn('⚠️ Warning: SUPABASE_URL environment variable is not set. Using default placeholder.');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Warning: SUPABASE_KEY environment variable is not set. Using default placeholder.');
}

// Initialize specialized Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  }
});

/**
 * Insert a new RSVP record into Supabase "rsvps" table
 */
async function insertRsvp(guestName, status, comment = '') {
  const { data, error } = await supabase
    .from('rsvps')
    .insert([
      { guest_name: guestName, status: status, comment: comment }
    ])
    .select();

  if (error) {
    console.error('Supabase insertRsvp error:', error);
    throw new Error(`Supabase Insert Failed: ${error.message}`);
  }
  return data;
}

/**
 * Fetch all RSVPs sorted by creation date from Supabase
 */
async function getRsvps() {
  const { data, error } = await supabase
    .from('rsvps')
    .select('id, guest_name, status, comment, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase getRsvps error:', error);
    throw new Error(`Supabase Fetch Failed: ${error.message}`);
  }
  return data || [];
}

/**
 * Calculate RSVP statistics directly from Supabase "rsvps" table
 */
async function getRsvpStats() {
  const { data, error } = await supabase
    .from('rsvps')
    .select('status');

  if (error) {
    console.error('Supabase getRsvpStats error:', error);
    throw new Error(`Supabase Stats Query Failed: ${error.message}`);
  }

  const rsvps = data || [];
  const total = rsvps.length;
  const attending = rsvps.filter(r => r.status === 'Accepted').length;
  const declining = rsvps.filter(r => r.status === 'Declined').length;

  return { total, attending, declining };
}

module.exports = {
  supabase,
  insertRsvp,
  getRsvps,
  getRsvpStats
};

