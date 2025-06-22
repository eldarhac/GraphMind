import { ChatOpenAI } from "@langchain/openai";
import { supabaseClient } from "../supabase-client";
import { InvokeLLM } from '../invoke-llm';
import { executeSql } from '../supabase-client';
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

const SYSTEM_PROMPT = `
You are an expert at converting natural language questions into precise SQL queries for a PostgreSQL database.

The user is querying a table named "participants2".

Here is the relevant schema for the "participants2" table:
- id: uuid (Primary Key)
- name: text
- headline: text
- location: text
- summary: text
- industry: text
- experience: json (can be a single JSON object or an array of objects)
- education: json (can be a single JSON object or an array of objects)

Key fields within the 'experience' JSON objects:
- "company": The name of the company.
- "title": The job title.
- "location": The location of the job.

Key fields within the 'education'JSON objects:
- "institution": The name of the institution (e.g., university).
- "degree": The degree obtained.

IMPORTANT QUERYING RULES:
1.  Always query against the "participants2" table.
2.  Your queries must be robust enough to handle cases where 'experience' or 'education' columns contain either a single JSON object or an array of JSON objects.
3.  To handle this, you MUST use a combination of \`jsonb_typeof\` and \`jsonb_array_elements\` to safely query the JSON data.
4.  Always cast the JSON columns to \`jsonb\` before using JSON functions (e.g., \`education::jsonb\`).

Example for querying the 'education' column for 'Ohio State University':
\`\`\`sql
SELECT * FROM participants2 WHERE
EXISTS (
  SELECT 1
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(education::jsonb) = 'array' THEN education::jsonb ELSE jsonb_build_array(education::jsonb) END) AS edu
  WHERE edu->>'institution' ILIKE '%Ohio State University%'
)
\`\`\`

This pattern correctly handles both single objects and arrays. Apply the same pattern for the 'experience' column.

Generate only the SQL query. Do not include any other text, explanation, or markdown.
`;

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

export async function processTextToSqlQuery(question: string) {
  try {
    const generatedQuery: any = await InvokeLLM({
      prompt: `Generate a SQL query for the following question: "${question}"`,
      system_prompt: SYSTEM_PROMPT,
      use_cache: false,
    });

    const sqlQuery = generatedQuery.replace(/```sql\n|```/g, '').trim();
    console.log("Generated SQL Query:", sqlQuery);

    const result = await executeSql(sqlQuery);
    console.log("SQL Execution Result:", result);

    if (result.error) {
      return `Database error: ${result.error}`;
    }
    if (result.data && result.data.length > 0) {
      return `I found the following people:\n\n${result.data.map((row: any) => `- ${row.name}`).join('\n')}`;
    }
    return "I could not find any information matching your query in the database.";

  } catch (error: any) {
    console.error("Error processing text-to-SQL:", error);
    return "I'm sorry, I encountered an error while trying to query the database.";
  }
} 