import { InvokeLLM } from '../invoke-llm';
import { executeSql } from '../supabase-client';

const SYSTEM_PROMPT = `
You are an expert at converting natural language questions into precise, single-line PostgreSQL queries.

The user is querying a table named "participants2". Here is the relevant schema:
- id: uuid (Primary Key)
- name: text
- title: text
- experience: jsonb (can contain an array of objects with a "company" key)
- education: jsonb (can contain an array of objects with an "institution" key)

**CRITICAL RULES:**
1.  **Always query the "participants2" table.**
2.  **Your entire output must be a single, valid PostgreSQL SELECT query on a single line.** Do not use semicolons or newlines.
3.  When a user asks "where" someone studied or worked, you MUST query the 'education' or 'experience' columns respectively.
4.  To query inside the 'education' or 'experience' JSONB columns, you MUST use the \`jsonb_path_exists\` function. This is the only way to handle both single objects and arrays of objects safely.

**EXAMPLE - How to find where a person studied:**
User Question: "Where did Dennis Lee study?"
Your SQL Query: SELECT education FROM participants2 WHERE name ILIKE '%Dennis Lee%'

**EXAMPLE - How to find who worked at a company:**
User Question: "Who worked at Google?"
Your SQL Query: SELECT name, title FROM participants2 WHERE jsonb_path_exists(experience, '$[*] ? (@.company like_regex "Google" flag "i")')

-   Based on these strict rules and examples, generate the SQL query for the user's question.
-   Do NOT generate any query that modifies the database (INSERT, UPDATE, DELETE, etc.).
-   **Output only the raw SQL query.**
`;

async function generateFinalAnswer(question: string, sqlResult: any): Promise<string> {
    const prompt = `
Based on the user's question and the data retrieved from the database, provide a concise and helpful natural-language answer.

User Question:
"${question}"

Database Result (JSON):
\`\`\`json
${JSON.stringify(sqlResult, null, 2)}
\`\`\`

- If the data is empty or contains an error, state that you could not find the information.
- Otherwise, summarize the data to directly answer the question. For example, if the user asked where someone studied and the result is a JSON object with a list of schools, list them out.
- Do not mention that you ran a SQL query. Just give the answer.
    `;
    const response = await InvokeLLM({ prompt });
    return String(response);
}

export async function processTextToSqlQuery(question: string) {
  try {
    const fullPrompt = `${SYSTEM_PROMPT}\n\nUser Question: "${question}"`;

    const generatedQuery = await InvokeLLM({
      prompt: fullPrompt,
      use_cache: false,
    });

    const sqlQuery = String(generatedQuery)
      .replace(/```sql\n|```|;/g, '')
      .trim();
      
    console.log("Generated SQL Query:", sqlQuery);

    if (!sqlQuery.toLowerCase().startsWith('select')) {
      return "I can only process requests to view information. Please try again with a different question.";
    }

    const result = await executeSql(sqlQuery);
    console.log("SQL Execution Result:", result);

    if (result.error) {
      return `Database error: ${result.error.message}. The failing query was: \`${sqlQuery}\``;
    }

    if (result.data && result.data.length > 0) {
      // Now, generate a final, user-friendly answer.
      const finalAnswer = await generateFinalAnswer(question, result.data);
      return finalAnswer;
    }
    
    return "I could not find any information matching your query in the database.";

  } catch (error: any) {
    console.error("Error processing text-to-SQL:", error);
    return "I'm sorry, I encountered an error while trying to query the database.";
  }
} 