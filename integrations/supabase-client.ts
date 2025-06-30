import { createClient } from '@supabase/supabase-js';
import { Person } from '@/Entities/all';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL or Anon Key is not set. Supabase integration will be disabled.");
}

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

export type RawGraphData = {
  participants: any[];
  connections: any[];
  avatars: any[];
};

async function getConnections(): Promise<any[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const { data, error } = await supabase.from('connections').select('*');
    if (error) {
      console.error('Error fetching connections from Supabase:', error);
      return null;
    }
    return data || [];
  } catch (err) {
    console.error('Unexpected error loading connections from Supabase:', err);
    return null;
  }
}

async function getAvatars(): Promise<any[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const { data, error } = await supabase.from('avatars').select('*');
    if (error) {
      console.error('Error fetching avatars from Supabase:', error);
      return null;
    }
    return data || [];
  } catch (err) {
    console.error('Unexpected error loading avatars from Supabase:', err);
    return null;
  }
}

async function getGraphData(): Promise<RawGraphData | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const [participantsRes, connectionsRes, avatarsRes] = await Promise.all([
      supabase.from('participants2').select('*').select('*').limit(2000),
      supabase.from('connections').select('*'),
      supabase.from('avatars').select('*'),
    ]);

    if (participantsRes.error) {
      console.error('Error fetching participants:', participantsRes.error);
      return null;
    }
    if (connectionsRes.error) {
      console.error('Error fetching connections:', connectionsRes.error);
      return null;
    }
    if (avatarsRes.error) {
      console.error('Error fetching avatars:', avatarsRes.error);
      return null;
    }

    return {
      participants: participantsRes.data || [],
      connections: connectionsRes.data || [],
      avatars: avatarsRes.data || [],
    };
  } catch (err) {
    console.error('Unexpected error loading graph data from Supabase:', err);
    return null;
  }
}

async function getParticipantDetails(personName: string): Promise<Person[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const { data, error } = await supabase
      .from('participants2')
      .select('*')
      .ilike('name', `%${personName}%`)
      .limit(5); // Fetch up to 5 potential matches

    if (error) {
      console.error('Error fetching participant from Supabase:', error);
      return null;
    }
    
    if (!data) return [];

    // Safely parse JSON string fields for each returned person
    const parsedData = data.map((person: any) => ({
      ...person,
      experience: safeJsonParse(person.experience),
      education: safeJsonParse(person.education),
      publications: safeJsonParse(person.publications),
    }));

    return parsedData as Person[];
  } catch (error) {
    console.error('An unexpected error occurred while fetching from Supabase:', error);
    return null;
  }
}

function safeJsonParse(value: any): any[] {
  if (!value) {
    return [];
  }
  // If it's already an array, return it.
  if (Array.isArray(value)) {
    return value;
  }
  // If it's a string, try to parse it.
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      // Ensure the parsed result is an array.
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse JSON string:', value, e);
      return [];
    }
  }
  // If it's some other type (like a single object that's not an array), return empty array.
  // This is because we expect a list of experiences/educations.
  return [];
}

// This function is no longer needed, as the logic will be moved into the database.
/*
async function executeSqlQuery(sql: string): Promise<any[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const { data, error } = await supabase.rpc('execute_readonly_sql', { query: sql });

    if (error) {
      console.error('Error executing SQL query via RPC:', error);
      // Attempt to return a more helpful error message to the front-end
      return [{ error: `Database error: ${error.message}` }];
    }
    
    return data;
  } catch (error) {
    console.error('An unexpected error occurred during RPC call:', error);
    return [{ error: 'An unexpected error occurred.' }];
  }
}
*/

// The text_to_sql RPC call is no longer needed with this approach.
/*
async function textToSql(question: string): Promise<any> {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    try {
        const { data, error } = await supabase.rpc('text_to_sql', { question });
        if (error) {
            console.error('Error with text_to_sql RPC:', error);
            return { error: `Database error: ${error.message}` };
        }
        return data;
    } catch (error) {
        console.error('An unexpected error occurred during text_to_sql RPC call:', error);
        return { error: 'An unexpected error occurred.' };
    }
}
*/

export async function executeSql(query: string) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: query });
    
    if (error) {
      console.error("Error executing SQL query via RPC:", error);
      console.error("Full error details:", JSON.stringify(error, null, 2));
      return { error: error.message, data: null };
    }
    
    return { error: null, data };

  } catch (rpcError) {
    console.error("Caught an exception during RPC call:", rpcError);
    return { 
      error: rpcError instanceof Error ? rpcError.message : "An unknown RPC error occurred.", 
      data: null 
    };
  }
}

async function getAllParticipants(): Promise<any[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const { data, error } = await supabase
      .from('participants2')
      .select('*')
      .limit(2000);

    if (error) {
      console.error('Error fetching all participants from Supabase:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('An unexpected error occurred while fetching all participants:', error);
    return null;
  }
}

async function getSimilarParticipants(personId: string, count: number = 5): Promise<any[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase client is not configured.");
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('find_similar_participants', {
      target_id: personId,
      match_count: count
    });

    if (error) {
      console.error('Error calling find_similar_participants RPC:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('An unexpected error occurred during the RPC call:', error);
    return null;
  }
}

async function getParticipantById(personId: string): Promise<Person | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const { data, error } = await supabase
      .from('participants2')
      .select('*')
      .eq('id', personId)
      .single(); // Fetch a single record

    if (error) {
      console.error('Error fetching participant by ID from Supabase:', error);
      return null;
    }
    
    if (!data) return null;

    // Safely parse JSON string fields
    const parsedData = {
      ...data,
      experience: safeJsonParse(data.experience),
      education: safeJsonParse(data.education),
    };

    return parsedData as Person;
  } catch (error) {
    console.error('An unexpected error occurred while fetching participant by ID:', error);
    return null;
  }
}

async function getParticipantNames() {
  if (!supabaseUrl || !supabaseAnonKey) return [];
  try {
    const { data, error } = await supabase
      .from('participants2')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      console.error('Error fetching participant names:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching participant names:', err);
    return [];
  }
}

export const supabaseClient = {
    getParticipantDetails,
    getParticipantById,
    executeSql,
    getAllParticipants,
    getConnections,
    getAvatars,
    getGraphData,
    getSimilarParticipants,
    getParticipantNames,
};
