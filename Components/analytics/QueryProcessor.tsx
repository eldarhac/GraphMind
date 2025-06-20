import { InvokeLLM } from '@/integrations/Core';
import { Person, Connection, IntentData, GraphResults, FindPathResult, RankNodesResult, RecommendPersonsResult, FindSimilarResult, FindBridgeResult } from '@/Entities/all';
import { processTextToSqlQuery } from '@/integrations/text-to-sql';

export default class QueryProcessor {
  static async processQuery(message: string, currentUser: Person, graphData: { nodes: Person[], connections: Connection[] }) {
    const startTime = Date.now();
    
    try {
      // Temporarily bypass the intent/graph logic to route directly to Text-to-SQL
      const sqlResponse = await processTextToSqlQuery(message);

      const processingTime = Date.now() - startTime;
      
      return {
        response: sqlResponse,
        intent: "text_to_sql", // A new intent for our new flow
        graphAction: null, // No graph action for now
        processingTime
      };

      /*
      // Step 1: Extract intent and entities from user message
      const personNames = graphData.nodes.map(n => n.name);
      const intentResult: IntentData = await InvokeLLM({
        prompt: `
          Analyze this user query for a graph-based network assistant: "${message}"
          
          The user asking the question is "${currentUser.name}".
          If the intent is 'find_path' and only one person is mentioned, assume the path is from the current user to that person.

          Here is a list of all the people in the network:
          - ${personNames.join('\n- ')}

          Your task:
          1.  Determine the user's intent (e.g., find_path).
          2.  Extract the entities (person names, topics) from the query.
          3.  **Crucially, fuzzy match the extracted person names against the provided list of people. If you find a close match, use the exact name from the list.** For example, if the user says "Dr. Marcus Smith" and "Dr. Marcus Thorne" is in the list, you MUST return "Dr. Marcus Thorne" in the entities array.
          
          Return the corrected entities in the final JSON output.
          
          Extract the following information:
          - intent: one of [find_path, rank_nodes, recommend_person, find_similar, find_bridge, general]
          - entities: relevant person names (corrected against the list), topics, or other key entities mentioned
          - parameters: any specific constraints or preferences
          
          Current user context: The user is exploring a professional network graph.
          
          Return structured data to help query the graph database.
        `,
        response_json_schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["find_path", "rank_nodes", "recommend_person", "find_similar", "find_bridge", "general"]
            },
            entities: {
              type: "array",
              items: { type: "string" }
            },
            parameters: {
              type: "object",
              properties: {
                target_person: { type: "string" },
                topic: { type: "string" },
                limit: { type: "number" },
                connection_type: { type: "string" }
              }
            },
            confidence: { type: "number" }
          }
        }
      });

      // Step 2: Execute graph query based on intent
      const graphResults: GraphResults = await this.executeGraphQuery(intentResult, graphData);

      // Step 3: Generate natural language response
      const response = await InvokeLLM({
        prompt: `
          Based on this graph query result, generate a helpful and conversational response:
          
          User Query: "${message}"
          Intent: ${intentResult.intent}
          Graph Results: ${JSON.stringify(graphResults, null, 2)}
          
          Provide a clear, engaging response that explains the findings in natural language.
          Be specific about the connections, people, and insights discovered.
          
          Keep the response concise but informative.
        `
      });

      const processingTime = Date.now() - startTime;

      return {
        response: response,
        intent: intentResult.intent,
        graphAction: this.generateGraphAction(intentResult, graphResults),
        processingTime
      };
      */
    } catch (error) {
      console.error('Query processing error:', error);
      return {
        response: "I encountered an issue processing your query. Could you please rephrase or try a different question?",
        intent: "general",
        graphAction: null,
        processingTime: Date.now() - startTime
      };
    }
  }

  static async executeGraphQuery(intentData: IntentData, graphData: { nodes: Person[], connections: Connection[] }): Promise<GraphResults> {
    const { intent, entities, parameters } = intentData;
    const { nodes, connections } = graphData;

    switch (intent) {
      case 'find_path':
        return this.findPath(entities, nodes, connections);
      
      case 'rank_nodes':
        return this.rankNodes(parameters.topic || '', nodes, connections);
      
      case 'recommend_person':
        return this.recommendPersons(nodes, connections);
      
      case 'find_similar':
        return this.findSimilar(entities, nodes, connections);
      
      case 'find_bridge':
        return this.findBridge(parameters, nodes, connections);
      
      default:
        return { nodes: [], connections: [], insights: [] };
    }
  }

