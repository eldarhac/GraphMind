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
      supabase.from('participants2').select('*'),
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
      current_com_experience: safeJsonParse(person.current_com_experience),
      education: safeJsonParse(person.education),
      publications: safeJsonParse(person.publications),
    }));

    return parsedData as Person[];
  } catch (error) {
    console.error('An unexpected error occurred while fetching from Supabase:', error);
    return null;
  }
}

function safeJsonParse(jsonString: string | null | undefined): any[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to parse JSON string:', jsonString, e);
    return [];
  }
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
      .select('*');

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

export const supabaseClient = {
    getParticipantDetails,
    executeSql,
    getAllParticipants,
    getConnections,
    getAvatars,
    getGraphData,
};
