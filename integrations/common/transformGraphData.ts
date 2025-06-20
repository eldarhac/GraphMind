import { Person, Connection } from '@/Entities/all';
import { RawGraphData } from '../supabase-client';

export interface GraphData {
  nodes: Person[];
  connections: Connection[];
}

function parseJsonArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function transformGraphData(raw: RawGraphData): GraphData {
  const avatarMap = new Map<string, string>();
  raw.avatars.forEach((row: any) => {
    if (row.person_id && row.avatar_url) {
      avatarMap.set(row.person_id.toString(), row.avatar_url);
    }
  });

  const nodes: Person[] = raw.participants.map((p: any) => ({
    id: p.id?.toString() || '',
    name: p.name || 'Unknown',
    title: p.current_project || p.title || '',
    institution: p.institution || p.current_institution || '',
    email: p.email || '',
    profile_picture_url: p.profile_picture_url || p.profile_image || '',
    linkedin_url: p['linkedin-url'] || '',
    expertise_areas: [],
    bio: p.bio || '',
    node_position: p.node_position || undefined,
    avatar: avatarMap.get(p.id?.toString() || '') || null,
  }));

  const connections: Connection[] = [];
  const seen = new Set<string>();

  raw.connections.forEach((row: any) => {
    const source = row.person_id?.toString() || row.id?.toString();
    if (!source) return;

    const work = parseJsonArray(row.work_connections);
    const school = parseJsonArray(row.school_connections);
    const publication = parseJsonArray(row.publication_connections);

    const addConn = (targets: string[], type: string) => {
      targets.forEach((target) => {
        const t = target.toString();
        const keyA = `${source}-${t}-${type}`;
        const keyB = `${t}-${source}-${type}`;
        if (!seen.has(keyA) && !seen.has(keyB)) {
          seen.add(keyA);
          seen.add(keyB);
          connections.push({
            id: keyA,
            person_a_id: source,
            person_b_id: t,
            connection_type: type,
            strength: 1,
            notes: '',
          });
        }
      });
    };

    addConn(work, 'work');
    addConn(school, 'education');
    addConn(publication, 'publication');
  });

  return { nodes, connections };
}
