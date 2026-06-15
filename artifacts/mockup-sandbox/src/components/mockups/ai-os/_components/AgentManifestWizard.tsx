import { useMemo, useState } from "react";
import { FilePlus2, Save, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentManifestPreview,
  AgentPlannerMode,
  WorkbenchSkillOption,
} from "../_shared/types";

type WizardSaveState = "idle" | "saving" | "saved" | "disabled" | "failed";

interface WizardDraft {
  name: string;
  description: string;
  instructions: string;
  skillIds: string[];
  plannerMode: AgentPlannerMode;
  approvalRequired: boolean;
  canUseNetwork: boolean;
  canWriteDatabase: boolean;
}

const defaultDraft: WizardDraft = {
  name: "Review Agent",
  description: "Custom agent created from the workbench.",
  instructions:
    "Use the selected skills to complete the user's request while preserving intermediate artifacts for review.",
  skillIds: ["md_to_rag", "rag_to_agent"],
  plannerMode: "linear",
  approvalRequired: false,
  canUseNetwork: false,
  canWriteDatabase: true,
};

function agentIdFromName(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (/^[a-z][a-z0-9_]{1,63}$/.test(normalized)) return normalized;
  return "custom_agent";
}

function quoted(value: string): string {
  return value.replace(/"/g, '\\"');
}

function yamlList(values: string[], indent: string): string {
  if (values.length === 0) return `${indent}[]`;
  return values.map((value) => `${indent}- ${value}`).join("\n");
}

function generateYaml(agentId: string, draft: WizardDraft): string {
  const skillYaml =
    draft.skillIds.length > 0
      ? draft.skillIds
          .map((skillId) => `  - skillId: ${skillId}\n    required: false`)
          .join("\n")
      : "  []";

  return [
    `agentId: ${agentId}`,
    `name: "${quoted(draft.name)}"`,
    `description: "${quoted(draft.description)}"`,
    "source: custom",
    "instructions: |",
    ...draft.instructions.split("\n").map((line) => `  ${line}`),
    "skills:",
    skillYaml,
    "planner:",
    `  mode: ${draft.plannerMode}`,
    "  failureStrategy: fail_fast",
    "permissions:",
    `  approvalRequired: ${draft.approvalRequired}`,
    `  canUseNetwork: ${draft.canUseNetwork}`,
    `  canWriteDatabase: ${draft.canWriteDatabase}`,
    "memory:",
    "  promotionMode: run_summary",
    "handoffs:",
    yamlList([], "  "),
    "tests:",
    yamlList([], "  "),
  ].join("\n");
}

function toManifest(agentId: string, draft: WizardDraft): AgentManifestPreview {
  return {
    agentId,
    name: draft.name.trim() || "Custom Agent",
    description: draft.description.trim() || "Custom agent created from the workbench.",
    source: "custom",
    instructions: draft.instructions,
    skills: draft.skillIds.map((skillId) => ({ skillId, required: false })),
    planner: {
      mode: draft.plannerMode,
      failureStrategy: "fail_fast",
    },
    permissions: {
      approvalRequired: draft.approvalRequired,
      canUseNetwork: draft.canUseNetwork,
      canWriteDatabase: draft.canWriteDatabase,
    },
    memory: {
      promotionMode: "run_summary",
    },
    handoffs: [],
    tests: [],
  };
}

export function AgentManifestWizard({
  skills,
  onCreated,
}: {
  skills: WorkbenchSkillOption[];
  onCreated: (agent: AgentManifestPreview) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<WizardDraft>(defaultDraft);
  const [saveState, setSaveState] = useState<WizardSaveState>("idle");
  const agentId = useMemo(() => agentIdFromName(draft.name), [draft.name]);
  const yaml = useMemo(() => generateYaml(agentId, draft), [agentId, draft]);

  function updateDraft(patch: Partial<WizardDraft>): void {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveState("idle");
  }

  function toggleSkill(skillId: string): void {
    setDraft((current) => {
      const nextSkillIds = current.skillIds.includes(skillId)
        ? current.skillIds.filter((item) => item !== skillId)
        : [...current.skillIds, skillId];
      return { ...current, skillIds: nextSkillIds };
    });
    setSaveState("idle");
  }

  async function saveManifest(): Promise<void> {
    const manifest = toManifest(agentId, draft);
    setSaveState("saving");

    try {
      const response = await fetch("/api/agent-manifests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          manifest,
          overwrite: false,
        }),
      });

      if (response.status === 403) {
        setSaveState("disabled");
        onCreated(manifest);
        return;
      }
      if (!response.ok) {
        throw new Error(`Manifest API returned ${response.status}`);
      }

      const data = (await response.json()) as { manifest?: AgentManifestPreview };
      onCreated(data.manifest ?? manifest);
      setSaveState("saved");
    } catch {
      onCreated(manifest);
      setSaveState("failed");
    }
  }

  const saveLabel =
    saveState === "saving"
      ? t("agentFirst.workbench.writing")
      : saveState === "disabled"
        ? t("agentFirst.workbench.writeDisabled")
        : saveState === "saved"
          ? t("agentFirst.workbench.written")
          : t("agentFirst.workbench.create");
  const statusText =
    saveState === "disabled"
      ? t("agentFirst.workbench.localWriteModeDisabled")
      : saveState === "failed"
        ? t("agentFirst.workbench.localPreviewOnly")
        : saveState === "saved"
          ? t("agentFirst.workbench.manifestWritten")
          : t("agentFirst.workbench.yamlPreview");

  return (
    <div className="wizard-layout">
      <div className="wizard-form">
        <div className="panel-heading">
          <span>
            <FilePlus2 size={16} />
            {t("agentFirst.workbench.newAgent")}
          </span>
          <span className="soft-label">{statusText}</span>
        </div>

        <label className="wizard-field">
          <span>{t("agentFirst.workbench.name")}</span>
          <input
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
          />
        </label>
        <label className="wizard-field">
          <span>{t("agentFirst.workbench.description")}</span>
          <input
            value={draft.description}
            onChange={(event) => updateDraft({ description: event.target.value })}
          />
        </label>
        <label className="wizard-field">
          <span>{t("agentFirst.workbench.instructions")}</span>
          <textarea
            value={draft.instructions}
            onChange={(event) => updateDraft({ instructions: event.target.value })}
          />
        </label>

        <div className="wizard-field">
          <span>{t("agentFirst.workbench.planner")}</span>
          <div className="segmented-control">
            {(["linear", "dag"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={draft.plannerMode === mode ? "segmented-button active" : "segmented-button"}
                onClick={() => updateDraft({ plannerMode: mode })}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="wizard-skill-select">
          {skills.map((skill) => (
            <label key={skill.skillId} className="toggle-row large">
              <input
                type="checkbox"
                checked={draft.skillIds.includes(skill.skillId)}
                onChange={() => toggleSkill(skill.skillId)}
              />
              <span>{skill.name}</span>
            </label>
          ))}
        </div>

        <div className="wizard-permissions">
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={draft.approvalRequired}
              onChange={(event) => updateDraft({ approvalRequired: event.target.checked })}
            />
            <span>{t("agentFirst.configure.approval")}</span>
          </label>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={draft.canUseNetwork}
              onChange={(event) => updateDraft({ canUseNetwork: event.target.checked })}
            />
            <span>{t("agentFirst.configure.network")}</span>
          </label>
          <label className="toggle-row large">
            <input
              type="checkbox"
              checked={draft.canWriteDatabase}
              onChange={(event) => updateDraft({ canWriteDatabase: event.target.checked })}
            />
            <span>{t("agentFirst.nav.data")}</span>
          </label>
        </div>

        <button
          type="button"
          className="primary-action"
          onClick={saveManifest}
          disabled={saveState === "saving"}
        >
          {saveState === "disabled" ? <WandSparkles size={15} /> : <Save size={15} />}
          {saveLabel}
        </button>
      </div>

      <div className="json-inspector">
        <div className="artifact-title">
          <WandSparkles size={15} />
          <span>{agentId}.yaml</span>
        </div>
        <pre>{yaml}</pre>
      </div>
    </div>
  );
}
