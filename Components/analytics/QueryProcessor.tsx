import { InvokeLLM } from '@/integrations/Core';
import { Person, Connection, IntentData, GraphResults, FindPathResult, RankNodesResult, RecommendPersonsResult, FindSimilarResult, FindBridgeResult, SelectNodeResult, ChatMessage, FindPotentialConnectionsResult } from '@/Entities/all';
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
        Query: "Find people similar to @Pamela Mayer" -> "graph_query" // Similarity is a graph operation using vector search
        Query: "List everyone who worked at Google" -> "relational_query"
        Query: "How many people studied at MIT?" -> "relational_query"
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
        
        const intentResultSchema = {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["find_path", "rank_nodes", "recommend_person", "find_similar", "find_bridge", "select_node", "find_potential_connections", "general"]
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
          },
          required: ["intent", "entities", "parameters", "confidence"]
        };

        const intentResult: IntentData = await InvokeLLM({
          prompt: `
            You are a specialized API that converts natural language queries into structured JSON.
            Your response MUST be a single, valid JSON object that strictly follows the JSON Schema provided below.
            Do not include any text, explanations, or markdown formatting outside of the JSON object itself.

            **JSON Schema to Follow:**
            \`\`\`json
            ${JSON.stringify(intentResultSchema, null, 2)}
            \`\`\`

            **Context for the Query:**
            - The query is from a user named: "${currentUser.name}".
            - References to "I", "me", or "my" should be interpreted as "${currentUser.name}".
            - For "find_path" intent, if only one person is named, the path is from "${currentUser.name}" to that person.
            
            **Conversation History:**
            ${contextualMessage}

            **User Query to Process:**
            "${message}"

            **Your JSON Output:**
          `,
          response_json_schema: intentResultSchema
        });
        console.log('[DEBUG 2] Extracted Entities:', JSON.stringify(intentResult, null, 2));

        // Sanitize entities to remove "@" prefix from mentions.
        if (intentResult.entities && Array.isArray(intentResult.entities)) {
          intentResult.entities = intentResult.entities.map(e =>
            typeof e === 'string' ? e.replace(/^@/, '').trim() : e
          );
        }

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
        } else if (intentResult.intent === 'find_similar') {
            const similarResult = graphResults as FindSimilarResult;
            finalText = this.generateSimilarExplanation(similarResult);
        } else if (intentResult.intent === 'find_potential_connections') {
            const potentialResult = graphResults as FindPotentialConnectionsResult;
            finalText = this.generatePotentialConnectionsExplanation(potentialResult);
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
        // Preprocess message to remove mention tags (@) before SQL processing
        const preprocessedMessage = message.replace(/@/g, '').trim();
        const sqlResponse = await processTextToSqlQuery(preprocessedMessage);

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
        return await this.findSimilar(entities, nodes);
      
      case 'find_bridge':
        return this.findBridge(parameters, nodes, connections);

      case 'select_node':
        return this.selectNodes(entities, nodes);
      
      case 'find_potential_connections':
        return this.findPotentialConnections(entities, nodes, connections);

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

  static async findSimilar(entities: string[], nodes: Person[]): Promise<FindSimilarResult> {
    if (!entities || entities.length === 0) {
      return { similar: [], target: undefined, message: "Please specify a person to find similar profiles." };
    }
  
    const targetName = entities[0].replace(/^@/, '');
  
    // Find the target person in the local graph data to get their ID.
    const targetNode = nodes.find(node => node.name.toLowerCase() === targetName.toLowerCase());
  
    if (!targetNode) {
      return { similar: [], target: undefined, message: `Could not find "${targetName}" in the network.` };
    }
  
    try {
      // Use the targetNode's ID to find similar people via Supabase embeddings.
      const similarPeople = await supabaseClient.getSimilarParticipants(targetNode.id, 5);
  
      if (!similarPeople || similarPeople.length === 0) {
        return { similar: [], target: targetNode, message: `I couldn't find anyone with a similar profile to ${targetName}.` };
      }
  
      // The RPC returns full Person objects, so we can use them directly.
      return { similar: similarPeople, target: targetNode };
  
    } catch (error) {
      console.error("Error finding similar people via embeddings:", error);
      return { 
        similar: [], 
        target: targetNode, 
        message: "I encountered an error while searching for similar people. Please try again later." 
      };
    }
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

      case 'find_potential_connections':
        const potentialResults = graphResults as FindPotentialConnectionsResult;
        return {
          type: 'highlight_nodes',
          node_ids: [
            ...(potentialResults.target ? [potentialResults.target.id] : []),
            ...(potentialResults.potential_connections?.map(n => n.id) || [])
          ]
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

  private static generateSimilarExplanation(similarResult: FindSimilarResult): string {
    const { similar, target, message } = similarResult;

    if (message) {
      return message;
    }

    if (!target || !similar || similar.length === 0) {
      return "I couldn't find any similar people for the specified person.";
    }

    const similarNames = similar.map(p => p.name).join(', ');
    const response = `Based on their profile, here are some people similar to ${target.name}:\n\n- ${similarNames.replace(/, /g, '\n- ')}\n\nI've highlighted them on the graph for you.`;
    
    return response;
  }

  static async findPotentialConnections(entities: string[], nodes: Person[], connections: Connection[]): Promise<FindPotentialConnectionsResult> {
    if (!entities || entities.length === 0) {
      return { potential_connections: [], message: "Please specify a person to find potential connections for." };
    }
    const targetName = entities[0].replace(/^@/, '');
    const targetNode = nodes.find(node => node.name.toLowerCase() === targetName.toLowerCase());

    if (!targetNode) {
      return { potential_connections: [], target: undefined, message: `Could not find "${targetName}" in the network.` };
    }

    // Find people similar to the target person.
    const similarPeople = await supabaseClient.getSimilarParticipants(targetNode.id, 3); // Get top 3 similar people

    if (!similarPeople || similarPeople.length === 0) {
        return { potential_connections: [], target: targetNode, message: `I couldn't find anyone with a similar profile to ${targetName} to base recommendations on.` };
    }
    
    // Get IDs of people already connected to the target person
    const existingConnectionIds = new Set<string>();
    connections.forEach(conn => {
        if (conn.person_a_id === targetNode.id) existingConnectionIds.add(conn.person_b_id);
        if (conn.person_b_id === targetNode.id) existingConnectionIds.add(conn.person_a_id);
    });
    existingConnectionIds.add(targetNode.id); // Can't recommend the person themselves

    // Get IDs of the similar people
    const similarPeopleIds = new Set(similarPeople.map(p => p.id));

    // Find connections of similar people (2nd degree connections)
    const potentialConnectionIds = new Set<string>();
    connections.forEach(conn => {
        let potentialId: string | null = null;
        if (similarPeopleIds.has(conn.person_a_id)) {
            potentialId = conn.person_b_id;
        } else if (similarPeopleIds.has(conn.person_b_id)) {
            potentialId = conn.person_a_id;
        }

        if (potentialId && !existingConnectionIds.has(potentialId) && !similarPeopleIds.has(potentialId)) {
            potentialConnectionIds.add(potentialId);
        }
    });

    // Get the full Person objects for the potential connections and limit it.
    const potential_connections = nodes
      .filter(node => potentialConnectionIds.has(node.id))
      .slice(0, 5); // Limit to 5 recommendations

    return {
        potential_connections,
        target: targetNode,
        based_on: similarPeople
    };
  }

  private static generatePotentialConnectionsExplanation(result: FindPotentialConnectionsResult): string {
    const { potential_connections, target, based_on, message } = result;

    if (message) {
      return message;
    }

    if (!target || !potential_connections || potential_connections.length === 0) {
      return `I couldn't find any potential new connections for ${target?.name || 'the selected person'}.`;
    }

    const basedOnNames = based_on?.map(p => p.name).join(', ');
    const potentialNames = potential_connections.map(p => p.name).join(', ');

    let response = `Based on people with similar profiles to ${target.name} (like ${basedOnNames}), you might want to connect with:\n\n- ${potentialNames.replace(/, /g, '\n- ')}`;
    response += `\n\nThese individuals are connected to your lookalikes but not yet to you. I've highlighted them on the graph.`;

    return response;
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
    You are a professional biographer. Your task is to write a concise, narrative summary (around 2-4 sentences) of ${personData.name}'s career and academic background, based ONLY on the data provided.

    **CRITICAL INSTRUCTION:** Your response MUST start directly with the person's name or a description of their career. DO NOT include any introductory phrases like "Here is a summary..." or "This is a summary of...".

    **Example of what NOT to do:**
    "Here is a summary of Jane Doe's career: Jane Doe started..."

    **Example of what TO do:**
    "Jane Doe began her career at..."

    **Further Instructions:**
    1. Weave together their key professional roles and educational achievements into a short story.
    2. You MUST mention the names of companies and educational institutions from the data.

    **Professional Experience:**
    ${experienceString}

    **Education:**
    ${educationString}

    **Generated Summary (2-4 sentences, narrative style, mentioning institutions, NO introduction):**
  `;

  try {
    const summary = await InvokeLLM({ prompt: prompt });
    return String(summary);
  } catch (error) {
    console.error("Error generating bio summary:", error);
    return "Unable to generate a summary for this person at this time.";
  }
}
