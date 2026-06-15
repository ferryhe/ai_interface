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
