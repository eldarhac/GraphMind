import { neo4jClient } from '@/integrations/neo4j-client';
import { supabaseClient } from '@/integrations/supabase-client';
import { transformSupabaseData } from '@/services/dataTransformer';
import { Person, Connection } from '@/Entities/all';

export async function getHybridGraphData(): Promise<{ nodes: Person[]; connections: Connection[] }> {
  const [participants, avatars, neo4jConnections] = await Promise.all([
    supabaseClient.getAllParticipants(),
    supabaseClient.getAvatars(),
    neo4jClient.getConnectionsFromNeo4j(),
  ]);

  const LINKEDIN_PLACEHOLDER = 'https://static.licdn.com/aero-v1/sc/h/9c8pery4and6j6ohjkp54ma2';

  const cleanedAvatars = (avatars || []).map((a: any) => {
    const url = a.avatar_url || a.avatar;
    if (url === LINKEDIN_PLACEHOLDER) {
      return { ...a, avatar: null, avatar_url: null };
    }
    return a;
  });

  const { nodes } = transformSupabaseData(participants || [], [], cleanedAvatars);

  const connections: Connection[] = neo4jConnections.map((c) => ({
    id: `${c.source}-${c.target}-${c.type}`,
    person_a_id: c.source,
    person_b_id: c.target,
    connection_type: c.type,
    strength: 1,
    notes: c.details || '',
  }));

  return { nodes, connections };
}
