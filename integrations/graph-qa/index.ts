import { ChatOpenAI } from '@langchain/openai';
import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';
import { GraphCypherQAChain } from 'langchain/chains/graph_qa/cypher';
import { getFromCache, setToCache } from '../common/caching';
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";
import { RetrievalQAChain } from "langchain/chains";

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


export async function queryGraph(params: {
  query: string;
  use_cache?: boolean; 
}) {
  const useCache = params.use_cache !== false;
  const { query } = params;

  if (useCache) {
    const cachedResponse = getFromCache({ query });
    if (cachedResponse) return cachedResponse;
  }

  const graph = await graphPromise;

  const chain = GraphCypherQAChain.fromLLM({
    llm,
    graph,
  });

  const response = await chain.invoke({ query });

  if (useCache) {
    setToCache({ query }, response);
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