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
  file: string;
};

export const CATEGORY_META: Record<TemplateCategory, { label: string; icon: string }> = {
  "system-design": { label: "System Design", icon: "🏗️" },
  "cloud-arch": { label: "Cloud Architecture", icon: "☁️" },
  "uml-er": { label: "UML & ER", icon: "📊" },
  wireframes: { label: "Wireframes", icon: "📱" },
  "mind-maps": { label: "Mind Maps", icon: "🧠" },
  workflows: { label: "Workflows", icon: "⚙️" },
  algorithms: { label: "Algorithms", icon: "🔗" },
  network: { label: "Network", icon: "🌐" },
};

export const GALLERY_TEMPLATES: GalleryTemplate[] = [
  // System Design
  {
    id: "system-design/load-balancer",
    name: "Load Balancer",
    description: "Client → Load Balancer → application servers flow",
    category: "system-design",
    tags: ["cloud", "networking", "scalability"],
    file: "/templates/system-design/load-balancer.excalidraw",
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
    description: "SQL vs NoSQL vs NewSQL comparison diagram",
    category: "uml-er",
    tags: ["database", "architecture", "comparison"],
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

  // Wireframes
  {
    id: "wireframes/web-layout",
    name: "Landing Page",
    description: "Hero, features, CTA, and footer wireframe",
    category: "wireframes",
    tags: ["web", "landing", "marketing"],
    file: "/templates/wireframes/web-layout-wireframe.excalidraw",
  },

  // Mind Maps
  {
    id: "mind-maps/brainstorm",
    name: "Brainstorm",
    description: "Central idea with branching topics and sub-ideas",
    category: "mind-maps",
    tags: ["ideation", "creativity", "brainstorm"],
    file: "/templates/mind-maps/brainstorm.excalidraw",
  },
  {
    id: "mind-maps/project-planning",
    name: "Project Planning",
    description: "Scope, schedule, resources, and risk breakdown",
    category: "mind-maps",
    tags: ["planning", "project", "management"],
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

  // Network
  {
    id: "network/aws-networking",
    name: "AWS Networking",
    description: "VPC, subnets, NAT gateway, and internet gateway layout",
    category: "network",
    tags: ["aws", "vpc", "networking"],
    file: "/templates/network/aws-networking.excalidraw",
  },
];
