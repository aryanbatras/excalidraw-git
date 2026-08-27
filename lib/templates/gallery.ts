export type TemplateCategory =
  | "system-design"
  | "cloud-arch"
  | "uml-er"
  | "wireframes"
  | "mind-maps"
  | "workflows"
  | "algorithms"
  | "network";

export type GalleryTemplate = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  thumbnail: string;
  file: string;
};

export const CATEGORY_META: Record<TemplateCategory, { label: string }> = {
  "system-design": { label: "System Design" },
  "cloud-arch": { label: "Cloud Architecture" },
  "uml-er": { label: "UML & ER" },
  wireframes: { label: "Wireframes" },
  "mind-maps": { label: "Mind Maps" },
  workflows: { label: "Workflows" },
  algorithms: { label: "Algorithms" },
  network: { label: "Network" },
};

const RAW_TEMPLATES = [
  // System Design
  {
    id: "system-design/load-balancer",
    name: "Load Balancer",
    description: "Client → LB → services with health checks and the layer model",
    category: "system-design",
    tags: ["cloud", "networking", "scalability"],
    file: "/templates/system-design/load-balancer.excalidraw",
  },
  {
    id: "system-design/url-shortener",
    name: "URL Shortener",
    description: "TinyURL-style: hashing, base62, collision handling, redirect",
    category: "system-design",
    tags: ["url-shortener", "hashing", "api"],
    file: "/templates/system-design/url-shortener.excalidraw",
  },
  {
    id: "system-design/web-crawler",
    name: "Web Crawler",
    description: "Seed URLs, frontier, politeness, deduplication, content store",
    category: "system-design",
    tags: ["crawling", "search", "scalability"],
    file: "/templates/system-design/web-crawler.excalidraw",
  },
  {
    id: "system-design/chat-messaging",
    name: "Chat Messaging",
    description: "1:1 and group chat: gateways, presence, message flow, storage",
    category: "system-design",
    tags: ["chat", "websockets", "realtime"],
    file: "/templates/system-design/chat-messaging.excalidraw",
  },
  {
    id: "system-design/redis-cache",
    name: "Redis Cache",
    description: "Data structures, eviction, persistence and caching topologies",
    category: "system-design",
    tags: ["cache", "redis", "storage"],
    file: "/templates/system-design/redis-cache.excalidraw",
  },
  {
    id: "system-design/rate-limiter",
    name: "Rate Limiter",
    description: "Token bucket rate limiting with sliding window",
    category: "system-design",
    tags: ["api", "security", "throttling"],
    file: "/templates/system-design/rate-limiter.excalidraw",
  },
  {
    id: "system-design/pub-sub",
    name: "Pub / Sub Messaging",
    description: "Publish-subscribe communication pattern",
    category: "system-design",
    tags: ["messaging", "async", "events"],
    file: "/templates/system-design/pub-sub.excalidraw",
  },
  {
    id: "system-design/kafka",
    name: "Kafka Topology",
    description: "Kafka brokers, topics, producers and consumers",
    category: "system-design",
    tags: ["streaming", "events", "data-pipeline"],
    file: "/templates/system-design/kafka.excalidraw",
  },
  {
    id: "system-design/cqrs",
    name: "CQRS Pattern",
    description: "Command Query Responsibility Segregation with event sync",
    category: "system-design",
    tags: ["architecture", "ddd", "events"],
    file: "/templates/system-design/cqrs.excalidraw",
  },

  // Cloud Architecture
  {
    id: "cloud-arch/aws-3-tier",
    name: "AWS 3-Tier Architecture",
    description: "VPC, public/private subnets, ALB, EC2, RDS",
    category: "cloud-arch",
    tags: ["aws", "vpc", "web-app"],
    file: "/templates/cloud-arch/aws-3-tier.excalidraw",
  },
  {
    id: "cloud-arch/microservices",
    name: "Microservices",
    description: "API gateway fan-out to independent services",
    category: "cloud-arch",
    tags: ["architecture", "services", "gateway"],
    file: "/templates/cloud-arch/microservices.excalidraw",
  },
  {
    id: "cloud-arch/serverless-api",
    name: "Serverless API",
    description: "API Gateway → Lambda → DynamoDB",
    category: "cloud-arch",
    tags: ["aws", "serverless", "api"],
    file: "/templates/cloud-arch/serverless-api.excalidraw",
  },

  // UML & ER
  {
    id: "uml-er/class-diagram",
    name: "Strategy Pattern",
    description: "Strategy design pattern class diagram",
    category: "uml-er",
    tags: ["design-pattern", "oop", "class"],
    file: "/templates/uml-er/class-diagram.excalidraw",
  },
  {
    id: "uml-er/factory-pattern",
    name: "Factory Pattern",
    description: "Factory design pattern class hierarchy",
    category: "uml-er",
    tags: ["design-pattern", "oop", "class"],
    file: "/templates/uml-er/factory-pattern-class.excalidraw",
  },
  {
    id: "uml-er/database-strategies",
    name: "Database Strategies",
    description: "Centralized, replication, partition and consistency strategies",
    category: "uml-er",
    tags: ["database", "sharding", "replication"],
    file: "/templates/uml-er/database-strategies.excalidraw",
  },
  {
    id: "uml-er/er-diagram",
    name: "E-Commerce ERD",
    description: "Users, Orders, Products entity-relationship diagram",
    category: "uml-er",
    tags: ["database", "entity", "relationship"],
    file: "/templates/uml-er/er-diagram.excalidraw",
  },
  {
    id: "uml-er/sequence-diagram",
    name: "Sequence Diagram",
    description: "Client → server → database interaction timeline",
    category: "uml-er",
    tags: ["uml", "sequence", "timeline"],
    file: "/templates/uml-er/sequence-diagram.excalidraw",
  },

  // Wireframes
  {
    id: "wireframes/web-layout",
    name: "Landing Page",
    description: "Hero, features, CTA, and footer wireframe",
    category: "wireframes",
    tags: ["web", "landing", "marketing"],
    file: "/templates/wireframes/web-layout-wireframe.excalidraw",
  },
  {
    id: "wireframes/mobile-app",
    name: "Mobile App",
    description: "Phone shell, hero, CTA stack, and content rows",
    category: "wireframes",
    tags: ["mobile", "app", "hero"],
    file: "/templates/wireframes/mobile-app.excalidraw",
  },
  {
    id: "wireframes/dashboard",
    name: "Dashboard",
    description: "Sidebar, stat cards, chart, and activity panel",
    category: "wireframes",
    tags: ["dashboard", "analytics", "ui"],
    file: "/templates/wireframes/dashboard.excalidraw",
  },

  // Mind Maps
  {
    id: "mind-maps/brainstorm",
    name: "Brainstorm",
    description: "Radial map: requirements to wrap-up for a design from scratch",
    category: "mind-maps",
    tags: ["ideation", "design", "structure"],
    file: "/templates/mind-maps/brainstorm.excalidraw",
  },
  {
    id: "mind-maps/project-planning",
    name: "Interview Prep Plan",
    description: "Radial study map: algorithms, system design, behavioral, mock mocks",
    category: "mind-maps",
    tags: ["interview", "plan", "study"],
    file: "/templates/mind-maps/project-planning.excalidraw",
  },

  // Workflows
  {
    id: "workflows/ci-cd-pipeline",
    name: "CI/CD Pipeline",
    description: "Commit → Lint → Test → Build → Deploy flow",
    category: "workflows",
    tags: ["devops", "ci-cd", "automation"],
    file: "/templates/workflows/ci-cd-pipeline.excalidraw",
  },
  {
    id: "workflows/approval-flow",
    name: "Approval Flow",
    description: "Expense approval with auto-approve and reject branches",
    category: "workflows",
    tags: ["business", "process", "approval"],
    file: "/templates/workflows/approval-flow.excalidraw",
  },
  {
    id: "workflows/data-pipeline",
    name: "Data Pipeline",
    description: "Ingest → transform → store → serve with a retry loop",
    category: "workflows",
    tags: ["data", "etl", "pipeline"],
    file: "/templates/workflows/data-pipeline.excalidraw",
  },
  {
    id: "workflows/job-scheduler",
    name: "Job Scheduler",
    description: "Airflow/Temporal-style: DAGs, workers, queues, retries, monitoring",
    category: "workflows",
    tags: ["airflow", "temporal", "scheduling"],
    file: "/templates/workflows/job-scheduler.excalidraw",
  },
  {
    id: "workflows/ad-click-aggregator",
    name: "Ad Click Aggregator",
    description: "Click ingestion, aggregation windows, storage and querying",
    category: "workflows",
    tags: ["analytics", "streaming", "aggregation"],
    file: "/templates/workflows/ad-click-aggregator.excalidraw",
  },
  {
    id: "workflows/log-ingestion",
    name: "Log Ingestion",
    description: "Splunk/Datadog-style: agents, buffers, indexing and dashboards",
    category: "workflows",
    tags: ["observability", "logging", "pipeline"],
    file: "/templates/workflows/log-ingestion.excalidraw",
  },

  // Algorithms
  {
    id: "algorithms/binary-tree",
    name: "Binary Tree",
    description: "Binary tree with connected node elements",
    category: "algorithms",
    tags: ["data-structure", "tree", "traversal"],
    file: "/templates/algorithms/binary-tree.excalidraw",
  },
  {
    id: "algorithms/binary-search-tree",
    name: "Binary Search Tree",
    description: "BST with ordered node hierarchy",
    category: "algorithms",
    tags: ["data-structure", "tree", "search"],
    file: "/templates/algorithms/binary-search-tree.excalidraw",
  },
  {
    id: "algorithms/hash-table",
    name: "Hash Table",
    description: "Key → value bucket mapping diagram",
    category: "algorithms",
    tags: ["data-structure", "hashing", "lookup"],
    file: "/templates/algorithms/hash-table.excalidraw",
  },
  {
    id: "algorithms/graph-traversal",
    name: "Graph Traversal",
    description: "Graph with BFS/DFS traversal edges",
    category: "algorithms",
    tags: ["data-structure", "graph", "traversal"],
    file: "/templates/algorithms/graph-traversal.excalidraw",
  },
  {
    id: "algorithms/data-structures",
    name: "Data Structures Overview",
    description: "Common data structures comparison",
    category: "algorithms",
    tags: ["data-structure", "overview", "comparison"],
    file: "/templates/algorithms/data-structures.excalidraw",
  },
  {
    id: "algorithms/advanced-data-structures",
    name: "Advanced Data Structures",
    description: "HyperLogLog, Count-Min Sketch, Skip Lists, Merkle Tree",
    category: "algorithms",
    tags: ["probabilistic", "sketches", "interview"],
    file: "/templates/algorithms/advanced-data-structures.excalidraw",
  },

  // Network
  {
    id: "network/aws-networking",
    name: "AWS Networking",
    description: "VPC, subnets, NAT gateway, and internet gateway layout",
    category: "network",
    tags: ["aws", "vpc", "networking"],
    file: "/templates/network/aws-networking.excalidraw",
  },
  {
    id: "network/datacenter-toplogy",
    name: "Datacenter Topology",
    description: "Core / aggregation switches with per-rack access",
    category: "network",
    tags: ["datacenter", "topology", "switching"],
    file: "/templates/network/datacenter-topology.excalidraw",
  },
  {
    id: "network/home-office",
    name: "Home Office",
    description: "Modem → router to wired and Wi-Fi devices",
    category: "network",
    tags: ["home", "wifi", "router"],
    file: "/templates/network/home-office.excalidraw",
  },
] as const satisfies readonly Omit<GalleryTemplate, "thumbnail">[];

export const GALLERY_TEMPLATES: GalleryTemplate[] = RAW_TEMPLATES.map((t) => ({
  ...t,
  // 400×300 WebP previews live under _thumbs/<category>/<slug>.webp (generated
  // by scripts/generate-thumbs.mjs). Slug = the template file's basename.
  thumbnail: t.file.replace(/^\/templates\//, "/templates/_thumbs/").replace(/\.excalidraw$/, ".webp"),
}));
