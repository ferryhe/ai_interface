ALTER TYPE agent_provider ADD VALUE IF NOT EXISTS 'openai_compatible';

ALTER TYPE agent_endpoint ADD VALUE IF NOT EXISTS 'chat_completions';
ALTER TYPE agent_endpoint ADD VALUE IF NOT EXISTS 'anthropic_messages';
ALTER TYPE agent_endpoint ADD VALUE IF NOT EXISTS 'ollama_chat';
ALTER TYPE agent_endpoint ADD VALUE IF NOT EXISTS 'deterministic';
