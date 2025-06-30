import { InvokeLLM } from '../invoke-llm';
import { executeSql } from '../supabase-client';

export async function processTextToSqlQuery(query: string): Promise<string> {
    const tableSchema = `
      Table: participants2
      Columns for Querying:
      - name: TEXT (The full name of the person)
      - experience: JSONB (Array of past jobs, each with a "company" key. e.g., [{"company": "Google", "title": "Engineer"}])
      - education: JSONB (Array of educational institutions, each with a "school" key. e.g., [{"school": "MIT", "degree": "BS"}])

      **CRITICAL QUERYING RULES:**
      1.  **"Who worked at [Company]?"**: Find people whose 'experience' contains the company.
          - Use: \`jsonb_path_exists(experience, '$[*] ? (@.company like_regex "[Company]" flag "i")')\`
          - Example: SELECT name FROM participants2 WHERE jsonb_path_exists(experience, '$[*] ? (@.company like_regex "Google" flag "i")')

      2.  **"Who studied at [School]?"**: Find people whose 'education' contains the school.
          - Use: \`jsonb_path_exists(education, '$[*] ? (@.school like_regex "[School]" flag "i")')\`
          - Example: SELECT name FROM participants2 WHERE jsonb_path_exists(education, '$[*] ? (@.school like_regex "MIT" flag "i")')

      3.  **"Where did [Person] study/work?"**: Retrieve the 'education' or 'experience' data for a specific person.
          - Use: \`ILIKE\` on the 'name' column.
          - Example: SELECT education FROM participants2 WHERE name ILIKE '%Sandra Buchanan%'

      **Your Task:**
      -   You MUST generate a single-line, valid PostgreSQL SELECT query based on the user's question.
      -   Do not use semicolons or newlines.
      -   Output only the raw SQL query.
    `;

    const prompt = `
        You are an expert SQL generator. Your task is to convert the following natural language query into a single-line PostgreSQL query.
        You MUST follow the provided schema and querying rules precisely.

        **Schema & Rules:**
        ${tableSchema}

        **User Query:**
        "${query}"

        **SQL Query:**
    `;

    try {
        const rawResponse = await InvokeLLM({ prompt });

        let sqlQuery = String(rawResponse);

        // The LLM often wraps the SQL in a markdown block. Let's extract it.
        const match = sqlQuery.match(/```(?:sql)?\n([\s\S]*?)\n```/);
        if (match && match[1]) {
            sqlQuery = match[1].trim();
        }

        // Before executing, perform a basic safety check.
        const normalizedQuery = sqlQuery.trim().toUpperCase();
        if (!normalizedQuery.startsWith('SELECT')) {
            return "I can only process SELECT queries for safety reasons.";
        }

        const finalQuery = sqlQuery.replace(/;$/, '');
        const results = await executeSql(finalQuery);

        if (results.error) {
            console.error(`Database error for query: ${finalQuery}`, results.error);
            return `I encountered a database error. The failing query was: \`${finalQuery}\``;
        }

        if (!results.data || results.data.length === 0) {
            return "I could not find any information matching your query in the database.";
        }

        // Now, generate a final, user-friendly answer.
        const finalAnswer = await generateFinalAnswer(query, results.data);
        return finalAnswer;
    } catch (error: any) {
        console.error('Error processing text-to-SQL:', error);
        const failingQuery = error.metadata?.query || 'the generated SQL';
        return `An error occurred. The failing query was: \`${failingQuery}\``;
    }
}

async function generateFinalAnswer(question: string, data: any[]): Promise<string> {
    const prompt = `
        You are a helpful assistant. Based on the user's question and the retrieved database data, provide a concise, natural language answer.
        If the data is a complex JSON object, summarize it clearly. For example, if you get a JSON object with a list of schools, list them out.

        **Original Question:**
        "${question}"

        **Data from Database:**
        ${JSON.stringify(data, null, 2)}

        **Synthesized Answer:**
    `;

    try {
        const finalAnswer = await InvokeLLM({ prompt });
        return String(finalAnswer);
    } catch (error) {
        console.error("Error generating final answer:", error);
        return "I found the data, but I had trouble formulating a response.";
    }
} 