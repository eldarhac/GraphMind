import { ChatOpenAI } from "@langchain/openai";
import { supabaseClient } from "../supabase-client";
// I'll assume the mcp_supabase_execute_sql tool can be imported and used here.
// For now, this is a placeholder.
// import { mcp_supabase_execute_sql } from "somewhere"; 

// We need the schema to generate accurate queries.
// This is a placeholder and should be fetched dynamically if possible.
const DATABASE_SCHEMA = `
Table: participants2
Columns:
- id: number
- name: string
- bio: string
- embedding: vector
- experience: jsonb
- publications: jsonb
- "linkedin-url": string
- "github-url": string
- "twitter-url": string
- "scholar-url": string
- affiliations: jsonb
- current_project: string
- office_hours: jsonb
`;

const llm = new ChatOpenAI({
    openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
    modelName: 'gpt-4.1-mini',
    temperature: 0,
});

async function generateSqlQuery(question: string, schema: string): Promise<string> {
  const prompt = `
You are a PostgreSQL expert. Given the following database schema:
\`\`\`
${schema}
\`\`\`

Generate a single, valid PostgreSQL SELECT query to answer the following question:
"${question}"

- Only return the raw SQL query.
- Do not add any commentary, explanation, or markdown formatting.
  `;

  const response = await llm.invoke(prompt);
  return response.content.toString().trim(); 
}

async function generateFinalAnswer(question: string, sqlResult: any): Promise<string> {
    const prompt = `
You are a helpful AI assistant. A user asked the following question:
"${question}"

To answer this, a SQL query was run against a database which returned the following JSON data:
\`\`\`json
${JSON.stringify(sqlResult, null, 2)}
\`\`\`

Based ONLY on the provided data, please provide a concise and helpful natural-language answer to the original question. If the data is empty, null, or contains an error, simply state that you could not find the information in the database. Do not invent information or say the query failed.
    `;
    const response = await llm.invoke(prompt);
    return response.content.toString().trim();
}

export async function processTextToSqlQuery(question: string): Promise<string> {
    try {
        const schema = DATABASE_SCHEMA;
        const sqlQuery = await generateSqlQuery(question, schema);
        console.log(`Generated SQL Query: ${sqlQuery}`);

        // Clean up the SQL query - remove trailing semicolons
        const cleanedSqlQuery = sqlQuery.replace(/;+$/, '').trim();

        // We will call a generic 'execute_sql' function now
        const sqlResult = await supabaseClient.executeSql(cleanedSqlQuery);
        console.log("SQL Execution Result:", sqlResult);
        
        const finalAnswer = await generateFinalAnswer(question, sqlResult);
        return finalAnswer;

    } catch (error) {
        console.error("Error processing Text-to-SQL query:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return `Sorry, I encountered an unexpected error: ${errorMessage}`;
    }
} 