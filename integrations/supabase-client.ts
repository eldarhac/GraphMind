import { createClient } from '@supabase/supabase-js';
import { Person } from '@/Entities/all';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL or Anon Key is not set. Supabase integration will be disabled.");
}

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

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

async function executeSql(sql: string): Promise<any[] | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });

    if (error) {
      console.error('Error executing SQL query via RPC:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      return [{ error: `Database error: ${error.message || error.code || 'Unknown error'}` }];
    }
    
    return data;
  } catch (error) {
    console.error('An unexpected error occurred during RPC call:', error);
    return [{ error: 'An unexpected error occurred.' }];
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
}; 