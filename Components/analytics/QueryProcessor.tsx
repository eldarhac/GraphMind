import { InvokeLLM } from '@/integrations/Core';
import { Person, Connection, IntentData, GraphResults, FindPathResult, RankNodesResult, RecommendPersonsResult, FindSimilarResult, FindBridgeResult, SelectNodeResult, ChatMessage } from '@/Entities/all';
import { processTextToSqlQuery } from '@/integrations/text-to-sql';
import { queryGraph, answerQuestionAboutPerson } from '@/integrations/graph-qa';
import { supabaseClient } from '@/integrations/supabase-client';

export default class QueryProcessor {
  static async processQuery(
    message: string, 
    currentUser: Person, 
    graphData: { nodes: Person[], connections: Connection[] },
    chatHistory: ChatMessage[] = []
  ) {
    const startTime = Date.now();
    
    try {
      // Create chat history context
      const chatContext = this.formatChatHistory(chatHistory);
      const contextualMessage = chatContext ? 
        `${chatContext}\n\nCurrent question: ${message}\n\nPlease answer the current question while considering the conversation history for context. If the current question refers to previous topics, use that context appropriately.` : 
        message;

      // --- Intent Classification Router ---
      const routerPrompt = `
        You are an expert intent classification router for a network analysis application. Your task is to classify the user's query into one of two categories: 'graph_query' or 'relational_query'.

        **INTENT DEFINITIONS:**
        - 'graph_query': Use for ANY request about the STRUCTURE of the network. This includes questions about paths, connections, relationships, links, who is connected to whom, immediate connections, or how people are related.
        - 'relational_query': Use ONLY for requests about the factual attributes of participants, such as finding lists of people based on their properties (like where they worked or studied), or asking for a count of people.

        **CRITICAL EXAMPLES:**
        Query: "Who are the immediate connections of @Mitchell Alexander" -> "graph_query"
        Query: "Show me the path between Person A and Person B" -> "graph_query"
        Query: "How are these two people related?" -> "graph_query"
        Query: "List everyone who worked at Google" -> "relational_query"
        Query: "How many people studied at MIT?" -> "relational_query"
        Query: "Find people similar to @Pamela Mayer" -> "relational_query"  // Note: Similarity is based on properties, so it's relational.
        Query: "Where did Justin Dougherty work in 2023?" -> "relational_query"


        ---
        Based on these strict definitions and examples, classify the following user query.
        User Query: "${message}"

        Respond with ONLY the string for the intent.
      `;

      const routerResult = await InvokeLLM({ prompt: routerPrompt });

      console.log('[DEBUG 1] Router Result:', routerResult);

      let classifiedIntent = String(routerResult)
        .toLowerCase()
        .replace(/["'\n]/g, '')
        .trim();
      console.log('Detected intent:', classifiedIntent);
      if (!['graph_query', 'relational_query'].includes(classifiedIntent)) {
        classifiedIntent = 'knowledge_base_qa';
      }

      if (classifiedIntent === 'graph_query') {
        // Step 1: Extract intent and entities from user message with chat context
        const personNames = graphData.nodes.map(n => n.name);
        const intentResult: IntentData = await InvokeLLM({
          prompt: `
            Analyze this user query for a graph-based network assistant, considering the chat history for context.

            Chat History and Current Question:
            ${contextualMessage}

            The user asking the question is "${currentUser.name}".
            **VERY IMPORTANT**: When the user refers to themselves with "I", "me", "my", or "myself", you MUST use "${currentUser.name}" as the person they are referring to.
            For "find_path" requests, if the user only mentions one other person, you MUST assume the path starts from "${currentUser.name}". In this scenario, the 'entities' array in your JSON output must contain two strings: ["${currentUser.name}", "the other person's name"].

            Here is a list of all the people in the network:
            - ${personNames.join('\n- ')}

            Your task:
            1.  Determine the user's intent (e.g., find_path).
            2.  Extract the entities (person names, topics) from the query, considering chat history context.
            3.  **Crucially, fuzzy match the extracted person names against the provided list of people. If you find a close match, use the exact name from the list.** For example, if the user says "Dr. Marcus Smith" and "Dr. Marcus Thorne" is in the list, you MUST return "Dr. Marcus Thorne" in the entities array.

            From the user's query, extract the full names of all participants mentioned. Participant names will be proper nouns.

            Examples:
            Query: "Find Misty Salinas"
            Result: {"entities": ["Misty Salinas"]}

            Query: "Can you please highlight @Cheryl Spears and Pamela Mayer for me?"
            Result: {"entities": ["Cheryl Spears", "Pamela Mayer"]}

            Query: "where is dr. scott harris"
            Result: {"entities": ["Dr. Scott Harris"]}

            Query: "Show me everyone"
            Result: {"entities": []}

            ---
            User Query: "${message}"
            Result:

            Return the corrected entities in the final JSON output.

            Extract the following information:
            - intent: one of [find_path, rank_nodes, recommend_person, find_similar, find_bridge, select_node, general]
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
                enum: ["find_path", "rank_nodes", "recommend_person", "find_similar", "find_bridge", "select_node", "general"]
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
        console.log('[DEBUG 2] Extracted Entities:', JSON.stringify(intentResult, null, 2));

        if (intentResult.intent === 'find_path' && intentResult.entities && intentResult.entities.length === 1) {
            // If only one entity is found for a path, assume it's between the current user and that entity.
            if (intentResult.entities[0] !== currentUser.name) {
                intentResult.entities.unshift(currentUser.name);
            }
        }

        if (intentResult.intent === 'find_path' && (!intentResult.entities || intentResult.entities.length < 2)) {
          console.error('[DEBUG 4] Entity extraction failed or found less than 2 people.');
          return {
            response: "I couldn't identify two specific people in your request. Please try again using the '@' mention feature, for example: 'path between @Person A and @Person B'.",
            intent: 'error',
            graphAction: null,
            processingTime: Date.now() - startTime
          };
        }
        if (intentResult.intent === 'select_node' && (!intentResult.entities || intentResult.entities.length === 0)) {
          console.error('[DEBUG 4] No people identified for select_node intent.');
          return {
            response: "I couldn't identify a specific person's name in your request. Please try again.",
            intent: 'error',
            graphAction: null,
            processingTime: Date.now() - startTime
          };
        }

        // Step 2: Execute graph query based on intent
        const graphResults: GraphResults = await this.executeGraphQuery(intentResult, graphData);

        let finalText = '';

        if (intentResult.intent === 'find_path') {
            const pathResult = graphResults as FindPathResult;
            finalText = this.generatePathExplanation(pathResult, currentUser.name);
        } else {
            // Step 3: Generate natural language response with chat history context
            const response = await queryGraph({
              query: contextualMessage,
              chatHistory: chatHistory
            });
            finalText = typeof response === 'object' && response !== null && 'result' in response
              ? (response as any).result
              : (typeof response === 'string' ? response : JSON.stringify(response));
        }

        const processingTime = Date.now() - startTime;

        return {
          response: finalText,
          intent: intentResult.intent,
          graphAction: this.generateGraphAction(intentResult, graphResults),
          processingTime,
          entities: intentResult.entities
        };
      } else if (classifiedIntent === 'knowledge_base_qa') {
        const qaResponse = await answerQuestionAboutPerson(message);
        const processingTime = Date.now() - startTime;
        return {
          response: qaResponse,
          intent: "knowledge_base_qa",
          graphAction: null,
          processingTime,
          entities: []
        };
      } else if (classifiedIntent === 'relational_query') {
        const sqlResponse = await processTextToSqlQuery(message);

        const processingTime = Date.now() - startTime;

        return {
          response: sqlResponse,
          intent: "text_to_sql",
          graphAction: null,
          processingTime,
          entities: []
        };
      } else {
        // Fallback for any unhandled classifiedIntent, though the logic above should prevent this.
        const qaResponse = await answerQuestionAboutPerson(message);
        return {
          response: qaResponse,
          intent: 'knowledge_base_qa',
          graphAction: null,
          processingTime: Date.now() - startTime
        };
      }

    } catch (error: any) {
      console.error('Error processing query:', error);
      return {
        response: "I encountered an issue processing your query. Could you please rephrase or try a different question?",
        intent: "general",
        graphAction: null,
        processingTime: Date.now() - startTime,
        entities: []
      };
    }
  }

  private static formatChatHistory(chatHistory: ChatMessage[]): string {
    if (!chatHistory || chatHistory.length === 0) return '';
    
    // Take last 5 messages for context (excluding welcome message)
    const recentMessages = chatHistory
      .filter(msg => msg.id !== 'welcome')
      .slice(-5);
    
    if (recentMessages.length === 0) return '';
    
    const formattedHistory = "Previous conversation:\n" + 
      recentMessages
        .map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.message}`)
        .join('\n');
    
    // Debug log to verify chat history is being processed
    console.log('Chat History Context:', formattedHistory);
    
    return formattedHistory;
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

      case 'select_node':
        return this.selectNodes(entities, nodes);
      
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

    // Pre-filter data to ensure consistency
    const nodeIds = new Set(nodes.map(n => n.id));
    const validConnections = connections.filter(conn => 
      nodeIds.has(conn.person_a_id) && nodeIds.has(conn.person_b_id)
    );

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
          const conn = validConnections.find(c =>
            (c.person_a_id === path[i] && c.person_b_id === path[i + 1]) ||
            (c.person_b_id === path[i] && c.person_a_id === path[i + 1])
          );
          if (conn) {
            pathConnections.push(conn);
          }
        }
        // Final consistency check
        if (pathNodes.length !== path.length || pathConnections.length !== path.length - 1) {
            return { path: [], distance: 0, message: "I found a path but the data was inconsistent. Please check your data source.", nodes: [], connections: [] };
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
      const neighbors = validConnections
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

  static selectNodes(entities: string[], nodes: Person[]): SelectNodeResult {
    const normalized = entities.map(e => e.toLowerCase().trim());
    const matched = nodes.filter(n =>
      normalized.some(ent => n.name.toLowerCase().includes(ent))
    );
    return { nodes: matched };
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

      case 'select_node':
        const selectResults = graphResults as SelectNodeResult;
        return {
          type: 'highlight_nodes',
          node_ids: selectResults.nodes?.map(n => n.id) || []
        };

      case 'general':
      default:
        return null;
    }
  }

  private static generatePathExplanation(pathResult: FindPathResult, currentUserName: string): string {
    const { nodes, connections } = pathResult;

    if (!nodes || nodes.length < 2 || !connections || !connections.length) {
        return "I couldn't find a path between the specified people.";
    }

    const startNode = nodes[0];
    const endNode = nodes[nodes.length - 1];

    if (!startNode || !endNode) {
      console.error("Path explanation generator received invalid start or end node.");
      return "I couldn't find a complete path between the specified people.";
    }
    
    const explanationParts: string[] = [];

    for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        const personA = nodes[i];
        const personB = nodes[i+1];

        // Safety check to ensure both nodes exist
        if (!personA || !personB) {
            console.error(`Missing node data at step ${i} in path explanation`);
            return "I found a path but encountered incomplete data. Please try your query again.";
        }

        const subject = (i === 0 && personA.name === currentUserName) ? "You" : personA.name;

        let predicate = '';

        if (conn.connection_type === 'WORK') {
            const details = conn.notes ? conn.notes.replace(/working together at/i, 'at').trim() : '';
            predicate = `worked with ${personB.name} ${details}`;
        } else if (conn.connection_type === 'STUDY') {
            const details = conn.notes ? conn.notes.replace(/studied at/i, 'at').trim() : '';
            predicate = `studied with ${personB.name} ${details}`;
        } else {
            predicate = `are connected to ${personB.name}`;
        }
        
        explanationParts.push(`${subject} ${predicate}.`);
    }

    const body = explanationParts.join('\n');
    const header = `Here's how you're connected to ${endNode.name}:`;
    const footer = `\n\nI've highlighted the full path on the graph.`;
    
    return `${header}\n\n${body}${footer}`;
  }
}

export async function generateBioSummary(personData: { name: string, experience: any[], education: any[] }): Promise<string> {
  // Convert the structured JSON data into a clean, readable string for the prompt
  const experienceString = Array.isArray(personData.experience) 
    ? personData.experience.map(exp => `- ${exp.title} at ${exp.company}`).join('\n')
    : 'No experience data available.';
  const educationString = Array.isArray(personData.education) 
    ? personData.education.map(edu => `- ${edu.degree} from ${edu.school}`).join('\n')
    : 'No education data available.';

  const prompt = `
    You are a professional biographer. Your task is to write a concise, one-paragraph summary of ${personData.name}'s career and academic history based ONLY on the data provided.
    Write in a fluid, narrative style. Mention their most recent or significant role and their education. Do not just list the data.

    **Professional Experience:**
    ${experienceString}

    **Education:**
    ${educationString}

    **Generated Summary:**
  `;

  try {
    const summary = await InvokeLLM({ prompt: prompt });
    return String(summary);
  } catch (error) {
    console.error("Error generating bio summary:", error);
    return "Unable to generate a summary for this person at this time.";
  }
}
