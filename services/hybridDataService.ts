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

  const { nodes } = transformSupabaseData(participants || [], [], avatars || []);

  const connections: Connection[] = neo4jConnections.map((c) => ({
    id: `${c.source}-${c.target}-${c.type}`,
    person_a_id: c.source,
    person_b_id: c.target,
    connection_type: c.type,
    strength: 1,
    notes: '',
  }));

  return { nodes, connections };
}
