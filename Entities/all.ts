import PersonData from './Person.json?raw';
import ConnectionData from './Connection.json?raw';

export interface Person {
  id: string;
  name: string;
  title: string;
  company?: string;
  institution?: string;
  profile_picture_url: string;
  linkedin_url: string;
  expertise_areas: string[];
  interests?: string[];
  influence_score?: number;
  node_position?: { x: number; y: number; };
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
    intent: 'find_path' | 'rank_nodes' | 'recommend_person' | 'find_similar' | 'find_bridge' | 'general';
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
export type GeneralResult = { nodes: [], connections: [], insights: [] };

// Union of all possible graph query results
export type GraphResults = FindPathResult | RankNodesResult | RecommendPersonsResult | FindSimilarResult | FindBridgeResult | GeneralResult;

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
    static list(): Promise<Person[]> {
        return super.list();
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