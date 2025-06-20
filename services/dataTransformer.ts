import { Person, Connection } from '@/Entities/all';

export function transformSupabaseData(participants: any[], connections: any[], avatars: any[]) {
  const avatarMap = new Map(avatars.map((a: any) => [a.person_id?.toString() || a.id?.toString(), a.avatar_url || a.avatar]));

  const nodes: Person[] = participants.map((p: any) => ({
    ...p,
    id: p.id?.toString() || '',
    name: p.name,
    title: p.current_project || p.title || '',
    company: p.company,
    institution: p.institution || p.current_institution,
    email: p.email,
    profile_picture_url: p.profile_picture_url || p.profile_image || '',
    linkedin_url: p['linkedin-url'] || '',
    expertise_areas: [],
    bio: p.bio,
    node_position: p.node_position,
    avatar: avatarMap.get(p.id?.toString() || '') || null,
  }));

  const seen = new Set<string>();
  const processedConnections: Connection[] = [];

  connections.forEach((conn: any) => {
    const source = conn.person_id?.toString() || conn.id?.toString();
    if (!source) return;

    const work = safeParse(conn.work_connections);
    const school = safeParse(conn.school_connections);
    const publication = safeParse(conn.publication_connections);

    const add = (targets: string[], type: string) => {
      targets.forEach((target: string) => {
        const t = target.toString();
        const linkId = [source, t, type].sort().join('-');
        if (!seen.has(linkId)) {
          seen.add(linkId);
          processedConnections.push({
            id: linkId,
            person_a_id: source,
            person_b_id: t,
            connection_type: type,
            strength: 1,
            notes: '',
          });
        }
      });
    };

    add(work, 'work');
    add(school, 'education');
    add(publication, 'publication');
  });

  return { nodes, connections: processedConnections };
}

function safeParse(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(v => v.toString());
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map((v: any) => v.toString()) : [];
    } catch {
      return [];
    }
  }
  return [];
}
