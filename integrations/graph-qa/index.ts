import { ChatOpenAI } from '@langchain/openai';
import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';
import { GraphCypherQAChain } from 'langchain/chains/graph_qa/cypher';
import { PromptTemplate } from '@langchain/core/prompts';
import { getFromCache, setToCache } from '../common/caching';
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";
import { RetrievalQAChain } from "langchain/chains";
import { ChatMessage } from '@/Entities/all';

// --- Existing Neo4j Graph Q&A Setup ---

const graphPromise = Neo4jGraph.initialize({
  url: import.meta.env.VITE_NEO4J_URI!,
  username: import.meta.env.VITE_NEO4J_USERNAME!,
  password: import.meta.env.VITE_NEO4J_PASSWORD!,
  enhancedSchema: true,
});

const llm = new ChatOpenAI({
  temperature: 0,
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY!,
});

// Custom prompt that forces the LLM to build a precise Cypher query for
// shortest-path questions between participants. The generated Cypher should
// always use the :Participant label with the name property and return the path
// object so we can interpret it later.
export const CYPHER_GENERATION_PROMPT = PromptTemplate.fromTemplate(
  `You are an expert Neo4j Cypher generator. Use the schema below to build a query answering the user's question.\n` +
  `- Always match participants as (:Participant {{name: '<n>'}}).\n` +
  `- For direct path questions, use shortestPath() function.\n` +
  `- For indirect path questions or when asked about alternative paths, use allShortestPaths() or specify maxLength > 1.\n` +
  `- If the question asks about "indirect" paths, look for paths with length 2 or more: shortestPath((a)-[*2..5]-(b)).\n` +
  `- The query must return the path object using RETURN p.\n` +
  `- Consider conversation context when determining path search strategy.\n` +
  `Schema:\n{schema}\n\nQuestion: {question}\nCypher:`
);

// Updated prompt for turning the path result into a human readable narrative with chat history context.
export const QA_PROMPT = PromptTemplate.fromTemplate(
  `You are a network analysis assistant. Use the context from a Cypher query to explain the connection between the people in the question.\n` +
  `Parse the context JSON to obtain the ordered Participant nodes and SHARED_EXPERIENCE relationships.\n` +
  `For each relationship, describe the connection using the properties type, institutionName, overlapStartDate, and overlapEndDate.\n` +
  `Write one sentence per step and combine them into a coherent paragraph.\n` +
  `If the context is empty, reply with "I could not find a direct professional or academic path between" followed by the two names.\n` +
  `Consider the conversation history when forming your response to maintain context and avoid repetition.\n` +
  `If the question appears to be a follow-up (like "indirect", "what about", etc.), understand it in context of the previous conversation.\n` +
  `For follow-up questions about indirect paths, search for longer paths or alternative connections beyond direct relationships.\n` +
  `Provide only plain text.\n\nQuestion: {question}\nContext: {context}\nAnswer:`
);


export async function queryGraph(params: {
  query: string;
  use_cache?: boolean;
  chatHistory?: ChatMessage[];
}) {
  const useCache = params.use_cache !== false;
  const { query, chatHistory = [] } = params;

  // Create cache key that includes recent chat history context
  const cacheKey = { 
    query, 
    recentHistory: chatHistory.slice(-3).map(msg => `${msg.sender}: ${msg.message}`) 
  };

  if (useCache) {
    const cachedResponse = getFromCache(cacheKey);
    if (cachedResponse) return cachedResponse;
  }

  const graph = await graphPromise;

  const chain = GraphCypherQAChain.fromLLM({
    llm,
    graph,
    cypherPrompt: CYPHER_GENERATION_PROMPT,
    qaPrompt: QA_PROMPT,
  });

  const response = await chain.invoke({ query });

  if (useCache) {
    setToCache(cacheKey, response);
  }

  return response;
}

// --- New Supabase Document Q&A Setup ---

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const openAIApiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openAIApiKey) {
  console.warn("Missing environment variables for Supabase Q&A. Service will be disabled.");
}

const supabaseClient = createClient(supabaseUrl!, supabaseKey!);
const embeddings = new OpenAIEmbeddings({ openAIApiKey });

const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabaseClient,
  tableName: "participants2",
  queryName: "match_documents",
});

const retriever = vectorStore.asRetriever();
const model = new ChatOpenAI({ openAIApiKey });
const supabaseChain = RetrievalQAChain.fromLLM(model, retriever);

export async function answerQuestionAboutPerson(question: string) {
    if (!supabaseUrl || !supabaseKey || !openAIApiKey) {
        return "Sorry, the connection to my knowledge base is not configured correctly.";
    }
    
    try {
        const response = await supabaseChain.invoke({
            query: question,
        });
        return response.text;
    } catch (error) {
        console.error("Error answering question with LangChain:", error);
        return "Sorry, I encountered an error while trying to find an answer.";
    }
} 