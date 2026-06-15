import { Archive, Boxes, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { WorkbenchArtifactPipelineGroup } from "../_shared/types";

export function ArtifactInspector({
  groups,
}: {
  groups: WorkbenchArtifactPipelineGroup[];
}) {
  const { t } = useTranslation();

  return (
    <div className="artifact-inspector-layout">
      <div className="panel-heading">
        <span>
          <Archive size={16} />
          {t("agentFirst.workbench.artifacts")}
        </span>
        <span className="soft-label">
          {t("agentFirst.workbench.pipelineGroupCount", { count: groups.length })}
        </span>
      </div>

      {groups.length > 0 ? (
        groups.map((pipeline) => (
          <section key={pipeline.pipelineRunId} className="artifact-pipeline-group">
            <div className="artifact-pipeline-heading">
              <div>
                <strong>{pipeline.title}</strong>
                <em>{pipeline.pipelineRunId}</em>
              </div>
              <span>
                {t("agentFirst.workbench.moduleCount", {
                  count: pipeline.moduleGroups.length,
                })}
              </span>
            </div>

            <div className="artifact-module-grid">
              {pipeline.moduleGroups.map((moduleGroup) => (
                <div key={moduleGroup.moduleRunId} className="artifact-module-group">
                  <span className="workbench-section-title">
                    <Boxes size={15} />
                    {moduleGroup.moduleId}
                  </span>
                  {moduleGroup.artifacts.map((artifact) => (
                    <div key={artifact.id} className="artifact-card">
                      <div className="artifact-title">
                        <FileText size={15} />
                        <span>{artifact.title}</span>
                      </div>
                      <p>{artifact.summary}</p>
                      <div className="artifact-meta-line">
                        <code>{artifact.kind}</code>
                        <em>{artifact.createdAt}</em>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="workbench-empty-state">
          <Archive size={18} />
          <strong>{t("agentFirst.workbench.noArtifacts")}</strong>
          <em>{t("agentFirst.workbench.empty")}</em>
        </div>
      )}
    </div>
  );
}
