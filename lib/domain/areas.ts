export const AREAS = [
  { id: "react-internals", label: "React internals" },
  { id: "nextjs", label: "Next.js" },
  { id: "node-runtime", label: "Node runtime" },
  { id: "advanced-typescript", label: "Advanced TypeScript" },
  { id: "postgres-databases", label: "Postgres & databases" },
  { id: "graphql-api-design", label: "GraphQL & API design" },
  { id: "testing-strategy", label: "Testing strategy" },
  { id: "web-performance", label: "Web performance" },
  { id: "security", label: "Security" },
  { id: "system-design", label: "System design" },
  { id: "architecture-patterns", label: "Architecture patterns" },
  { id: "distributed-systems", label: "Distributed systems" },
  { id: "cicd-devops", label: "CI/CD & DevOps" },
  { id: "observability", label: "Observability" },
  { id: "cs-fundamentals", label: "CS fundamentals" },
  { id: "engineering-leadership", label: "Engineering leadership & practices" },
] as const;

export type AreaId = (typeof AREAS)[number]["id"];

export const AREA_IDS: AreaId[] = AREAS.map((area) => area.id);
