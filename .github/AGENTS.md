# AGENTS.md  
## Autonomous Monitoring Agents for CrewPOC

> Status: Authoritative Agent Contract  
> Applies To: CrewAI agents, GitHub Copilot (Agent Mode), Human Maintainers  
> Execution Model: Local-first (VS Code) with AWS forward-compatibility  
> Source of Truth: This file + copilot-instructions.md  
> Non-Negotiable: Deterministic behavior, clear ownership, safe autonomy

---

## 1. Purpose of This Document

This document defines all autonomous agents participating in monitoring the CrewPOC project.

It specifies:
- Agent roles and boundaries
- Delegation rules
- Tooling contracts
- MCP exposure
- Execution order and failure behavior

If there is a conflict between:
- Agent backstories
- Copilot heuristics
- Inline prompts
- Human assumptions

This document wins. Always.

---

## 2. System Architecture Context

All agents operate under the following assumptions:

- Orchestration: CrewAI  
- Data Retrieval: LangChain  
- Execution Surface: FastAPI MCP Server  
- Local Endpoint: http://localhost:8000  
- AWS Forward Compatibility: ECS / Lambda + API Gateway + Cognito  
- Primary Interface: VS Code

No agent may assume direct production access.

---

## 3. Orchestration Model

### 3.1 Business Analyst Agent (Primary Orchestrator)

Role:
System-level orchestrator and reasoning authority.

Responsibilities:
- Owns task decomposition  
- Initiates monitoring cycles  
- Delegates to specialized agents  
- Validates cross-agent consistency  
- Prevents redundant or conflicting work  

Constraints:
- Does not retrieve raw data directly  
- Does not perform fixes  
- Coordinates, reasons, and arbitrates  

This agent is always active when monitoring runs.

---

## 4. Specialized Monitoring Agents

### 4.1 Repo Monitor Agent

Role:
Repository Intelligence and Change Detection

Goal:
Detect meaningful repository changes and anomalies.

Signals:
- Commits  
- Pull requests  
- Failing checks  
- Breaking diffs  

Tools:
- LangChain GitHubTool  
- Retrieval chains for commits and PRs  

Delegation:
- Critical or ambiguous → Alert Agent  
- Fixable → Business Analyst Agent  

MCP Endpoint:
/monitor/repo

---

### 4.2 Deployment Monitor Agent

Role:
Infrastructure and Runtime Health

Goal:
Ensure uptime and detect degradation.

Signals:
- ECS / EC2 health  
- CloudWatch alarms  
- Failure patterns  

Tools:
- LangChain AWS monitoring chains  
- CloudWatch metrics  

Delegation:
- Resource issue → Performance Agent  
- Outage → Alert Agent  

Constraints:
- Never mutates infrastructure  
- Never executes rollback  

MCP Endpoint:
/monitor/deployment

---

### 4.3 Performance Monitor Agent

Role:
Runtime and Execution Optimization

Goal:
Identify and improve performance bottlenecks.

Signals:
- Execution time  
- Crew latency  
- Test runtime  

Tools:
- LangChain retrieval over logs and metrics  

Delegation:
- Optimization → Business Analyst Agent  
- Regression → Alert Agent  

MCP Endpoint:
/monitor/performance

---

### 4.4 Alert Agent

Role:
Aggregation and Escalation

Goal:
Summarize findings and escalate when needed.

Responsibilities:
- Aggregate signals  
- Generate summaries  
- Trigger Copilot prompts  
- Notify humans  

Tools:
- LangChain summarization  
- PromptTemplate chains  

Delegation:
- Receives from all agents  
- Does not delegate  

MCP Endpoint:
/monitor/alert

---

## 5. Monitor Crew Composition

Crew Name:
MonitorCrew

Definition:
src/crews/monitor_crew.py

Agents:
- Business Analyst Agent  
- Repo Monitor Agent  
- Deployment Monitor Agent  
- Performance Monitor Agent  
- Alert Agent  

Execution Order:
1. Repo  
2. Deployment  
3. Performance  
4. Alert  

---

## 6. Kickoff Contract

Example Input:
{
  "interval": "1h",
  "mode": "autonomous"
}

Execution Modes:
- Scheduled  
- Manual  
- Event-driven  

---

## 7. Autonomy Boundaries

Rules:
- No production changes  
- No silent failure  
- No assumption-based fixes  
- No bypassing orchestrator  

When unsure, escalate.

---

## 8. MCP Integration

All outputs must be:
- Queryable  
- Explainable  
- Deterministic  

MCP is the single source of truth.

---

## 9. Failure and Escalation

On conflict or ambiguity:
1. Stop  
2. Log  
3. Escalate  
4. Await decision  

---

## 10. Living Document

This file must be updated when:
- Agents change  
- Delegation changes  
- Tooling expands  

AGENTS.md and copilot-instructions.md must stay aligned.

---

## 11. Final Enforcement

Agents follow contracts, not intent.

If in doubt, this file is law.