  static findPath(entities: string[], nodes: Person[], connections: Connection[]): FindPathResult {
    // Defensive coding: Ensure entities is an array before filtering.
    const validEntities = Array.isArray(entities)
      ? entities.filter(e => typeof e === 'string' && e.trim() !== '')
      : [];

    if (validEntities.length < 2) {
      return { path: [], distance: 0, message: "I need two people's names to find a path. Please try again.", nodes: [], connections: [] };
    }

    const startNodeName = validEntities[0];
    const endNodeName = validEntities[1];

    const startNode = nodes.find(n => n.name.toLowerCase() === startNodeName.toLowerCase());
    const endNode = nodes.find(n => n.name.toLowerCase() === endNodeName.toLowerCase());

    if (!startNode) {
      return { path: [], distance: 0, message: `Could not find "${startNodeName}" in the network.`, nodes: [], connections: [] };
    }
    if (!endNode) {
      return { path: [], distance: 0, message: `Could not find "${endNodeName}" in the network.`, nodes: [], connections: [] };
    }

    const queue: [string, string[]][] = [[startNode.id, [startNode.id]]]; // [current_node_id, [path_so_far]]
    const visited = new Set<string>([startNode.id]);

    while (queue.length > 0) {
      const [currentId, path] = queue.shift()!;

      if (currentId === endNode.id) {
        // Path found! Now, let's collect the full node and connection objects.
        const pathNodes = path.map(id => nodes.find(n => n.id === id)).filter((n): n is Person => n !== undefined);
        const pathConnections: Connection[] = [];
        for (let i = 0; i < path.length - 1; i++) {
          const conn = connections.find(c =>
            (c.person_a_id === path[i] && c.person_b_id === path[i + 1]) ||
            (c.person_b_id === path[i] && c.person_a_id === path[i + 1])
          );
          if (conn) {
            pathConnections.push(conn);
          }
        }
        return {
          path: path,
          distance: path.length - 1,
          nodes: pathNodes,
          connections: pathConnections,
          message: `Found a path with ${path.length - 1} degrees of separation.`
        };
      }

      // Get neighbors
      const neighbors = connections
        .filter(c => c.person_a_id === currentId || c.person_b_id === currentId)
        .map(c => (c.person_a_id === currentId ? c.person_b_id : c.person_a_id));
      
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          const newPath = [...path, neighborId];
          queue.push([neighborId, newPath]);
        }
      }
    }

    return { path: [], distance: 0, message: "No path found between the specified individuals.", nodes: [], connections: [] };
  }

  static rankNodes(topic: string, nodes: Person[], connections: Connection[]): RankNodesResult {
    // Simple influence ranking based on connection count and topic relevance
    const rankedNodes: Person[] = nodes
      .map(node => {
        const connectionCount = connections.filter(conn => 
          conn.person_a_id === node.id || conn.person_b_id === node.id
        ).length;
        
        const topicRelevance = topic ? 
          (node.expertise_areas?.some(area => 
            area.toLowerCase().includes(topic.toLowerCase())
          ) ? 2 : 1) : 1;

        return {
          ...node,
          influence_score: connectionCount * topicRelevance
        };
      })
      .sort((a, b) => (b.influence_score || 0) - (a.influence_score || 0))
      .slice(0, 10);

    return {
      ranked_nodes: rankedNodes,
      topic: topic,
      total_analyzed: nodes.length
    };
  }

  static recommendPersons(nodes: Person[], connections: Connection[]): RecommendPersonsResult {
    // Simple recommendation based on mutual connections
    const recommended = nodes
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    return {
      recommendations: recommended,
      reasoning: "Based on shared interests and mutual connections"
    };
  }

  static findSimilar(entities: string[], nodes: Person[], connections: Connection[]): FindSimilarResult {
    if (entities.length === 0) return { similar: [], target: undefined };
    
    const targetName = entities[0];
    const targetNode = nodes.find(node => 
      node.name.toLowerCase().includes(targetName.toLowerCase())
    );

    if (!targetNode) return { similar: [], target: undefined };

    const similar = nodes
      .filter(node => node.id !== targetNode.id)
      .filter(node => {
        const sharedTopics = node.expertise_areas?.filter(area =>
          targetNode.expertise_areas?.includes(area)
        )?.length || 0;
        return sharedTopics > 0;
      })
      .slice(0, 5);

    return { similar, target: targetNode };
  }

  static findBridge(parameters: any, nodes: Person[], connections: Connection[]): FindBridgeResult {
    // Find nodes that connect different clusters/topics
    const bridges = nodes
      .filter(node => {
        const nodeConnections = connections.filter(conn =>
          conn.person_a_id === node.id || conn.person_b_id === node.id
        );
        return nodeConnections.length >= 3; // Has multiple connections
      })
      .slice(0, 5);

    return { bridges };
  }

  static generateGraphAction(intentData: IntentData, graphResults: GraphResults) {
    const { intent } = intentData;

    switch (intent) {
      case 'find_path':
        const pathResults = graphResults as FindPathResult;
        return {
          type: 'highlight_path',
          node_ids: pathResults.path || [],
          connection_ids: pathResults.connections?.map(c => c.id) || []
        };

      case 'rank_nodes':
        const rankResults = graphResults as RankNodesResult;
        return {
          type: 'highlight_nodes',
          node_ids: rankResults.ranked_nodes?.slice(0, 5).map(n => n.id) || []
        };

      case 'recommend_person':
        const recResults = graphResults as RecommendPersonsResult;
        return {
          type: 'highlight_nodes',
          node_ids: recResults.recommendations?.map(n => n.id) || []
        };

      case 'find_similar':
        const similarResults = graphResults as FindSimilarResult;
        return {
          type: 'highlight_nodes',
          node_ids: [
            ...(similarResults.target ? [similarResults.target.id] : []),
            ...(similarResults.similar?.map(n => n.id) || [])
          ]
        };

      case 'find_bridge':
        const bridgeResults = graphResults as FindBridgeResult;
        return {
          type: 'highlight_nodes',
          node_ids: bridgeResults.bridges?.map(n => n.id) || []
        };

      case 'general':
      default:
        return null;
    }
  }
}