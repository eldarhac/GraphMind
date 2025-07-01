import { InvokeLLM } from '../invoke-llm';
import { executeSql } from '../supabase-client';

export async function processTextToSqlQuery(query: string): Promise<string> {
    const tableSchema = `
      You have access to three tables:

      Table: participants2
      Relevant Columns:
      - id: TEXT (Primary Key, LinkedIn profile ID)
      - name: TEXT (The full name of the person)
      - current_company_name: TEXT
      - current_company_id: TEXT
      - education_details: TEXT
      - embedding: vector (IGNORE for SQL queries)

      Table: participant_experience
      Relevant Columns:
      - participant_id: TEXT (Foreign Key to participants2.id)
      - company: TEXT
      - title: TEXT
      - start_date: TEXT (e.g., "Feb 2020")
      - end_date: TEXT (e.g., "Jan 2024" or "Present")

      Table: participant_education
      Relevant Columns:
      - participant_id: TEXT (Foreign Key to participants2.id)
      - school: TEXT
      - field: TEXT (Field of study)
      - start_year: INT4 (e.g., 2021)
      - end_year: INT4 (e.g., 2024)

      **CRITICAL QUERYING RULES:**
      1.  **Joins are ESSENTIAL.** You MUST join tables to answer questions about experience or education.
          - Join \`participants2\` and \`participant_experience\` on \`participants2.id = participant_experience.participant_id\`.
          - Join \`participants2\` and \`participant_education\` on \`participants2.id = participant_education.participant_id\`.

      2.  **"Who worked at [Company]?"**:
          - SQL: SELECT p.name FROM participants2 p JOIN participant_experience pe ON p.id = pe.participant_id WHERE pe.company ILIKE '%[Company]%'
          - Example: SELECT p.name FROM participants2 p JOIN participant_experience pe ON p.id = pe.participant_id WHERE pe.company ILIKE '%Google%'

      3.  **"Who studied at [School]?"**:
          - SQL: SELECT p.name FROM participants2 p JOIN participant_education ped ON p.id = ped.participant_id WHERE ped.school ILIKE '%[School]%'
          - Example: SELECT p.name FROM participants2 p JOIN participant_education ped ON p.id = ped.participant_id WHERE ped.school ILIKE '%MIT%'

      4.  **"Where did [Person] work?"**:
          - SQL: SELECT pe.company, pe.title, pe.start_date, pe.end_date FROM participant_experience pe JOIN participants2 p ON pe.participant_id = p.id WHERE p.name ILIKE '%[Person Name]%'
          - Example: SELECT pe.company, pe.title, pe.start_date, pe.end_date FROM participant_experience pe JOIN participants2 p ON pe.participant_id = p.id WHERE p.name ILIKE '%Sandra Buchanan%'

      5.  **"Where did [Person] study?"**:
          - SQL: SELECT ped.school, ped.field, ped.start_year, ped.end_year FROM participant_education ped JOIN participants2 p ON ped.participant_id = p.id WHERE p.name ILIKE '%[Person Name]%'
          - Example: SELECT ped.school, ped.field, ped.start_year, ped.end_year FROM participant_education ped JOIN participants2 p ON ped.participant_id = p.id WHERE p.name ILIKE '%Sandra Buchanan%'

      **Your Task:**
      -   You MUST generate a single-line, valid PostgreSQL SELECT query based on the user's question.
      -   Use ILIKE for case-insensitive text matching.
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
        } else {
            // If no markdown, try to find the SELECT statement directly, ignoring preamble text.
            const selectIndex = sqlQuery.toUpperCase().indexOf('SELECT');
            if (selectIndex !== -1) {
                sqlQuery = sqlQuery.substring(selectIndex);
            }
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