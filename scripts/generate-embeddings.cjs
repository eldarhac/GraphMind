const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin access
const openAIApiKey = process.env.VITE_OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openAIApiKey) {
  throw new Error("Missing required environment variables. Ensure VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY, and VITE_OPENAI_API_KEY are in your .env file.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openAIApiKey });

async function generateAndStoreEmbeddings() {
  console.log("Fetching participants from the database...");
  
  // Fetch all participants
  const { data: participants, error: fetchError } = await supabase
    .from('participants2')
    .select('id, name, position, experience, publications, education');

  if (fetchError) {
    console.error("Error fetching participants:", fetchError);
    return;
  }

  if (!participants || participants.length === 0) {
    console.log("No participants found to process.");
    return;
  }

  console.log(`Found ${participants.length} participants. Generating embeddings...`);

  for (const participant of participants) {
    // 1. Create a descriptive document for the participant
    const document = `
      Name: ${participant.name || ''}
      Position: ${participant.position || ''}
      Experience: ${participant.experience || ''}
      Education: ${JSON.stringify(participant.education) || ''}
      Publications: ${participant.publications || ''}
    `.trim();

    // 2. Generate embedding for the document
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: document,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // 3. Store the embedding in the database
      const { error: updateError } = await supabase
        .from('participants2')
        .update({ embedding })
        .eq('id', participant.id);
      
      if (updateError) {
        console.error(`Error updating participant ${participant.id}:`, updateError.message);
      } else {
        console.log(`Successfully generated and stored embedding for ${participant.name} (${participant.id})`);
      }
    } catch (e) {
        console.error(`Failed to process embedding for ${participant.name}: ${e.message}`);
    }
  }

  console.log("Embedding generation complete.");
}

generateAndStoreEmbeddings(); 