import { Person, Connection } from '@/Entities/all';

export const CORE_THRESHOLD = 2;

export interface LayoutPerson extends Person {
  layoutType: 'core' | 'satellite';
  degree: number;
}

export function categorizeNodes(
  nodes: Person[],
  connections: Connection[],
  coreThreshold: number = CORE_THRESHOLD
): LayoutPerson[] {
  const degreeMap = new Map<string, number>();
  connections.forEach(conn => {
    degreeMap.set(conn.person_a_id, (degreeMap.get(conn.person_a_id) || 0) + 1);
    degreeMap.set(conn.person_b_id, (degreeMap.get(conn.person_b_id) || 0) + 1);
  });

  return nodes.map(node => {
    const degree = degreeMap.get(node.id) || 0;
    const layoutType: 'core' | 'satellite' = degree > coreThreshold ? 'core' : 'satellite';
    return { ...node, layoutType, degree };
  });
}
