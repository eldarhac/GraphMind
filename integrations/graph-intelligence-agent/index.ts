import { ChatOpenAI } from '@langchain/openai';
import { GraphCypherQAChain } from 'langchain/chains/graph_qa/cypher';
import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';
import { Neo4jVectorStore } from '@langchain/community/vectorstores/neo4j_vector';
import { OpenAIEmbeddings } from '@langchain/openai';

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

/** Find the shortest path between two people using Cypher */
export async function findShortestPath(personA: string, personB: string) {
  const graph = await graphPromise;
  const chain = GraphCypherQAChain.fromLLM({ llm, graph });
  const query = `MATCH p = shortestPath((a:Participant {name: '${personA}'})-[:SHARED_EXPERIENCE*..6]-(b:Participant {name: '${personB}'})) RETURN p`;
  const result = await chain.invoke({ query });
  return result;
}

/** Compute semantic similarity between two participants based on text properties */
export async function inferConnection(personA: string, personB: string) {
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY! });
  const graph = await graphPromise;
  const vectorStore = await Neo4jVectorStore.initialize(embeddings, {
    url: import.meta.env.VITE_NEO4J_URI!,
    username: import.meta.env.VITE_NEO4J_USERNAME!,
    password: import.meta.env.VITE_NEO4J_PASSWORD!,
    indexName: 'participant-embeddings',
    nodeLabel: 'Participant',
    textNodeProperty: 'bio',
    embeddingNodeProperty: 'embedding',
  });

  const [[docsA, scoreA]] = await vectorStore.similaritySearchWithScore(personA, 1);
  const [[docsB, scoreB]] = await vectorStore.similaritySearchWithScore(personB, 1);
  if (!docsA || !docsB) return 'No matching participants found.';

  const score = scoreA && scoreB ? (scoreA + scoreB) / 2 : 0;
  const aiMessage = await llm.invoke(
    `Explain why ${personA} and ${personB} might be professionally connected. Their similarity score is ${score.toFixed(2)}.`
  );
  return aiMessage.content;
}

/** Simple intent router */
export async function processGraphQuery(question: string) {
  const lower = question.toLowerCase();
  if (lower.includes('connected') || lower.includes('path')) {
    const match = /between\s+(.*)\s+and\s+(.*)/i.exec(question);
    if (match) {
      return findShortestPath(match[1], match[2]);
    }
  }
  if (lower.includes('similar') || lower.includes('should') || lower.includes('potential')) {
    const match = /between\s+(.*)\s+and\s+(.*)/i.exec(question);
    if (match) {
      return inferConnection(match[1], match[2]);
    }
  }
  return 'Sorry, I could not understand the request.';
}

