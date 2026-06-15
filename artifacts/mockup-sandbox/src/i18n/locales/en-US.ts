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
      missionRole: "mission-role",
      runs: "{{count}} runs",
      noRunsYet: "no runs yet",
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
          not_configured: "not configured",
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
          approval_required: "approval required",
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
        resultRecordCount: "{{count}} result record",
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
        status: "Status: {{status}}",
        criticalRules: "⚠ Critical Rules",
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
          fallbackData: "markdown docs",
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
      },
      apiFallback: {
        apiResult: "API result",
        moduleRun: "Module run",
        apiResultWithRun: "API result {{runId}}",
        apiRunWithId: "API run {{runId}}",
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
            dataCount: "6 markdown docs",
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
      runtimeStep: "runtime-step",
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
