import neo4j from 'neo4j-driver';
import { Person, Connection } from '@/Entities/all';

const driver = neo4j.driver(
  import.meta.env.VITE_NEO4J_URI!,
  neo4j.auth.basic(
    import.meta.env.VITE_NEO4J_USERNAME!,
    import.meta.env.VITE_NEO4J_PASSWORD!
  )
);

async function fetchAllData(): Promise<{ nodes: Person[], connections: Connection[] }> {
  const session = driver.session();
  console.log('Neo4j session created.');
  try {
    // This query now fetches only Participant nodes and their SHARED_EXPERIENCE relationships.
    const result = await session.run(`
      MATCH (p:Participant)-[r:SHARED_EXPERIENCE]-(c:Participant)
      RETURN p, r, c
    `);

    console.log(`Query returned ${result.records.length} records.`);
    if (result.records.length === 0) {
      console.warn('Warning: Neo4j query returned 0 records. Check if your database contains data with the :Person label.');
    }

    const nodesMap = new Map<string, Person>();
    const connectionsMap = new Map<string, Connection>();

    result.records.forEach((record: any) => {
      const personNode = record.get('p');
      if (personNode) {
        const nodeId = personNode.elementId;
        if (!nodesMap.has(nodeId)) {
          nodesMap.set(nodeId, {
            id: nodeId,
            ...personNode.properties
          } as Person);
        }
      }

      const relationship = record.get('r');
      const otherPersonNode = record.get('c');
      if (relationship && otherPersonNode) {
        const connId = relationship.elementId;
        if (!connectionsMap.has(connId)) {
          connectionsMap.set(connId, {
            id: connId,
            person_a_id: relationship.startNodeElementId,
            person_b_id: relationship.endNodeElementId,
            connection_type: relationship.type.toLowerCase(),
          } as Connection);
        }
        
        // Ensure the other person is also in the nodes map
        const otherNodeId = otherPersonNode.elementId;
        if (!nodesMap.has(otherNodeId)) {
           nodesMap.set(otherNodeId, {
            id: otherNodeId,
            ...otherPersonNode.properties
          } as Person);
        }
      }
    });

    const nodes = Array.from(nodesMap.values());
    const connections = Array.from(connectionsMap.values());
    
    console.log(`Processed ${nodes.length} unique nodes and ${connections.length} unique connections.`);

    return { nodes, connections };
  } catch (error) {
    console.error('Error fetching data from Neo4j:', error);
    throw error; // Re-throw the error to be caught by the calling function
  } finally {
    await session.close();
    console.log('Neo4j session closed.');
  }
}

export const neo4jClient = {
  fetchAllData,
}; 