export const enUS = {
  translation: {
    language: {
      switchTo: "中文",
      ariaLabel: "Switch language to Chinese",
    },
    common: {
      refresh: "Refresh",
      noUpstreamDependencies: "No upstream dependencies.",
      noMandatoryApproval: "No mandatory approval gate.",
      latestArtifacts: "Latest artifacts",
      currentAction: "Current action",
      blockingReason: "Blocking reason",
      lastActivity: "Last activity: {{time}}",
      missionRole: "Mission role",
      runs: "{{count}} runs",
      noRunsYet: "No runs yet",
      risk: "{{level}} risk",
      riskApproval: "{{level}} risk approval",
      riskLevel: {
        low: "Low",
        medium: "Medium",
        high: "High",
      },
      status: {
        pending: "Pending",
        waiting_approval: "Waiting approval",
        running: "Running",
        blocked: "Blocked",
        succeeded: "Succeeded",
        failed: "Failed",
        cancelled: "Cancelled",
        approved: "Approved",
        rejected: "Rejected",
        expired: "Expired",
      },
    },
    topbar: {
      viewPortal: "View Portal",
      adminConsole: "Admin Console",
    },
    operator: {
      source: {
        builtin: "built-in",
        community: "community",
        custom: "custom",
        workbench: "workbench",
        unknown: "{{source}}",
      },
      redaction: {
        placeholder: "[redacted]",
      },
      backstage: {
        badges: {
          operator: "Operator",
          guardedWrites: "guarded writes",
          governance: "governance",
        },
        title: "Operator Backstage",
        description:
          "Operator can inspect all manifests and workbench governance docs. Built-in/community manifests and workbench docs remain read-only; only custom agent manifests can be edited through the guarded localhost manifest API.",
        skillCount: "{{count}} skills",
        skillSubtitle: "{{kind}} · {{readiness}}",
        readiness: {
          ready: "ready",
          not_configured: "Not configured",
        },
        cards: {
          agents: {
            title: "Agent manifests",
            description:
              "Source-labelled review plus guarded custom-only editing with redacted responses.",
          },
          skills: {
            title: "Skill manifests",
            description:
              "Built-in / community / custom sources normalized for operator review.",
          },
          workbench: {
            title: "Workbench docs",
            description:
              "Read-only docs/workbench visibility with workbench source badge.",
          },
        },
        tabs: {
          agents: "Agent manifests",
          skills: "Skill manifests",
          workbench: "Workbench docs",
        },
        agentManifests: {
          title: "Agent manifests",
          description:
            "Read-only review of registered agent manifests via existing GET /api/agents data. Only custom manifests can be mutated below.",
        },
        skillManifests: {
          title: "Skill manifests",
          description:
            "Read-only view of registered skill manifests via existing GET /api/skills data.",
        },
      },
      manifestViewer: {
        emptyTitle: "No manifest loaded",
        readOnly: "read-only",
        emptyDescription: "No manifest available.",
        redactionNotice:
          "Sensitive values, local paths, provider URLs, tokens, and MCP-style endpoints are redacted in this operator view.",
        manifestId: "Manifest ID:",
      },
      manifestEditor: {
        title: "Custom manifest editor",
        badges: {
          customOnly: "custom only",
          localhostGuarded: "localhost guarded",
        },
        description:
          "Built-in and community manifests stay read-only. Editor content is redacted before display so operator view does not expose raw secrets or local paths.",
        guardrails: {
          title: "Guardrails stay in effect",
          prefix: "Writes are limited to",
          suffix:
            ", require same-origin localhost access, and return redacted responses.",
        },
        emptySelect: "Select an agent manifest to inspect or edit.",
        nonCustom:
          "{{agentId}} is a {{source}} manifest. Operator editing is only enabled for custom manifests.",
        editing:
          "Editing {{agentId}}. Redacted placeholders may need to be replaced manually before saving.",
        saving: "Saving",
        save: "Save custom manifest",
        reset: "Reset redacted draft",
        messages: {
          saved: "Custom manifest written through guarded localhost-only API.",
        },
        errors: {
          mustBeObject: "Manifest JSON must be an object.",
          invalidJson: "Invalid manifest JSON.",
          apiReturned: "Manifest API returned {{status}}",
          writeFailed: "Manifest write failed.",
        },
      },
      workbench: {
        title: "Workbench docs",
        descriptionPrefix: "Read-only visibility into",
        descriptionSuffix: "governance files.",
        emptyTitle: "No workbench doc",
        emptyDescription: "No workbench file available.",
        redactionNotice:
          "Sensitive lines containing local paths, provider/MCP URLs, or token-like values are redacted.",
        sourceLabel: "Source:",
      },
    },
    agentFirst: {
      common: {
        yes: "Yes",
        no: "No",
      },
      nav: {
        agent: "Agent",
        modules: "Modules",
        progress: "Progress",
        data: "Data",
        configure: "Configure",
        publish: "Publish",
      },
      workspace: {
        mission: "Mission Center",
        foreground: "Foreground",
        backstage: "Backstage",
        operator: "Operator",
      },
      topbar: {
        title: "AI Team Mission Control",
        postgresMemory: "Postgres memory",
        activeRuns: "{{count}} run active",
      },
      aria: {
        mainNavigation: "Main navigation",
        mobileNavigation: "Mobile navigation",
        workspaceMode: "Workspace mode",
        workbenchTabs: "Workbench tabs",
        agentCatalog: "Agent catalog",
        skillCatalog: "Skill catalog",
        skillTabs: "Skill tabs",
        runtimeExecutionMode: "Runtime execution mode",
        capabilityMap: "Capability map",
        publishSettings: "Publish settings",
      },
      actions: {
        openData: "Open data",
        openMemory: "Open memory",
        resume: "Resume",
        resumeNow: "Resume now",
        resuming: "Resuming",
        review: "Review",
        save: "Save",
        test: "Test",
        testRun: "Test Run",
        viewData: "View data",
        viewRun: "View run",
      },
      executionMode: {
        plan_only: "Plan only",
        execute_ready: "Execute ready",
      },
      status: {
        run: {
          running: "Running",
          waiting: "Waiting",
          succeeded: "Succeeded",
          queued: "Queued",
        },
        runtime: {
          succeeded: "Succeeded",
          running: "Running",
          resumable: "Resume ready",
          approval_required: "Approval",
          waiting_for_user: "Needs reply",
          waiting_for_data: "Needs data",
          blocked: "Blocked",
          skipped: "Config needed",
          queued: "Queued",
        },
        connection: {
          configured: "Provider ready",
          missing_key: "Provider env missing",
          offline: "API offline",
        },
        agentRun: {
          local: "Local mock",
          submitting: "Submitting",
          saved: "API saved",
          offline: "API offline",
          failed: "API failed",
        },
        agentRunApi: {
          planned: "Planned",
          missing_key: "Missing key",
          needs_approval: "Needs approval",
          failed: "Failed",
        },
        publish: {
          draft: "Draft",
          published: "Published",
          paused: "Paused",
        },
        publishSave: {
          local: "Local",
          saving: "Saving",
          saved: "API saved",
          offline: "API offline",
          failed: "Save failed",
        },
        climateApi: {
          loading: "Loading",
          api: "API",
          offline: "Mock fallback",
        },
        climateRun: {
          idle: "Idle",
          submitting: "Submitting",
          succeeded: "Accepted",
          offline: "Local fallback",
          failed: "Failed",
        },
        readiness: {
          ready: "Ready",
          not_configured: "Not configured",
          readyToRun: "ready to run",
        },
        agentReadiness: {
          ready: "ready",
          missing_skills: "missing skills",
        },
        workbenchRun: {
          pending: "pending",
          queued: "queued",
          running: "running",
          succeeded: "succeeded",
          failed: "failed",
          cancelled: "cancelled",
          approval_required: "Approval required",
          waiting_for_user: "waiting for user",
          waiting_for_data: "waiting for data",
          blocked: "blocked",
          skipped: "skipped",
        },
      },
      statusMessages: {
        localPublishSettings: "Local publish settings",
        localDraft: "Local draft",
        localMockRuntime: "Local mock runtime",
        runtimeActionsLocal:
          "Runtime actions are local until API run data is available",
        loadedFromApi: "Loaded from API",
        loadedPublishSettingsFromApi: "Loaded publish settings from API",
        apiOfflineLocalDraft: "API offline - local draft",
        apiOfflineLocalPublishSettings:
          "API offline - local publish settings",
        unsavedLocalDraft: "Unsaved local draft",
        savedToApi: "Saved to API",
        apiOfflineLocalDraftOnly: "API offline - local draft only",
        unsavedLocalPublishSettings: "Unsaved local publish settings",
        savingPublishSettings: "Saving publish settings",
        savedPublishSettingsToApi: "Saved publish settings to API",
        apiOfflineLocalPublishSettingsOnly:
          "API offline - local publish settings only",
        apiOfflineCannotTestKey: "API offline - cannot test key",
        submittingAgentRunApi: "Submitting to Agent Run API",
        waitingForApiRunData: "Waiting for API run data",
        agentRunApiFailedLocal: "Agent run API failed - showing local mock",
        savedRun: "Saved run {{runId}}",
        apiOfflineLocalMock: "API offline - showing local mock",
        submittingAgent: "Submitting {{agentId}}",
        agentRunApiUnavailableLocalDemo:
          "Agent run API unavailable - local demo",
        apiOfflineLocalDemo: "API offline - local demo",
        runtimeActionsConnected: "Runtime actions are connected to API run data",
        resumingModule: "Resuming {{moduleId}}",
        resumeSubmittedForModule: "Resume submitted for {{moduleId}}",
        resumeApiFailedForModule: "Resume API failed for {{moduleId}}",
        loadingClimateMonitorStatus: "Loading Climate Monitor status",
        climateStatusLoadedFromApi: "Status loaded from API",
        climateApiOfflineLocalMock: "API offline - local mock status",
        submittingClimateDryRun: "Submitting dry-run",
        submittingClimateLiveRun: "Submitting live run",
        climateRunFailed: "{{message}}",
        climateRunHttpError: "Climate Monitor run returned {{status}}",
        climateDryRunAccepted: "Dry-run accepted by API",
        climateLiveRunAccepted: "Live run accepted by API",
        climateDryRunApiOffline: "Dry-run was not submitted; API offline",
        climateLiveRunApiUnavailable: "Live-run API unavailable",
      },
      metrics: {
        adapter: "Adapter",
        approval: "Approval",
        artifacts: "Artifacts",
        configNeeded: "Config needed",
        configured: "Configured",
        externalRun: "External run",
        integration: "Integration",
        kind: "Kind",
        latestResult: "Latest result",
        readiness: "Readiness",
        records: "Records",
        requiredEnv: "Required env",
        resume: "Resume",
        resumeReady: "Resume ready",
        runs: "Runs",
        runState: "Run state",
        storedRecords: "Stored records",
        ui: "UI",
        updated: "Updated",
        warnings: "Warnings",
      },
      agentView: {
        title: "Agent",
        demoUserMessage:
          "Build an onboarding knowledge agent from the watched docs and keep every module result in the database.",
        demoAgentMessage:
          "I will run the five-module chain and store snapshots, Markdown, chunks, agent config, and climate report records in Postgres.",
        pipelineTitle: "Pipeline: docs to publishable agent",
        pipelineDetail:
          "{{succeededCount}} succeeded / {{resumeReadyCount}} resume ready / {{approvalCount}} approval / {{configNeededCount}} config",
        liveWorkspace: "Live workspace",
        apiIngest: "API ingest v1",
        moduleMemory: "module memory",
      },
      runtime: {
        title: "Runtime",
      },
      modules: {
        title: "Modules",
        registeredCount: "{{count}} registered",
        runtimeContract: "Runtime contract",
        resultUi: "Result UI",
      },
      progress: {
        title: "Pipeline progress",
        description:
          "Every module run posts events and artifacts back into the shared database memory.",
        queuedInstruction: "Queued instruction",
        pipeline: "Pipeline {{runId}}",
        planSteps: "{{count}} plan steps",
        planWarnings: "Agent plan warnings",
        resultRecordCount: "{{count}} result records",
        resultRecordCount_one: "{{count}} result record",
        resultRecordCount_other: "{{count}} result records",
      },
      data: {
        title: "Database memory",
        description:
          "Canonical display data from each module is queryable from one Postgres-backed surface.",
        searchRecords: "Search records",
        all: "all",
      },
      backstage: {
        tabs: {
          agents: "Agents",
          skills: "Skills",
          runs: "Runs",
          artifacts: "Artifacts",
          operator: "Operator",
        },
        skillTabs: {
          io: "Run I/O",
          artifacts: "Artifacts",
          events: "Events",
          ui: "Skill UI",
        },
        ui: {
          opsPanel: "Ops panel",
          htmlTab: "HTML tab",
        },
        agentsTitle: "Agents",
        skillsTitle: "Skills",
        loadedCount: "{{count}} loaded",
        skillManifest: "Skill manifest",
        foregroundDetail: "Foreground detail",
        input: "Input",
        output: "Output",
        interaction: "Interaction",
      },
      skillUi: {
        genericRenderer: "Generic renderer",
        noHtmlSurface: "This skill does not ship an HTML backstage surface.",
        htmlEntrypoint: "Backstage HTML entrypoint",
        runStatus: "Run status",
      },
      climate: {
        title: "Climate Monitor Ops",
        latestReport: "Latest report",
        noReportTitle: "No report yet",
        noReportDescription:
          "The API did not return a current Climate Monitor report.",
        scopeCoverage: "Scope coverage",
        coverageAria: "{{label}} {{coverage}}%",
        dedupPlaceholders: "Dedup placeholders",
        candidates: "Candidates",
        merged: "Merged",
        pending: "Pending",
        lastChecked: "Last checked",
        date: "Date",
        manifest: "Manifest",
        research: "Research",
        dryRun: "Dry-run",
        liveRun: "Live run",
      },
      configure: {
        title: "Configure Agent",
        description:
          "Connect the AI runtime, choose model behavior, decide which skills the Agent may use, and see exactly what each capability produces.",
        provider: "Provider",
        providerFallback: "{{provider}} fallback",
        activePlanner: "Active planner",
        endpoint: "Endpoint",
        model: "Model",
        reasoning: "Reasoning",
        reasoningSummary: "{{effort}} reasoning",
        systemPrompt: "System prompt",
        businessSkills: "Business Skills",
        businessSkillsDescription:
          "These are your product modules. The Agent calls them to build the pipeline, and each module writes displayable results back into the database.",
        generalSkills: "General Skills",
        generalSkillsDescription:
          "These are common Agent abilities. Keep them available on demand so the Agent can ask to install or use one during a conversation, with approval before sensitive actions.",
        enabled: "Enabled",
        approval: "Approval",
        network: "Network",
        dbWrite: "DB write",
        onDemand: "On demand",
        installed: "Installed",
        available: "Available",
        enabledCount: "{{count}} enabled",
        allowedCount: "{{count}} allowed",
        switchGuide: "Switch guide",
        skillDetailsLabel: "{{name}} details",
        memory: "Memory",
        memoryMode: {
          shortLong: "short + long",
          longOnly: "long only",
          shortOnly: "short only",
        },
        memoryPromotion: {
          agent_suggested: "Agent suggested",
          manual: "Manual",
        },
        reasoningEffort: {
          none: "None",
          low: "Low",
          medium: "Medium",
          high: "High",
          xhigh: "Extra high",
        },
        shortTermThreadMemory: "Short-term thread memory",
        longTermPostgresMemory: "Long-term Postgres memory",
        promotion: "Promotion",
        collection: "Collection",
        retentionDays: "Retention days",
        safety: "Safety",
        toolSteps: "{{count}} tool steps",
        approveExternalActions: "Approve external actions",
        approvePublishing: "Approve publishing",
        allowSelfLearning: "Allow self-learning",
        maxToolSteps: "Max tool steps",
        runtimePreview: "Runtime Preview",
        active: "Active",
        skills: "Skills",
        skillCounts: "{{businessCount}} business / {{generalCount}} general",
        memoryIntoCollection: "{{memoryMode}} into {{collection}}",
        selfLearningAllowed: "self-learning allowed",
        selfLearningPaused: "self-learning paused",
        guides: {
          provider:
            "Choose the planner provider and endpoint. Connection checks use the guarded local API.",
          model:
            "Choose model and reasoning behavior for planning, tool choice, and progress explanations.",
          memory:
            "Decide how conversation and run summaries are promoted into Postgres-backed memory.",
          safety:
            "Set approval gates and limits for external effects, publishing, and self-learning.",
          runtime:
            "Preview the effective runtime choices that will be submitted with agent runs.",
          business: {
            web_listening: {
              summary:
                "Watches source URLs and turns web changes into database records the Agent can reason about.",
              trigger:
                "Use when a source website, docs page, changelog, or competitor page needs monitoring.",
              action:
                "The Agent asks the module to fetch pages, snapshot HTML, extract readable text, and compare changes.",
              output:
                "Snapshots, extracted text, detected change events, and provenance appear in Modules, Progress, and Data.",
              boundary:
                "This is the only business skill that normally needs network access.",
            },
            doc_to_md: {
              summary:
                "Converts uploaded or collected documents into clean Markdown that downstream modules can consume.",
              trigger:
                "Use when PDFs, Word docs, exports, or raw source documents need to become structured text.",
              action:
                "The Agent sends source document references to the module and stores Markdown plus warnings/assets.",
              output:
                "Markdown documents, conversion warnings, asset references, and source metadata are stored as artifacts.",
              boundary:
                "It should not decide knowledge structure; it only prepares readable Markdown.",
            },
            md_to_rag: {
              summary:
                "Builds retrieval memory from Markdown by chunking text and preparing embedding/index metadata.",
              trigger:
                "Use after Markdown exists and the Agent needs searchable long-term knowledge.",
              action:
                "The Agent asks for chunks, token counts, embedding payload metadata, and index status records.",
              output:
                "RAG chunks, token counts, embedding metadata, and index progress become visible in Data.",
              boundary:
                "It prepares memory records; model-facing answers still come from the Agent runtime.",
            },
            rag_to_agent: {
              summary:
                "Turns validated RAG memory into a publishable agent configuration with prompts and tool bindings.",
              trigger:
                "Use when the knowledge base is ready and you want a publishable or testable agent.",
              action:
                "The Agent asks for prompts, tool definitions, validation checks, and final handoff state.",
              output:
                "Generated agent configs, prompts, tool bindings, and validation results appear before Publish.",
              boundary:
                "Keep approval on for this skill because it can shape what the final agent is allowed to do.",
            },
            climate_monitor: {
              summary:
                "Keeps the climate and actuarial monitor reports, source scopes, and guarded run state visible to operators.",
              trigger:
                "Use when report freshness, Excel-derived website coverage, or research deduplication state must be checked.",
              action:
                "The Agent reads Climate Monitor status through ai_interface and can request dry-run or configured live-run executions.",
              output:
                "Latest report metadata, source/scope coverage, warnings, dedup status, and run JSON appear in Backstage.",
              boundary:
                "Live execution remains disabled until CLIMATE_MONITOR_PROJECT_PATH is configured and live runs are explicitly enabled.",
            },
            ai_actuary: {
              summary:
                "Runs actuarial reserving workflows through the registered safe CLI adapter.",
              trigger:
                "Use when a controlled actuarial pipeline run should be launched or inspected.",
              action:
                "The Agent prepares a bounded run request and records the adapter output for review.",
              output:
                "Run JSON and report artifacts become visible through Runs and Artifacts.",
              boundary:
                "Execution depends on local ai_actuary configuration and remains adapter-gated.",
            },
            example_reporter: {
              summary:
                "Demonstrates the community skill manifest shape without requiring external execution.",
              trigger: "Use as a registry validation and UI rendering example.",
              action:
                "The Agent treats it as a normal skill manifest with sample schemas and artifacts.",
              output:
                "Example report metadata appears in the skill detail surface.",
              boundary:
                "This is a community example, not a production pipeline.",
            },
          },
          general: {
            web_search: {
              summary:
                "Lets the Agent look up fresh public information when project memory may be stale.",
              trigger:
                "Use for latest docs, pricing, release notes, laws, APIs, news, or anything time-sensitive.",
              action:
                "The Agent searches, reads selected sources, cites what it used, then folds the result into the plan.",
              output:
                "Search findings show in chat summaries and can be saved into memory when relevant.",
              boundary:
                "Requires network and approval because it leaves the local project context.",
            },
            browser: {
              summary:
                "Lets the Agent open local previews and inspect actual UI state instead of guessing from code.",
              trigger:
                "Use for smoke tests, visual checks, clicking through flows, and reading browser console issues.",
              action:
                "The Agent opens the page, navigates, clicks controls, checks DOM/console, and reports what rendered.",
              output:
                "Verified page state, screenshots when useful, and console findings are reported back in the thread.",
              boundary:
                "Approval stays useful for external sites or any action that changes third-party state.",
            },
            github: {
              summary:
                "Lets the Agent inspect repository work, pull requests, checks, reviews, and issues.",
              trigger:
                "Use when PR state, CI failures, review comments, or remote branch status matters.",
              action:
                "The Agent reads PR metadata, checks, comments, and can push confirmed-safe fixes from this repo.",
              output:
                "PR summaries, check status, review decisions, commits, and links are shown in the conversation.",
              boundary:
                "Writes, merges, or destructive Git operations should remain approval-gated.",
            },
            notion: {
              summary:
                "Lets the Agent use workspace knowledge and capture decisions into structured documents.",
              trigger:
                "Use when plans, meeting notes, specs, decisions, or knowledge pages should live in Notion.",
              action:
                "The Agent reads selected pages or writes structured summaries when you approve the destination.",
              output:
                "Notion pages, implementation specs, and linked knowledge records become part of the handoff.",
              boundary:
                "Workspace reads/writes should be explicit because they may contain private team context.",
            },
            lark: {
              summary:
                "Lets the Agent interact with Lark messages, docs, tasks, calendars, approvals, and Base records.",
              trigger:
                "Use for team workflows: send updates, create docs, query tasks, prepare meetings, or sync tables.",
              action:
                "The Agent routes to the right Lark capability and asks before sending or changing shared state.",
              output:
                "Messages, docs, tasks, calendar results, or Base records are linked back to the Agent thread.",
              boundary:
                "External communication and sensitive-data transmission must stay approval-gated.",
            },
            file_tools: {
              summary:
                "Lets the Agent read and prepare files inside the approved project workspace.",
              trigger:
                "Use for local code, docs, fixtures, generated plans, and files that belong to this project.",
              action:
                "The Agent reads relevant files, edits scoped files when requested, and keeps Git changes isolated.",
              output:
                "Changed files, diffs, verification results, commits, and PR links are reported in the run summary.",
              boundary:
                "It should stay inside ai_interface; sibling repositories remain off-limits unless requested.",
            },
          },
        },
        capability: {
          agent: {
            title: "Agent",
            detail: "Chat, plan, choose tools, and explain progress.",
          },
          businessSkills: {
            title: "Business skills",
            detail: "Run your fixed module chain and store canonical outputs.",
          },
          generalSkills: {
            title: "General skills",
            detail:
              "Install or enable common abilities when a conversation needs them.",
          },
          memory: {
            title: "Memory",
            detail: "Persist useful context into Postgres for later runs.",
          },
        },
        switches: {
          enabled: {
            label: "Enabled",
            detail: "Whether the Agent is allowed to call this capability.",
          },
          approval: {
            label: "Approval",
            detail:
              "When on, the Agent asks before running sensitive or finalizing actions.",
          },
          network: {
            label: "Network",
            detail: "Whether this capability may reach external URLs or services.",
          },
          dbWrite: {
            label: "DB write",
            detail:
              "Whether this module may persist results, events, and artifacts into Postgres memory.",
          },
          onDemand: {
            label: "On demand",
            detail:
              "The Agent may suggest installing or enabling it during a conversation.",
          },
        },
        skillDetail: {
          purpose: "Purpose",
          whenUsed: "When used",
          agentAction: "Agent action",
          result: "Result",
          boundary: "Boundary",
        },
      },
      publish: {
        title: "Publish agent",
        description:
          "The final agent becomes available after the RAG index and validation records are stored.",
        openPortalPreview: "Open Portal preview",
        versionLabel: "Version label",
        portalToken: "Portal token",
        portalTokenPlaceholder: "Enter a new portal token",
        tokenEnding: "Token ending ****{{tokenLast4}}",
        noSavedToken: "No saved token yet",
        updatedAt: "Updated {{time}}",
        noPlaintextTokens: "Plaintext tokens are never returned by the API.",
        saveDraft: "Save draft",
        pause: "Pause",
        steps: {
          ragIndex: "RAG index",
          chunkProgress: "96 / 124 chunks",
          agentConfig: "Agent config",
          validation: "Validation",
          endpoint: "Endpoint",
        },
        portalAccess: "Portal access",
        portalAccessTitle: "Token unlocks the frontstage workspace",
        portalAccessDescription:
          "Published users enter with a portal token, then work inside Chat, Steps, Data, Sources, and Result.",
        viewAsUser: "View as user",
        demoTokenOnly:
          "Demo token only. Production token validation belongs on the server.",
        frontstageVisible: "Frontstage visible",
        frontstageVisibleTitle: "Users keep progress and data visibility",
        portalViews: {
          chat: {
            label: "Chat",
            detail: "Ask the published Agent to run or continue work.",
          },
          steps: {
            label: "Steps",
            detail: "See which module is running, blocked, or complete.",
          },
          data: {
            label: "Data",
            detail: "Inspect generated records and artifacts.",
          },
          sources: {
            label: "Sources",
            detail: "Trace evidence back to source material.",
          },
          result: {
            label: "Result",
            detail: "Review final handoff, agent config, and readiness.",
          },
        },
        adminOnly: "Admin-only",
        adminOnlyTitle: "Configure stays backstage",
        adminOnlyDescription:
          "Provider, model, business skills, general skills, memory, safety, and publish gates remain admin controls.",
        configureRuntime: "Configure runtime",
        manageMemoryWrites: "Manage memory writes",
        controlSkillPermissions: "Control skill permissions",
      },
      composer: {
        placeholder: "Ask Agent to run modules, store data, or inspect results...",
        attachFile: "Attach file",
        plan: "Plan",
        agentSettings: "Agent settings",
        send: "Send",
      },
      chat: {
        you: "You",
        agent: "Agent",
      },
      workbench: {
        missingSkills: "Missing skills",
        skillCount: "{{count}} skills",
        visibleCount: "{{count}} visible",
        runs: "Runs",
        unassigned: "unassigned",
        noRuns: "No runs",
        empty: "Empty",
        pipelineRun: "Pipeline run",
        none: "none",
        agent: "Agent",
        activeSkill: "Active skill",
        idle: "idle",
        steps: "Steps",
        moduleSteps: "Module steps",
        events: "Events",
        rawJson: "Raw JSON",
        noRunSelected: "No run selected",
        agentManifest: "Agent manifest",
        source: "Source",
        planner: "Planner",
        noApiRun: "No API run",
        lastRun: "Last run",
        identity: "Identity",
        persona: "Persona",
        background: "Background",
        team: "Team: {{teamId}}",
        teamLabel: "Team",
        status: "Status: {{status}}",
        runtimeStatus: "Runtime status",
        criticalRules: "⚠ Critical Rules",
        deliverables: "Deliverables",
        format: "Format",
        workflow: "Workflow",
        approvalRequired: "Approval required",
        approvalNotRequired: "No approval required",
        workflowDeliverables: "Outputs",
        communicationStyle: "Communication style",
        tone: "Tone",
        outputFormat: "Output format",
        languagePreference: "Language preference",
        successMetrics: "Success metrics",
        instructions: "Instructions",
        boundSkills: "Bound skills",
        required: "required",
        optional: "optional",
        permissions: "Permissions",
        allowed: "Allowed",
        off: "Off",
        handoffs: "Handoffs",
        directRun: "Direct run",
        writing: "Writing",
        writeDisabled: "Write disabled",
        written: "Written",
        create: "Create",
        localWriteModeDisabled: "Local write mode disabled",
        localPreviewOnly: "Local preview only",
        manifestWritten: "Manifest written",
        yamlPreview: "YAML preview",
        newAgent: "New Agent",
        name: "Name",
        description: "Description",
        artifacts: "Artifacts",
        pipelineGroupCount: "{{count}} pipeline groups",
        moduleCount: "{{count}} modules",
        noArtifacts: "No artifacts",
      },
      workbenchDemo: {
        common: {
          now: "Now",
        },
        skills: {
          web_listening: {
            description:
              "Monitor URLs, create snapshots, extract text, and detect changes.",
          },
          doc_to_md: {
            description:
              "Convert source documents into Markdown with warnings and assets.",
          },
          md_to_rag: {
            description: "Chunk Markdown and prepare RAG index records.",
          },
          rag_to_agent: {
            description:
              "Generate agent configuration, prompts, and validation output.",
          },
          climate_monitor: {
            description:
              "Track climate and actuarial monitor reports and source coverage.",
          },
          ai_actuary: {
            description:
              "Invoke the reserving pipeline through the safe CLI executor.",
          },
          example_reporter: {
            description:
              "Community manifest example for custom skill validation.",
          },
        },
        agents: {
          knowledgeBuilder: {
            name: "Knowledge Builder",
            description:
              "Turn approved web and document sources into a RAG-backed agent configuration.",
            instructions:
              "Build an inspectable knowledge pipeline from approved sources. Plan with the smallest set of enabled skills that can monitor sources, convert documents, prepare RAG records, and generate an agent configuration. Preserve intermediate artifacts for review.",
            tests: {
              buildFromMarkdown:
                "Build an agent from approved Markdown source material.",
            },
          },
          climateBriefing: {
            name: "Climate Briefing Agent",
            description:
              "Summarize climate monitor outputs and prepare review-ready briefings.",
            instructions:
              "Use climate monitor artifacts as the source of truth, preserve source coverage notes, and hand draft briefings to the publishing agent only after validation.",
            handoffs: {
              refreshSources: "Refresh source material when coverage changes.",
            },
          },
        },
        runs: {
          knowledgeBuilder: {
            title: "Knowledge Builder demo run",
          },
        },
        runSteps: {
          collectSources: {
            title: "Collect approved sources",
            summary: "18 snapshots and 3 change events stored.",
          },
          convertDocuments: {
            title: "Convert documents",
            summary: "6 Markdown documents with one warning.",
          },
          prepareRag: {
            title: "Prepare RAG records",
            summary: "96 of 124 chunks indexed.",
          },
          draftAgent: {
            title: "Draft agent config",
            summary: "Waiting for the RAG index artifact.",
          },
        },
        events: {
          plan: {
            title: "Plan created",
            detail: "DAG plan selected four bound skills.",
          },
          artifacts: {
            title: "Markdown artifacts stored",
            detail: "doc_to_md wrote 6 displayable Markdown artifacts.",
          },
          active: {
            title: "md_to_rag running",
            detail: "Chunk metadata is being normalized for retrieval.",
          },
        },
        artifacts: {
          snapshot: {
            title: "Latest page snapshot",
            summary:
              "Approved source page snapshot with extracted text metadata.",
          },
          markdown: {
            summary: "Markdown conversion output with provenance retained.",
            content:
              "# Onboarding\n\nUse the guided setup to connect sources, confirm document quality, and publish a searchable assistant.",
          },
        },
        sampleArtifacts: {
          docToMdMarkdown: {
            content:
              "# Onboarding\n\nUse the guided setup to connect sources, confirm document quality, and publish a searchable assistant.\n\n- Source snapshots are linked to provenance.\n- Conversion warnings stay attached to the run.\n- Assets are stored beside Markdown output.",
          },
        },
        localRun: {
          title: "{{agentName}} local test",
          updatedAt: "Local",
          firstStepSummary: "Local demo fallback queued.",
          waitingSummary: "Waiting for prior step.",
          eventTitle: "Local fallback",
          eventDetail: "Agent run API unavailable.",
        },
      },
    },
    portal: {
      brand: "AI",
      nav: {
        chat: "Chat",
        steps: "Steps",
        data: "Data",
        sources: "Sources",
        result: "Result",
      },
      topbar: {
        surface: "End-user Agent Portal",
        title: "Onboarding Knowledge Agent",
        description: "Published agent workspace for end users.",
        lastSync: "Last sync",
        configureAccess: "Configure access",
        openAdmin: "Open Admin Console",
      },
      lock: {
        kicker: "Published workspace",
        title: "Agent Portal",
        description:
          "Enter your access token to open the published agent workspace.",
        tokenLabel: "Access token",
        tokenPlaceholder: "portal-token",
        checking: "Checking",
        enter: "Enter Portal",
      },
      admin: {
        kicker: "Admin access",
        title: "Enter admin token",
        description:
          "Admin Console is for operators. Submit an admin token to continue, or return to the Portal.",
        tokenLabel: "Admin token",
        tokenPlaceholder: "admin-token",
        back: "Back to Portal",
        enter: "Enter Admin",
        previewNote:
          "Demo preview only. No token keeps you in the frontstage Portal.",
      },
      runState: {
        local: "Local demo",
        submitting: "Submitting",
        refreshing: "Refreshing",
        saved: "API saved",
        offline: "API offline",
        failed: "API failed",
      },
      autoRefresh: {
        idle: "Auto idle",
        off: "Auto off",
        active: "Auto active",
        paused: "Auto paused",
        on: "Auto on",
      },
      accessState: {
        idle: "Locked",
        checking: "Checking",
        authorized: "API authorized",
        missing_token: "Token required",
        invalid_token: "Invalid token",
        not_published: "Not published",
        offline: "Demo offline",
        failed: "Verification failed",
      },
      status: {
        complete: "Complete",
        running: "Running",
        waiting: "Waiting",
        blocked: "Blocked",
      },
      syncSource: {
        submit: "Submitted",
        manual: "Manual",
        auto: "Auto",
      },
      composer: {
        ariaLabel: "Portal chat prompt",
        placeholder: "Ask this published agent...",
        send: "Send",
        status: {
          waitingForInput: "Waiting for input",
        },
      },
      sections: {
        chat: {
          title: "Agent chat",
          description: "Ask the published agent and review its progress.",
        },
        steps: {
          kicker: "Transparent run",
          title: "Steps",
          description: "Review pipeline steps and human interaction gates.",
          pipeline: "Pipeline {{runId}}",
          warnings: "Agent plan warnings",
        },
        data: {
          kicker: "Database records",
          title: "Data",
          description: "Inspect records stored by each module run.",
          filters: "Data filters",
        },
        sources: {
          kicker: "Evidence",
          title: "Sources",
          description: "Trace source evidence and provenance.",
        },
        result: {
          kicker: "Final output",
          title: "Result",
          description: "Inspect agent handoff outputs and readiness.",
          draftOutput: "Draft agent output",
        },
      },
      actions: {
        inspect: "Inspect",
        viewSteps: "View Steps",
        inspectData: "Inspect Data",
        checkSources: "Check Sources",
        viewDetails: "View details",
        viewDetailsFor: "View details for {{title}}",
        viewEvidence: "Inspect evidence",
        viewEvidenceFor: "Inspect evidence for {{label}}",
        viewResult: "Inspect result",
        viewResultFor: "Inspect result handoff for {{title}}",
        refresh: "Refresh",
        autoRefresh: "Auto refresh",
        pauseAutoRefresh: "Pause auto refresh",
        retry: "Retry",
      },
      empty: {
        loadingDetails: "Loading record details...",
        noRecords: "No data records for the selected step yet.",
        noSources: "No sources are available yet.",
        noResults: "No result items are available yet.",
        noInteraction: "No interaction is waiting for this step.",
        noEvents: "No events stored yet.",
        noArtifacts: "No artifacts stored yet.",
      },
      interaction: {
        kind: {
          question: "Question",
          approval: "Approval",
          data_request: "Data request",
          blocked: "Blocked",
        },
        status: {
          waiting_for_user: "Needs reply",
          waiting_for_approval: "Approval",
          waiting_for_data: "Needs data",
          blocked: "Blocked",
          resumable: "Resume ready",
          resumed: "Resumed",
        },
        optionsAria: "{{step}} options",
        feedbackLabel: "Reply for {{step}}",
        feedbackPlaceholder: "Reply for this step...",
        approve: "Approve",
        submit: "Send feedback",
        resume: "Resume",
        submitting: "Submitting",
        succeeded: "Succeeded",
        failed: "Failed",
      },
      detailDrawer: {
        title: "Module run detail",
        runEvents: "Events",
        artifacts: "Artifacts",
        selectRecord: "Select a record to inspect stored data.",
        localDemo: "Local demo",
        failed: "Detail API failed for this record.",
        openRecord: "Open this record to load module details.",
        empty: "No detail records were stored for this module run yet.",
      },
      sourceDrawer: {
        title: "API evidence",
        evidence: "Provenance events",
        artifacts: "Evidence artifacts",
        selectSource: "Select a source to inspect evidence.",
        localEvidence: "Local evidence",
        loading: "Loading source evidence...",
        failed: "Evidence API failed for this source.",
        openSource: "Open this source to load evidence.",
        empty: "No evidence records were stored for this module run yet.",
      },
      resultDrawer: {
        title: "API handoff",
        details: "Handoff events",
        artifacts: "Result artifacts",
        selectResult: "Select a result item to inspect handoff details.",
        localHandoff: "Local handoff",
        loading: "Loading result details...",
        failed: "Result detail API failed for this item.",
        openResult: "Open this result item to load handoff artifacts.",
        empty: "No handoff records were stored for this module run yet.",
      },
      context: {
        title: "Current run context",
        currentStep: "Current step",
        pipeline: "Pipeline",
        visibleData: "Visible data",
        records: "{{count}} records",
        readiness: "Readiness",
        access: "Access",
        admin: "Admin",
        adminDescription: "Operator-only access for governance tools.",
      },
      modules: {
        web_listening: {
          label: "Listen",
          adminModule: "Intelligence monitoring",
          fallbackSummary: "Watched source URLs and captured changed pages.",
          fallbackData: "snapshots",
        },
        doc_to_md: {
          label: "Convert",
          adminModule: "Document preparation",
          fallbackSummary:
            "Converted source material into clean Markdown records.",
          fallbackData: "Markdown documents",
        },
        md_to_rag: {
          label: "Index",
          adminModule: "Knowledge indexing",
          fallbackSummary:
            "Chunking Markdown and preparing retrieval metadata.",
          fallbackData: "chunks",
        },
        rag_to_agent: {
          label: "Generate Agent",
          adminModule: "Agent assembly",
          fallbackSummary: "Generating and validating the agent handoff.",
          fallbackData: "agent config",
        },
        unknown: {
          adminModule: "{{module}} module",
          fallbackSummary: "{{module}} completed without a detailed summary.",
          fallbackData: "{{module}} output",
        },
      },
      apiFallback: {
        apiResult: "API result",
        moduleRun: "Module run",
        apiResultWithRun: "API result {{runId}}",
        apiRunWithId: "API run {{runId}}",
        submittedPrompt: "Submitted prompt",
        syncPending: "Sync pending",
        updatedAt: "Updated {{time}}",
        inspectStoredArtifacts:
          "Open details to inspect stored events and artifacts.",
        inspectFinalArtifacts: "Open details to inspect final run artifacts.",
        stepNeedsApproval: "{{step}} needs approval before it can continue.",
        stepNeedsConfiguration:
          "{{step}} needs adapter configuration before it can run.",
      },
      readiness: {
        pipeline: "Pipeline",
        connection: "Connection",
        completedSteps: "Completed steps",
        completedCount: "{{completed}} / {{total}}",
        agentStatus: "Agent status",
      },
      resultKind: {
        agent_config: "Agent config",
        memory: "Memory",
        source_package: "Source package",
        handoff: "Handoff",
      },
      eventSeverity: {
        info: "Info",
        warning: "Warning",
        error: "Error",
      },
      agentRunStatus: {
        planned: "Planned",
        missing_key: "Missing key",
        needs_approval: "Needs approval",
        failed: "Failed",
      },
      connectionStatus: {
        configured: "Configured",
        missing_key: "Missing key",
        offline: "Offline",
      },
      statusMessages: {
        enterPortalToken: "Enter Portal token",
        enterPortalTokenToContinue: "Enter a Portal token to continue",
        checkingPortalToken: "Checking Portal token",
        localDemoUnlocked: "API offline - local demo Portal unlocked",
        localDemoRuntime: "Local demo runtime",
        runtimeAccessRejected: "Portal access rejected by runtime API",
        runtimeAccessRejectedLong:
          "Portal access was rejected by the runtime API. Re-enter a valid token.",
        runRefreshedData:
          "Run refreshed - open a data record to reload module artifacts",
        runRefreshedSource: "Run refreshed - open a source to reload evidence",
        runRefreshedResult:
          "Run refreshed - open a result item to reload handoff details",
        portalAccessApiUnavailable: "Portal access API unavailable",
        portalAccessApiStatus:
          "Portal access API returned {{status}}; access remains locked",
        portalAccessInvalidJson: "Portal access API returned invalid JSON",
        portalAccessUnexpectedPayload:
          "Portal access API returned an unexpected payload",
        publishedAgentUnlocked: "Published Agent {{versionLabel}} unlocked",
        agentNotOpen: "Agent is {{publishStatus}}; Portal is not open yet",
        tokenRejected: "Token was checked by API and rejected",
        feedbackActionsLocal:
          "Feedback actions are local until API run data is available",
        openDataRecord: "Open a data record to inspect stored module artifacts",
        openSource: "Open a source to inspect evidence and provenance",
        openResult: "Open a result item to inspect handoff details",
        submittingAgentRunApi: "Submitting to Agent Run API",
        agentRunFailedLocal: "Agent Run API failed - showing local demo",
        agentRunUnexpectedLocal:
          "Agent Run API returned an unexpected response - showing local demo",
        savedRun: "Saved run {{runId}}",
        apiOfflineLocal: "API offline - showing local demo",
        refreshingRun: "Refreshing run {{runId}}",
        refreshFailed: "Refresh failed for run {{runId}}",
        refreshUnexpected:
          "Refresh returned an unexpected response for {{runId}}",
        refreshedRun: "Refreshed run {{runId}}",
        refreshUnavailable:
          "Refresh unavailable for run {{runId}} - keeping current view",
        localFeedbackCaptured:
          "Local demo feedback captured - no API run is connected",
        submittingFeedback: "Submitting feedback for {{step}}",
        feedbackSaved:
          "Feedback saved for {{step}}; resume is ready when available",
        feedbackApiFailed: "Feedback API failed for {{step}}",
        localResumeRequested:
          "Local demo resume requested - no API run is connected",
        resumingStep: "Resuming {{step}}",
        resumeSubmitted: "Resume submitted for {{step}}",
        resumeApiFailed: "Resume API failed for {{step}}",
        localDemoRecord: "Local demo record - no API module run is connected",
        loadedDetails: "Loaded details for {{title}}",
        loadingDetailsFor: "Loading details for {{title}}",
        detailApiFailed: "Detail API failed for {{title}}",
        localDemoSource: "Local demo source - no API module run is connected",
        loadedEvidence: "Loaded evidence for {{label}}",
        loadingEvidence: "Loading evidence for {{label}}",
        evidenceApiFailed: "Evidence API failed for {{label}}",
        localDemoResult: "Local demo result - no API module run is connected",
        loadedResultDetails: "Loaded result details for {{title}}",
        loadingResultDetails: "Loading result details for {{title}}",
        resultDetailApiFailed: "Result detail API failed for {{title}}",
        artifactApiFailed: "Artifact API failed for {{title}}",
      },
      demo: {
        relative: {
          twoMinutesAgo: "2 min ago",
          oneMinuteAgo: "1 min ago",
          running: "running",
          queued: "queued",
        },
        steps: {
          listen: {
            label: "Listen",
            summary: "Watched source URLs and captured changed pages.",
            dataCount: "18 snapshots",
          },
          convert: {
            label: "Convert",
            summary: "Converted source material into clean Markdown records.",
            dataCount: "6 Markdown documents",
          },
          index: {
            label: "Index",
            summary: "Chunking Markdown and preparing retrieval metadata.",
            dataCount: "96 / 124 chunks",
          },
          generate: {
            label: "Generate Agent",
            summary:
              "Waiting for validated RAG memory before final agent output.",
            dataCount: "draft config",
          },
        },
        interaction: {
          title: "Approve final agent draft",
          message:
            "Review the generated prompt and tool policy before the published agent is unlocked.",
          prompt: "Approve this draft for publish?",
          approve: "Approve",
          revise: "Request revision",
        },
        messages: {
          userMeta: "Request",
          userText:
            "Build an onboarding knowledge agent from the watched docs and show me what changed.",
          agentMeta: "Agent progress",
          agentText:
            "The run has finished Listen and Convert. Index is active now, with 96 of 124 chunks ready. You can inspect the step timeline, source citations, or the database records while validation waits.",
        },
        data: {
          snapshot: {
            kind: "Snapshot",
            title: "Docs landing page",
            detail:
              "Captured text and change metadata from the watched documentation URL.",
          },
          markdown: {
            kind: "Markdown",
            title: "Onboarding guide.md",
            detail:
              "Converted source document into Markdown with 2 conversion warnings.",
          },
          chunk: {
            kind: "Chunk",
            title: "Authentication setup chunk",
            detail:
              "843 tokens with embedding metadata prepared for the RAG collection.",
          },
          agentConfig: {
            kind: "Agent config",
            title: "Support agent draft",
            detail:
              "Prompt and tool plan waiting for index validation before publishing.",
          },
        },
        sources: {
          watchedUrl: {
            label: "docs.example.com/start",
            type: "Watched URL",
            freshness: "Snapshot captured 2 min ago",
            summary:
              "Primary onboarding page used to detect copy and setup flow changes.",
            evidenceTitle: "Watched URL snapshot",
            evidenceDetail:
              "The Listen step captured page text and change metadata before downstream conversion.",
          },
          sourceDocument: {
            label: "Onboarding Guide export",
            type: "Source document",
            freshness: "Converted 1 min ago",
            summary:
              "Original user guide converted into Markdown before chunking.",
            evidenceTitle: "Converted source document",
            evidenceDetail:
              "The Convert step normalized the original guide into Markdown before chunking.",
          },
          memoryRecord: {
            label: "RAG collection onboarding-v1",
            type: "Memory record",
            freshness: "96 chunks indexed",
            summary:
              "Retrieval memory that will power the published Agent answers.",
            evidenceTitle: "RAG memory collection",
            evidenceDetail:
              "The Index step stores chunks and retrieval metadata for the published Agent.",
          },
        },
        readiness: {
          ragIndex: {
            label: "RAG index",
            value: "Running",
          },
          validation: {
            label: "Validation",
            value: "Queued",
          },
          publishedUrl: {
            label: "Published URL",
            value: "Locked until validation",
          },
          agentVersion: {
            label: "Agent version",
          },
        },
        results: {
          agentConfig: {
            title: "Support agent draft",
            status: "Waiting for approval",
            summary:
              "Draft prompt, tool policy, and handoff notes are ready for review.",
            detail:
              "Generated from the indexed onboarding collection and waiting on the final approval step.",
          },
          memory: {
            title: "Onboarding RAG memory",
            status: "Indexing",
            summary: "96 of 124 chunks are ready for retrieval.",
            detail:
              "The published Agent will answer from this collection once indexing and validation complete.",
          },
        },
      },
    },
    legacyAi: {
      dock: {
        views: {
          preview: "Preview",
          agent: "Agent",
          deploy: "Deploy",
          tasks: "Tasks",
        },
        tools: {
          git: "Git",
          console: "Console",
          secrets: "Secrets",
          database: "Database",
          packages: "Packages",
          search: "Search",
          debugger: "Debug",
        },
        actions: {
          start: "Start",
          stop: "Stop",
          run: "Run",
          runApp: "Run app",
          stopApp: "Stop app",
          switchToolPage: "Switch tool page",
          switchToolTo: "Switch tool to {{tool}}",
        },
      },
      command: {
        placeholder: {
          plan: "Describe the plan you want the agent to prepare...",
          power: "Tell the agent what outcome to create...",
        },
        attachFile: "Attach file",
        togglePlanMode: "Toggle plan mode",
        plan: "Plan",
        agentSettings: "Agent settings",
        voiceInput: "Voice input",
        send: "Send",
        sendMessage: "Send message",
        meta: {
          plan: "Plan mode waits for approval before acting.",
          power: "Power mode can inspect, edit, run, and report back.",
        },
        shortcut: "Enter to send / Shift+Enter for newline",
      },
      taskRail: {
        workspaceTitle: "Agent OS",
        workspaceHandle: "@you",
        searchTasks: "Search tasks",
        newObjective: "New objective",
        activeWork: "Active work",
        status: {
          running: "Running",
          waiting: "Waiting",
          paused: "Paused",
          done: "Done",
        },
      },
      context: {
        livePreview: "Live preview",
        open: "Open",
        preview: {
          title: "Auth API",
          status: "401 handled / 200 ready",
        },
        runtime: "Runtime",
        changes: "Changes",
        review: "Review",
        agentControl: "Agent control",
        permissions: {
          writeAccess: "Write access",
          networkTools: "Network tools",
          deploy: "Deploy",
        },
        permissionState: {
          on: "On",
          ask: "Ask",
          manual: "Manual",
        },
        model: "Model",
        modelDescription:
          "Full tool use, code review, and approval checkpoints enabled.",
      },
      inspector: {
        eyebrow: "Inspector",
        title: "Agent implementation details",
        close: "Close inspector",
        tabs: {
          changes: "Changes",
          code: "Code",
          logs: "Logs",
          preview: "Preview",
        },
        preview: {
          title: "Auth API preview",
          description: "Login, refresh, and logout endpoints are staged.",
          status: {
            ready: "ready",
            waiting: "waiting",
          },
        },
      },
      timeline: {
        objective: "objective",
        reviewChanges: "Review changes",
        inspectCode: "Inspect code",
        statusTitle: "Agent is implementing and pausing at approval points.",
        statusDescription:
          "The main surface tracks intent, progress, decisions, and outcomes.",
        progress: "Progress",
        queuedUserInstruction: "Queued user instruction",
        approval: {
          approveSecureCookie: "Approve secure cookie flow",
          keepJsonTokens: "Keep JSON tokens",
        },
      },
      data: {
        tasks: {
          authApi: {
            title: "Ship JWT auth API",
            updatedAt: "Now",
            model: "Power / GPT-4o",
          },
          dashboard: {
            title: "Review admin dashboard",
            updatedAt: "12m ago",
            model: "Lite / Claude Haiku",
          },
          deploy: {
            title: "Deploy staging preview",
            updatedAt: "1h ago",
            model: "Power / GPT-4o",
          },
        },
        timeline: {
          authApi: {
            plan: {
              title: "Plan approved",
              detail:
                "Create Express auth routes, JWT middleware, refresh-token rotation, and request throttling.",
              artifact: "6 implementation steps",
            },
            deps: {
              title: "Installed runtime dependencies",
              detail:
                "Added express-rate-limit, jsonwebtoken, bcrypt, and validation helpers.",
            },
            routes: {
              title: "Writing route handlers",
              detail:
                "Login and refresh endpoints are wired. The agent is validating token expiry and response shapes before moving on.",
            },
            approval: {
              title: "Needs approval",
              detail:
                "Use httpOnly cookies for refresh tokens instead of returning both tokens in JSON?",
              artifact: "Security-sensitive decision",
            },
            tests: {
              title: "Run auth contract tests",
              detail: "Queued after the refresh-token decision is confirmed.",
              time: "Next",
            },
          },
          dashboard: {
            audit: {
              title: "Audit finished",
              detail:
                "Checked chart hierarchy, loading states, and keyboard focus order.",
            },
            review: {
              title: "Waiting for review",
              detail:
                "Two layout choices are ready for approval before code changes.",
            },
          },
          deploy: {
            build: {
              title: "Production build passed",
              detail: "Static assets compiled and smoke checks passed.",
            },
            preview: {
              title: "Preview deployed",
              detail: "Staging URL is live with webhook replay enabled.",
            },
          },
        },
        fileChanges: {
          authRoutes: {
            summary: "Login, refresh, and logout endpoints",
          },
          jwtMiddleware: {
            summary: "Bearer token guard and typed request user",
          },
          tokenLib: {
            summary: "Token signing and refresh rotation helpers",
          },
        },
        runtimeSignals: {
          apiServer: {
            label: "API server",
            value: "running :3000",
          },
          tests: {
            label: "Tests",
            value: "queued",
          },
          secrets: {
            label: "Secrets",
            value: "2 required",
          },
          preview: {
            label: "Preview",
            value: "healthy",
          },
        },
      },
      monolith: {
        common: {
          user: "User",
          you: "You",
        },
        topbar: {
          userHandle: "@you",
          searchCommands: "Search files & commands...",
          checkpointsTitle: "12 checkpoints - click to view history",
          checkpoints: "checkpoints",
          cyclesTitle: "1,247 cycles available - click to top up",
          previewOnPhone: "Preview on phone",
          fork: "Fork",
          share: "Share",
          collaborator: "User {{initial}}",
          run: "Run",
          stop: "Stop",
          panels: "Panels",
          taskChips: {
            restApi: "Build a REST API with auth",
            reactDashboard: "Create a React dashboard",
            postgresDatabase: "Set up a PostgreSQL database",
            deployProduction: "Deploy to production",
            unitTests: "Write unit tests",
            darkMode: "Add dark mode",
          },
        },
        replSwitcher: {
          searchPlaceholder: "Search Repls & templates...",
          tabs: {
            recent: "Recent",
            templates: "Templates",
          },
          recentTitle: "Recent",
          featuredTitle: "Featured",
          newRepl: "+ New Repl",
          importGitHub: "Import from GitHub",
          recent: {
            restApi: { desc: "REST API with JWT auth", time: "now" },
            dashboard: { desc: "Admin dashboard with charts", time: "2h ago" },
            discord: { desc: "Slash command bot", time: "yesterday" },
            stripe: { desc: "Webhook receiver + replay", time: "3d ago" },
            classifier: { desc: "scikit-learn pipeline", time: "1w ago" },
          },
          templates: {
            next: {
              name: "Next.js + Postgres",
              desc: "Full-stack starter with Drizzle",
            },
            fastapi: {
              name: "FastAPI + React",
              desc: "Python backend + Vite frontend",
            },
            discord: {
              name: "Discord Bot (TS)",
              desc: "Slash commands + Drizzle",
            },
            telegram: {
              name: "Telegram Mini App",
              desc: "Vue 3 + WebApp SDK",
            },
            agent: {
              name: "AI Agent (LangChain)",
              desc: "Tools, memory, streaming",
            },
            stripe: {
              name: "Stripe Checkout",
              desc: "Subscriptions + webhooks",
            },
            blog: {
              name: "Static blog (Astro)",
              desc: "Markdown + RSS + sitemap",
            },
          },
        },
        panels: {
          names: {
            console: "Console",
            shell: "Shell",
            webview: "Webview",
            git: "Git",
            packages: "Packages",
            secrets: "Secrets",
            database: "Database",
            search: "Search",
            debugger: "Debugger",
            deploy: "Deploy",
          },
          togglePanels: "Toggle panels:",
          console: {
            fixErrorTitle: "Ask Agent to fix this error",
            fixWithAgent: "Fix with Agent",
            runCommand: "Run a command...",
          },
          shell: {
            welcome: "Welcome to the Shell. Type commands below.",
          },
          webview: {
            open: "Open",
            loading: "Loading...",
            serverRunning: "Server running",
          },
          git: {
            tabs: {
              changes: "Changes",
              log: "Log",
              diff: "Diff",
              branches: "Branches",
            },
            changedFiles: "Changed files ({{count}})",
            commitMessage: "Commit message",
            staged: "{{count}} staged",
            commitPlaceholder: "Describe your changes...",
            committed: "✓ Committed!",
            commitFiles: "Commit {{count}} file(s)",
            current: "current",
            newBranch: "+ New branch",
            branches: {
              mainUpdated: "2h ago",
              rateLimitingUpdated: "Yesterday",
              refreshTokensUpdated: "3 days ago",
            },
            log: {
              0: { message: "Add auth middleware", time: "2h ago" },
              1: { message: "Setup Express server", time: "4h ago" },
              2: { message: "Add rate limiting", time: "Yesterday" },
              3: { message: "Initial project setup", time: "2 days ago" },
            },
          },
          packages: {
            searchPlaceholder: "Search packages...",
            addPlaceholder: "Add package...",
            install: "+ Install",
            installing: "Installing {{packageName}}...",
            headers: {
              package: "Package",
              version: "Version",
              type: "Type",
              size: "Size",
            },
            new: "new",
          },
          secrets: {
            keyPlaceholder: "KEY",
            valuePlaceholder: "value",
            add: "+ Add",
            reveal: "Reveal secret",
            hide: "Hide secret",
            copy: "Copy secret name",
            remove: "Remove secret",
          },
          database: {
            tabs: {
              query: "Query",
              tables: "Tables",
            },
            zeroRows: "Query executed - 0 rows returned",
            oneRowAffected: "1 row affected",
            syntaxError: "ERROR: syntax error at or near \"{{token}}\"",
            running: "⟳ Running...",
            run: "▶ Run (⌘↵)",
            shortcut: "Ctrl+Enter to run",
            runEmpty: "Run a query to see results",
            rows: "{{count}} rows",
          },
          search: {
            searchPlaceholder: "Search in files... (Enter)",
            caseSensitive: "Case sensitive",
            regex: "Regex",
            toggleReplace: "Toggle replace",
            replacePlaceholder: "Replace with...",
            replace: "Replace",
            replaceAll: "Replace All",
            searching: "Searching...",
            noResults: "No results for \"{{query}}\"",
            empty: "Type to search across all files",
            results: "{{count}} result(s)",
          },
          debugger: {
            controls: {
              continue: "Continue",
              pause: "Pause",
              stepOver: "Step over",
              stepInto: "Step into",
              stepOut: "Step out",
              restart: "Restart",
              stop: "Stop",
            },
            pausedAt: "Paused at {{location}}",
            running: "Running",
            tabs: {
              vars: "Vars",
              stack: "Stack",
              breakpoints: "Breakpoints",
            },
            condition: "if: {{condition}}",
            addBreakpoint: "+ Add breakpoint",
          },
          deploy: {
            tabs: {
              overview: "Overview",
              logs: "Logs",
              settings: "Settings",
            },
            production: "Production",
            deployedAgo: "Deployed 2h ago",
            labels: {
              url: "URL",
              region: "Region",
              instance: "Instance",
              uptime: "Uptime",
            },
            values: {
              region: "US East (Virginia)",
            },
            traffic: "Traffic (last 24h)",
            deploying: "⟳ Deploying...",
            deploy: "↑ Deploy",
            rollback: "Rollback",
            logs: {
              buildComplete: "✓ Build completed in 3.2s",
              testsPassed: "✓ Tests passed (47/47)",
              imagePushed: "✓ Docker image pushed",
              successful: "✓ Deployment successful",
              building: "⟳ Building...",
              installing: "✓ Installing dependencies",
              runningTests: "✓ Running tests",
              buildingImage: "✓ Building Docker image",
              pushing: "✓ Pushing to registry",
              updating: "✓ Updating deployment",
              healthPassed: "✓ Health check passed - live!",
            },
            settings: {
              autoDeploy: "Auto-deploy on push",
              runTests: "Run tests before deploy",
              rollback: "Rollback on failure",
              alwaysOn: "Always-on (prevent sleep)",
            },
          },
        },
        account: {
          signOut: "Sign out",
          nav: {
            profile: "Profile",
            settings: "Settings",
            billing: "Billing",
            aiApis: "AI APIs",
            apiKeys: "API Keys",
            agentConfig: "Agent Config",
          },
          aiApis: {
            title: "AI Model APIs",
            description:
              "Connect your API keys to enable models. {{providers}} provider(s) connected · {{models}} models active.",
            activeLabel: "Active:",
            searchPlaceholder: "Search models or providers...",
            connected: "Connected",
            activeCount: "{{count}} active",
            modelCount: "{{count}} model(s)",
            remove: "Remove",
            connect: "+ Connect",
            enterKey:
              "Enter your {{provider}} API key to unlock all {{count}} models.",
            localOnly: "Keys are stored locally and never shared.",
            keyPlaceholder: "Paste your {{provider}} API key...",
            saving: "Saving...",
            saved: "✓ Saved!",
            saveKey: "Save Key",
            featured: "Featured",
            context: "ctx {{context}}",
            active: "Active",
            setActive: "Set active",
            on: "✓ On",
            off: "Off",
            requiresKey: "Requires API key",
          },
          profile: {
            title: "Profile",
            memberSince: "Member since January 2024",
            displayName: "Display name",
            email: "Email",
            username: "Username",
            saveChanges: "Save changes",
          },
          settings: {
            title: "Settings",
            darkMode: "Dark mode",
            darkModeDesc: "Use dark theme across the interface",
            usageData: "Send anonymous usage data",
            usageDataDesc: "Help improve the product",
            autoSave: "Auto-save files",
            autoSaveDesc: "Save files automatically on change",
            inlineAi: "Show inline AI suggestions",
            inlineAiDesc: "Display model suggestions in the editor",
          },
          billing: {
            title: "Billing",
            proPlan: "Pro Plan",
            renewal: "$20 / month · Renews June 3, 2026",
            active: "Active",
            usageThisMonth: "Usage this month",
            aiTokens: "AI tokens",
            storage: "Storage",
            deployments: "Deployments",
          },
          apiKeys: {
            title: "API Keys",
            description: "Use these keys to access AI OS programmatically.",
            generate: "+ Generate new key",
            productionKey: "Production key",
            devKey: "Dev key",
            createdProd: "Jan 15, 2024",
            createdDev: "Feb 8, 2024",
            lastProd: "2h ago",
            lastDev: "Yesterday",
            keyMeta: "Created {{created}} · Last used {{last}}",
            revoke: "Revoke",
          },
        },
        agentConfig: {
          title: "Agent = Package",
          description:
            "An agent is not just a prompt - it's a software package: an orchestration loop, tool registry, memory management, and error handling. The LLM API is just one layer. Pick the framework package that fits your stack.",
          architecture: {
            title: "Agent Architecture Stack",
            taskInput: {
              label: "Task Input",
              sub: "user prompt + context + history",
            },
            framework: {
              label: "Agent Framework",
              sub: "{{packageName}} - orchestration loop, memory, tools",
            },
            protocol: { label: "Tool Calling Protocol" },
            provider: {
              label: "LLM Provider API",
              sub: "OpenAI / Anthropic / Together AI / Ollama",
            },
            executor: {
              label: "Tool Executor",
              sub: "shell · file_read · file_write · browser · deploy",
            },
          },
          selectedPackage: "selected: {{packageName}}",
          frameworkPackages: "Framework Packages",
          default: "default",
          completeImplementation: "complete agent implementation",
          packageLayers: "Package Layers",
          npmPackages: "npm packages",
          capabilities: "Capabilities",
          setDefault: "★ Set as default framework",
          defaultFramework: "Default framework",
          perTaskConfiguration: "Per-task Configuration",
          frameworkPackage: "Framework Package",
          model: "Model",
        },
        chat: {
          messages: {
            userBuildAuth:
              "Build a REST API with authentication using Express and JWT",
            agentBuildAuth:
              "I'll build a complete REST API with JWT authentication. Let me set up the project structure.",
            userAddRateLimiting: "Also add rate limiting and refresh tokens",
          },
          steps: {
            setupExpress: "Setting up Express server",
            installDependencies: "Installing dependencies",
            createMiddleware: "Creating auth middleware",
            writeRoutes: "Writing route handlers",
          },
          composer: {
            placeholder: {
              plan: "Describe what to plan...",
              power: "What should I build next?",
            },
            attachFile: "Attach file",
            planModeTitle:
              "Plan mode - agent proposes a plan before acting",
            plan: "Plan",
            voiceInput: "Voice input",
            send: "Send",
            sendPlan: "Send (Plan mode)",
            planHint:
              "Plan mode: agent will propose a step-by-step plan and wait for approval before executing.",
            shortcut: "⏎ send · ⇧⏎ newline",
          },
          tiers: {
            power: {
              name: "Power",
              description: "Smartest, full agentic loop",
              hint: "Best quality · ~$0.04/task",
            },
            lite: {
              name: "Lite",
              description: "Faster, lower cost",
              hint: "Balanced · ~$0.008/task",
            },
            eco: {
              name: "Eco",
              description: "Cheapest, basic tasks",
              hint: "Lowest cost · ~$0.001/task",
            },
          },
        },
        commandPalette: {
          placeholder: "Type a command or search files...",
          groups: {
            files: "Files",
            commands: "Commands",
            agent: "Agent",
            settings: "Settings",
          },
          items: {
            runProject: "Run project",
            stopProject: "Stop project",
            openShell: "Open shell",
            formatFile: "Format file",
            toggleTerminal: "Toggle terminal",
            restartLanguageServer: "Restart language server",
            findInFiles: "Find in files",
            gitCommitAll: "Git: commit all",
            newChat: "New chat",
            togglePlanMode: "Plan mode: Toggle",
            switchPower: "Switch to Power tier",
            switchLite: "Switch to Lite tier",
            openAgentSettings: "Open agent settings",
            openSettings: "Open settings",
            switchTheme: "Switch theme",
            keyboardShortcuts: "Keyboard shortcuts",
            accountBilling: "Account & billing",
          },
          noResults: "No results for \"{{query}}\"",
          navigate: "navigate",
          open: "open",
          close: "close",
          results: "{{count}} results",
        },
        overlays: {
          qr: {
            title: "Preview on your phone",
            scanLine1: "Scan with your phone camera",
            scanLine2: "or open in Replit Mobile app",
          },
        },
        notifications: {
          title: "Notifications",
          routeHandlers: "Agent finished writing route handlers",
          packageUpdate: "express@4.19.2 available (update)",
          branchPushed: "main branch pushed - 3 commits ahead",
          twoMinutesAgo: "2m ago",
          fifteenMinutesAgo: "15m ago",
          oneHourAgo: "1h ago",
        },
        files: {
          title: "Files",
          newFile: "New File",
          newFolder: "New Folder",
          collapseAll: "Collapse All",
        },
        sidebar: {
          agent: "Agent",
          outline: "Outline",
          threads: "Threads",
          storage: "Storage",
          bounties: "Bounties",
        },
        rail: {
          files: "Files",
          sourceControl: "Source Control",
        },
        editor: {
          newTab: "New tab",
          splitRight: "Split editor right",
          aiAccept: "✦ AI · Tab to accept",
          commentThread: "{{count}} comment thread",
        },
        bottomNav: {
          tasks: "Tasks",
          workspace: "Workspace",
          account: "Account",
        },
        help: {
          title: "Help & keyboard shortcuts",
          keyboardShortcuts: "Keyboard shortcuts",
          shortcuts: {
            commandPalette: "Command palette",
            quickFile: "Quick file open",
            inlineAi: "Inline AI edit",
            saveFile: "Save file",
            runSend: "Run / send",
            toggleComment: "Toggle comment",
            toggleSidebar: "Toggle sidebar",
            togglePanels: "Toggle bottom panels",
            commandAlt: "Command (alt)",
          },
          docs: "Docs",
          support: "Support",
          tour: "Tour",
        },
        settings: {
          workspaceSettings: "Workspace settings",
          workspace: "Workspace",
          alwaysOn: "Always-On",
          alwaysOnDesc: "Keep Repl running 24/7 · 5 cycles/day",
          boost: "Boost",
          themeLabel: "Theme",
          theme: {
            dark: "Dark",
            midnight: "Midnight",
            highContrast: "Contrast",
          },
          layoutLabel: "Layout",
          layout: {
            default: "Default",
            minimal: "Minimal",
            focus: "Focus",
          },
          links: {
            accountBilling: "Account & Billing",
            editorPreferences: "Editor preferences",
            connectedServices: "Connected services",
            privacyData: "Privacy & data",
          },
        },
        status: {
          githubSync: "GitHub: 3 ahead · 1 behind",
          running: "Running",
          stopped: "Stopped",
          portTitle: "Port 3000 → my-rest-api.you.repl.co",
          live: "Live",
          cpuUsage: "CPU usage",
          memoryUsage: "Memory usage",
          networkIo: "Network I/O",
          diskUsage: "Disk usage",
          connectionStatus: "Connection status",
          cursor: "Ln {{line}}, Col {{column}}",
          indentation: "Spaces: {{count}}",
        },
        history: {
          title: "Task History",
          configure: "Configure",
          tasks: {
            landing: {
              title: "Build a landing page for SaaS",
              time: "2h ago",
            },
            stripe: {
              title: "Add Stripe payment integration",
              time: "Yesterday",
            },
            authBug: {
              title: "Fix authentication bug in Express",
              time: "2 days ago",
            },
            adminDashboard: {
              title: "Create admin dashboard with charts",
              time: "3 days ago",
            },
            ci: {
              title: "Set up CI/CD with GitHub Actions",
              time: "5 days ago",
            },
          },
        },
        frameworks: {
          replit: {
            tagline: "Orchestrated planning loop",
            description:
              "Replit's own agent framework. Uses a structured planning loop where the agent reasons about the task, uses tools via a custom parse step, verifies the result, and checkpoints progress.",
            loop: {
              plan: "Plan task",
              callTools: "Call tools",
              parse: "Parse response",
              execute: "Execute tool",
              feedBack: "Feed result back",
              verify: "Verify + checkpoint",
            },
            pros: {
              integration: "Deep Replit integration",
              checkpoints: "Automatic checkpoints",
              filesystem: "File system access",
              streaming: "Streaming output",
            },
          },
          hermes: {
            tagline: "Native <tool_call> tokens",
            description:
              "Nous Research Hermes models are trained natively on tool calling with special XML tokens. No prompt engineering needed - the model intrinsically understands function calling format.",
            loop: {
              schema: "Send <tools> schema",
              output: "Model outputs <tool_call>",
              parse: "Parse XML token",
              execute: "Execute function",
              inject: "Inject <tool_response>",
              continue: "Model continues",
            },
            pros: {
              native: "Natively trained format",
              parallel: "Parallel tool calls",
              lowHallucination: "Low hallucination rate",
              openWeights: "Open weights",
            },
          },
          openaiFn: {
            tagline: "tools[] + finish_reason",
            description:
              "OpenAI's structured tool calling via the Chat Completions API. Pass tool definitions as JSON Schema - the model returns structured tool_calls that you execute and feed back as role: tool messages.",
            loop: {
              schema: "Send tools[] schema",
              receive: "Receive tool_calls",
              parse: "Parse JSON args",
              execute: "Execute function",
              post: "Post role:tool message",
              done: "Loop until done",
            },
            pros: {
              standard: "Industry standard",
              parallel: "Parallel calls",
              structuredArgs: "Structured args",
              models: "Works with all OpenAI models",
            },
          },
          anthropicTools: {
            tagline: "tool_use content blocks",
            description:
              "Anthropic Claude's tool use via content blocks. Tools are defined with input_schema, and the model returns tool_use blocks in the content array when it wants to call a function.",
            loop: {
              schema: "Send tools + input_schema",
              receive: "Receive tool_use block",
              extract: "Extract input JSON",
              execute: "Execute function",
              post: "Post tool_result block",
              continue: "Continue until text",
            },
            pros: {
              blocks: "Clean content blocks",
              thinking: "Built-in thinking",
              context: "Extended context",
              vision: "Vision + tools combined",
            },
          },
          custom: {
            tagline: "Custom framework",
            description: "Bring your own orchestration loop and tool protocol.",
          },
        },
        models: {
          hermes405: {
            description:
              "Most capable Hermes model. Excels at complex reasoning, agentic tasks, and long-context understanding.",
          },
          hermes70: {
            description:
              "Fast and capable. Great balance of speed and intelligence for production workloads.",
          },
          hermes2Pro: {
            description:
              "Optimized for function calling and structured JSON output.",
          },
          hermesMixtral: {
            description:
              "MoE architecture tuned for instruction following and code generation.",
          },
          gpt4o: {
            description:
              "Most capable multimodal model. Handles text, images, and audio natively.",
          },
          gpt4oMini: {
            description:
              "Fast and cost-efficient. Ideal for high-throughput tasks and real-time applications.",
          },
          gpt4Turbo: {
            description:
              "High intelligence with an updated knowledge cutoff and vision support.",
          },
          o1Preview: {
            description:
              "Frontier model designed for complex multi-step reasoning and science.",
          },
          o1Mini: {
            description:
              "Smaller, faster reasoning model optimized for STEM tasks.",
          },
          claudeSonnet: {
            description:
              "Best combination of speed and intelligence. Excellent at coding and analysis.",
          },
          claudeHaiku: {
            description:
              "Fastest and most compact Claude model for near-instant responsiveness.",
          },
          claudeOpus: {
            description:
              "Top-level intelligence for highly complex tasks requiring deep understanding.",
          },
          geminiPro: {
            description:
              "Multimodal model with the longest context window. Processes text, images, video, and audio.",
          },
          geminiFlash: {
            description:
              "Fast and versatile performance across a diverse variety of tasks.",
          },
          geminiFlash8b: {
            description:
              "High volume, lower intelligence tasks. Optimized for cost efficiency.",
          },
          llama405: {
            description:
              "Most capable open-weight model. Approaches frontier closed-source models.",
          },
          llama70: {
            description:
              "Great balance of capability and speed for most tasks.",
          },
          llama8: {
            description:
              "Lightweight model for on-device and edge deployments.",
          },
          llamaVision: {
            description:
              "Multimodal model supporting image understanding tasks.",
          },
          mistralLarge: {
            description:
              "Top-tier reasoning for complex tasks. Fluent in English, French, Spanish, German, Italian.",
          },
          mistralSmall: {
            description:
              "State-of-the-art small model optimized for low-latency workloads.",
          },
          mixtral: {
            description:
              "High-capability sparse MoE model. Excels at code and math.",
          },
          codestral: {
            description:
              "Purpose-built for code generation, completion, and fill-in-the-middle tasks.",
          },
          deepseekV3: {
            description:
              "Latest flagship model excelling at coding, math, and reasoning tasks.",
          },
          deepseekR1: {
            description:
              "Reasoning model matching OpenAI o1 performance on math and coding benchmarks.",
          },
          deepseekCoder: {
            description:
              "Specialized for code completion with support for 338 programming languages.",
          },
          grok2: {
            description:
              "State-of-the-art model with real-time knowledge via X/Twitter integration.",
          },
          grokVision: {
            description:
              "Multimodal version with image understanding capabilities.",
          },
          commandRPlus: {
            description:
              "Optimized for RAG and tool use. Best-in-class retrieval augmented generation.",
          },
          commandR: {
            description:
              "Highly performant generative model for enterprise production use cases.",
          },
          qwen: {
            description:
              "Alibaba's latest frontier model. Strong multilingual and coding performance.",
          },
          yi: {
            description:
              "01.AI's top model with strong performance across reasoning and knowledge tasks.",
          },
          dbrx: {
            description:
              "Databricks' mixture-of-experts model for enterprise AI applications.",
          },
        },
        modelTags: {
          agentic: "Agentic",
          reasoning: "Reasoning",
          fast: "Fast",
          balanced: "Balanced",
          functionCalling: "Function Calling",
          json: "JSON",
          code: "Code",
          coding: "Coding",
          moe: "MoE",
          multimodal: "Multimodal",
          vision: "Vision",
          cheap: "Cheap",
          science: "Science",
          stem: "STEM",
          analysis: "Analysis",
          creative: "Creative",
          longContext: "Long Context",
          highVolume: "High Volume",
          openSource: "Open Source",
          multilingual: "Multilingual",
          math: "Math",
          realTime: "Real-time",
          rag: "RAG",
          toolUse: "Tool Use",
          enterprise: "Enterprise",
        },
        agentPackages: {
          langchain: {
            tagline: "Provider-agnostic chains & agents",
            description:
              "The most widely-used agent framework. Ships with tool abstractions, memory backends, RAG chains, and a massive ecosystem of integrations.",
            capabilities: {
              0: "Memory",
              1: "RAG chains",
              2: "Multi-agent",
              3: "Streaming",
              4: "LangSmith tracing",
              5: "Tool calling",
              6: "Structured output",
            },
            layers: {
              0: {
                name: "Orchestration",
                detail: "AgentExecutor runs the plan-act-observe loop",
              },
              1: {
                name: "Tool Registry",
                detail: "DynamicTool / StructuredTool with JSON schema",
              },
              2: {
                name: "Memory",
                detail:
                  "BufferMemory / ConversationSummaryMemory / VectorStoreMemory",
              },
              3: {
                name: "LLM Interface",
                detail:
                  "ChatOpenAI / ChatAnthropic / ChatGoogleGenerativeAI",
              },
            },
          },
          "vercel-ai": {
            tagline: "Type-safe streaming agents for TypeScript",
            description:
              "Vercel's modern AI SDK. Best-in-class streaming with RSC, Zod-typed tool parameters, multi-step agent loops, and React hooks out of the box.",
            capabilities: {
              0: "Streaming RSC",
              1: "Type-safe Zod tools",
              2: "Multi-step loop",
              3: "React hooks (useChat)",
              4: "Edge runtime",
              5: "Structured output",
            },
            layers: {
              0: {
                name: "Orchestration",
                detail: "generateText/streamText with maxSteps auto-loops",
              },
              1: {
                name: "Tool Registry",
                detail: "tool() with Zod schemas - fully type-safe",
              },
              2: {
                name: "Streaming",
                detail:
                  "Server-sent events, RSC, useChat / useCompletion hooks",
              },
              3: {
                name: "LLM Interface",
                detail:
                  "@ai-sdk/openai | @ai-sdk/anthropic | @ai-sdk/google",
              },
            },
          },
          "hermes-native": {
            tagline: "Raw loop + <tool_call> tokens - no framework",
            description:
              "No framework at all. Hermes models are natively trained on tool calling tokens. Write the orchestration loop yourself in ~50 lines. Full control, zero overhead.",
            capabilities: {
              0: "Native token format",
              1: "Zero overhead",
              2: "Full loop control",
              3: "Open weights",
              4: "Self-hostable",
              5: "Parallel tool calls",
            },
            layers: {
              0: {
                name: "Orchestration",
                detail: "Your own while-loop - full control",
              },
              1: {
                name: "Tool Registry",
                detail: "Plain array of JSON Schema objects in system prompt",
              },
              2: {
                name: "Protocol",
                detail: "Native <tool_call> / <tool_response> XML tokens",
              },
              3: {
                name: "LLM Interface",
                detail:
                  "OpenAI-compatible client -> Together AI / vLLM / Ollama",
              },
            },
          },
          "openai-assistants": {
            tagline: "Managed threads, runs & built-in tools",
            description:
              "OpenAI's managed agent infrastructure. Persistent threads handle context automatically. Built-in code interpreter, file search, and function calling with no loop to manage.",
            capabilities: {
              0: "Managed threads",
              1: "Auto context",
              2: "Code interpreter",
              3: "File search",
              4: "Persistent state",
              5: "Streaming runs",
            },
            layers: {
              0: {
                name: "Orchestration",
                detail: "OpenAI-managed run loop - no while-loop needed",
              },
              1: {
                name: "Tool Registry",
                detail:
                  "functions[] + built-in code_interpreter + file_search",
              },
              2: {
                name: "Memory",
                detail:
                  "Threads = persistent conversation, managed automatically",
              },
              3: {
                name: "LLM Interface",
                detail: "OpenAI models only (gpt-4o, o1, etc.)",
              },
            },
          },
          crewai: {
            tagline: "Multi-agent crews with role-based delegation",
            description:
              "Multi-agent framework where specialized agents collaborate in crews. Define a Coder, Reviewer, and Tester - each with their own LLM, tools, and goal.",
            capabilities: {
              0: "Multi-agent",
              1: "Role-based",
              2: "Task context passing",
              3: "Process.sequential/hierarchical",
              4: "Memory",
              5: "Delegation",
            },
            layers: {
              0: {
                name: "Orchestration",
                detail:
                  "Crew.kickoff() - sequential or hierarchical process",
              },
              1: {
                name: "Agent Layer",
                detail: "Each Agent has its own LLM, tools, goal, memory",
              },
              2: {
                name: "Task Graph",
                detail: "Tasks with context[] - outputs flow between agents",
              },
              3: {
                name: "LLM Interface",
                detail: "Any LangChain-supported LLM per agent",
              },
            },
          },
          autogen: {
            tagline: "Microsoft: conversational multi-agent + code exec",
            description:
              "Microsoft's framework for building multi-agent conversations. Human-in-the-loop, automated code execution, and nested conversations between specialized agents.",
            capabilities: {
              0: "Multi-agent chat",
              1: "Code executor",
              2: "Human-in-loop",
              3: "Group orchestration",
              4: "Streaming",
              5: "Nested conversations",
            },
            layers: {
              0: {
                name: "Orchestration",
                detail:
                  "RoundRobinGroupChat / SelectorGroupChat team loop",
              },
              1: {
                name: "Agent Layer",
                detail:
                  "AssistantAgent + CodeExecutorAgent + UserProxyAgent",
              },
              2: {
                name: "Code Execution",
                detail:
                  "LocalCommandLineCodeExecutor / DockerCommandLineExecutor",
              },
              3: {
                name: "LLM Interface",
                detail:
                  "OpenAIChatCompletionClient / AnthropicChatCompletionClient",
              },
            },
          },
        },
      },
    },
    missionCenter: {
      badge: "Mission Center",
      title: "Mission Control",
      description:
        "Mission Center is the default entry for users: describe work, generate a mission plan, review steps, dependencies, and approvals, then decide whether to execute.",
      currentPlan: "Current plan",
      approvalSteps: "Approval steps",
      riskLevel: "Risk level",
      steps: "{{count}} steps",
      tabMissionCenter: "Mission Center",
      tabBackstage: "Backstage",
      statusTitle: "Mission status",
      generatedStatus: "Latest mission plan generated. Review the steps, dependencies, and approval points first.",
      revisedStatus: "Plan updated. Confirm the key approval steps again.",
      approvedStatus: "Plan confirmed. You can keep it as a plan or continue to execution.",
      executeReadyStatus: "Execution request sent. Open Backstage to review run details.",
      planOnlyStatus: "Kept as a plan. Execution has not started.",
      planOnlySavedStatus: "Kept as a plan. Execution has not started; you can return to the details later.",
      missionApiUnavailable: "Mission API unavailable",
      revisionUpdateFailed: "Revision update failed",
      approveFailed: "Approve failed",
      executeFailed: "Execute failed",
      defaultRevisionInstruction:
        "Please clarify the task split, dependencies, and approval notes for the current mission.",
      waitingTitle: "Waiting for a mission plan",
      waitingDescription:
        "After the first plan is generated, this area will show the mission summary, role recommendations, step dependencies, and approval summary.",
      handoffTitle: "Backstage handoff",
      handoffDescription:
        "Backstage keeps Agents, Skills, Runs, and Artifacts available. Operator handles advanced governance, manifest review, and protected edits.",
      handoffFallback:
        "After you confirm the plan, switch to Backstage to inspect Runs, Artifacts, Skill UI, and the Approval Inbox.",
      openBackstage: "Open Backstage workbench",
      openOperator: "Open Operator entry",
    },
    missionIntake: {
      badge: "Mission intake",
      title: "What should the AI team accomplish?",
      description:
        "Describe the goal, constraints, and expected output. The system will call the Mission API to generate a summary, steps, dependencies, and approval suggestions.",
      placeholder:
        "Example: Sync the website, product docs, and FAQ into a knowledge agent for the sales team. Give me the plan and approval points first.",
      reviewMode: "Review mode",
      draftForReview: "Review before execution",
      planOnly: "Plan only",
      submit: "Generate plan",
      apiFailed: "Mission API request failed",
    },
    planReview: {
      missionSummary: "Mission summary",
      revision: "Revision",
      executionIntent: "Execution intent",
      executeAfterApproval: "Execute after approval",
      planOnly: "Plan only",
      conflictTitle: "Version conflict detected",
      stepReview: "Step review",
      stepReviewDescription: "Review steps, dependencies, skills, and approval requirements.",
      roleSuggestions: "Role suggestions",
      roleSuggestionsDescription: "Suggested role and skill ownership inferred from plan steps.",
      noExplicitSkills: "The current plan does not declare explicit skills.",
      planActions: "Plan actions",
      planActionsDescription: "Confirm, revise, or execute the current plan.",
      revisionPlaceholder:
        "Example: Split high-risk steps into smaller units and move approvals before data writes.",
      approve: "Confirm plan",
      revise: "Revise plan",
      execute: "Execute",
      executionReady: "Execution is ready",
      stillPlanning: "Execution is still in planning",
      advancedDetails: "Advanced details",
      roleLabels: {
        web_listening: "Intelligence monitoring",
        doc_to_md: "Document preparation",
        md_to_rag: "Knowledge indexing",
        rag_to_agent: "Agent assembly",
        climate_monitor: "Monitoring review",
        ai_actuary: "Risk assessment",
      },
    },
    approvalSummary: {
      title: "Approval summary",
      description: "Focuses on required human decisions and overall risk exposure.",
      noRequiredSteps: "The current plan has no extra mandatory approval steps.",
    },
    planStep: {
      dependsOn: "Depends on",
      approval: "Approval",
    },
    approvalCard: {
      runtimeStep: "Runtime step",
      mission: "Mission:",
      revision: "Revision:",
      moduleRun: "Module run:",
      requested: "Requested:",
      approve: "Approve",
      reject: "Reject",
    },
    approvalInbox: {
      title: "Approval Inbox",
      approved: "Approved: {{action}}",
      rejected: "Rejected: {{action}}",
      description: "Collects high-risk actions waiting for human confirmation and refreshes after decisions.",
      updatedTitle: "Approval updated",
      unavailableTitle: "Approval inbox unavailable",
      loading:
        "Refreshing approval list. Wait for the latest pending actions and redacted summaries before continuing.",
      empty:
        "No pending approvals. Mission approval does not mean execution has started; new high-risk steps will appear here separately.",
      apiUnavailable: "Approval API unavailable",
      decisionFailed: "Approval decision failed",
    },
    executionBoard: {
      title: "Execution Board",
      description: "Shows execution status, blockers, and latest artifacts by Agent / Role.",
      revisionSuffix: " Current revision: {{revisionId}}",
      unavailableTitle: "Execution Board unavailable",
      unavailableFallback: "Execution board unavailable",
      loading:
        "Syncing the mission execution board. Role status, blockers, and artifact summaries will appear shortly.",
      noMission: "Create and select a mission before opening the Execution Board.",
      empty:
        "There are no execution records yet. Approve only confirms the plan; real run state and artifact links appear after execution.",
    },
    agentStatus: {
      approvalLink: "Handle in Approval Inbox",
    },
    artifactStrip: {
      empty: "No latest artifacts yet.",
    },
  },
} as const;
