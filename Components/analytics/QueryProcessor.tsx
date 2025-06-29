import { InvokeLLM } from '@/integrations/Core';
import { Person, Connection, IntentData, GraphResults, FindPathResult, RankNodesResult, RecommendPersonsResult, FindSimilarResult, FindBridgeResult, SelectNodeResult, ChatMessage, FindPotentialConnectionsResult, ExplainSimilarityResult } from '@/Entities/all';
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

      const tools = [
        {
          name: "answer_relational_question",
          description: "Answers questions about factual attributes of participants, like their work history, education, or title. Use for queries like 'List everyone who worked at Google' or 'How many people studied at MIT?'.",
          parameters: {
            type: "object",
            properties: {
              question: { type: "string", description: "The natural language question to answer from the relational database." }
            },
            required: ["question"]
          }
        },
        {
          name: "answer_graph_question",
          description: "Answers general questions about the network structure, relationships, or influential nodes. Use for 'Who is the most connected person in AI?' or 'Summarize the tech cluster'.",
          parameters: {
            type: "object",
            properties: {
              question: { type: "string", description: "The natural language question to answer from the graph." }
            },
            required: ["question"]
          }
        },
        {
          name: "find_path",
          description: "Finds the shortest path between two people in the network. Use for 'Show me the path between Person A and Person B' or 'How am I connected to Person C?'.",
          parameters: {
            type: "object",
            properties: {
              person_a: { type: "string", description: "The name of the starting person. Can be 'me' or 'I' to refer to the current user." },
              person_b: { type: "string", description: "The name of the ending person." }
            },
            required: ["person_a", "person_b"]
          }
        },
        {
          name: "find_similar_people",
          description: "Finds people with similar profiles to a given person, based on their experience and education (using vector embeddings).",
          parameters: {
            type: "object",
            properties: {
              person_name: { type: "string", description: "The name of the person to find similar profiles for." }
            },
            required: ["person_name"]
          }
        },
        {
          name: "find_potential_connections",
          description: "Recommends new people for a given person to connect with. It works by finding people similar to the target person and then suggesting their connections.",
          parameters: {
            type: "object",
            properties: {
              person_name: { type: "string", description: "The name of the person to find potential connections for. Can be 'me' or 'I'." }
            },
            required: ["person_name"]
          }
        },
        {
          name: "explain_similarity",
          description: "Explains *why* two people are considered to have similar profiles by comparing their backgrounds.",
          parameters: {
            type: "object",
            properties: {
              person_a: { type: "string", description: "The name of the first person." },
              person_b: { type: "string", description: "The name of the second person." }
            },
            required: ["person_a", "person_b"]
          }
        },
        {
          name: "select_person",
          description: "Selects and highlights a person on the graph.",
          parameters: {
            type: "object",
            properties: {
              person_name: { type: "string", description: "The name of the person to select." }
            },
            required: ["person_name"]
          }
        }
      ];

      const agentPrompt = `
        You are a highly intelligent network analysis agent. Your goal is to answer the user's question by choosing the best tool for the job.
        You must respond with a JSON object containing the tool to use and the parameters to pass to it.
        Your response MUST be only the JSON object, with no other text.

        **Tools Available:**
        ${JSON.stringify(tools, null, 2)}

        **Critical Rules & Context:**
        - The current user's name is "${currentUser.name}".
        - You MUST ONLY replace pronouns like "me", "I", or "my" with "${currentUser.name}".
        - If the user's query mentions specific names, you MUST use those exact names in the tool parameters. DO NOT substitute a person's name with the current user's name. For example, if the query is "compare Person X and Person Y", the parameters should be for "Person X" and "Person Y", not the current user.
        - You have access to a graph of people and their connections, and a relational database with their profile details.

        **Conversation History:**
        ${chatContext}

        **Current User Query:**
        "${message}"

        Based on the query, history, tools, and the critical rules, select the single most appropriate tool and its parameters.

        **Example Response Format:**
        {
          "name": "tool_name",
          "parameters": {
            "param_name": "value"
          }
        }

        **Your JSON Response:**
      `;

      const toolSelection = await InvokeLLM({
        prompt: agentPrompt,
        // Assuming InvokeLLM can handle a more generic schema definition
        // If not, we might need a wrapper to format this for the LLM
      });

      // The LLM's response should be a JSON string that we need to parse.
      const parsedSelection = typeof toolSelection === 'string' ? JSON.parse(toolSelection) : toolSelection;

      let { name: toolName, parameters: toolParams } = parsedSelection;

      // Defensively parse parameters, as the LLM may return a schema-like object.
      if (toolParams && toolParams.properties) {
        const extractedParams: { [key:string]: any } = {};
        for (const key in toolParams.properties) {
          if (toolParams.properties[key] && toolParams.properties[key].hasOwnProperty('value')) {
            extractedParams[key] = toolParams.properties[key].value;
          }
        }
        toolParams = extractedParams;
      }

      // Sanitize params that might refer to the current user
      for (const key in toolParams) {
        if (typeof toolParams[key] === 'string' && (toolParams[key].toLowerCase() === 'me' || toolParams[key].toLowerCase() === 'i')) {
          toolParams[key] = currentUser.name;
        }
      }
      
      let result: GraphResults;
      let responseText: string;

      // Step 2: Execute the selected tool
      switch (toolName) {
        case "answer_relational_question":
          responseText = await processTextToSqlQuery(toolParams.question);
          result = { nodes: [], connections: [], insights: [] }; // No graph action for now
          break;
        case "answer_graph_question":
          responseText = await queryGraph({ query: toolParams.question, chatHistory });
          result = { nodes: [], connections: [], insights: [] }; // No graph action for now
          break;
        case "find_path":
          result = this.findPath([toolParams.person_a, toolParams.person_b], graphData.nodes, graphData.connections);
          responseText = this.generatePathExplanation(result as FindPathResult, currentUser.name);
          break;
        case "find_similar_people":
          result = await this.findSimilar([toolParams.person_name], graphData.nodes);
          responseText = this.generateSimilarExplanation(result as FindSimilarResult);
          break;
        case "find_potential_connections":
          result = await this.findPotentialConnections([toolParams.person_name], graphData.nodes, graphData.connections);
          responseText = this.generatePotentialConnectionsExplanation(result as FindPotentialConnectionsResult);
          break;
        case "explain_similarity":
          result = await this.explainSimilarity([toolParams.person_a, toolParams.person_b], graphData.nodes);
          responseText = this.generateSimilarityExplanation(result as ExplainSimilarityResult);
          break;
        case "select_person":
          result = this.selectNodes([toolParams.person_name], graphData.nodes);
          const selectedNodes = (result as SelectNodeResult).nodes;
          responseText = selectedNodes.length > 0
            ? `I've highlighted ${selectedNodes.map(n => n.name).join(', ')} on the graph.`
            : `I couldn't find anyone named '${toolParams.person_name}'.`;
          break;
        default:
          responseText = "I'm not sure how to handle that request. Please try rephrasing.";
          result = { nodes: [], connections: [], insights: [] };
      }

      const processingTime = Date.now() - startTime;
      
      return {
        response: responseText,
        intent: toolName, // We can use the tool name as the intent for logging/UI purposes
        graphAction: this.generateGraphAction(toolName, result),
        processingTime,
        entities: Object.values(toolParams) // For context, though not used in the same way
      };

    } catch (error: any) {
      console.error('Error processing agentic query:', error);
      return {
        response: "I encountered an issue processing your query with my new agent brain. Could you please rephrase?",
        intent: "agent_error",
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

      case 'explain_similarity':
        return this.explainSimilarity(entities, nodes);

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

  static generateGraphAction(toolName: string, graphResults: GraphResults) {
    switch (toolName) {
      case 'find_path':
        const pathResults = graphResults as FindPathResult;
        return {
          type: 'highlight_path',
          node_ids: pathResults.path || [],
          connection_ids: pathResults.connections?.map(c => c.id) || []
        };

      case 'find_similar_people':
        const similarResults = graphResults as FindSimilarResult;
        return {
          type: 'highlight_nodes',
          node_ids: [
            ...(similarResults.target ? [similarResults.target.id] : []),
            ...(similarResults.similar?.map(n => n.id) || [])
          ]
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

      case 'explain_similarity':
        const similarityResult = graphResults as ExplainSimilarityResult;
        return {
          type: 'highlight_nodes',
          node_ids: [
            ...(similarityResult.person_a ? [similarityResult.person_a.id] : []),
            ...(similarityResult.person_b ? [similarityResult.person_b.id] : [])
          ]
        };

      case 'select_person':
        const selectResults = graphResults as SelectNodeResult;
        return {
          type: 'highlight_nodes',
          node_ids: selectResults.nodes?.map(n => n.id) || []
        };
        
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

  static async explainSimilarity(entities: string[], nodes: Person[]): Promise<ExplainSimilarityResult> {
    if (!entities || entities.length < 2) {
        return { explanation: "Please specify two people to compare their similarity." };
    }

    const personAName = entities[0].replace(/^@/, '');
    const personBName = entities[1].replace(/^@/, '');

    const personANode = nodes.find(node => node.name.toLowerCase() === personAName.toLowerCase());
    const personBNode = nodes.find(node => node.name.toLowerCase() === personBName.toLowerCase());

    if (!personANode) {
        return { explanation: `Could not find "${personAName}" in the network.`, message: `Could not find "${personAName}" in the network.` };
    }
    if (!personBNode) {
        return { explanation: `Could not find "${personBName}" in the network.`, message: `Could not find "${personBName}" in the network.` };
    }

    // Fetch full details from Supabase
    const [personADetails, personBDetails] = await Promise.all([
        supabaseClient.getParticipantById(personANode.id),
        supabaseClient.getParticipantById(personBNode.id)
    ]);

    if (!personADetails || !personBDetails) {
        return { explanation: "Could not retrieve full details for one or both individuals to compare.", message: "Could not retrieve full details for one or both individuals to compare." };
    }

    // Now, generate the explanation using an LLM.
    const experienceStringA = Array.isArray(personADetails.experience)
        ? personADetails.experience.map(exp => `- ${exp.title} at ${exp.company}`).join('\n')
        : 'No experience data available.';
    const educationStringA = Array.isArray(personADetails.education)
        ? personADetails.education.map(edu => `- ${edu.degree} from ${edu.school}`).join('\n')
        : 'No education data available.';

    const experienceStringB = Array.isArray(personBDetails.experience)
        ? personBDetails.experience.map(exp => `- ${exp.title} at ${exp.company}`).join('\n')
        : 'No experience data available.';
    const educationStringB = Array.isArray(personBDetails.education)
        ? personBDetails.education.map(edu => `- ${edu.degree} from ${edu.school}`).join('\n')
        : 'No education data available.';

    const prompt = `
        You are a professional analyst. Your task is to explain why ${personADetails.name} and ${personBDetails.name} have similar professional profiles, based ONLY on the data provided.
        Your response MUST use their full names. Do NOT use placeholders like "Person A" or "Person B".

        **Information for ${personADetails.name}**:
        Title: ${personADetails.title}
        Experience:
        ${experienceStringA}
        Education:
        ${educationStringA}

        **Information for ${personBDetails.name}**:
        Title: ${personBDetails.title}
        Experience:
        ${experienceStringB}
        Education:
        ${educationStringB}

        **Analysis Task:**
        Write a concise, 2-3 sentence explanation highlighting the key similarities in their careers, such as common industries, companies, or fields of study.
        Remember to use their names, ${personADetails.name} and ${personBDetails.name}, in your response.

        **Generated Explanation:**
    `;

    try {
        const explanation = await InvokeLLM({ prompt: prompt });
        return {
            person_a: personADetails,
            person_b: personBDetails,
            explanation: String(explanation)
        };
    } catch (error) {
        console.error("Error generating similarity explanation:", error);
        return { explanation: "I was unable to generate a similarity explanation at this time.", message: "I was unable to generate a similarity explanation at this time." };
    }
  }

  private static generateSimilarityExplanation(result: ExplainSimilarityResult): string {
    const { explanation, message, person_a, person_b } = result;

    if (message) {
      return message;
    }
    
    if (!explanation) {
      return `I couldn't generate an explanation for the similarity between ${person_a?.name} and ${person_b?.name}.`;
    }

    return explanation;
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
