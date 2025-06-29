import PersonData from './Person.json?raw';
import ConnectionData from './Connection.json?raw';
import { supabaseClient } from '@/integrations/supabase-client';

export interface Person {
  id: string;
  name: string;
  title: string;
  company?: string;
  institution?: string;
  email?: string;
  profile_picture_url: string;
  avatar?: string;
  linkedin_url: string;
  expertise_areas: string[];
  interests?: string[];
  bio?: string;
  influence_score?: number;
  node_position?: { x: number; y: number; };
  /**
   * Layout type for hybrid graph rendering. Nodes with many connections
   * are marked as 'core' while others are 'satellite'.
   */
  layoutType?: 'core' | 'satellite';
  /** Number of connections used when categorizing layout type */
  degree?: number;
  experience?: any[];
  education?: any[];
}

export interface Connection {
  id: string;
  person_a_id: string;
  person_b_id: string;
  connection_type: string;
  strength: number;
  notes: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  query_type?: string;
  processing_time?: number;
}

export interface IntentData {
    intent: 'find_path' | 'rank_nodes' | 'recommend_person' | 'find_similar' | 'find_bridge' | 'select_node' | 'general';
    entities: string[];
    parameters: {
        target_person?: string;
        topic?: string;
        limit?: number;
        connection_type?: string;
    };
    confidence?: number;
}

// Specific result types for each graph query function
export type FindPathResult = {
    path: string[];
    distance: number;
    nodes: Person[];
    connections: Connection[];
    message: string;
};
export type RankNodesResult = { ranked_nodes: Person[]; topic: string; total_analyzed: number; };
export type RecommendPersonsResult = { recommendations: Person[]; reasoning:string; };
export type FindSimilarResult = { similar: Person[]; target: Person | undefined; };
export type FindBridgeResult = { bridges: Person[]; };
export type SelectNodeResult = { nodes: Person[] };
export type GeneralResult = { nodes: [], connections: [], insights: [] };

// Union of all possible graph query results
export type GraphResults = FindPathResult | RankNodesResult | RecommendPersonsResult | FindSimilarResult | FindBridgeResult | SelectNodeResult | GeneralResult;

class BaseModel {
    static list(): Promise<any[]> {
        // @ts-ignore
        return Promise.resolve(JSON.parse(this.data));
    }

    static update(id: string, data: any): Promise<void> {
        console.log(`Updating ${this.name} with id ${id} with data:`, data);
        return Promise.resolve();
    }

    static create(data: any): Promise<void> {
        console.log(`Creating new ${this.name} with data:`, data);
        return Promise.resolve();
    }
}

export class Person extends BaseModel {
    // @ts-ignore
    static data = PersonData;
    static async list(): Promise<Person[]> {
        // This method now ONLY fetches from Supabase.
        // If this fails, it will fail loudly.
        const data = await supabaseClient.getAllParticipants();
        
        if (!data) {
            console.error('Failed to fetch any data from Supabase. The returned value was null.');
            return []; // Return an empty array to avoid crashes
        }
        
        if (data.length === 0) {
            console.warn('Supabase returned 0 participants. Is the "participants2" table empty or is RLS preventing access?');
        }
        
        // Transform Supabase data to match Person interface
        const transformedData = data.map((participant: any) => ({
            id: participant.id?.toString() || Math.random().toString(),
            name: participant.name || 'Unknown',
            title: participant.current_project || 'No title available',
            institution: 'Unknown Institution', // Add if available in your schema
            email: participant.email || '',
            profile_picture_url: 'https://randomuser.me/api/portraits/men/1.jpg', // Default image
            linkedin_url: participant['linkedin-url'] || '#',
            expertise_areas: [], // You can extract this from bio or other fields if needed
            bio: participant.bio || '',
            node_position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 }
        }));
        
        console.log(`Loaded ${transformedData.length} participants from Supabase`);
        return transformedData;
    }
}

export class Connection extends BaseModel {
    // @ts-ignore
    static data = ConnectionData;
    static list(): Promise<Connection[]> {
        return super.list();
    }
}

export class ChatMessage extends BaseModel {
    static create(data: ChatMessage): Promise<void> {
        return super.create(data);
    }
} 