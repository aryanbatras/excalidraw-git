export type LibraryMeta = {
  id: string;
  name: string;
  description: string;
  file: string;
  icon: string;
  items: number;
  category: "icons" | "diagrams" | "cloud" | "infrastructure";
};

export const LIBRARIES: LibraryMeta[] = [
  {
    id: "software-logos",
    name: "Software Logos",
    description: "Docker, React, Vue, and other software logos",
    file: "/libraries/software-logos.excalidrawlib",
    icon: "📦",
    items: 18,
    category: "icons",
  },
  {
    id: "aws-architecture",
    name: "AWS Architecture Icons",
    description: "Full set of AWS service architecture icons",
    file: "/libraries/aws-architecture.excalidrawlib",
    icon: "☁️",
    items: 249,
    category: "cloud",
  },
  {
    id: "devops-icons",
    name: "DevOps Icons",
    description: "CI/CD, infrastructure, and DevOps icons",
    file: "/libraries/devops-icons.excalidrawlib",
    icon: "🔧",
    items: 29,
    category: "infrastructure",
  },
  {
    id: "uml-er",
    name: "UML & ER Diagrams",
    description: "UML and entity-relationship diagram shapes",
    file: "/libraries/uml-er.excalidrawlib",
    icon: "📊",
    items: 21,
    category: "diagrams",
  },
  {
    id: "network-topology",
    name: "Network Topology Icons",
    description: "Network and infrastructure topology icons",
    file: "/libraries/network-topology.excalidrawlib",
    icon: "🌐",
    items: 10,
    category: "infrastructure",
  },
  {
    id: "aws-serverless",
    name: "AWS Serverless Icons",
    description: "Lambda, API Gateway, and serverless icons",
    file: "/libraries/aws-serverless.excalidrawlib",
    icon: "⚡",
    items: 24,
    category: "cloud",
  },
];
