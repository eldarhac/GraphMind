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

async function generateFinalAnswer(question: string, data: any[]): Promise<string> {
    const prompt = `
        You are a helpful assistant. You have been given the result of a SQL query and the original question.
        Your task is to synthesize a natural, user-friendly answer based on the data.
        The data is an array of objects.

        **Original Question:**
        "${question}"

        **Data from Database:**
        ${JSON.stringify(data, null, 2)}

        **Synthesized Answer:**
    `;

    try {
        const finalAnswer = await InvokeLLM({ prompt: prompt });
        return String(finalAnswer);
    } catch (error) {
        console.error("Error generating final answer:", error);
        return "I found the data, but I had trouble formulating a response.";
    }
}

export async function processTextToSqlQuery(query: string): Promise<string> {
    const tableSchema = `
      Table: participants2
      Columns:
      - name: TEXT (The full name of the person)
      - experience: TEXT (A string which can be NULL, empty, or contain a JSON array of job experiences, e.g., '[{"company": "Google", "title": "Software Engineer"}]')

      To query the 'experience' column, you MUST first cast it to JSONB.
      You MUST also filter out NULL or empty strings before casting to avoid errors.
      For example, to find people who worked at a company, you MUST use a query structured like this:
      SELECT name FROM participants2 WHERE experience IS NOT NULL AND experience != '' AND jsonb_path_exists(experience::jsonb, '$[*] ? (@.company like_regex "some-company" flag "i")')
    `;

    const prompt = `
        You are an expert SQL generator. Your task is to convert a natural language query into a valid SQL query for a PostgreSQL database.
        You MUST use the provided table schema and MUST NOT invent table or column names.
        The query should be a single-line SQL statement.

        **Schema & Instructions:**
        ${tableSchema}

        **User Query:**
        "${query}"

        **SQL Query:**
    `;

    try {
        const rawResponse = await InvokeLLM({ prompt: prompt });

        let sqlQuery = String(rawResponse);

        // The LLM often wraps the SQL in a markdown block. Let's extract it.
        // This regex handles both ```sql and ``` blocks.
        const match = sqlQuery.match(/```(?:sql)?\n([\s\S]*?)\n```/);
        if (match && match[1]) {
            sqlQuery = match[1];
        }

        // Before executing, perform a basic safety check.
        const normalizedQuery = sqlQuery.trim().toUpperCase();
        if (!normalizedQuery.startsWith('SELECT')) {
            return "I can only process SELECT queries for safety reasons.";
        }

        const finalQuery = sqlQuery.trim().replace(/;$/, '');
        const results = await executeSql(finalQuery);

        if (results.error) {
            return `Database error: ${results.error.message}. The failing query was: \`${finalQuery}\``;
        }

        if (!results.data || results.data.length === 0) {
            return "I could not find any information matching your query in the database.";
        }

        // Now, generate a final, user-friendly answer.
        const finalAnswer = await generateFinalAnswer(query, results.data);
        return finalAnswer;
    } catch (error: any) {
        console.error('Database error:', error.message);
        const failingQuery = error.metadata?.query || 'the generated SQL';
        return `Database error: ${error.message}. The failing query was: \`${failingQuery}\``;
    }
} 