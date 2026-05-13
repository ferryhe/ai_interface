export type ModuleId = string;

export interface ModuleDefinition {
  moduleId: ModuleId;
  displayName: string;
  description: string;
  category: "source" | "transform" | "index" | "agent";
  resultKinds: string[];
}

export const moduleRegistry: ModuleDefinition[] = [
  {
    moduleId: "web_listening",
    displayName: "Web Listening",
    description: "Monitor web pages, create snapshots, extract text, and detect changes.",
    category: "source",
    resultKinds: ["web_snapshot", "extracted_text", "change_event"],
  },
  {
    moduleId: "doc_to_md",
    displayName: "Doc to Markdown",
    description: "Convert source documents into Markdown with warnings and extracted assets.",
    category: "transform",
    resultKinds: ["markdown_document", "conversion_warning", "document_asset"],
  },
  {
    moduleId: "md_to_rag",
    displayName: "Markdown to RAG",
    description: "Chunk Markdown, prepare embeddings, and build RAG index records.",
    category: "index",
    resultKinds: ["rag_chunk", "embedding_metadata", "rag_index"],
  },
  {
    moduleId: "rag_to_agent",
    displayName: "RAG to Agent",
    description: "Generate agent configs, prompts, tools, and validation results.",
    category: "agent",
    resultKinds: ["agent_config", "agent_prompt", "agent_validation"],
  },
];

export function isKnownModuleId(moduleId: string): moduleId is ModuleId {
  return moduleRegistry.some((moduleDefinition) => moduleDefinition.moduleId === moduleId);
}
