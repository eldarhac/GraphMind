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

    // The 'experience' and 'education' fields are no longer in this table as JSON.
    const parsedData = data.map((person: any) => ({
      ...person,
      experience: [], // Default to empty array, can be fetched on-demand
      education: [], // Default to empty array, can be fetched on-demand
    }));

    return parsedData as Person[];
  } catch (error) {
    console.error('An unexpected error occurred while fetching from Supabase:', error);
    return null;
  }
}

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
    const { data: personData, error: personError } = await supabase
      .from('participants2')
      .select('*')
      .eq('id', personId)
      .single();

    if (personError) {
      console.error('Error fetching participant by ID from Supabase:', personError);
      return null;
    }
    
    if (!personData) return null;

    const { data: experienceData, error: experienceError } = await supabase
      .from('participant_experience')
      .select('*')
      .eq('participant_id', personId);
      
    if (experienceError) {
      console.error('Error fetching participant experience:', experienceError);
      return null;
    }

    const { data: educationData, error: educationError } = await supabase
      .from('participant_education')
      .select('*')
      .eq('participant_id', personId);

    if (educationError) {
      console.error('Error fetching participant education:', educationError);
      return null;
    }

    const person: Person = {
      ...personData,
      experience: experienceData || [],
      education: educationData || [],
      // Ensure all required fields from the Person interface are present
      title: personData.title || personData.current_company_name || '',
      profile_picture_url: personData.profile_picture_url || '',
      linkedin_url: personData.linkedin_url || '',
      expertise_areas: personData.expertise_areas || [],
    };

    return person;

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
