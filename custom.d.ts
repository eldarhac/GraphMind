declare module '@langchain/openai';
declare module '@langchain/community/graphs/neo4j_graph';
declare module 'langchain/chains/graph_qa/cypher';
declare module '@langchain/community/vectorstores/supabase';
declare module '@supabase/supabase-js';
declare module 'langchain/chains';
declare module 'neo4j-driver';
declare module '*';
interface ImportMetaEnv {
  [key: string]: string | undefined;
}
interface ImportMeta {
  env: ImportMetaEnv;
}
