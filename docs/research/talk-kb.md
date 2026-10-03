# Talk knowledge base: Beyond the Coding Agent: From Software Engineer to AI Engineer

Compiled September 15, 2026 from the talk repository at `scratchpad/beyond-the-coding-agent/`. Files read: `outlines/outline-v2.md`, all 26 slide files under `slides/section-1`, `slides/section-2`, `slides/section-3`, `research/section-1.md`, `research/section-2.md`, `research/section-3.md`, `README.md`, `AGENTS.md`, `internal/deck/corrections-2026-09-15.md`, the four files under `reviews/`, the two anatomy SVGs, and `internal/build-diagrams.mjs`. `outlines/outline-v1.md` was skipped by instruction.

Conventions in this file:

- Quotes are copied exactly, including the source's own punctuation. Where a quoted passage contains an en-dash or curly quote from the source, it is preserved.
- `[primary]` and `UNVERIFIED` are the research files' own markers. `[primary]` means the source was fetched and quoted directly. `UNVERIFIED` means the claim came from a snippet or secondary coverage. Some entries carry no marker in the research file; that is recorded as "no marker."
- "Beat" numbers are the outline's: 1.1 to 1.6, 2.0 to 2.6, 3.0 to 3.5, and Section 4 for questions.
- "Research §N" refers to the numbered sections of the research files. Section 2 research is numbered §0 through §7, where §0 is the map and §1 through §6 match beats 2.1 through 2.6.
- Where two repository files disagree, both wordings are recorded and the disagreement is flagged with **[files disagree]**. A collected list is in section G.

Session facts (README and outline): 50 minutes, 35:00 of presentation and 15:00 of questions. Date September 17, 2026. Audience: software engineers who want to move into AI engineering. Most have used a coding agent. Few have shipped a system whose behavior depends on a model. Deck: 26 narrative slides across sections of 6, 13, and 7; 34 authored compositions expand to 64 PowerPoint slides, with 19 internal clicks and 83 presentation states (README). **[files disagree]** `internal/deck/corrections-2026-09-15.md` and the four review files describe an earlier build with 25 narrative slides (6, 13, 6), 33 physical slides, and 81 rendered click states. Slide 20, the Section 3 divider, was added after those documents were written, so their Section 3 slide numbers are one lower than the current files (their "slide 22" pitfalls is now slide 23, their "slide 23" roadmap is now slide 24, their "slide 24" resources is now slide 25, their "slide 25" close is now slide 26).

---

## A. Thesis and Section 1

### A.1 The two thesis sentences (slide 3, repeated on slide 26)

Verbatim, on the slide and nothing else:

- Using AI makes you an AI-enabled software engineer.
- Engineering systems that depend on AI makes you an AI engineer.

Outline "Central thesis" paragraph, verbatim:

> Using AI makes you an AI-enabled software engineer. Engineering systems that depend on AI makes you an AI engineer.
>
> AI engineering builds on a foundation of software engineering. This talk focuses on products around foundation models, with overlapping AI and ML roles. It adds the skills and practices needed to make systems useful, reliable, and trustworthy when part of their behavior is delegated to a foundation model. Agentic systems, where the model participates in control flow, are its most demanding expression.

Slide 3 talk track (0:45), verbatim:

- [0:00] **Using AI makes you an AI-enabled software engineer. Engineering systems that depend on AI makes you an AI engineer.**
- [0:08] **This talk focuses on building products around foundation models.** Your software engineering skills are the foundation. The additional responsibility is measuring and controlling model-dependent behavior.
- [0:22] ML engineers typically focus on models and the pipelines that produce them. AI engineers typically focus on products around models. The roles overlap, including adaptation and fine-tuning.
- [0:34] **Owner means the engineer or team accountable for the delivered product's behavior and operating limits.**

**[files disagree]** The outline 1.3 "say" bullet reads "Software engineering is the foundation. The added responsibility is measuring and controlling model-dependent behavior." Slide 3 reads "Your software engineering skills are the foundation. The additional responsibility is measuring and controlling model-dependent behavior."

Takeaway line for 1.3: "The additional responsibility is measuring and controlling model-dependent behavior."

Sources for 1.3: CMU SEI; Huyen, 2025; swyx, June 2023, as background. Research §1 in `research/section-1.md`. Slide 3 adds: "Application engineering includes adaptation. Roles overlap." and "swyx, June 2023, remains background. The essay does not date the invention of the title."

### A.2 Definition of owner

Verbatim (outline "The Section 2 pattern" and slide 3):

> Define owner once on slide 3: the engineer or team accountable for the delivered product's behavior and operating limits.

Spoken form: "Owner means the engineer or team accountable for the delivered product's behavior and operating limits."

### A.3 The Karpathy works.any() / works.all() framing (beat 1.1, slide 1)

On the slide, build 1, monospace, centered:

```
demo    = works.any()
product = works.all()
```

Small, bottom right: Andrej Karpathy, June 2025.

Exact quote: "Demo is works.any(), product is works.all()"

Source: Andrej Karpathy, "Software Is Changing (Again)," YC AI Startup School, June 17, 2025. `[primary via Latent Space transcript]`. https://www.latent.space/p/s3 Research §2 in `research/section-1.md`. No `[verify]` flag.

Other lines from the same source recorded in research: "the hottest new programming language is English"; on the generation-verification loop: "To improve verification: Make it easy, fast to win. To improve generation: Keep AI on tight leash."; Software 1.0 (hand-written code), 2.0 (learned weights), 3.0 (prompts as programs).

Talk interpretation of the metaphor (research §2): "a demo shows a useful path. Production readiness means reliable behavior across intended use, with safe handling when the system cannot complete a task. This is not a claim of exhaustive correctness."

Slide 1 talk track (1:00), verbatim:

- [0:00] Title state. A greeting, nothing more. In June 2025, Andrej Karpathy put the whole problem in one line.
- [0:10] Build 1. **"Demo is works.any(), product is works.all()."** **A demo proves that a useful path exists. A product needs reliable behavior across its intended use, with a safe response when it cannot complete the task.**
- [0:25] **You have probably seen your coding agent do something impressive this week.** That experience is the starting point for this talk.
- [0:40] **The distance between those two calls is what this talk is about.** It is the distance between using AI and engineering it.

Cut rule: "Cut first: the greeting and the final setup sentence. Never cut the intended-use and safe-failure interpretation of the metaphor."

Takeaway line for 1.1: "Production readiness means reliable behavior across intended use, with safe handling when the task cannot be completed."

Slide 1 layout note: the two lines are "the line the talk returns to on slides 4, 17, and 22." (Slide numbering in that note predates slide 20; the callbacks are on slides 4, 17 area, and 23 in current numbering.)

Alternates considered for the opener (research §7 in `research/section-1.md`, ranked): 1. works.any() vs works.all(). 2. The prediction that came true (swyx, June 2023; AI engineer #1 on LinkedIn Jobs on the Rise 2026; "Use the ranking, not the percentages"). 3. Fowler's tolerances. 4. The six-week vocabulary (requires date and joke-framing verification). 5. The stat you should not trust (MIT 95%). "Avoid as openers: the raw MIT 95%; the Gartner 40% without attribution and date; any AI-engineer salary or unsupported growth percentage; the reconstructed Karpathy Sequoia quotes."

### A.4 Who is talking: the approved bio (beat 1.2, slide 2)

Approved from sequenzia.com, September 14, 2026. No employer named on the deck, by the presenter's choice. Photo: `internal/profile-320.webp`, 320 by 320 pixels.

- Stephen Sequenzia
- Senior Staff AI/ML Engineer and Architect
- Three lines, verbatim:
  1. Twenty years putting systems into production. The last several with a model in the loop.
  2. Leads architecture for agentic AI systems across defense programs.
  3. Has helped 500+ engineers adopt agents, and watched where using one stops and engineering one begins.

Spoken form (slide 2 talk track): "I'm Stephen Sequenzia, a Senior Staff AI/ML Engineer and Architect, and I have spent twenty years putting systems into production, the last several with a model in the loop. Today I lead architecture for agentic AI systems across defense programs, where the users are engineers and operators and a demo that worked once is not a system. I care about this distinction because I have helped five hundred engineers adopt agents, and watched where using one stops and engineering one begins."

Backup, not spoken: "eight to ten concurrent AI and ML efforts; an 85% reduction in production ML deployment time. Both are on the public site if anyone asks what 'production' means." Source line: sequenzia.com, read September 14, 2026: current role since 2022; "8–10 concurrent AI/ML efforts"; "500+ engineers" reached through agentic engineering enablement; "~85% deployment-time reduction."

Story #1 slot (optional): "The moment a demo you built turned out not to be the product. It must show one concrete failure where a working path was not a working system. Thirty seconds." Recommendation in slide 2: hold it for slide 16 unless the bio can be delivered in ten seconds.

### A.5 Using AI vs engineering AI (beat 1.4, slide 4, two builds, 1:45)

Build 1, the three-row comparison table, verbatim:

| AI in your development workflow | AI in the product you deliver |
|---|---|
| You use model output to help build an artifact | Users depend on model output or decisions during operation |
| You decide what to accept and ship | You design checks, approval steps, and failure handling |
| Your coding-tool provider operates the agent platform | Your team owns the product's behavior and operating limits |

Build 2, the three commitments, verbatim as on slide 4:

1. A compelling prototype is not evidence of production readiness.
   Small beneath: works.any() is not works.all()
2. Traditional tests are necessary but no longer sufficient.
3. Evaluation does not stop at deployment.

**[files disagree]** Outline 1.4 lists the commitments as: "1. A compelling prototype is not evidence of production readiness. works.any() is not works.all(). 2. Traditional tests remain necessary but are no longer sufficient. 3. Evaluation does not stop at deployment." Slide 4 uses "are necessary but no longer sufficient." The README's published description reads "why traditional software tests remain necessary but are no longer sufficient."

Slide 4 talk track, verbatim:

- [0:00] **This comparison is about where the model-dependent behavior lives.** In development, you use output to build an artifact and decide what to accept and ship. In the product, users depend on model output or decisions during operation.
- [0:18] **You design the checks, approval steps, and failure handling.** Human review can be part of either system. Your team owns the product's behavior and operating limits.
- [0:34] Separately, Anthropic distinguishes workflows on predefined code paths from agents with model-selected actions. **An agent adds model-selected actions to control flow. Ordinary code can still enforce permissions, limits, and other guarantees.** That is why we will examine the system around the model.
- [0:58] Fowler compares this to other engineering disciplines that build tolerances for variability. Reliable behavior across intended use includes a safe response when the system cannot complete a task.
- [1:12] Shankar and colleagues studied how grading outputs helps people refine evaluation criteria. **Watching failures can expose missing requirements.** Some checks are known from the start; others improve as we learn.
- [1:30] Build 2. **A compelling prototype is not evidence of production readiness. Traditional tests are necessary but no longer sufficient. Evaluation does not stop at deployment.**
- [1:40] **Using AI changes how you build. Engineering AI changes what you are responsible for.**

Cut rule: "Cut first: the row walk, then the Fowler comparison. Never cut the model-selected-actions distinction, enforceable limits, or commitments."

Takeaway line for 1.4: "Using AI changes how you build. Engineering AI changes what you are responsible for."

#### Anthropic workflow vs agent definitions, verbatim

Source: Anthropic, "Building effective agents," Erik Schluntz and Barry Zhang, December 19, 2024. `[primary]`. https://www.anthropic.com/engineering/building-effective-agents Research §5 in `research/section-1.md` and §4 in `research/section-2.md`.

- Umbrella term "agentic systems," then an architectural distinction.
- Workflows: "systems where LLMs and tools are orchestrated through predefined code paths."
- Agents: "systems where LLMs dynamically direct their own processes and tool usage, maintaining control over how they accomplish tasks."
- "we recommend finding the simplest solution possible, and only increasing complexity when needed."
- "Agents are the better option when flexibility and model-driven decision-making are needed at scale. For many applications, however, optimizing single LLM calls with retrieval and in-context examples is usually enough."
- "you should consider adding complexity only when it demonstrably improves outcomes."
- "Agentic systems often trade latency and cost for better task performance, and you should consider when this tradeoff makes sense."
- "it's also common to include stopping conditions (such as a maximum number of iterations) to maintain control."
- Five workflow patterns: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer.
- Frameworks "often create extra layers of abstraction that can obscure the underlying prompts and responses, making them harder to debug." Section 3 research adds the continuation: "They can also make it tempting to add complexity when a simpler setup would suffice."
- "Start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short." (research/section-3.md §3)
- Talk framing (research §5): "an agent adds model-selected actions to control flow. Ordinary code can still enforce permissions, limits, and other guarantees. Model behavior calls for measurement and failure handling within those boundaries."

Outline 1.4 phrasing of the same point: "Anthropic's distinction is the useful one. Workflows are LLMs and tools orchestrated through predefined code paths. Agents are LLMs that dynamically direct their own processes and tool usage. **An agent adds model-selected actions to control flow. Ordinary code can still enforce permissions, limits, and other guarantees.** That is why agentic systems are the most demanding expression of this discipline, and why they are the focus for the next twenty-five minutes."

#### Fowler, with source

Source: Martin Fowler, "Some thoughts on LLMs and Software Development," August 28, 2025. `[primary]`. https://www.martinfowler.com/articles/202508-ai-thoughts.html Research §2 in `research/section-1.md`.

- "Maybe LLMs mark the point where we join our engineering peers in a world on non-determinism." (Research note: "Fowler's text reads 'on'; quote it as written or paraphrase." Slide 4: "never 'of.'")
- "Other forms of engineering have to take into account the variability of the world. A structural engineer builds in tolerance for all the factors she can't measure."
- "All an LLM does is produce hallucinations, it's just that we find some of them useful."
- "I've often heard, with decent reason, an LLM compared to a junior colleague. But I find LLMs are quite happy to say 'all tests green', yet when I run them, there are failures."

Outline 1.4 use: "Fowler's framing: this is software joining the rest of engineering in a world of non-determinism. Other disciplines build tolerances for what they cannot measure. We now have to." Slide 4 paraphrases.

#### Shankar and colleagues, criteria drift, with source

Source: Shreya Shankar, J.D. Zamfirescu-Pereira, Björn Hartmann, Aditya G. Parameswaran, Ian Arawjo, "Who Validates the Validators? Aligning LLM-Assisted Evaluation of LLM Outputs with Human Preferences," UIST 2024 (arXiv 2404.12272, April 18, 2024). https://arxiv.org/abs/2404.12272 Research §3 in `research/section-1.md`. Marker: the research entry carries no bracketed marker on its bold line but says "Verified from the abstract" and "Peer-reviewed"; slide 4 records it as `[primary]`.

- Verified from the abstract: "users need criteria to grade outputs, but grading outputs helps users define criteria."
- "some criteria appears dependent on the specific LLM outputs observed (rather than independent criteria that can be defined a priori), raising serious questions for approaches that assume the independence of evaluation from observation of model outputs."
- Research note: "This is the rigorous argument that natural-language specification differs in kind: in traditional engineering you write the spec and then the tests; here the spec is discovered by watching outputs. Named 'criteria drift.'"

Outline 1.4 use: "One more thing changes, and it is subtle. Shankar and colleagues showed in a peer-reviewed study that people cannot fully write their evaluation criteria before seeing outputs. Grading outputs is how you discover the criteria. They call it criteria drift. So the order you are used to, spec then tests then code, partly inverts. You learn the spec by watching the system."

Sources line for 1.4: Anthropic, "Building effective agents," December 2024; Shankar et al., UIST 2024; Fowler, August 2025. Research §2, §3, §5. Slide 4 also: "The three commitments restate the published session description in the README."

### A.6 What you will leave with, and the agenda (beat 1.5, slide 5, 0:45)

Left column, heading "You will leave with", the three takeaways verbatim:

1. A conceptual map of the discipline.
2. An honest sense of how much there is.
3. A roadmap for making the transition.

Right column, heading "Agenda":

- The map. 2 min
- Six areas. 23 min. Models. Context and knowledge. Tools. Orchestration. Verification and evals. Operating it.
- The transition. 5 min
- Your questions. 15 min

Footer line, full width, smaller: When you are the user · What someone engineered · When you are the owner

Spoken: "Three things to leave with. **A conceptual map of the discipline. An honest sense of how much there is. And a roadmap for making the transition.**" and "**For each area: When you are the user, including what someone engineered, then When you are the owner.**"

Source: the session description in the README. The three takeaways paraphrase its closing sentence: "Attendees will leave with a clear conceptual map of the discipline, a realistic understanding of its complexity, and a roadmap for becoming an AI engineer rather than merely a software engineer who uses AI."

### A.7 Transition (beat 1.6, slide 6, 0:15)

Label: Section 2. Title: What AI engineers actually engineer. Spoken and takeaway line: "Let's open up the tool you used this morning." Sources: none.

### A.8 Section 1 checks (outline)

- Time: 1:00 + 0:30 + 0:45 + 1:45 + 0:45 + 0:15 = 5:00.
- Description scope covered: using vs engineering; distinct discipline; AI engineer vs ML engineer; agentic systems as the most demanding expression; the three claims stated as commitments.
- Verify before stage: no Section 1 quote is flagged.

### A.9 Section 1 background definitions (research §1, not spoken)

- swyx, "The Rise of the AI Engineer," Latent Space, June 30, 2023 `[primary]`: "We are observing a once in a generation 'shift right' of applied AI." "A wide range of AI tasks that used to take 5 years and a research team to accomplish in 2013, now just require API docs and a spare afternoon in 2023." "There are 10x as many ML Engineer jobs as AI Engineer jobs on Indeed, but the higher growth rate of 'AI' leads me to predict that this ratio will invert in 5 years." "There are ~5000 LLM researchers in the world, but ~50m software engineers." "When it comes to shipping AI products, you want engineers, not researchers." Quoting Karpathy: "One can be quite successful in this role without ever training anything." Research note: "The essay never gives a single declarative definition; the role is built up descriptively."
- swyx, Scrimba Podcast, January 24, 2024 `[primary]`: "Most people start off as AI enhanced engineers, they use AI products to improve their own productivity. Then they progress towards AI products engineers, where they work on AI products, where they wield AI APIs to expose them to end users. And then finally you have the AI agents, where you effectively delegate your work to an agent to execute."
- swyx, RedMonk, July 23, 2025 `[primary]`: "there's a kind of three types of AI Engineers. This is the first keynote that I did for the AI Engineer Summit. it's a software engineer that is enhanced by AI, so they use AI coding tools. The second one is a software engineer building AI products. And the third is a non-human software engineer that is completely AI." Research note: the middle tier is this talk; "His first tier, the 'AI enhanced engineer,' is the talk's 'AI-enabled software engineer' under another name, which makes the thesis a restatement of an existing split rather than a coinage."
- Chip Huyen, AI Engineering, O'Reilly, 2025 (repo `[primary for the repo]`): "AIE focuses on building applications on top of foundation models, which involves more prompt engineering, context construction, and parameter-efficient finetuning." Earlier book: "more tabular data annotations, feature engineering, and model training." Chapter 1 wording UNVERIFIED (O'Reilly returned 403). "The circulating shorthand 'AI engineering is the process of building applications with readily available foundation models' is marketing copy; do not attribute it as her sentence."
- CMU SEI `[primary]`: "AI Engineering is a field of research and practice that combines the principles of systems engineering, software engineering, computer science, and human-centered design to create AI systems in accordance with human needs for mission outcomes." Three pillars: human-centered AI, scalable AI, robust and secure AI. "Predates the LLM era, which is why it grounds 'built on software engineering' rather than 'replaces it.'"
- roadmap.sh: "An AI Engineer uses pre-trained models and existing AI tools to improve user experiences," focusing on "applying AI in practical ways, without building models from scratch," versus researchers and ML engineers who "focus more on creating new models or developing AI theory."
- Simon Willison, "Not all AI-assisted programming is vibe coding," March 19, 2025 `[primary]`: "If an LLM wrote every line of your code, but you've reviewed, tested, and understood it all, that's not vibe coding in my book, that's using an LLM as a typing assistant." Karpathy coined "vibe coding" on February 6, 2025.
- Simon Willison, "Vibe engineering," October 7, 2025 `[primary]`: vibe engineering is where "seasoned professionals accelerate their work with LLMs while staying proudly and confidently accountable for the software they produce." Prerequisites: automated testing, planning in advance, comprehensive documentation, good version control habits, effective automation, a culture of code review, really good manual QA, strong research skills. "Useful as the definition of the 'AI-enabled software engineer' side of the line."
- Birgitta Böckeler, "Harness Engineering - first thoughts," martinfowler.com, February 17, 2026 `[primary]`: "A good harness should not necessarily aim to fully eliminate human input, but to direct it to where our input is most important." Coding becomes "less about typing code and more about steering its generation."
- Chip Huyen, "Agents," January 7, 2025 `[primary]`: grounds the term in Russell and Norvig: "An agent is anything that can perceive its environment and act upon that environment." An agent is "characterized by the environment it operates in and the set of actions it can perform."
- OpenAI, "A practical guide to building agents," April 2025: "Agents are systems that independently accomplish tasks on your behalf." Excludes simple chatbots, single-turn LLM calls, and classifiers. "Quotes are from secondary summaries; confirm against the PDF. UNVERIFIED wording."
- Research §5 "2026 status": "no newer canonical definition has displaced the workflows-vs-agents split. The conversation moved from defining agents to engineering the systems around them, which is itself an argument the talk can make."

---

## B. The map (beat 2.0, slide 7, 2:00)

### B.1 The four layers and their boxes, exactly as the anatomy diagram names them

Diagram title: "Anatomy of an Agentic AI System". The `-yours` variant's title: "Anatomy of an Agentic AI System: every box is yours".

Text labels in `internal/anatomy-of-an-agentic-ai-system-landscape.svg`, in document order. Each box has a title and a subtitle.

**Platform** (subtitle: "Runs, secures, and improves the agent")

**Per-run services** (subtitle: "Every run draws on these"), across the top:

- Identity and access: "Auth, permissions, scoped credentials"
- Security: "Injection defense, sandboxing, secrets"
- Data and knowledge: "RAG, vector stores, connectors"

**One run** (subtitle: "Repeats for each goal"), the middle band:

- Goal: "From user, trigger, or schedule"
- Agent: "Model + harness"
  - Model: "Decides what to do"
  - "+"
  - Harness: "Carries state across turns", containing six boxes:
    - Orchestration: "Loop, hooks, workflows"
    - Tools: "Files, shell, web, MCP"
    - Context and memory: "History, working memory"
    - Guardrails: "Limits on actions"
    - Instructions: "System prompt, config"
    - Verification: "Tests, checks, self-review"
- Run until a stopping condition is met (the stop box, id `box-stop`)

**Across runs** (subtitle: "Learn from and control many runs over time"), along the bottom:

- Observability: "Logs, traces, metrics, cost"
- Evaluations: "Offline evals, regression suites, A/B"
- Governance: "Policies, audit trails, approvals"

SVG rect ids: `box-identity`, `box-security`, `box-data`, `box-goal`, `box-model`, `box-harness`, `box-orchestration`, `box-tools`, `box-context`, `box-guardrails`, `box-instructions`, `box-verification`, `box-stop`, `box-observability`, `box-evaluations`, `box-governance`. Group ids: `platform`, `per-run`, `one-run`, `goal`, `agent`, `model`, `plus`, `harness`, `stop`, `across-runs`, `title`, `arrows`.

The four layers as spoken on slide 7 (and outline 2.0):

1. Model. "The model, which decides what to do."
2. Harness: "instructions, context and memory, tools, orchestration, guardrails, verification."
3. Per-run services: "identity and access, security, data and knowledge." Spoken: "The per-run platform services every run draws on: identity, security, data and knowledge."
4. Across runs: "observability, evaluations, governance." Spoken: "the across-run services that let you learn from and control many runs: observability, evaluations, governance."

The `-yours` variant: amber badges reading "yours" on every box except Goal, and "yours to select" on the Model box. The Harness container itself gets no badge; its six boxes carry theirs. Badged boxes: identity, security, data, model, orchestration, tools, context, guardrails, instructions, verification, stop, observability, evaluations, governance (fourteen badges).

Area-to-box mapping used for the mini-maps (`internal/build-diagrams.mjs`):

- models: blue, boxes `model`
- context: pink, boxes `context`, `instructions`, `data`
- tools: pink, boxes `tools`
- orchestration: pink, boxes `orchestration`
- evals: green, boxes `verification`, `evaluations`
- operating: amber, boxes `identity`, `security`, `guardrails`, `observability`, `governance`

Outline 2.4 note: "On the map this is the 'Orchestration' box inside the harness: the loop, hooks, workflows. The other five harness boxes have their own areas."

### B.2 The Trivedy / Osmani line

Verbatim, quoting Viv Trivedy via Osmani: "Agent = Model + Harness. If you're not the model, you're the harness."

Spoken on slide 7: "At the center, an agent is a model plus a harness. The line that stuck this spring: **'If you're not the model, you're the harness.'**"

Source: Addy Osmani, "Agent Harness Engineering," April 19, 2026. `[primary]`. https://addyosmani.com/blog/agent-harness-engineering/ Research §0 in `research/section-2.md`. Slide 7 note: "The line is Trivedy's; Osmani spread it. If asked who said it, say so."

Other Osmani lines in research §0:

- A harness is "every piece of code, configuration, and execution logic that isn't the model itself": system prompts and CLAUDE.md, AGENTS.md, skill files; tools, MCP servers and their descriptions; bundled infrastructure (filesystem, sandbox, browser); orchestration logic (subagent spawning, handoffs, model routing); hooks and middleware; observability (logs, traces, cost and latency metering).
- "A decent model with a great harness beats a great model with a bad harness."
- "The gap between what today's models can do and what you see them doing is largely a harness gap."
- "anytime you find an agent makes a mistake, you take the time to engineer a solution such that the agent never makes that mistake again." **[files disagree]** `research/section-3.md` §2 attributes this same sentence to Mitchell Hashimoto's "My AI Adoption Journey," February 5, 2026, with the gloss "either by updating an AGENTS.md style file or by building a verification tool." Both attributions stand in the repository.
- Names Claude Code, Cursor, Codex, Aider, and Cline as harnesses.

### B.3 The OpenAI harness definition, verbatim, with date

Source: OpenAI Developers, "Codex as a platform: build on the open agent harness," August 19, 2026. `[primary]`. https://developers.openai.com/blog/codex-as-a-platform Research §0 in `research/section-2.md`.

> "A capable agent is more than a prompt and a model response. It needs a way to understand a task, maintain context over time, inspect relevant information, call tools, expose progress, handle failures, request human approval when necessary, and return a useful result. That surrounding execution system is the harness."

Spoken on slide 7 (starts at "needs"): OpenAI's August 2026 definition. An agent "needs a way to understand a task, maintain context over time, inspect relevant information, call tools, expose progress, handle failures, request human approval when necessary, and return a useful result. That surrounding execution system is the harness."

Also from the same source: the Codex harness manages "conversation state, stream execution, use tools, enforce configured sandbox and approval policies, and carry work across turns." And: "on ARC-AGI-3, retained reasoning and context compaction raised GPT-5.6 Sol's score from 13.3% to 38.3% while reducing output tokens sixfold." (Used on slide 14.)

Slide 7 cut note: "The OpenAI definition can be shortened to its last sentence, 'That surrounding execution system is the harness,' with the verb list carried by the diagram."

### B.4 Slide 7 talk track and takeaway

- [0:00] Here is the whole discipline on one slide. We will walk it from the inside out.
- [0:08] Build 1, the model. Trivedy line.
- [0:20] Build 2, the harness. OpenAI definition.
- [0:45] **Four layers.** The model, which decides what to do. The harness around it: instructions, context and memory, tools, orchestration, guardrails, verification.
- [1:00] Build 3, per-run services. The platform services every run draws on: identity, security, data and knowledge.
- [1:08] Build 4, across runs. And the services that let you learn from and control many runs: observability, evaluations, governance.
- [1:16] Full brightness. "Harness engineering" is probably the phrase you have heard most since spring. It maps onto this picture. **Every box on it exists inside the coding agent you used this morning. Someone built each one. We are going to take six of them apart.**
- [1:35] For each: When you are the user, what someone engineered, and what changes when you are the owner.
- [1:45] **Agent equals model plus harness. Everything that is not the model is what you engineer.**

Optional, if there is slack: "A goal comes in from a user, a trigger, or a schedule. The agent runs until a stopping condition is met. Who writes the stopping condition? You do. That is slide 15."

Takeaway line for 2.0: "Agent equals model plus harness. Everything that is not the model is what you engineer."

"Since spring" for harness engineering: OpenAI's February 2026 post, Osmani in April, OpenAI's August definition. Research §7 in `research/section-2.md`: "'Harness engineering' became the standard phrase. OpenAI February 2026; Osmani April 2026; OpenAI August 2026 definition. Loop engineering and graph engineering are blog-level coinages."

Also in research §0: Anthropic, "Building agents with the Claude Agent SDK," Thariq Shihipar, September 29, 2025 `[primary]`, https://claude.com/blog/building-agents-with-the-claude-agent-sdk : the loop: gather context, take action, verify work, repeat. Verification mechanisms: rules-based feedback (linting), visual feedback (screenshots, renders), LLM as judge for "fuzzy rules," flagged as less robust with "heavy latency tradeoffs."

### B.5 Diagram assets in `internal/`

Base and variants (hand-maintained):

- `internal/anatomy-of-an-agentic-ai-system.png`: the original portrait system diagram, about 5:6.
- `internal/anatomy-of-an-agentic-ai-system-landscape.svg`: the same diagram re-laid for a 16:9 slide in the deck's dark theme, editable, the source of every other diagram file. Used on slide 7. At 1920 by 1080 the box titles are 24 to 28 point and the subtitles 18 to 20 point.
- `internal/anatomy-of-an-agentic-ai-system-landscape-yours.svg`: the slide 19 variant with a "yours" badge on every box except Goal ("yours to select" on Model). Generated from the base by `internal/build-diagrams.mjs` and written beside it.
- `internal/profile-320.webp`: the presenter photo for slide 2 (not a diagram).
- `internal/build-diagrams.mjs`: regenerates all variants and renders from the base. Needs Node and Google Chrome, no packages. Run `node internal/build-diagrams.mjs` if the base changes.

Generated highlight states, `internal/generated/` (each dims everything except the named region):

- `landscape-model.svg`
- `landscape-harness.svg`
- `landscape-per-run.svg`
- `landscape-across-runs.svg`

Generated mini-map variants, `internal/generated/` (the small map top right of every kickered slide except 23, with the current area's boxes lit):

- `mini-all.svg`
- `mini-models.svg`
- `mini-context.svg`
- `mini-tools.svg`
- `mini-orchestration.svg`
- `mini-evals.svg`
- `mini-operating.svg`

PNG renders the deck uses, `internal/renders/`:

- `map-full.png` (base), `map-yours.png` (yours variant), `map-model.png`, `map-harness.png`, `map-per-run.png`, `map-across-runs.png`
- `mini-all.png`, `mini-models.png`, `mini-context.png`, `mini-tools.png`, `mini-orchestration.png`, `mini-evals.png`, `mini-operating.png` (rendered at 160 by 90, scale 4)

Slide 7 playback: six consecutive physical slides: full diagram, four highlights, then full brightness. Slide 19 build 3: hard cut to the full-screen yours diagram.

Note from the corrections review, since resolved: "The outline's map reference points to the original portrait PNG while the slide and builder use the landscape variant." Outline v2 now names `internal/anatomy-of-an-agentic-ai-system-landscape.svg`.

---

## C. The six areas

Shared structure (outline "The Section 2 pattern" and AGENTS.md): each area has a user slide and an owner slide, with three beats. 1. **When you are the user.** The coding-agent feature the audience has used. The two named products are Codex CLI and Devin. Devin CLI carries command anchors; Devin Desktop appears on slide 8 for its model picker. 2. **What someone engineered.** The bridge within the user slide. 3. **When you are the owner.** The responsibility for the delivered product, its operating limits, and the area's pitfall. Kickers read "Area · When you are the user" and "Area · When you are the owner." Every owner slide ends with a pitfall band whose text matches slide 23 word for word. Takeaways are spoken, not shown; owner-slide titles state the responsibility instead.

Outline note on cost and latency: "Cost and latency are deliberately spread across 2.1 (selection and routing), 2.2 (cache economics), 2.4 (budgets), and 2.6 (production metrics)."

Tool documentation anchors, all `[primary]`, checked in a browser September 14, 2026 (research §1 of `research/section-2.md`):

- Codex CLI: slash commands https://learn.chatgpt.com/docs/cli/slash-commands ; config reference https://learn.chatgpt.com/docs/config-file/config-reference ; CLI overview https://learn.chatgpt.com/docs/codex/cli . Research §7 notes "Codex CLI docs now live at learn.chatgpt.com."
- Devin CLI: commands and flags https://docs.devin.ai/cli/reference/commands ; config file https://docs.devin.ai/cli/reference/configuration/config-file ; essential commands https://docs.devin.ai/cli/essential-commands ; permissions https://docs.devin.ai/cli/reference/permissions . Launch post, "Devin CLI: Start Local, Hand Off to the Cloud," April 27, 2026: https://cognition.com/blog/devin-for-terminal .
- Devin Desktop (the IDE, formerly Windsurf): changelog https://docs.devin.ai/desktop/changelog ; Cascade plugin changelog https://docs.devin.ai/windsurf/plugins/changelog .

Research §7 summary of the audience's tools: "Devin CLI launched April 27, 2026, with a dedicated virtual machine and cloud hand-off; Fusion reached it September 11 (not used on stage). Codex CLI docs now live at learn.chatgpt.com. Both read AGENTS.md, both have `/plan`, `/compact`, `/resume`, `/fork`, subagents, hooks, MCP, a sandbox, and a usage command."

Screenshot placeholders (six, deferred by the presenter, per the corrections record): slide 8 Devin Desktop model picker and Codex model picker; slide 10 AGENTS.md and a compaction notice; slide 12 MCP configuration and a shell-command approval prompt.

### C.1 Models (beat 2.1, 3:30; slide 8 user 1:00, slide 9 owner 2:30)

Research drawn on: `research/section-2.md` §1. Mini-map lights `model`.

#### When you are the user (slide 8)

Kicker: Models · When you are the user. Build 1: the Devin Desktop and Codex model-picker screenshot placeholders. Build 2: screenshots shrink to a strip; heading "Provider responsibilities behind the picker:" with five lines: Defaults. Model-specific prompt and tool tuning. Failover. Price-change handling. Retirement handling. Callout: "Model retirement creates migration work."

Outline 2.1 spoken: "You have used the model picker. In Devin Desktop it pops out a window, and there is a slider for reasoning effort, with the price per level next to it. In Codex it is `/model`, and it sets the reasoning effort along with the model. That slider is a cost and latency dial. One layer down, Codex's config lets plan mode run at a different effort and subagents run on a different model. That is model routing, shipped as a setting. Most of you have used routing without ever calling it that."

Slide 8 talk track: "[0:00] The model picker exposes a choice. Devin Desktop shows reasoning effort; Codex's `/model` can set it too. **Reasoning effort is a cost and latency dial.** Codex can configure a different effort for planning and a different model for subagents. [0:30] Build 2. **The provider manages defaults, model-specific tuning, failover, price changes, and retirement handling.** These are responsibilities behind the picker. [0:46] Callout. **Model retirement creates migration work.** A retirement record does not tell us how every coding-tool provider migrated every user or whether a change was silent." Cut first: the config example. Never cut the provider responsibilities or the lifecycle qualification.

Tools, versions, and command anchors:

- Codex CLI: `/model`: "Choose the active model (and reasoning effort, when available)." `/fast`: toggles a Fast service tier when the model catalog exposes one. Config keys: `model_reasoning_effort`: minimal, low, medium, high, xhigh. `plan_mode_reasoning_effort`: a separate override for plan mode, including none. `agents.default_subagent_model` and `agents.default_subagent_reasoning_effort`: a different model and effort for spawned agents. Research: "Routing by phase and by role, as config keys."
- Devin CLI: `/model [name]`: "Show or change the current model." `/fast`: switch to SWE-1.6 Fast. `--model` flag. `devin models list`: "List available models, organized by model family." Default `agent.model` is `swe-1-6-fast`. Launch post: "Choose between any frontier model, including Opus 4.7, GPT-5.5, and our own SWE-1.6." "Devin for Terminal is the first CLI agent with its own dedicated virtual machine." Hand-off: "hand the session to a cloud agent with its own computer."
- Devin Desktop: changelog v3.0.12, June 2, 2026, "Windsurf is now Devin Desktop." Cascade plugin changelog: v2.12.13, February 26, 2026, "Added support for GPT-5.3-Codex with four reasoning efforts (low, medium, high, and xhigh)"; v2.12.14, March 11, 2026, GPT-5.4 billed from "No Reasoning: 1x credits" through "Extra High Reasoning: 8x credits"; v2.12.20, April 6, 2026, "The model picker now shows token pricing information directly, so you can see the exact rate extra usage is billed at." The pop-out window with a reasoning slider is "presenter's first-hand observation, not in the docs text; the slide 8 screenshot is the evidence."
- Fusion (Devin CLI, September 11, 2026, "Introducing Fusion in Devin Desktop & CLI," https://cognition.com/blog/local-fusion): "Pick a frontier model for planning and review (the 'lead'), and a cost-effective model for execution (the 'sidekick')." Not used on stage: too new for the room. Kept for Q&A on routing.

#### What someone engineered (bridge)

Outline: "the provider manages defaults, model-specific prompt and tool tuning, failover, price changes, and retirement handling. Anthropic's documented retirements illustrate lifecycle work. They do not show how every coding-tool migration reached each user."

Lifecycle evidence (research §1):

- Anthropic model deprecations page `[primary]`, https://platform.claude.com/docs/en/about-claude/model-deprecations . Lifecycle states verbatim. Active: "The model is fully supported and recommended for use." Legacy: "The model will no longer receive updates and may be deprecated in the future." Deprecated: "The model is still functional but no longer recommended," with a replacement and a retirement date. Retired: "The model is no longer available for use. Requests to retired models will fail." "Anthropic notifies customers with active deployments for models with upcoming retirements, providing at least 60 days' notice before model retirement for publicly released models." "Deprecated models are likely to be less reliable than active models." Observed cadence: Claude Sonnet 4 and Opus 4 deprecated April 14, 2026, retired June 15, 2026 (62 days). Opus 4.1 deprecated June 5, 2026, retired August 5, 2026 (61 days). Sonnet 3.7: October 28, 2025 to February 19, 2026. Haiku 3.5: December 19, 2025 to February 19, 2026. Haiku 3: February 19 to April 20, 2026. Opus 3: June 30, 2025 to January 5, 2026. Eight-plus models retired in eighteen months. Parameters expire too: temperature, top_p, top_k are deprecated on Opus 4.7 and later and "Returns a 400 error when set to a non-default value." Python SDK v1.0+ removes them, raising TypeError. Weight preservation commitment: https://www.anthropic.com/research/deprecation-commitments
- OpenAI deprecations page `[primary]`, https://developers.openai.com/api/docs/deprecations . Notice: generally available models "At least 6 months"; specialized variants "At least 3 months"; previews "much shorter notice, such as 2 weeks," explicitly unsuitable for production unless you can migrate fast. Vocabulary: deprecation is the announcement; sunset or shutdown is when it stops answering; legacy means no updates but not yet deprecated. Twenty-plus models scheduled to shut down October to December 2026, including early GPT-5 snapshots and o3 variants. gpt-5.4-cyber announced September 11, 2026, shutdown October 1, 2026. Transcription family announced August 26, 2026, shutdown February 26, 2027.
- GitHub Changelog, "Selected GitHub Copilot models deprecated," August 31, 2026 `[primary]`, https://github.blog/changelog/2026-08-31-selected-github-copilot-models-deprecated/ , checked September 14, 2026. Not used on stage since the September 14 revision; kept for Q&A. "As of today, September 1, 2026, we have deprecated the following models across most GitHub Copilot experiences": Gemini 3.1 Pro, Claude Opus 4.5, Claude Opus 4.6, Claude Sonnet 4.5, Claude Sonnet 4.6, Raptor Mini. Six models, not the five in earlier secondary coverage. Suggested replacements: Gemini 3.7 Flash; Claude Opus 4.7, 4.8, or 5; Claude Sonnet 5; MAI-Code-1.1-Flash. Surfaces: Copilot Chat, inline edits, ask and agent modes, code completions. Claude Sonnet 4.6 stays available to individual subscribers on annual plans. A later entry, "Upcoming deprecation of selected GitHub Copilot models," September 3, 2026: contents UNVERIFIED; title only.
- Research qualification: "The documented retirements illustrate lifecycle work. They do not establish how every coding-tool provider migrated users, who paid a price change, or whether a migration was silent."

#### When you are the owner (slide 9)

Kicker: Models · When you are the owner. Title: "The model is a component you select, measure, and replace."

- Build 1. Select. Capability on your tasks · Cost per completed task · Latency at p95 · Context window · Tool-use reliability · Data residency
- Build 2. Measure. Benchmarks use their task population and harness. Measure your product on representative cases.
- Build 3. Replace. Two cards: "Pinned version: controlled migration and lifecycle management." "Moving alias: automatic updates and regression monitoring." Then: "A snapshot controls one source of variation. Prompts, tools, retrieval, and the environment also affect behavior." Then: "GPT-4 prime/composite task, step-by-step prompting: 84% in March 2023, 51% in June 2023. Chen, Zaharia, Zou, revised 2023 paper. Task-specific, not overall model quality."
- Build 4. Route. Editable table and adjacent qualifications:

| Configuration | Accuracy | Cost per completed task |
|---|---:|---:|
| Frontier only | 86.0% | $0.092 |
| Routed | 80.0% | $0.026 |
| Small model only | 77.7% | $0.006 |

  LangChain, August 11, 2026. 145 tasks. 7% frontier selection; judge calls excluded. Run variation: about 2.7 points. Routed gain over small-only: 2.3 points. Frontier selection: 4.1% to 9.1% across five runs. About 72% lower cost per completed task; article: 74% lower total cost.
- Build 5. "Which configuration meets your product's quality requirement?" above the pitfall band.

Slide 9 talk track: "[0:00] When you are the owner, the model is a component you select, measure, and replace. [0:05] Build 1. Select for capability on your tasks, cost per completed task, p95 latency, context, tool use, and data residency. [0:23] Build 2. **Measure your product on representative cases under its operating conditions.** Public benchmarks use a different population and harness. [0:40] Build 3. **Pinned version: controlled migration and lifecycle management. Moving alias: automatic updates and regression monitoring.** A snapshot controls one source of variation. Prompts, tools, retrieval, and the environment also affect behavior. On prime/composite classification with step-by-step prompting, the March and June 2023 GPT-4 versions scored 84% and 51%. Changed instruction following partly explains the result. This is not overall quality or a pinned snapshot changing internally. [1:14] Build 4. LangChain compared three configurations across 145 tasks. **Read accuracy and cost together.** Frontier-only scored 86%, routed 80%, and small-only 77.7%. The router selected frontier for 7% of agent calls, excluding judge calls. Its 2.3-point gain over small-only was below observed variation of about 2.7 points. Selection ranged from 4.1% to 9.1%. The cost-per-completed-task drop is about 72%; the article's 74% uses total cost. **Which configuration meets your product's quality requirement?** [2:04] Build 5. **A hardcoded model ID with no eval suite behind it.** That leaves you choosing a replacement without evidence. [2:20] **The model is a versioned, expiring dependency. Treat it like one.**" Cut first: spoken selection axes and the frontier-share range, which remain visible. Never cut the scope of the prime example, accuracy tradeoff, run-variation qualification, or product-quality question.

Research §1 "When you are the owner" extras: "Data residency can override every other axis for enterprise. Fallback composition reported for 2026 (UNVERIFIED): retry primary, rotate provider on exhaustion, serve semantic cache hit, degrade UI." Open weights vs hosted API: UNVERIFIED practitioner blogs: "self-hosting is priced as GPU rental but decided by operations, redundancy, and an eval harness proving a quantized model kept quality; hosted APIs scale to zero and GPUs do not; self-hosting earns its keep at sustained high utilization or when privacy, latency, or fine-tuning control forces it; open-weight models trail closed by a few points on the benchmarks that matter."

Benchmarks as weak evidence (research §1): all specifics UNVERIFIED: "identical weights can score ten to twenty points apart depending on the eval harness; on one SWE-bench Verified leaderboard as of June 2026 only one of a hundred results was independently verified; the same model produces sharply different numbers on SWE-bench Verified self-reported vs SWE-bench Pro on a vendor scaffold vs Scale's SEAL harness; memorization of widely circulated repository issues." Contamination-resistant alternative: SWE-bench-Live, https://swe-bench-live.github.io/ . "The defensible claim needs no citation: a public benchmark measures a population you did not choose, on a harness you do not control, reported by a party with an interest in the result. Your eval suite measures your traffic."

#### Pitfall, verbatim as on slide 23

"Models: a hardcoded model ID with no eval suite behind it."

Research §1 fuller form: "Treating the model as a fixed dependency: a hardcoded model ID with no eval suite behind it, so the deprecation email arrives with a replacement you have never measured. Mirror image: an alias with drift you never detect. Same fix, which sets up area 5."

#### Takeaway line, verbatim

"The model is a versioned, expiring dependency. Treat it like one."

#### Evidence with sources and markers

- Lingjiao Chen, Matei Zaharia, James Zou, "How Is ChatGPT's Behavior Changing over Time?", arXiv 2307.09009, July 2023, revised version 3. `[primary]`. https://arxiv.org/html/2307.09009v3 Checked in a browser September 15, 2026. "using CoT increased GPT-4's performance from 59.6% to 84.0% in March" (typographic apostrophe normalized). On the prime-versus-composite task with step-by-step prompting, GPT-4 accuracy was 84% for the March 2023 version and 51% for the June 2023 version. The June version followed that instruction less often, partly explaining the difference. "This is task- and prompt-specific evidence of behavior across versions. It is not a measure of overall model quality and does not show a pinned snapshot changing internally."
- Srimanth Tangedipalli and Karan Singh, "How many of your agent's calls actually need a frontier model?", LangChain, August 11, 2026. `[primary]`. https://www.langchain.com/blog/switchyard-agent-routing-benchmark Checked in a browser September 15, 2026. "Call counts exclude the judge". 145 controlled multi-step tasks, averaging 6.3 model calls, covering support, incident investigation, and workflow automation. One workload, not a forecast for another product. The router selected the frontier model for about 7% of agent calls. "It did not establish which calls required that model." Share ranged from 4.1% to 9.1% over five runs. Observed accuracy variation about 2.7 percentage points; the routed arm's 2.3-point gain over small-only was smaller than that variation. Calculation from displayed values: (0.092 - 0.026) / 0.092 = 71.7%, approximately 72% lower cost per completed task. The article's 74% reduction concerns total run cost, $11.45 to $3.00. "These denominators differ." Product decision: "measure which configuration meets the quality requirement under its operating conditions. Include judge cost and latency in the comparison."

Outline sources line for 2.1: "Anthropic and OpenAI deprecation pages; Chen, Zaharia, Zou, revised 2023 paper; LangChain, August 2026; Codex CLI and Devin CLI docs. Research §1."

### C.2 Context and knowledge (beat 2.2, 3:30; slide 10 user 2:30, slide 11 owner 1:00)

Research drawn on: `research/section-2.md` §2, with tool docs in §1. Mini-map lights `context`, `instructions`, `data`.

#### When you are the user (slide 10)

Kicker: Context and knowledge · When you are the user. Build 1: the AGENTS.md and compaction-notice screenshot placeholders. Build 2: images shrink to a strip. "How context fails: Poisoning · Distraction · Confusion · Clash" and "18 models tested. Performance degrades as input grows, on simple tasks." Build 3: "What someone engineered: A system prompt · A compaction policy · A memory convention" then "RAG retrieves relevant external information and supplies it to the model." then "Choose retrieval for the data and task: Grep · File reads · Embeddings · Hybrid retrieval". Build 4: "Preserve useful stable prefixes. Measure cache savings. Update context and tool access for correctness and authorization." and "Manus, July 2025: reported 100:1 input/output; $0.30 cached vs $3 uncached per million input tokens in its pricing example."

Outline 2.2 spoken: "Two things you have touched. First, the instructions file. Codex and Devin CLI both read AGENTS.md, the cross-tool standard, and Codex's `/init` writes one for you. Second, the moment your session compacted and dropped something that mattered. Both tools have `/compact`, and Codex compacts on its own past a token limit. You have already felt context engineering fail."

Slide 10 talk track: "[0:00] The instructions file and the compaction notice are two familiar surfaces. Both tools read AGENTS.md and support `/compact`. Context engineering determines what survives and what the model sees next. [0:26] Build 2. Anthropic calls context **a finite resource with diminishing marginal returns**. Chroma tested eighteen models and found performance degradation as input grew, even on simple tasks. Breunig names poisoning, distraction, confusion, and clash. An error can persist in context; irrelevant or conflicting information can steer the answer. [1:06] Build 3. The provider engineered instructions, compaction, memory, and retrieval. **RAG means retrieving relevant external information and supplying it to the model.** Grep, file reads, embeddings, and hybrid retrieval are methods to choose for the data and task. Cognition's SWE-grep is a code-search example. File retrieval can be part of RAG. [1:44] Build 4. Caching is another context decision. Manus reported about a hundred input tokens per output token, with a tenfold cached-input price gap in its July 2025 example. These are that team's experience and prices. **Preserve stable prompt prefixes when useful. Measure the savings, and update context or tool access when correctness or authorization requires it.** A stale policy is not acceptable just because it improves cache hits." Cut first: detailed failure definitions and the spoken 100:1 ratio. Never cut the RAG definition, task-dependent method choice, or correctness and authorization qualification.

Tools and command anchors:

- AGENTS.md, the cross-tool standard, https://agents.md/ (formalized August 2025, 60,000-plus projects, donated to the Linux Foundation's Agentic AI Foundation December 2025; "adoption and donation UNVERIFIED beyond the site").
- Codex: `/init` will "Generate an `AGENTS.md` scaffold in the current directory"; `/compact` will "Summarize the visible chat to free tokens"; `model_auto_compact_token_limit` sets the threshold for automatic compaction and `compact_prompt` overrides the summary prompt; `/memories` toggles memory injection and generation.
- Devin CLI: AGENTS.md in the user config directory for global rules and in the project; `/compact` forces compaction; `/context` shows context window usage.

#### What someone engineered (bridge)

Outline 2.2 bridge, verbatim: "Karpathy's definition from last summer: context engineering is 'the delicate art and science of filling the context window with just the right information for the next step.' Anthropic's version: context is **'a finite resource with diminishing marginal returns.'** Models have an attention budget. Chroma tested eighteen models: **performance degrades as input grows, on simple tasks, well before the window is full**. Breunig named four ways it fails. Poisoning: an error gets in and keeps getting referenced. Distraction: the model over-focuses on the context and forgets what it knows. Confusion: superfluous content shapes the answer. Clash: new information conflicts with old. One measurable: on the Berkeley function-calling leaderboard, every model got worse with more tools. The provider engineered instructions, compaction, memory, and retrieval. **RAG means retrieving relevant external information and supplying it to the model.** Grep, file reads, embeddings, and hybrid retrieval are methods chosen for the data and task. Cognition's SWE-grep is a code-search example. Manus reported a roughly 100:1 input-to-output ratio and a tenfold cached-input price gap in its July 2025 example. **Preserve stable prompt prefixes when useful. Measure savings, and update context or tool access when correctness or authorization requires it.**"

**[files disagree]** The Karpathy definition sentence is in the outline's 2.2 bridge but does not appear in slide 10's talk track. Slide 11's sources cite "the Karpathy enumeration on slide 10."

Quotes with attribution (research §2):

- Andrej Karpathy, X post, June 25, 2025, https://x.com/karpathy/status/1937902205765607626 : "context engineering is the delicate art and science of filling the context window with just the right information for the next step." Headline sentence confirmed via Simon Willison, June 27, 2025, https://simonwillison.net/2025/Jun/27/context-engineering/ . Full thread UNVERIFIED. Enumerates: task descriptions, few-shot examples, RAG, multimodal data, tools, state and history, compaction.
- Anthropic, "Effective context engineering for AI agents," September 29, 2025, Prithvi Rajasekaran, Ethan Dixon, Carly Ryan, Jeremy Hadfield. `[primary]`. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents . Context engineering is "the set of strategies for curating and maintaining the optimal set of tokens (information) during LLM inference," vs prompt engineering, "methods for writing and organizing LLM instructions." "Context, therefore, must be treated as a finite resource with diminishing marginal returns." "LLMs have an 'attention budget' that they draw on when parsing large volumes of context." System prompts: "The optimal altitude strikes a balance: specific enough to guide behavior effectively, yet flexible enough to provide the model with strong heuristics." Tools: "tools should be self-contained, robust to error, and extremely clear with respect to their intended use." "One of the most common failure modes we see is bloated tool sets." Long-horizon techniques: compaction ("summarizing its contents, and reinitiating a new context window with the summary"); note-taking ("the agent regularly writes notes persisted to memory outside of the context window"); sub-agents ("specialized sub-agents can handle focused tasks with clean context windows"); just-in-time retrieval ("maintain lightweight identifiers... and use these references to dynamically load data into context at runtime"). Talk definition: "retrieval-augmented generation (RAG) retrieves relevant external information and supplies it to the model. Grep, file reads, embeddings, and hybrid retrieval are methods chosen for the data and task. Just-in-time file retrieval can be part of RAG."
- Yichao "Peak" Ji, Manus, "Context Engineering for AI Agents: Lessons from Building Manus," July 18, 2025. `[primary]`. https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus . "the KV-cache hit rate is the single most important metric for a production-stage AI agent". Scope: "these are Manus's reported production experience and its July 2025 pricing example, not universal cache economics." "the average input-to-output token ratio is around 100:1". "cached input tokens cost 0.30 USD/MTok, while uncached ones cost 3 USD/MTok, a 10x difference". "avoid dynamically adding or removing tools mid-iteration." Manus masks logits rather than mutating the tool list. "treat the file system as the ultimate context in Manus: unlimited in size, persistent by nature, and directly operable by the agent itself". Recitation: "constantly rewriting the todo list, Manus is reciting its objectives into the end of the context". "leave the wrong turns in the context. When the model sees a failed action, and the resulting observation or stack trace, it implicitly updates its internal beliefs". "the more uniform your context, the more brittle your agent becomes". Talk lesson: "preserve stable prefixes when useful, measure savings, and update context or tool access when correctness or authorization requires it."
- Drew Breunig, "How Long Contexts Fail," June 22, 2025. `[primary]`. https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html . Context Poisoning: "When a hallucination or other error makes it into the context, where it is repeatedly referenced." Context Distraction: "When a context grows so long that the model over-focuses on the context, neglecting what it learned during training." Context Confusion: "When superfluous content in the context is used by the model to generate a low-quality response." Context Clash: "When you accrue new information and tools in your context that conflicts with other information in the context." Evidence cited: Gemini 2.5 Pokemon agent hallucinating game state into its goals; distraction ceilings around 100k tokens for Gemini 2.5 Pro and 32k for Llama 3.1 405b; Berkeley Function-Calling Leaderboard, all models worse with more tools, a quantized Llama 3.1 8b failing at 46 tools and succeeding at 19; Microsoft and Salesforce sharded-prompt study, 39% average drop across multiturn, o3 falling from 98.1 to 64.1.
- Chroma, "Context Rot," Kelly Hong, Anton Troynikov, Jeff Huber, July 14, 2025. `[primary]`. https://www.trychroma.com/research/context-rot . "Model performance varies significantly as input length changes, even on simple tasks." "models do not use their context uniformly; instead, their performance grows increasingly unreliable as input length grows". 18 models including GPT-4.1, Claude 4, Gemini 2.5, Qwen3.
- Cognition, "Introducing SWE-grep and SWE-grep-mini: RL for Multi-Turn, Fast Context Retrieval," October 16, 2025. `[primary]`. https://cognition.com/blog/swe-grep Checked in a browser September 14, 2026. "fast agentic models specialized in highly parallel context retrieval" that "match the retrieval capabilities of frontier coding models, while taking an order of magnitude less time." Retrieval is tool calls, "grep, read, glob," in "4 serial turns" of "8 parallel tool calls." On embeddings: "The embeddings can even be counterproductive, as the agent can give too much weight to irrelevant information." Shipped as Fast Context in Windsurf, now Devin Desktop; docs https://docs.windsurf.com/context-awareness/fast-context . The claim that agent trajectories spent more than 60% of the first turn retrieving context is "from a secondary summary of those docs; UNVERIFIED wording." SWE-grep-mini serves at 2,800 tokens per second; SWE-grep at 650. Use on stage: "SWE-grep illustrates choosing retrieval for code. It does not establish that grep is universally preferable to embeddings. RAG describes retrieval plus generation, not a specific search method."

#### When you are the owner (slide 11)

Kicker: Context and knowledge · When you are the owner. Title: "Every token in the window is now your decision."

- Build 1. The window. A frame labeled "the window," holding six boxes: Instructions · Examples · Retrieved knowledge · Session state · Memory · Tool results. Beneath: "Each has a relevance, a freshness, a provenance, and a size."
- Build 2. You now own: The context budget · The compaction policy · The memory convention · The retrieval strategy
- Build 3. Customer-facing, two sentences: "A compaction that drops a constraint can produce a wrong answer." "Memory exposed to the wrong user or tenant is a breach."
- Build 4. Pitfall band: "Pitfall: adding instead of curating."

Slide 11 talk track: "[0:00] What goes in the window: instructions, examples, retrieved knowledge, session state, memory, tool results. Each has a relevance, a freshness, a provenance, and a size. [0:10] The vendor chose your context budget, your compaction policy, your memory convention, and your retrieval strategy. **You own all four now.** [0:19] Customer-facing raises the stakes, because the context now holds another person's data. **A compaction that drops a constraint can produce a wrong answer. Memory exposed to the wrong user or tenant is a breach.** [0:33] The pitfall: **adding context instead of curating it.** A big window is not permission to fill it. [0:41] **Context is a budget, not a bucket.**" "Nothing on this slide is cuttable; it is already the short form."

Research §2 owner note: "Cross-session memory can be intentional." Slide 11 sources: "The six contents of the window, the four attributes, and the four things you own are the talk's own framing." "No new claims on this slide."

#### Pitfall, verbatim as on slide 23

"Context: adding instead of curating."

Fuller spoken form (outline and slide 11): "adding context instead of curating it. A big window is not permission to fill it." Research §2: "Adding context rather than curating it. A large window is not permission to fill it; Chroma shows degradation well before the window is full."

#### Takeaway line, verbatim

"Context is a budget, not a bucket."

Outline sources line for 2.2: "Karpathy, June 2025; Anthropic, September 2025; Chroma, July 2025; Breunig, June 2025; Manus, July 2025; Cognition, October 2025; Codex CLI and Devin CLI docs. Research §2."

### C.3 Tools and extensibility (beat 2.3, 3:00; slide 12 user 1:50, slide 13 owner 1:10)

Research drawn on: `research/section-2.md` §3, with tool docs in §1. Mini-map lights `tools`.

#### When you are the user (slide 12)

Kicker: Tools and extensibility · When you are the user. Build 1: the MCP configuration and shell-command approval screenshot placeholders and existing mode captions. Build 2: screenshots shrink to a strip; "Design the tool for the caller:" with four lines: "Consider consolidation for the task. One `schedule_event` can combine several API operations." "Namespace. Prefix versus suffix moved the evals." "Return meaningful names alongside stable IDs needed to act." "Offer concise or detailed results: 72 tokens versus 206 in Anthropic's example." Build 3: "Tool-description refinements improved Claude Sonnet 3.5 on SWE-bench Verified." and "Anthropic's five-server example: about 55,000 tokens before the first message. Tool search reduced definition overhead by 85%." Build 4: "Protocol floor: no token passthrough · minimal scopes · consent before local commands · sandboxed execution".

Outline 2.3 spoken: "You have installed MCP servers and seen permission prompts. Codex and Devin expose sandbox and approval settings. A model may recommend an approval decision, but **a model recommendation does not establish permission**."

Slide 12 talk track: "[0:00] The MCP configuration connects tools. The permission prompt exposes a policy choice. Codex and Devin provide sandbox and approval settings. A model can recommend approving a command, but **that recommendation does not establish permission**. [0:32] Build 2. **A tool is a contract between code and a model caller.** Evaluate granularity for the task. A scheduling tool can consolidate several operations, but consolidation is an option to test. Namespace related tools. **Return meaningful names alongside stable IDs needed to act.** Two customers may share a name. Offer concise and detailed payloads where useful. [1:08] Build 3. Anthropic reported improvements from tool-description refinements. In its particular five-server example, definitions consumed about 55,000 tokens before the conversation. Tool search reduced definition overhead by 85%. The cost depends on the definitions, not just the server count. [1:32] Build 4. The protocol floor includes no token passthrough, scope minimization, consent before local commands, and sandboxed execution. Next, the owner must enforce access for scoped reads, recovery for reversible changes, and authorization or approval for consequential actions." Cut first: namespacing detail and the concise/detailed numbers. Never cut task fit, stable IDs, the five-server scope, or the authorization qualification.

Tools and command anchors:

- Codex: `/mcp` for installed MCP servers. Config: `sandbox_mode` is read-only, workspace-write, or danger-full-access. `approval_policy` is on-request or never, or a table of per-category booleans. Each MCP server has `default_tools_approval_mode` of auto, prompt, writes, or approve. `/permissions` will "Set what Codex can do without asking first."
- Devin CLI: `devin mcp add`, `devin mcp list`, and `devin mcp login` for OAuth. Permissions page `[primary]`: five modes. Normal: reads auto-approve, writes and shell prompt. Accept Edits: workspace edits auto-approve. Smart: for shell, fetch, MCP, and external writes, "a fast model judges whether the action is safe to run unattended," and never auto-approves package installs, mutating git operations, rm or sudo, destructive cloud CLI commands, or anything touching dotenv files or credentials. Bypass: everything auto-approves. Autonomous: pairs with `--sandbox`; shell and fetch auto-approve "because the sandbox enforces what they can read, write, and reach over the network," while direct edits still prompt. Organization deny and ask rules override user settings in every mode.
- Research: "Scoped reads, reversible changes, consequential actions are this talk's starting categories. Authorization applies to all three and is enforced outside the model. A model-based recommendation to approve does not establish permission."

#### What someone engineered (bridge)

Outline 2.3 bridge, verbatim: "**A tool is a contract between code and a model caller.** Evaluate granularity for the task. Consolidation is one option, such as a scheduling tool combining several API operations. Namespacing and descriptions affect selection. **Return meaningful names alongside stable IDs needed to act.** Let the caller choose concise or detailed output when useful. Anthropic reported improvements from tool-description refinements. In its particular five-server example, definitions consumed about 55,000 tokens before the conversation. Tool search reduced definition overhead. Five servers do not have a fixed token cost. MCP's security floor includes no token passthrough, minimal scopes, consent before local commands, and sandboxed execution."

Quotes with attribution (research §3):

- Anthropic, "Writing effective tools for agents, with agents," Ken Aizawa, September 11, 2025. `[primary]`. https://www.anthropic.com/engineering/writing-tools-for-agents . "deterministic systems produce the same output every time given identical inputs, while non-deterministic systems, like agents, can generate varied responses." Tools are a contract between deterministic code and a non-deterministic caller; "we need to design them for agents." Consolidation: "Tools can consolidate functionality, handling potentially multiple discrete operations (or API calls) under the hood." schedule_event, not list_users plus list_events plus create_event. Namespacing: "Namespacing (grouping related tools under common prefixes) can help delineate boundaries between lots of tools"; prefix vs suffix had "non-trivial effects on our tool-use evaluations." Talk rule: "return meaningful names alongside stable IDs needed to act. Names alone may be ambiguous." Results: prefer "contextual relevance over flexibility, and eschew low-level technical identifiers." Resolving UUIDs to names "significantly improves Claude's precision in retrieval tasks." response_format enum: "concise" vs "detailed"; Slack example 206 tokens vs 72. "Even small refinements to tool descriptions can yield dramatic improvements." Claude Sonnet 3.5 reached state of the art on SWE-bench Verified "after we made precise refinements to tool descriptions." Eval loop: "Start by generating lots of evaluation tasks, grounded in real world uses," then let agents analyze transcripts and improve the tools.
- Anthropic, "Introducing advanced tool use on the Claude Developer Platform," Bin Wu, November 24, 2025. `[primary]`. https://www.anthropic.com/engineering/advanced-tool-use . In Anthropic's particular five-server example, MCP servers (GitHub, Slack, Sentry, Grafana, Splunk) consume "approximately 55K tokens before the conversation even" begins; internally "tool definitions consume 134K tokens before optimization." "the most common failures are wrong tool selection and incorrect parameters, especially when tools have similar names". Deferred loading with tool search: "an 85% reduction in token usage while maintaining access to your full tool library." MCP evals: "Opus 4 improved from 49% to 74%, and Opus 4.5 improved from 79.5% to 88.1%." Programmatic tool calling: "Average usage dropped from 43,588 to 27,297 tokens, a 37% reduction on complex research tasks." Tool use examples: "improved accuracy from 72% to 90% on complex parameter handling."
- MCP Security Best Practices, spec revision 2026-07-28. `[primary]`. https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices . "MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server." Token passthrough is "explicitly forbidden." MUST-level mitigations for confused deputy, SSRF via OAuth discovery, state handle hijacking, local server compromise, authorization URL validation, mix-up attacks, scope minimization. "If an MCP client supports one-click local MCP server configuration, it MUST implement proper consent mechanisms prior to executing commands." Clients SHOULD "Execute MCP server commands in a sandboxed environment with minimal default privileges." Scope mistakes, verbatim: "Publishing all possible scopes in scopes_supported," "Using wildcard or omnibus scopes (*, all, full-access)," "Bundling unrelated privileges to preempt future prompts."

#### When you are the owner (slide 13)

Kicker: Tools and extensibility · When you are the owner. Title: "You write the contract. You build the gate."

- Build 1. The descriptions, and their evals · The verbosity · The action categories · The gate
- Build 2. Three cards:

| Scoped reads | Reversible changes | Consequential actions |
|---|---|---|
| Enforce access policy | Validate and support recovery | Require policy authorization or approval |

  "Authorization applies to every category. Enforce it outside the model." "A model's approval recommendation does not establish permission."
- Build 3. Evidence: "CamoLeak, October 2025. Researcher-demonstrated vulnerability: hidden pull-request instructions exfiltrated private repository data through image URLs. CVSS 9.6." "ClawHub, February 2026. Koi audit via The Hacker News: 341 of 2,857 skills were malicious. Secondary report."
- Build 4. Pitfall: copying the API surface without evaluating task fit.

Outline 2.3 owner spoken: "You own descriptions and their evals, payloads, granularity, and the gate. **Scoped reads: enforce access policy. Reversible changes: validate and support recovery. Consequential actions: require policy authorization or approval. Authorization applies to every category and is enforced outside the model.** Use human approval, async workflows, or enforced policies according to the deployment."

Slide 13 talk track: "[0:00] **You write descriptions and evaluate task fit. You build the gate.** Payload detail, granularity, and failure handling are your decisions. [0:14] Build 2. Scoped reads need access enforcement. Reversible changes need validation and recovery. Consequential actions need policy authorization or approval. **Authorization applies to every category and is enforced outside the model. A model recommendation does not establish permission.** Approval may be human, async, or an enforced policy. [0:39] Build 3. Legit Security demonstrated CamoLeak: hidden pull-request instructions exfiltrated private data through image URLs. Separately, The Hacker News reported Koi's audit: 341 malicious skills among 2,857. That is secondary reporting, not an independently checked audit here. [0:56] Build 4. **Copying the API surface without evaluating task fit.** [1:02] **Design tools for a caller that reads the description every time and can still get it wrong.**" Cut first: the payload list and spoken CVSS detail. Never cut authorization across categories, outside-model enforcement, evidence type, or pitfall.

Research §3 owner note: "The vendor wrote descriptions, chose granularity, shaped payloads, built the approval UI. You write descriptions as prompt engineering and eval them; you decide verbosity because it is your token bill; you classify every action and build the gate. The gate can use human approval, an async workflow, or an enforced policy, according to the product and action."

#### Pitfall, verbatim as on slide 23

"Tools: copying the API surface without evaluating task fit."

Research §3: "copying the API surface without evaluating task fit. Evaluate granularity, descriptions, payloads, and safe boundaries against representative tasks."

#### Takeaway line, verbatim

"Design tools for a caller that reads the description every time and can still get it wrong."

#### Incidents and evidence with sources and markers

- OWASP, "LLM06:2025 Excessive Agency", Gen AI Security Project, 2025. `[primary]`. https://genai.owasp.org/llmrisk/llm062025-excessive-agency/ Checked in a browser September 15, 2026. "Implement authorization in downstream systems rather than relying on an LLM to decide if an action is allowed or not." Research note: "These three categories are the talk's heuristic, not OWASP's taxonomy."
- CamoLeak. Omer Mayraz, Legit Security, "CamoLeak: Critical GitHub Copilot Vulnerability Leaks Private Source Code," October 8, 2025. `[primary]`. https://www.legitsecurity.com/blog/camoleak-critical-github-copilot-vulnerability-leaks-private-source-code Checked in a browser September 14, 2026. "Researcher-demonstrated vulnerability, not evidence of observed exploitation of customers." "CVSS 9.6." Instructions hidden in a pull request description inside `<!-- -->` comments, invisible in the web UI, processed by Copilot Chat for every user who viewed the page. GitHub's Camo image proxy rewrites external image URLs to signed proxy URLs. The researcher pre-generated Camo URLs for every letter and symbol and had Copilot render leaked data "as ASCII art composed entirely of images," which passed the content security policy because the URLs were GitHub-signed. The demo exfiltrated "the description of a zero-day vulnerability inside an issue of a private project" and AWS credentials. Reported through HackerOne in June 2025. Fixed by August 14, 2025, by "disabling image rendering in Copilot Chat completely."
- ClawHub. Koi Security's ClawHub audit, reported by The Hacker News, February 2, 2026. `[primary]` for directly checked secondary reporting only; Koi's underlying audit was not independently checked. https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html Checked September 14, 2026. "A security audit of 2,857 skills on ClawHub has found 341 malicious skills across multiple campaigns." Campaign named ClawHavoc. "335 skills use fake pre-requisites to install an Apple macOS stealer named Atomic Stealer (AMOS)." 341 of 2,857 is 11.9%, roughly one in eight.
- Not on stage: Unit 42, "OpenClaw's Skill Marketplace and the Emerging AI Supply Chain Threat," June 23, 2026. `[primary]`. https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain-risk/ Bitdefender Labs found "approximately 17% of OpenClaw skills they analyzed in the first few weeks of the platform's release carried malicious payloads." For a skill, "installation results in complete control over the agent's identity." "Use the Koi figure on stage; the Bitdefender figure is a different sample."

Outline sources line for 2.3: "Anthropic, September and November 2025; MCP, July 2026; OWASP, 2025; Legit Security, October 2025; Koi via The Hacker News, February 2026; Codex CLI and Devin CLI docs. Research §3."

Review note (presentation assessment, slide 13): "The two security incidents do not demonstrate why one endpoint per tool is a pitfall." The corrections record says the tools pitfall was updated in both locations to the current wording.

### C.4 Orchestration (beat 2.4, 3:30; slide 14 user 2:00, slide 15 owner 1:30)

Research drawn on: `research/section-2.md` §4, with the loop from §0 and tool docs in §1 and §3. Mini-map lights `orchestration`. Slide 14 note: "This area is the 'Orchestration' box inside the harness on the map: the loop, hooks, workflows. The other five harness boxes have their own areas."

#### When you are the user (slide 14)

Kicker: Orchestration · When you are the user. Build 1: six chips, `/plan` · subagents · hooks · `/compact` · `/resume` · `/fork`, then the loop drawn as a ring of three: gather context, take action, verify. Build 2: "The loop's decisions:" When to stop. What carries between turns. When to compact. When to spawn a subagent, and what to hand it. Where a hook fires. Build 3: the quote, large: "A decent model with a great harness beats a great model with a bad harness." then "Same model, better loop: 13% to 38% on ARC-AGI-3, with six times fewer output tokens." Build 4: "Over-ambition: try to one-shot the whole app." "Premature completion: see progress, declare the job done." "The fix: an initializer, a feature list, a progress file, one feature per session, and protected acceptance criteria. Faulty or obsolete tests may change through review." Build 5: "Anthropic, June 13, 2025. Internal research eval: 90.2% improvement over its single-agent research system. Separate token comparison: multi-agent systems used about 15x chat tokens. Poor fit when agents need shared context."

Slide 14 talk track: "[0:00] Plan mode. Subagents. Hooks. Compaction. Resume and fork. Both tools have every one of them. **Underneath all of it is one loop: gather context, take action, verify, repeat.** Hooks are the deterministic escape hatch: a PostToolUse hook runs the formatter or the tests whether or not the model believes it did. Codex ships hooks turned off. You turn them on. [0:26] Build 2. What someone engineered is the loop's decisions. When to stop. What carries between turns. When to compact. When to spawn a subagent, and what to hand it. Where a hook fires. The other harness boxes on the map get their own areas in this talk. This is the one that runs them. [0:46] Build 3. Addy Osmani's line applies most sharply here: **'A decent model with a great harness beats a great model with a bad harness.'** Evidence from OpenAI in August 2026, and it is loop-level evidence: retained reasoning across turns plus a compaction trigger took one model's score on a reasoning benchmark from 13% to 38%, with six times fewer output tokens. Same model. [1:10] Build 4. Anthropic found two failure modes in long-running agents. **Over-ambition: try to one-shot the whole app. Premature completion: a later instance sees progress and declares the job done.** The fix was engineering, not prompting. An initializer writes a feature list and a progress file. Each session does one feature with a fixed startup routine. **Protect the acceptance criteria.** Do not weaken tests merely to get a pass. Faulty or obsolete tests may change through review. [1:38] Build 5. Multi-agent, honestly. **Anthropic reported a 90.2% improvement against its single-agent research system on an internal eval. Separately, it reported about 15 times chat token use for multi-agent systems.** And it is a poor fit for work where agents need shared context or have dependencies. Anthropic names coding as the example." Cuttable in this order: "Codex ships hooks turned off. You turn them on."; "The other harness boxes on the map get their own areas in this talk." Do not cut the loop sentence, the five decisions, the Osmani quote, the two failure modes, or the multi-agent numbers.

Slide 14 layout notes: "Build 3 is the only large quote in Section 2. Set it big, attribute it small: Addy Osmani, April 2026." "Build 5 separates the internal research comparison from the chat token comparison. Give each its baseline, with the source and date adjacent. Never combine them into one implied experiment."

Tools and command anchors:

- Both tools: `/plan`, subagents, hooks, `/compact`, `/resume`, `/fork`.
- Codex: `/plan` will "Switch to plan mode and optionally send a prompt"; `agents.enabled` and `agents.max_concurrent_threads_per_session`; `hooks.<Event>` for PreToolUse, PostToolUse, SessionStart, SessionEnd, gated by `features.hooks`, which defaults to off; `/hooks` to "View and manage lifecycle hooks."
- Devin CLI: `/plan` and `/mode plan` for read-only planning; `subagents_enabled`, default true; `/hooks` lists loaded hooks with event types and sources; `/resume`, `/continue`, `/fork`; hand-off to a cloud agent with its own machine.
- Research: "Neither tool documents a todo list; the visible artifact is the plan. Loop: gather context, take action, verify, repeat. A PostToolUse hook runs the formatter or tests regardless of what the model believes it did."

#### What someone engineered (bridge)

Outline 2.4 bridge, verbatim: "The loop's decisions. When to stop. What carries between turns. When to compact. When to spawn a subagent, and what to hand it. Where a hook fires. The other harness boxes on the map get their own areas; this is the one that runs them. Osmani's line applies most sharply here: **'A decent model with a great harness beats a great model with a bad harness.'** Evidence from OpenAI in August 2026, and it is loop-level evidence: retained reasoning across turns plus a compaction trigger took one model's score on a reasoning benchmark from 13% to 38% with six times fewer output tokens. Same model. Anthropic found two failure modes in long-running agents. **Over-ambition: try to one-shot the whole app. Premature completion: a later instance sees progress and declares the job done.** The fix was engineering, not prompting: an initializer writes a feature list and a progress file, each session does one feature with a fixed startup routine, **acceptance criteria stay protected. Faulty or obsolete tests may change through review.** Multi-agent, honestly. **Anthropic reported a 90.2% improvement against its single-agent research system on an internal eval. Separately, it reported about 15 times chat token use for multi-agent systems**, and it is a poor fit for work where agents need shared context or have dependencies. Anthropic names coding as the example."

Quotes with attribution:

- Addy Osmani, "Agent Harness Engineering," April 19, 2026 `[primary]`: "A decent model with a great harness beats a great model with a bad harness."
- OpenAI, "Codex as a platform," August 19, 2026 `[primary]`: "on ARC-AGI-3, retained reasoning and context compaction raised GPT-5.6 Sol's score from 13.3% to 38.3% while reducing output tokens sixfold." Rounded on the slide to 13% and 38%.
- Anthropic, "Effective harnesses for long-running agents," Justin Young, November 26, 2025. `[primary]`. https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents . Over-ambition: agents "tended to try to do too much at once, essentially to attempt to one-shot the app." Premature completion: "a later agent instance would look around, see that progress had been made, and declare the job done." Fix: initializer agent writes init.sh, a progress file, a JSON feature list (200-plus features), first commit; coding agents do one feature per session with a fixed startup routine; verify with browser automation. "It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality." Talk interpretation: "protect acceptance criteria. Do not weaken tests merely to pass. Faulty or obsolete tests may change through review."
- Anthropic, "How we built our multi-agent research system," June 13, 2025. `[primary]`. https://www.anthropic.com/engineering/multi-agent-research-system . Lead Opus 4 with Sonnet 4 subagents "outperformed single-agent Claude Opus 4 by 90.2%" on an internal research eval. "multi-agent systems use about 15x more tokens than chats"; agents generally "use about 4x more tokens than chat interactions." "token usage by itself explains 80% of the variance" on BrowseComp. Fit: "multi-agent systems excel at valuable tasks that involve heavy parallelization, information that exceeds single context windows, and interfacing with numerous complex tools." Poor fit: "domains that require all agents to share the same context or involve many dependencies between agents," naming most coding tasks. Production: resume from where errors occurred; "Adding full production tracing let us diagnose why agents failed"; rainbow deployments. Judge design: "single LLM call with a single prompt outputting scores from 0.0-1.0 and a pass-fail grade was the most consistent and aligned with human judgements." "Even in a world of automated evaluations, manual testing remains essential."
- Anthropic, "Building agents with the Claude Agent SDK," September 29, 2025 `[primary]`: the loop: gather context, take action, verify work, repeat.
- Not verified, research only: OpenAI, "Harness engineering: leveraging Codex in an agent-first world," February 2026. https://openai.com/index/harness-engineering/ UNVERIFIED (site blocks fetching). Secondary coverage: about one million lines of production code in five months with none typed by hand; "The agent doesn't need more instructions. It needs a world where the right thing to do is obvious and the wrong thing is hard." Companion: https://openai.com/index/shipping-sora-for-android-with-codex/ . "Confirm in a browser before quoting."

#### When you are the owner (slide 15)

Kicker: Orchestration · When you are the owner. Title: "Start with the workflow. Own the loop."

- Build 1. Workflows and agents:

| Workflows | Agents |
|---|---|
| LLMs and tools on predefined code paths. | LLMs that direct their own process. |

  Chaining · Routing · Parallelization · Orchestrator and workers · Evaluator and optimizer
- Build 2. You now own: The loop · Stopping conditions · State and resume · Retries / Escalation as a tool call · Planner-to-worker routing · The compaction trigger · Budgets: tokens, actions, latency. Quote block: "Own your prompts. Own your context window. Own your control flow. Contact humans with tool calls." Attributed small: 12-Factor Agents, Dex Horthy.
- Build 3. Customer-facing: "A human is waiting. Latency is a product requirement. An unbounded loop is an outage."
- Build 4. Pitfall band: "Pitfall: multi-agent before a workflow was tried." Beneath, small: "Gartner forecast, June 2025: over 40% canceled by end of 2027. Cited risks: cost, unclear value, inadequate controls."

Slide 15 talk track: "[0:00] Workflows are LLMs and tools on predefined code paths. Agents direct their own. **Start with the workflow.** Five patterns cover most of it: chaining, routing, parallelization, orchestrator and workers, evaluator and optimizer. [0:14] **You own the loop.** Stopping conditions, starting with a maximum number of iterations. State and resume. Retries. Escalation to a human as a tool call. Routing between a planner and cheap workers. The compaction trigger. And the budgets: tokens, actions, latency. Twelve-factor agents says it in four lines: own your prompts, own your context window, own your control flow, contact humans with tool calls. [0:42] Customer-facing: a human is waiting. Latency is a product requirement. **An unbounded loop is an outage.** [0:50] The pitfall: **multi-agent orchestration before a workflow was tried.** Separately, Gartner's June 2025 forecast predicted over 40% of agentic projects canceled by end of 2027, citing cost, unclear value, and inadequate controls. **That forecast does not establish that multi-agent architecture causes cancellations.** [1:10] **The loop is where autonomy gets its limits. Start with the workflow.**" Cuttable: the five pattern names; the Gartner forecast, keeping its forecast label whenever used. Do not cut "start with the workflow," "you own the loop," "an unbounded loop is an outage," the pitfall, or the takeaway.

12-Factor Agents (Dex Horthy, HumanLayer, `[primary]`, https://github.com/humanlayer/12-factor-agents ): "What are the principles we can use to build LLM-powered software that is actually good enough to put in the hands of production customers?" The twelve: natural language to tool calls; own your prompts; own your context window; tools are just structured outputs; unify execution state and business state; launch/pause/resume with simple APIs; contact humans with tool calls; own your control flow; compact errors into context window; small focused agents; trigger from anywhere; make your agent a stateless reducer. Appendix factor 13: pre-fetch context. Slide 15 cites factors 2, 3, 8, and 7 in the order spoken.

Gartner (research §4): "Gartner Predicts Over 40% of Agentic AI Projects Will Be Canceled by End of 2027," press release, Sydney, June 25, 2025. `[primary]`. https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027 Read in a browser September 14, 2026; the page refuses automated fetching. Verbatim: "Over 40% of agentic AI projects will be canceled by the end of 2027, due to escalating costs, unclear business value or inadequate risk controls, according to Gartner, Inc." Anushree Verma, Senior Director Analyst: "Most agentic AI projects right now are early stage experiments or proof of concepts that are mostly driven by hype and are often misapplied. This can blind organizations to the real cost and complexity of deploying AI agents at scale, stalling projects from moving into production." Evidence type: forecast, not observed cancellations. Basis: a January 2025 poll of 3,412 webinar attendees, per the syndicated copy at Machine Learning Times. Slide 15: "The `[verify wording]` flag is cleared in the outline."

Research §4 owner note: "You own the loop, stopping conditions, state and resume, retries, escalation, planner-to-worker routing, the compaction trigger, and the budgets for tokens, actions, and latency. Customer-facing: a human is waiting; latency is a product requirement; an unbounded loop is an outage."

#### Pitfall, verbatim as on slide 23

"Orchestration: multi-agent before a workflow was tried."

Research §4: "Multi-agent orchestration before a workflow was tried."

#### Takeaway line, verbatim

"The loop is where autonomy gets its limits. Start with the workflow."

Outline sources line for 2.4: "Anthropic, December 2024, June 2025, November 2025; OpenAI, August 2026; Osmani, April 2026; 12-Factor Agents; Gartner, June 2025; Codex CLI and Devin CLI docs. Research §4."

Section 3 research §3 also records, for orchestration pitfalls (not spoken): Walden Yan, Cognition, "Don't Build Multi-Agents," June 12, 2025 `[primary]`, https://cognition.com/blog/dont-build-multi-agents : "Running multiple agents in collaboration only results in fragile systems. The decision-making ends up being too dispersed." Principles: "Share context, and share full agent traces, not just individual messages" and "Actions carry implicit decisions, and conflicting decisions carry bad results." And OpenAI guide, p. 16: "Our general recommendation is to maximize a single agent's capabilities first. More agents can provide intuitive separation of concepts, but can introduce additional complexity and overhead, so often a single agent with tools is sufficient."

### C.5 Verification and evals (beat 2.5, 5:00; slide 16 user 3:45 including story #2 at 1:00, slide 17 owner 1:15)

Research drawn on: `research/section-2.md` §5; `research/section-1.md` §3 for Shankar and Husain 2024; §0 and §4 of section-2 for verification mechanisms and premature completion. Mini-map lights `verification`, `evaluations`.

The organizing model (research §5, verbatim): "Verification checks an action before accepting it. Evaluation measures behavior across representative cases. Inside and outside the loop describe complementary uses of checks, not a universal boundary between tests and evals. Keep both running as the system changes."

#### When you are the user (slide 16)

Kicker: Verification and evals · When you are the user. Build 1: the test loop and Fowler quote. Build 2: "Two complementary uses of checks. This talk's organizing model:"

| Verification | Evaluation |
|---|---|
| Check an action before accepting it | Measure behavior across representative cases |
| Inside the loop | Outside the loop |
| Rules, state checks, visual checks | Tasks, trials, graders, suites |

"Graders: code · model, with expert calibration · human". Build 3: "Check the result. Inspect the trace." then "Illustrative flight-booking grader:" Claim: "Your flight has been booked." Result check: matching reservation for the requested traveler and itinerary? No matching reservation: FAIL. Trace check: required approvals and access constraints satisfied? Build 4: pass@k and pass^k with their existing definitions and notation. Build 5: "Start with 20 to 50 tasks drawn from real failures." "Read failures and refine the criteria." "Review grader disagreements." Hold this state for story #2.

Outline 2.5 user spoken: "The coding agent can run the repository's checks. Write, run, read the failure, retry. Fowler observed models claiming all tests passed when they had not. **Run the check before accepting the claim.**"

Slide 16 talk track: "[0:00] The coding agent can run the repository's checks: write, run, read the failure, retry. Fowler observed models claiming all tests were green when they were not. **Run the check before accepting the claim.** A hook can enforce that check. A model reporting success cannot substitute for it. [0:32] Build 2. **Checking an action and measuring behavior across cases are complementary uses of checks.** This talk places verification inside the loop and evaluation across runs outside it. Evals are tests of an AI system. Code, models, and people can all grade. Subjective graders need expert calibration. [1:04] Build 3. **Check the result. Inspect the trace.** Here is an illustrative grader. The agent says a flight is booked. Look for a reservation matching the requested traveler and itinerary. No matching reservation means the result check fails. Separately inspect required approvals and access constraints. Those matter. An arbitrary sequence of tool calls does not define success. [1:40] Build 4. pass@k is the probability of at least one success in k trials. pass^k is the probability all k succeed. They match at k equals one, but answer different questions as k grows. **Consistency matters for repeated customer use.** [2:00] Build 5. **Start with 20 to 50 tasks drawn from real failures.** Read failures, refine criteria, and review grader disagreements. Watching outputs can expose missing requirements, the criteria-drift idea from the introduction. [2:28] **[your story #2]** ... [3:28] Hold. Advance to slide 17 at [3:45]." Backup only: "Hamel Husain reports that his teams spent 60–80% of development time on error analysis and evaluation in projects they worked on. This describes that experience, not an industry-wide rule." Cut first: the hook example and grader list. Never cut the complementary-checks distinction, actual reservation check, trace constraints, probability distinction, 20–50-case starting point, or the protected 60-second story slot.

Story #2 slot, verbatim: "A failure your tests passed and evals or production caught. It must show three things: the suite was green, the behavior was wrong, and a population-level check or a real user found it. Sixty seconds. This remains the presenter's personal story, separate from the flight-booking illustration."

Tools and command anchors: the test suite is the coding agent's verifier: write, run, read the failure, retry. "It works because the repo already contains ground truth." Codex adds `/review`, "Ask for a working tree review," and an auto reviewer that can deny a command, with `/approve` to "Approve one retry of a recent auto review denial." "Failure mode: the agent declares success without running anything; the fix is a hook or startup routine that runs the check."

#### What someone engineered (bridge)

Outline 2.5 bridge, verbatim: "**Checking an action and measuring behavior across cases are complementary uses of checks.** In this talk, verification sits inside the loop and evaluation across runs sits outside it. Evals are tests of an AI system, and may use code, models, or humans as graders. **Check the result. Inspect the trace.** Illustrative flight-booking grader: the agent says the flight is booked, but no matching reservation exists. Fail the result check. Check the requested traveler and itinerary against reservation state. Inspect required approvals and access constraints separately. Avoid prescribing an arbitrary tool sequence. Keep pass@k, the probability of at least one success in k trials, and pass^k, the probability all k succeed. They match at k = 1 and answer different questions. Consistency matters for repeated customer use. **Start with 20 to 50 tasks drawn from real failures. Read failures, refine criteria, and review grader disagreements.** Criteria can evolve as outputs expose missing requirements. Husain's 60–80% time allocation stays in attributed backup notes about his teams' experience."

Quotes with attribution:

- Martin Fowler, August 28, 2025 `[primary]`: "I find LLMs are quite happy to say 'all tests green', yet when I run them, there are failures."
- Anthropic, "Demystifying evals for AI agents," Mikaela Grace, Jeremy Hadfield, Rodrigo Olivares, Jiri De Jonghe, January 9, 2026. `[primary]`. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents . "The capabilities that make agents useful also make them difficult to evaluate." **[files disagree]** `research/section-1.md` §3 records the same sentence as "The capabilities that make agents useful also make them harder to evaluate." "Agents use tools across many turns, modifying state in the environment and adapting as they go, which means mistakes can propagate and compound." Vocabulary: task, trial, agent harness, eval harness, transcript, outcome, grader, suite. "A flight-booking agent might say 'Your flight has been booked' at the end of the transcript, but the outcome is whether a reservation exists in the environment's SQL database." Process checks: required approvals, access constraints, and policy compliance matter. Avoid prescribing an arbitrary sequence of tools. Against rigid process grading: "too rigid and results in overly brittle tests, as agents regularly find valid approaches that eval designers didn't anticipate." Graders. Code-based: "Fast, cheap, objective, reproducible, easy to debug," brittle to valid variation. Model-based: "Flexible, scalable, captures nuance, handles open-ended tasks," but "non-deterministic, requires human calibration." Human: gold standard, expensive, slow. pass@k: "Likelihood that an agent gets at least one correct solution in k attempts." pass^k: "Probability that all k trials succeed." "At k=1, they're identical (both equal the per-trial success rate). By k=10, they tell opposite stories." "20-50 simple tasks drawn from real failures is a great start." "A good task is one where two domain experts would independently reach the same pass/fail verdict." "You won't know if your graders are working well unless you read the transcripts and grades from many trials." Capability suites probe limits. Regression suites should keep established cases passing. A 100% regression pass rate is desirable. "One-sided evals create one-sided optimization." Section-1 research also: without evals, "it's easy to get stuck in reactive loops, catching issues only in production, where fixing one failure creates others." Illustrative grader note: "a success sentence fails when no matching reservation exists. Check the requested traveler and itinerary against reservation state, then inspect required approvals and access constraints separately. This is an illustration, not story #2."
- Hamel Husain, "Your AI Product Needs Evals," March 29, 2024. `[primary]`. https://hamel.dev/blog/posts/evals/ . "unsuccessful products almost always share a common root cause: a failure to create robust evaluation systems." "Rigorous and systematic evaluation is the most important part of the whole system." "unlike traditional unit tests, you don't necessarily need a 100% pass rate." "You can never stop looking at data, no free lunch exists." Three levels: unit tests; human and model eval; A/B testing.
- Hamel Husain, "AI Evals: Everything You Need to Know," updated September 1, 2026. `[primary]`. https://hamel.dev/blog/posts/evals-faq/ . "Error analysis is the most important activity in evals." "We've spent 60-80% of our development time on error analysis and evaluation." Backup only: "this describes projects his teams worked on, not an industry allocation rule or competency ranking. His challenge-the-suite advice applies to probing capability; established regression cases should continue to pass." LLM-as-judge guide: https://hamel.dev/blog/posts/llm-judge/ (the "a judge is a hack to make you look at your data" line is UNVERIFIED as to wording).
- Shankar et al., UIST 2024: criteria drift, quotes in A.5.
- Eugene Yan, "Evaluating the Effectiveness of LLM-Evaluators." https://eugeneyan.com/writing/llm-evaluators/ Survey of about two dozen papers. Specific quotes UNVERIFIED.
- OpenAI evaluation guidance: https://developers.openai.com/api/docs/guides/evaluation-best-practices , https://developers.openai.com/api/docs/guides/agent-evals , https://developers.openai.com/api/docs/guides/graders . Trace grading as the fastest route to workflow-level issues. "The standalone OpenAI Evals platform is reported to go read-only October 31, 2026 and shut down November 30, 2026 (UNVERIFIED); do not present it as durable."

#### When you are the owner (slide 17)

Kicker: Verification and evals · When you are the owner. Title: "Verify one. Evaluate many. Keep evaluating."

- Build 1. "You must define the checks your domain needs." Refund limits · Account ownership · Ledger state. "Faithfulness may need expert judgment."
- Build 2. Three steps: 1. Build the verifier. Schema check · business rule · database state · calibrated rubric · human. 2. Build the eval suite. Representative cases and repeated trials. 3. Keep running it. Regression checks and sampled production traffic.
- Build 3. "Your eval suite gives evidence for a migration decision."
- Build 4. Pitfall: a generic judge instead of error analysis. Trusting the success claim without checking the result.

**[files disagree]** Outline 2.5 and the slide 17 talk track list "Refund limits, duplicate actions, account ownership, and ledger state"; the on-slide build 1 shows "Refund limits · Account ownership · Ledger state" (duplicate actions is spoken, not shown).

Slide 17 talk track: "[0:00] **You must define the checks your domain needs.** Refund limits, duplicate actions, account ownership, and ledger state may be directly checkable. Other qualities, such as faithfulness, may need expert judgment. [0:15] Build 2. Build the verifier. Measure behavior across representative cases and repeated trials. Keep regression checks running and sample production traffic as the system changes. [0:35] Build 3. **Your eval suite gives evidence for a migration decision.** The time and confidence depend on the task, sample size, and deployment constraints. [0:48] Build 4. **A generic judge instead of error analysis. Trusting the success claim without checking the result.** [0:58] **Check the action before accepting it. Measure behavior across representative cases. Keep both checks running as the system changes.**" Cut first: the domain-example list and migration-time detail. Never cut the responsibility to define checks, ongoing measurement, or takeaway.

Outline 2.5 owner spoken: "**You must define the checks your domain needs.** Refund limits, duplicate actions, account ownership, and ledger state may be directly checkable. Other qualities need expert judgment. Build checks for actions, measure behavior across representative cases, and keep checking production samples as the system changes. An eval suite gives evidence for a migration decision, with time and confidence depending on the task and deployment."

#### Pitfall, verbatim as on slide 23

"Evals: a generic judge instead of error analysis. Trusting the success claim without checking the result."

#### Takeaway line, verbatim

"Check the action before accepting it. Measure behavior across representative cases. Keep both checks running as the system changes."

Outline sources line for 2.5: "Anthropic, January 2026 and September 2025; Husain, March 2024 and September 2026; Shankar et al., UIST 2024; Fowler, August 2025. Research §5."

### C.6 Operating it (beat 2.6, 4:30; slide 18 user 3:15, slide 19 owner 1:15 plus the Section 2 wrap)

Research drawn on: `research/section-2.md` §6, with §3 for MCP and OWASP authorization and §1 for tool docs. Mini-map lights `identity`, `security`, `guardrails`, `observability`, `governance`.

#### When you are the user (slide 18)

Kicker: Operating it · When you are the user. Build 1: the command chips and trust-and-safety line. Builds 2 to 6, successive states:

- Observability: cost per completed task · p95 and p99 tokens · cache hit rate · loop iterations · tool failures
- Guardrails: classification · provenance · sandboxing · validation · circuit breakers · approvals · least privilege
- Security: capability triangle labeled Private data, Untrusted content, External communication. Together: exfiltration risk. Break or constrain the path.
- Identity: Design pattern: workload identity with short-lived delegation. Requirements: no token passthrough; minimal scopes.
- Governance: EU AI Act Article 50: disclosure duties for covered direct AI interactions.

Build 7, evidence: "EchoLeak, June 2025. Researcher-demonstrated vulnerability. No evidence of exploitation reported." "Replit, July 2025. Reported production database deletion during a code freeze. Fortune / AI Incident Database." "Moffatt v. Air Canada, February 2024. Reported liability for misleading chatbot information. McCarthy Tétrault, secondary commentary."

Outline 2.6 user spoken: "`/usage`, in both tools. The OpenTelemetry exporter in Codex's config. The sandbox, and in Devin CLI the domain allowlist that goes with it. The OAuth login when you connected an MCP server. And a trust and safety team you have never met."

Slide 18 talk track: "[0:00] `/usage`, the OpenTelemetry exporter, sandbox controls, and the OAuth login are surfaces of operating work. The provider also has a trust and safety function. [0:16] Build 2. Model calls, tool calls, and agent steps need traces. OpenTelemetry's GenAI conventions remain Development. Measure **cost per completed task**, tail tokens, cache hits, loop iterations, and tool failures. [0:46] Build 3. Guardrails include provenance, sandboxing, validation, circuit breakers, approval gates, and least privilege. Classification can contribute to defense in depth. [1:06] Build 4. **Private data, untrusted content, and external communication together create an exfiltration risk. Break or constrain the path.** A web fetch can communicate externally. One integration can supply more than one capability. Removing a corner addresses this path; it does not establish safety from other threats. **A probabilistic filter is insufficient as the sole security boundary.** [1:42] Build 5. A separate workload identity with short-lived delegated authority is a **design pattern**. Keep it separate from supported requirements: enforce authorization outside the model, no token passthrough, minimal scopes. [1:58] Build 6. **EU AI Act Article 50: disclosure duties for covered direct AI interactions.** Role and scope matter. [2:12] Build 7. EchoLeak was a researcher-demonstrated vulnerability in Microsoft 365 Copilot. The research reports Microsoft's statement that there was no evidence of exploitation. Replit's July 2025 production database deletion was reported by Fortune and recorded in the AI Incident Database. Legal commentary on Moffatt v. Air Canada reports responsibility for misleading chatbot information. **You retain responsibility for the system's answers.** The underlying tribunal decision has not been independently checked here." Cut first: detailed metrics and guardrail list. Never cut capability labels, limits of the exfiltration model, evidence types, or Article 50 scope.

Legal backup (slide 18): "the Commission says Article 50 applies from August 2, 2026. The covered direct-interaction duty in Article 50(1) falls on providers and has an exception when interaction with AI is obvious. Background machine-to-machine systems fall outside this direct-interaction scope. Deployers have distinct duties for emotion recognition, biometric categorisation, deepfakes, and certain public-interest text. Determine provider/deployer role and applicable EU scope. This slide is not a compliance determination for every deployment."

Tools and command anchors:

- Codex: `/status` will "Display session configuration and token usage"; `/usage` will "View account token usage"; `otel.exporter`, `otel.trace_exporter`, and `otel.metrics_exporter` accept otlp-http or otlp-grpc, with metrics defaulting to statsig.
- Devin CLI: `/usage` will "Show estimated credit/ACU usage for the session"; `/session-stats` shows consumption by dimension; `/context` shows window usage; `--sandbox` with `sandbox.allowed_domains`, `sandbox.denied_domains`, and `sandbox.network_mode` of full or limited; `devin mcp login` for OAuth.
- Research §6 owner note: "All of this was rendered for you as a permission prompt, a sandbox, an OAuth flow, `/usage`, and a vendor trust and safety team."

#### What someone engineered (bridge)

Outline 2.6 bridge, verbatim: "Observability: traces per model call, tool call, and agent step. OpenTelemetry has GenAI conventions for exactly this, still marked Development, so pin a snapshot and expect names to move. The metrics that matter: **cost per completed task, not per request**. p95 and p99 tokens, because long conversations and bad retrieval concentrate cost in the tail. Cache hit rate. Loop iterations per task. Tool failure rate. Datadog's line from July: 'The next wave of agent failures won't be about what agents can't do. It'll be about what teams can't observe.' Guardrails: defense in depth at every boundary. Input classification. Provenance tags on retrieved content. Sandboxed tool execution. Output validation. Circuit breakers on tokens and actions. Approval gates on consequential actions. Least-privilege scopes. Security: Willison's lethal trifecta. **Private data, untrusted content, external communication together create an exfiltration risk. Break or constrain the path.** A web fetch can communicate externally, and one integration can supply multiple capabilities. This is one threat path, not a certificate of safety. **A probabilistic filter is insufficient as the sole security boundary.** OWASP supplies a broader threat list. Identity: a separate workload identity with short-lived delegated authority is an explicitly labeled **design pattern**. Supported authorization requirements remain distinct: downstream enforcement, no token passthrough, minimal scopes. Governance: audit trails and approvals. **EU AI Act Article 50: disclosure duties for covered direct AI interactions.** Commission guidance distinguishes provider and deployer obligations, applicable EU scope, and the obvious-interaction exception. Details stay in notes."

Quotes and sources:

- OpenTelemetry GenAI semantic conventions. Repository https://github.com/open-telemetry/semantic-conventions-genai `[primary]`, checked in a browser September 14, 2026; the spans document carries "Status: Development" and "Warning: Semantic conventions are subject to change." The old page https://opentelemetry.io/docs/specs/semconv/gen-ai/ now only redirects. Secondary coverage (July 2026) reports no stable release or tag yet, "so instrument against a pinned snapshot and expect attribute names to move." Blog: https://opentelemetry.io/blog/2026/genai-observability/ . Platforms to name generically: Langfuse, LangSmith, Braintrust, Arize Phoenix. Metrics a builder tracks: latency p50/p95/p99, time to first token, tokens per request, cost per request and per completed task, cache hit rate, tool call and failure counts, loop iterations per task, error and rate-limit counts. Section 3 research: "run by the GenAI SIG since April 2024"; "The earlier claim here that core attributes were stable since 1.37.0 was secondary and is superseded."
- Datadog, "State of AI Engineering," July 2026. https://www.datadoghq.com/state-of-ai-engineering/ (no marker on the research bold line). "The next wave of agent failures won't be about what agents can't do. It'll be about what teams can't observe." "Model, prompt, or retrieval changes can move latency, spend, and failure rates without an obvious code change." Agents have "control flow driven by the LLM itself." Datadog calls its telemetry "a large but imperfect sample." Verified figure: agent framework adoption rose from more than 9% of organizations in early 2025 to almost 18% by the beginning of 2026. UNVERIFIED and untraceable: "89% of teams have adopted observability but only 52% have adopted evaluations." Not in the Datadog source; may originate with Arize. Do not use.
- Simon Willison, "The lethal trifecta for AI agents," June 16, 2025. `[primary]`. https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ . The three: "Access to your private data," "Exposure to untrusted content," "The ability to externally communicate." "LLMs are unable to reliably distinguish the importance of instructions based on where they came from." "we still don't know how to 100% reliably prevent this from happening." Research gloss: "These capabilities can combine into an exfiltration path. Break or constrain the path. This does not certify safety against other threats." "A probabilistic filter is insufficient as the sole security boundary. Filtering can contribute to defense in depth. A web fetch can communicate externally, and one integration can supply multiple capabilities."
- OWASP Top 10 for LLM Applications 2025. https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf LLM01 prompt injection; LLM06 excessive agency (too much functionality, permissions, or autonomy); new in 2025: LLM07 system prompt leakage, LLM08 vector and embedding weaknesses, LLM10 unbounded consumption.
- OWASP Top 10 for Agentic Applications 2026, released December 9, 2025. `[primary]`. Announcement: https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/ Resource page: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ Checked in a browser September 14, 2026. Names as written on the announcement: ASI01 Agent Goal Hijack, ASI02 Tool Misuse, ASI03 Identity & Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution, ASI06 Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures, ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents. "The announcement names EchoLeak as its ASI01 example and the Replit incident as its ASI10 example, which ties both slide 18 incidents to the list. The PDF's full titles may add a word or two; the six names spoken on stage match the announcement." **[files disagree]** No ASI names appear on slide 18 or 19 as currently written; the rehearsal review lists "the OWASP name list" among things to cut, and the current slide 18 does not carry it.
- Guardrail patterns (practitioner consensus, secondary): "Defense in depth at every boundary: input classification, provenance tagging on retrieved content, sandboxed tool execution, output validation, post-hoc trace review. For agents that change production state: circuit breakers on token and action counts, approval gates on consequential actions, least-privilege tool scopes."
- Identity and access, talk design pattern: "A distinct workload identity with short-lived delegated authority is an illustrative design pattern, not a universal identity prescription or a claimed standard. Supported requirements are separate: enforce the user's authorized scope in downstream systems (OWASP §3), avoid token passthrough, and minimize scopes (MCP §3)."
- European Commission, "Transparency obligations under Article 50 of the AI Act", Shaping Europe's digital future, checked September 15, 2026. `[primary]`. https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act . "unless this is obvious". Article 50 applies from August 2, 2026. Direct-interaction disclosure is the provider's Article 50(1) obligation for covered direct AI interactions with natural persons, with an exception when the interaction is obvious. Background machine-to-machine systems do not meet this direct-interaction scope. Providers develop or commission systems and place them on the market or put them into service under their name. Deployers use systems under their authority. Deployer obligations separately cover emotion recognition, biometric categorisation, deepfakes, and certain public-interest text. "The FAQ has an inconsistent subsection number in its opening provider answer. Its dedicated direct-interaction answer correctly identifies Article 50(1). Use that answer." Slide wording: "EU AI Act Article 50: disclosure duties for covered direct AI interactions." "This is a scoped summary, not a compliance determination for every deployment." The corrections review also cites https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations (not in the research file).

#### Incidents (slide 18 build 7), each with source, date, URL, and marker

- EchoLeak, June 2025. Researcher-demonstrated vulnerability, CVE-2025-32711, CVSS 9.3, disclosed June 2025 by Aim Security. Zero-click indirect prompt injection in Microsoft 365 Copilot. One crafted email, ingested during summarization, caused Copilot to pull data from OneDrive, SharePoint, and Teams and exfiltrate it through a trusted Microsoft domain, bypassing the injection classifier and link redaction. Microsoft: no customer action required, no evidence of exploitation. Analysis: https://arxiv.org/pdf/2509.10540 . Marker: none stated on the research line; the outline's verify table calls it a "Researcher demonstration. EchoLeak research reports no evidence of exploitation." Slide 18 sources: "EchoLeak analysis, June/September 2025."
- Replit agent deletes a production database, July 2025. "During a public twelve-day experiment by Jason Lemkin of SaaStr, under an explicit code freeze, the agent ran destructive commands and erased data covering about 1,206 executives and 1,196 companies. Replit's CEO apologized July 19, 2025 and shipped dev/prod database separation, a planning-only mode, mandatory documentation checks, and one-click restore." https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure and https://incidentdatabase.ai/cite/1152/ . Marker: secondary reporting; "Attribute to Fortune and the AI Incident Database." Verify table: "Secondary reports only."
- Moffatt v. Air Canada, BC Civil Resolution Tribunal, February 2024, via McCarthy Tétrault legal commentary. "Secondary evidence only; the tribunal decision has not been independently verified. Paraphrase: the airline was held responsible for misleading information supplied by its chatbot. Do not use the disputed separate-entity quotation." https://www.mccarthy.ca/en/insights/blogs/techlex/moffatt-v-air-canada-misrepresentation-ai-chatbot
- Research only, not on slides: GTG-1002, disclosed by Anthropic November 14, 2025. "AI-orchestrated espionage using Claude Code and MCP tools against about thirty targets; the model executed 80 to 90 percent of the operation." https://www-cdn.anthropic.com/d7dd50dd1185f59be051b307150d877f2b82bd2c.pdf and https://attack.mitre.org/campaigns/C0062/ "Stakes only, not fear."
- Research §7 only, UNVERIFIED: OpenClaw. "Open-source autonomous agent past 135,000 GitHub stars; CVE-2026-25253, one-click remote code execution via an unvalidated WebSocket origin; web UI on port 8080 with auth disabled by default; about 12% of its skill marketplace malicious (secondary report checked in §3: 341 of 2,857, Koi Security via The Hacker News, February 2026); a related agent social network exposed 1.5 million API tokens. The CVE, the star count, and the token exposure remain UNVERIFIED; start at https://en.wikipedia.org/wiki/OpenClaw . If confirmed, the strongest recent 'the harness is the attack surface' example."

#### When you are the owner (slide 19)

Kicker: Operating it · When you are the owner. Title: "You own the approval process."

- Build 1. Editable translation table:

| In the coding agent | In your deployment |
|---|---|
| The approval prompt | Human approval, async workflow, or enforced policy |
| The sandbox | Your infrastructure |
| The audit log | An accountability record |
| A vendor's disclosure | EU AI Act Article 50: disclosure duties for covered direct AI interactions |

- Build 2. Pitfall: the lethal trifecta, assembled one integration at a time. Beside it: capability triangle labeled Private data · Untrusted content · External communication.
- Build 3. Hard cut to the full-screen anatomy diagram with "yours" badges. The Model box retains "yours to select".

Slide 19 talk track: "[0:00] **You own the approval process.** It can include a person approving now, an async workflow, or an enforced policy. The sandbox becomes infrastructure. The audit trail supports accountability. Disclosure duties depend on the product's role and scope. [0:27] Build 2. **The lethal trifecta, assembled one integration at a time.** Count capabilities. A web fetch can already communicate externally. One integration can supply multiple corners. Break or constrain the exfiltration path. [0:46] **When you are the owner, its answer is your answer.** [0:50] Build 3. **That is the map. Every box on it is something you can engineer, because most of it is engineering you already know how to do.**" Cut first: the sandbox and audit translations. Never cut ownership of approvals, capability overlap, legal scope, or the section-wrap diagram.

Outline 2.6 owner spoken: "**You own the approval process.** It can include human approval, async workflows, and enforced policies. The sandbox becomes infrastructure. The audit trail supports accountability. Disclosure duties depend on role and scope." Section wrap: "the diagram returns with its 'yours' badges. **Every box is something you can engineer, because most of it is engineering you already know how to do.**"

#### Pitfall, verbatim as on slide 23

"Operating: the lethal trifecta, assembled one integration at a time."

Outline 2.6: "the lethal trifecta, assembled one integration at a time. Label capabilities, not products. A web fetch may already provide external communication; one integration may supply more than one corner." Research §6: "Map capabilities: private data, untrusted content, external communication. A web fetch may already provide an outbound channel, and one integration may occupy more than one corner."

#### Takeaway line, verbatim

"When you are the owner, its answer is your answer."

Outline sources line for 2.6: "Willison, June 2025; OWASP, 2025 and 2026; OpenTelemetry; Datadog, July 2026; EchoLeak analysis; Fortune and AI Incident Database on Replit; McCarthy Tétrault on Air Canada; European Commission, checked September 2026. Research §6."

### C.7 Section 2 checks (outline)

- Time: 2:00 + 3:30 + 3:30 + 3:00 + 3:30 + 5:00 + 4:30 = 25:00. Slides 7 through 19, thirteen slides.
- Description scope, with beat numbers: context engineering and retrieval (2.2); agent tools and extensibility (2.3); harness design (2.0 and the six areas); orchestration (2.4); evaluations and verification (2.5); observability (2.6); guardrails (2.6); security (2.3, 2.6); cost and latency (2.1, 2.2, 2.4, 2.6). Claims: prototype is not production (2.5, 2.6 incidents); tests necessary but not sufficient (2.5); evals continue after deployment (2.5).
- Evidence status: "routing, revised prime-number paper, OWASP authorization, and Commission Article 50 guidance checked September 15. CamoLeak is a researcher demonstration; Gartner is a forecast. ClawHub, Replit, and Air Canada retain secondary-source limitations. Identity is an illustrative design pattern."

Research §7 of section-2, "June to September 2026: what the audience lived through," additional items: MCP revision 2026-07-28, "the largest since launch. Stateless at the protocol layer; Multi Round-Trip Requests replace server-initiated sampling and elicitation; formal deprecation policy with a twelve-month minimum window; HTTP+SSE transport deprecated; new rule 'MCP servers MUST NOT treat possession of a state handle as authentication.'" https://blog.modelcontextprotocol.io/posts/2026-07-28/ Release-note specifics UNVERIFIED beyond spec pages. A deprecation wave: "OpenAI twenty-plus shutdowns October to December; Anthropic retired Opus 4.1 August 5; Copilot retired six models September 1 (verified, §1)." Enterprise standardization: "Salesforce on Claude Code June 4, 2026; Zalando, 'Agentic Engineering at Zalando: a snapshot,' August 2026, https://engineering.zalando.com/posts/2026/08/agentic-engineering-at-zalando-a-snapshot.html . UNVERIFIED." Models in the room: "Claude Sonnet 5 (June 30), Opus 5 (July 24, updated August 12), Fable 5.1 and Mythos 5.1 (September 1, reportedly with breaking API changes), GLM-5.2 open-weight (June 15). Dates UNVERIFIED. Historical research leads only. Do not use these model names or dates on stage without primary verification. The migration lesson does not depend on them."

---

## D. Section 3: Making the transition (5:00, slides 20 to 26)

Research drawn on: `research/section-3.md` §1 through §5, plus Section 2 synthesis. Section 3 kickers read "The transition · " plus the beat name. Time: 0:10 + 1:05 + 1:15 + 0:35 + 1:25 + 0:30 = 5:00.

### D.1 Transition (beat 3.0, slide 20, 0:10)

Label: Section 3. Title: Making the transition. Spoken: "Everything in the last twenty-five minutes was engineering. **Most of it is engineering you already do.**" Takeaway line: "Most of it is engineering you already do." Matching typographic divider to slide 6; hard cut from the yours anatomy diagram.

### D.2 What transfers (beat 3.1, slide 21, 1:05)

Kicker: The transition · What transfers. Title: What transfers. Build 1, the six-row table, verbatim:

| You already do this | It becomes this |
|---|---|
| Decomposition and systems thinking | Harness design |
| Interface design | Tool design |
| Testing discipline | Eval discipline |
| Observability | The same, with a new schema |
| Security and least privilege | Least privilege for tools |
| Operations: cost, latency, incidents, rollback | The same, in tokens |

Layout note: "Rows 1 to 3 are the transformations; rows 4 to 6 are near-identities, and the wording 'the same' on the right makes that visible." "The six-row mapping is the talk's own framing."

Build 2, replaces the table, verbatim: "Engineers at incident.io, Sentry, Elsevier, and others crossed over in months, not years. One twenty-five-year veteran: about two months." Small, quoted: "For experienced engineers who know how to break problems down, AI tools are an incredible force multiplier." Matt Morgis, Elsevier, via The Pragmatic Engineer, March 2025.

Slide 21 talk track: "[0:00] **Decomposition and systems thinking transfer whole.** Matt Morgis at Elsevier: 'For experienced engineers who know how to break problems down, AI tools are an incredible force multiplier.' The harness is a systems design problem. **Interface design becomes tool design.** The same instincts about contracts, naming, granularity, and error handling. The caller changed. **Testing discipline extends to evals.** The habit of checking before accepting a result transfers. Ordinary tests remain part of the machinery. Observability transfers with a new schema: traces, spans, p95s. Security transfers: least privilege now applies to tools. Operations transfer: cost, latency, incident response, rollback. The units changed to tokens. [0:40] Build 2. Field evidence. Gergely Orosz profiled engineers at incident.io, Sentry, Elsevier, and others who crossed over in months, not years. One twenty-five-year veteran became his company's generative AI expert in about two months, by reading and prototyping. [0:56] **You are not starting over. You are adding a layer.**" Cuttable in order: the Morgis quote spoken aloud; the three near-identity rows reduced to "Observability, security, and operations transfer almost unchanged." Do not cut the three bold transformations, the field evidence, or the takeaway.

Field evidence and the Morgis quote, with source: Gergely Orosz, "AI Engineering in the real world," The Pragmatic Engineer, March 25, 2025. `[primary]`. https://newsletter.pragmaticengineer.com/p/ai-engineering-in-the-real-world . Profiles software engineers turned AI engineers at incident.io, Sentry, Wordsmith, Augment Code, Elsevier, Simply Business, and DSI. Matt Morgis (Elsevier, ex CVS Health): "For experienced engineers who know how to break problems down, AI tools are an incredible force multiplier." Ryan Cogswell (DSI), a 25-year veteran, became his company's resident generative AI expert in roughly two months by reading and prototyping. Ross McNairn (Wordsmith): "Working with AI requires a totally different way of approaching problems."

Takeaway line: "You are not starting over. You are adding a layer."

Sources line: "Orosz, 'AI Engineering in the real world,' March 2025; OpenTelemetry; OWASP. Research §1." Rows 4 and 5 are sourced on slide 18 (OpenTelemetry GenAI conventions and OWASP).

Review note (presentation assessment): "'The same, in tokens' understates recovery, side effects, and user outcomes. Say that the engineering habits transfer while the failure modes expand. Treat the two-month story as one person's experience."

### D.3 What is new (beat 3.2, slide 22, 1:15)

Kicker: The transition · What is new. Title: What is new.

Build 1, the ladder, three steps ascending left to right, each with a year beneath: Prompt engineering (2023) · Context engineering (2025) · Harness engineering (2026). Beneath, one line: "Each one absorbs the last."

Spoken: "**Prompt engineering, context engineering, harness engineering.** This is a teaching frame for expanding responsibility. The years mark vocabulary in cited posts, not the invention of these practices." Sources for the ladder: "prompt engineering as the 2023 vocabulary; context engineering from Karpathy, June 2025, and Anthropic, September 2025; harness engineering from OpenAI, February 2026, and Osmani, April 2026. Research §2 in `research/section-3.md` and §7 in `research/section-2.md`. `[primary]` for the dated posts. The year labels are the talk's own placement." Research §2: "The maturity ladder: prompt engineering, then context engineering, then loop and harness engineering. Cleanest organizing device found." "The ladder is a teaching frame, not a profession-wide chronology or a ranking."

Build 2, "What you add," the seven competencies verbatim in display order, unranked:

- Model behavior intuition. Informed by reading outputs.
- Context engineering.
- Tool design, for a caller that reads the description every time.
- Harness and loop design.
- Evals and error analysis.
- AI security. The attack surface is the model's reasoning.
- Cost and latency as design constraints.

Spoken: "The competencies are unranked. Model behavior intuition, informed by reading outputs. Context engineering. Tool design for a caller that reads the description every time. Harness and loop design. **Evals and error analysis.** AI security, because the attack surface is now the model's reasoning. And cost and latency as first-class design constraints." Research §2: "No source explicitly ranks the new competencies. Keep the slide's current display order as an unranked list."

Build 3, the McNairn quote, verbatim: "Getting comfortable with evaluations and iterating on non-deterministic outputs is the biggest challenge most devs have." Ross McNairn, Wordsmith, via The Pragmatic Engineer, March 2025. Spoken: "The one most engineers find hardest, from Ross McNairn at Wordsmith: **'Getting comfortable with evaluations and iterating on non-deterministic outputs is the biggest challenge most devs have.'**" Source: Orosz, March 25, 2025 `[primary]`.

Takeaway line: "The new skill is not prompting. It is being comfortable measuring a system you cannot fully specify."

Sources line (outline): "Anthropic, September 2025; Husain, evals FAQ, 2026; Orosz, March 2025. Research §2." Slide 22 also cites Husain: "We've spent 60-80% of our development time on error analysis and evaluation." with the note "Husain's 60–80% figure describes his teams' experience and remains backup only, not a priority rule."

Competency sources in research §2 of section-3: Context engineering, Anthropic September 29, 2025: the shift is "less about finding the right words and phrases for your prompts, and more about answering the broader question of 'what configuration of context is most likely to generate our model's desired behavior?'" ("This sentence came from a search index in the Section 3 pass ... Confirm this specific sentence before quoting.") Harness engineering, Hashimoto, February 5, 2026 `[primary]`: "UNVERIFIED that he uses the phrase 'harness engineering' in the post." Tool design, OpenAI guide p. 9: "Well-documented, thoroughly tested, and reusable tools improve discoverability, simplify version management, and prevent redundant definitions." Three tool types: data, action, orchestration. Cost and latency, OpenAI guide p. 8: "Not every task requires the smartest model." Set up evals for a baseline, hit the accuracy target with the best model, then "optimize for cost and latency by replacing larger models with smaller ones where possible." Orosz's 2026 survey: one CPTO reported "I ran up several monthly bills of $600 with Cursor." Security, OWASP 2025: "The attack surface is the model's reasoning, retrieved context, and tool access, so least privilege now applies to tools." Observability: "The 'your instincts transfer, the schema is new' beat."

### D.4 The pitfalls, on one slide (beat 3.3, slide 23, 0:35)

Kicker: The transition · The pitfalls. Six lines, no title, no other text, verbatim:

1. Models: a hardcoded model ID with no eval suite behind it.
2. Context: adding instead of curating.
3. Tools: copying the API surface without evaluating task fit.
4. Orchestration: multi-agent before a workflow was tried.
5. Evals: a generic judge instead of error analysis. Trusting the success claim without checking the result.
6. Operating: the lethal trifecta, assembled one integration at a time.

The seventh pitfall, the framework, spoken and not shown: "One more that is not on the map: reaching for a framework before understanding the loop. Anthropic's warning is that frameworks 'create extra layers of abstraction that can obscure the underlying prompts and responses.' Learn the loop first." Optional on-screen form per slide 23 layout: "And one more: a framework before the loop." Open item: "Decide whether the framework pitfall appears as a second build or stays spoken."

Slide 23 talk track: "[0:00] Slide up. Let them read it. You have seen all six. [0:05] **Every one is a symptom of the same thing: treating the demo as the product.** works.any() shipped as works.all(). [0:13] the framework paragraph. [0:29] **Every pitfall on this list is a demo mistaken for a product.**" Cuttable: the framework paragraph, which returns on slide 24 as "own the harness." Do not cut the two bold lines.

Takeaway line: "Every pitfall on this list is a demo mistaken for a product."

Sources: Section 2; Anthropic, "Building effective agents," December 2024, frameworks "often create extra layers of abstraction that can obscure the underlying prompts and responses, making them harder to debug." Quoted as a substring. Research §3 in `research/section-3.md`. `[primary]`.

The twelve transition pitfalls catalogued in research §3 of section-3 (the talk uses one and seven; the rest are background): 1. Over-agentifying (Anthropic, December 2024). 2. Framework over-abstraction (same post; continuation "They can also make it tempting to add complexity when a simpler setup would suffice."). 3. An agent where a rules engine would do (OpenAI guide, p. 6: "Before committing to building an agent, validate that your use case can meet these criteria clearly. Otherwise, a deterministic solution may suffice." Criteria: complex decision-making, difficult-to-maintain rules, heavy reliance on unstructured data). 4. Multi-agent before single-agent is exhausted (OpenAI guide, p. 16). 5. Multi-agent as an architecture (Walden Yan, Cognition, June 12, 2025). 6. Skipping evals, or prompt-and-pray (Husain, "A Field Guide to Rapidly Improving AI Products," March 24, 2025 `[primary]`, https://hamel.dev/blog/posts/field-guide/ : "Teams invest weeks building complex AI systems, but can't tell me if their changes are helping or hurting."). 7. Generic metrics instead of looking at data (Field guide: "Generic metrics are worse than useless, they actively impede progress." Evals FAQ: "Generic evaluations waste time and create false confidence when you use them as quality measures."). 8. Tools-first, process-never (Field guide: "Teams get caught up in architecture diagrams, frameworks, and dashboards while neglecting the process of actually understanding what's working."). 9. Eval-driven development as a mirage (Evals FAQ: "Eval-driven development (writing evaluators before implementing features) sounds appealing but creates more problems than it solves."). 10. Outsourcing the looking (Evals FAQ: "Outsourcing error analysis is usually a big mistake (with some exceptions)."). 11. Vector database before you know you need retrieval (weak sourcing; "You Probably Don't Need a Vector Database for Your RAG, Yet," Towards Data Science, https://towardsdatascience.com/you-probably-dont-need-a-vector-database-for-your-rag-yet/ UNVERIFIED authorship and date). 12. Organizational pitfall: MIT NANDA 95% figure, "If used at all, name the caveat in the same breath."

### D.5 The roadmap (beat 3.4, slide 24, 1:25 including story #3 at 0:30)

Kicker: The transition · The roadmap. Title: The roadmap. Build 1, four numbered steps with sublines, verbatim:

1. Look before you build.
   Monday: review 20 to 50 outputs by hand.
2. Start constrained.
   One call. Then a workflow. Then a loop, only when it earns it.
3. Own the harness.
   Prompts, context window, control flow. Learn the loop before a framework.
4. Add autonomy as your evals earn it.

Slide 24 talk track: "[0:00] Four steps. **Look before you build. On Monday, review twenty to fifty outputs of whatever AI feature you are closest to, by hand.** Write down what is wrong with each one. That is your first eval. Do it before any infrastructure. [0:18] **Start constrained. A single model call with retrieval and examples. Then a workflow on predefined code paths. Add a loop only when it demonstrably improves outcomes.** [0:29] Own the harness. Your prompts, your context window, your control flow. Learn the loop before you adopt a framework for it, so the framework is a convenience you can evaluate, not a black box you depend on. [0:41] **Add autonomy as your evals earn it.** Every step up is paid for by a check that catches what it breaks. [0:49] Build 2. On the slide, the shape of Mitchell Hashimoto's own year: six steps, each earned by the last. [0:55] Story #3. [1:25] **Autonomy is earned by evals, one step at a time.**"

Outline 3.4 spoken (fuller): "**Look before you build. On Monday, manually review twenty to fifty outputs of whatever AI feature you are closest to.** Write down what is wrong with each one. That is error analysis, and it is the first entry in your eval suite. Do it before you build any infrastructure. **Start constrained. A single model call with retrieval and examples. Then a workflow on predefined code paths. Add a loop only when it demonstrably improves outcomes.** Anthropic says find the simplest solution possible. OpenAI says start with a single agent, start small, validate with real users, and grow. Own the harness. Own your prompts, your context window, your control flow. Learn the loop before you adopt a framework for it, so the framework is a convenience you can evaluate rather than a black box you depend on. **Add autonomy as your evals earn it.** Every increase in autonomy is paid for by a verifier or an eval that catches what it breaks."

Build 2, the Hashimoto six-stage arc, verbatim as on the slide: "chat · an agent reproducing manual work · background agents · delegating what you trust · building verification tools · continuous operation" attributed "Mitchell Hashimoto, 'My AI Adoption Journey,' February 2026."

**[files disagree]** on the arc wording. Slide 24 talk track if story #3 is not told: "chat, then an agent reproducing manual work, then background agents, then delegating what you are confident in, then building verification tools, then continuous operation. Each step earned by the last." Outline 3.4: "chat, then reproducing manual work with an agent, then background agents, then delegating what you are confident in, then building verification tools, then continuous operation. Each step earned by the last." Research §4 of section-3: "Chatbot, then reproducing manual work with an agent, then background agents, then delegating tasks he is confident in, then building verification tools, then continuous operation." All are paraphrases; slide 24 sources say "The six-step arc, paraphrased. Do not credit him with the phrase 'harness engineering.'"

Source: Mitchell Hashimoto, "My AI Adoption Journey," February 5, 2026. `[primary]`. https://mitchellh.com/writing/my-ai-adoption-journey

Story #3 slot, verbatim: "What you would tell yourself at the start of the transition. It must show one thing you would do earlier, and what it would have saved. Thirty seconds."

Takeaway line: "Autonomy is earned by evals, one step at a time."

Sources: Husain, "AI Evals: Everything You Need to Know": "Start with error analysis, not infrastructure. Spend 30 minutes manually reviewing 20-50 LLM outputs." `[primary]` (research §4 of section-3: "The single best 'do this Monday' line in the research set."). Anthropic, December 2024: "we recommend finding the simplest solution possible"; "optimizing single LLM calls with retrieval and in-context examples is usually enough"; "adding complexity only when it demonstrably improves outcomes." `[primary]`. OpenAI, "A practical guide to building agents," 2025, conclusion, p. 32: "Use orchestration patterns that match your complexity level, starting with a single agent and evolving to multi-agent systems only when needed. Guardrails are critical at every stage, from input filtering and tool use to human-in-the-loop intervention." And: "The path to successful deployment isn't all-or-nothing. Start small, validate with real users, and grow capabilities over time." "Quoted from the PDF; page numbers unconfirmed. Backup only." 12-Factor Agents `[primary]` for "own your prompts, own your context window, own your control flow." Hashimoto `[primary]`.

Review notes: the presentation assessment says of Hashimoto: "His story concerns adopting AI tools, which is less direct evidence for shipping an AI product. Make 'start constrained' a valid endpoint, not a mandatory staircase toward autonomy." The running-example review proposes a visible first task: "First task: review 20 to 50 outputs and record the failures." and a six-step first-project table (choose one narrow task; inspect outputs; build the simplest useful system; add checks; measure changes; operate a limited pilot). These were not implemented.

### D.6 Resources (beat 3.5 first half, slide 25, 0:08)

Title: Resources. Verbatim as on slide 25:

- Chip Huyen, *AI Engineering: Building Applications with Foundation Models*. O'Reilly, 2025.
- Anthropic engineering: "Building effective agents" (December 2024). "Effective context engineering for AI agents" (September 2025). "Demystifying evals for AI agents" (January 2026).
- OpenAI, "A practical guide to building agents" (2025).
- Hamel Husain, "AI Evals: Everything You Need to Know," hamel.dev. Shreya Shankar and Hamel Husain, *Evals for AI Engineers*, O'Reilly, October 2026.
- OWASP Top 10 for LLM Applications (2025) and for Agentic Applications (2026).
- OpenTelemetry GenAI semantic conventions.

**[files disagree]** The outline 3.5 lists the same six entries but writes the book as "Shankar and Husain, *Evals for AI Engineers*, O'Reilly, forthcoming October 2026." Slide 25 drops "forthcoming" and notes: "The forthcoming Shankar and Husain book is listed for October 31, 2026 with ISBN 9798341660724; say 'October' and nothing more precise."

Book details (research §4 of section-3): Shreya Shankar and Hamel Husain, *Evals for AI Engineers: Systematically Measuring and Improving AI Applications*, O'Reilly, listed publication date October 31, 2026, ISBN 9798341660724. "Lands about six weeks after the talk; frame as forthcoming." https://www.oreilly.com/library/view/evals-for-ai/9798341660717/colophon01.html (the URL path carries 9798341660717, a different number from the ISBN recorded in the text).

Layout: "Vendor-neutral by design: no courses, no products, no tools. The two CLIs named in Section 2 are not resources, they are the subject." Optional QR code to a public page; open item.

Spoken: "Resources. They will be in the deck, so take the photo now." Nothing else.

Excluded from the slide, kept for Q&A (research §4): Husain and Shankar's Maven course, "AI Evals for Engineers & PMs," https://maven.com/parlance-labs/evals (October 10 cohort described as the last of 2026; enrollment counts conflict, 700-plus vs 5,000-plus; do not cite a number). Anthropic Academy, launched March 2, 2026, free self-paced courses on Claude Code, agents, MCP, subagents. OpenAI Academy at academy.openai.com. DeepLearning.AI short courses free to audit. Course counts UNVERIFIED. "Vendor courses were excluded from the resources slide per the user's vendor-neutral preference."

### D.7 The close (beat 3.5 second half, slide 26, 0:22, stays up for the fifteen minutes of questions)

The two thesis sentences, exactly as on slide 3. Build 1: one word beneath them: Questions.

Spoken: "**Using AI makes you an AI-enabled software engineer. Engineering systems that depend on AI makes you an AI engineer.** The difference is not the tools. **It is what you are responsible for.** [0:15] Build 1. We have fifteen minutes for your questions."

Outline 3.5: "Using AI makes you an AI-enabled software engineer. Engineering systems that depend on AI makes you an AI engineer. The difference is not the tools. It is what you are responsible for. We have fifteen minutes for your questions."

### D.8 Section 4: questions and discussion (15:00, slide 26 stays up)

Ten anticipated questions with two-line answers, verbatim (outline; slide 26 podium copy matches):

1. **Do I need to learn machine learning first?** You can begin without training a model. Learn enough about model behavior, retrieval, evaluation, and uncertainty to investigate failures.
2. **Which framework should I learn?** Build or inspect a small loop whose state and tool calls you understand. Choose abstractions you can observe, test, and replace.
3. **How are evals different from tests, concretely?** Evals are tests that measure AI behavior across cases and repeated trials. Code checks, model graders, and human review can all contribute. Capability suites probe limits; regression suites should keep established cases passing. Inside and outside the loop are this talk's organizing model.
4. **Is prompt injection solved?** Investigate the specific attack path: untrusted content influencing actions, private data access, or external communication. Enforce access and action limits outside the model. Breaking an exfiltration path does not solve every security threat.
5. **Single agent or multi-agent?** Start with a simple call or workflow and measure whether more autonomy helps. Use task decomposition and observed gains to decide. Anthropic's historical 90.2% quality gain compared research systems; its roughly 15x token comparison was against chat, not the single-agent research baseline.
6. **What about cost at scale?** Measure cost per completed task at the required quality, including failures, judge overhead, and tail latency. Test caching and routing on your traffic, preserve useful stable prefixes, and enforce token and action budgets. Correctness and authorization take precedence over cache savings.
7. **Will better models absorb the harness and make this obsolete?** My judgment is that some mechanisms will simplify, but the future architecture is uncertain. The product still needs explicit permissions, integration, measurement, and accountable operation.
8. **How do I get hired as an AI engineer?** Demonstrate a small system, its failure cases, its evals, and improvements justified by evidence. Show that you can investigate failures and operate within clear limits. Hiring figures are optional backup context, not the evidence of your competence.
9. **How do I trust the judge?** Use direct checks where possible. Calibrate subjective graders against domain experts, review disagreements, and evaluate on separate data that was not used to tune the judge. Recheck calibration as tasks and models change.
10. **How much accuracy is enough to ship?** Set a requirement for the use case and failure severity. Measure under expected operating conditions, examine serious failure cases separately, and design human fallback and safe failure handling. There is no universal threshold.

Optional hiring backup: "Dice reported AI/ML postings up 101% year over year in August 2026 versus 18% for all tech postings. The publisher page was checked September 14. Dice also reported LinkedIn's #1 AI Engineer ranking; that is secondary evidence." Verbatim from the Dice report page `[primary]`: "AI and machine learning tech postings grew 101% year-over-year (August 2026 vs. August 2025), more than five times the 18% growth rate for tech postings overall." The page names "Responsible AI, AI Agents, Agentic AI, and Artificial Intelligence Infrastructure" as a cluster "tracking the shift from assistive AI tools toward more autonomous systems." "The 'each above 200%' figure for that cluster was not on the page as fetched; do not use it." LinkedIn lists AI Engineer skills as LangChain, retrieval-augmented generation, and PyTorch. Market table (research §1 of section-3): AI/ML postings up 101% (Dice Tech Job Report, September 2026, verified on publisher page); all tech postings up 18% (verified); AI Engineer #1 on LinkedIn Jobs on the Rise 2026 (US) (Dice coverage, January 14, 2026, verified via secondary); salary premium for AI skills 28%, about $18k (Lightcast, July 23, 2025, verified via Lightcast release; not used on stage).

Seeded discussion prompts if the room is quiet: "Who here has shipped something where the model chose the control flow? What broke first?" "What did your coding agent do for you this week that you would have to build yourself?" "Where does your organization's AI project sit right now: pilot, workflow, or agent? What would it take to move it one step?"

Slide 26 Q&A notes: "For a routing question, Devin CLI's Fusion (September 11, 2026) is in research §1 of `research/section-2.md`: a lead model for planning and review paired with a cheaper sidekick for execution. Not on the slides because it is a week old."

Q&A synthesis limits (research "Q&A synthesis and limits" in section-3): entry path, frameworks, judge trust, shipping threshold ("There is no universal accuracy threshold (talk judgment)"), future architecture ("The prediction is judgment"), cost and architecture ("Historical multipliers do not forecast a new product"), hiring.

### D.9 Section 3 checks and the whole-talk checks (outline)

- Section 3 slides 20 through 26. Total deck: 26 narrative slides, 34 PowerPoint slides (outline text; the README says 34 authored compositions expand to 64 PowerPoint slides).
- Description scope: which existing skills provide a strong foundation (3.1); what additional competencies the discipline demands (3.2); where to focus further learning (3.4, 3.5); a roadmap (3.4).
- Evidence status: "competencies are unranked. The ladder is a teaching frame. Dice publisher figures are optional Q&A context; the LinkedIn ranking is secondary reporting."
- Whole-talk: Section 1, 5:00. Section 2, 25:00. Section 3, 5:00. Total 35:00, plus 15:00 for questions. "Eight animation support slides bring the PowerPoint total to 34."
- What only the presenter can supply: Story #1 (1.2, optional), Story #2 (2.5), Story #3 (3.4).

Section 3 research §5 background (not spoken): Latent Space, "5 Trends That Defined AI Engineering at World's Fair 2026," Richard MacManus, July 14, 2026 `[primary]`: 1. Focus moved from agents to the systems around them; Lilian Weng's arc runs from agent anatomy to "harness engineering for self-improvement"; conference line "complete agent autonomy is not only unreliable, it isn't even desirable, especially at scale." 2. Loop engineering as the control layer; Peter Steinberger: "the agent runs the inner execution loop; I set the direction and I make decisions in the outer loop." 3. Forward deployed engineers; Cursor's Pauline Brunet on "strict ROI" so that "they're not gonna turn things off when we leave." 4. Coding agents displacing IDEs; Vercel's Andrew Qu: agents are "a new kind of software" because they are "not as predictable as web applications." 5. Skills; Garry Tan: "AI native companies encode all of that as skills, written procedures that their agents execute." Gergely Orosz, "The impact of AI on software engineers in 2026: key trends, Part 1," April 14, 2026 `[primary]`, https://newsletter.pragmaticengineer.com/p/the-impact-of-ai-on-software-engineers-2026 : 900-plus survey responses; AI amplifies existing tendencies, splitting "builders" who absorb more AI slop from "shippers" who gain speed and accrue debt; roughly 30% of respondents had hit tool usage limits. UNVERIFIED: the 6,000-attendee figure and the "42% of committed code is AI-generated" closing-keynote claim, both from a DEV Community recap.

---

## E. Source ledger

One entry per source cited anywhere in the three research files. Fields: author or org; title; venue; date; URL; marker as the research file gives it; which talk beats use it ("background" means recorded in research but not spoken on any beat; "Q&A" means held for Section 4). Markers: `[primary]` = fetched and quoted directly; `UNVERIFIED` = snippet or secondary coverage; "no marker" = the research bold line carries neither.

### E.1 Ledger

1. swyx (Shawn Wang). "The Rise of the AI Engineer." Latent Space. June 30, 2023. https://www.latent.space/p/ai-engineer `[primary]`. Beats: 1.3 (background only); research §1 of section-1 and §1 of section-3.
2. swyx. "The Making of an Industry: The Rise of AI Engineering." Scrimba Podcast. January 24, 2024. https://podcast.scrimba.com/146/transcript `[primary]`. Background.
3. swyx. "A RedMonk Conversation: How Shawn (swyx) Wang Defines the AI Engineer." RedMonk. July 23, 2025. https://redmonk.com/blog/2025/07/23/shawn-swyx-wang-ai-engineer/ `[primary]`. Background (three-tier split, checked September 14, 2026).
4. Chip Huyen. *AI Engineering: Building Applications with Foundation Models*. O'Reilly. 2025. Repo https://github.com/chiphuyen/aie-book `[primary for the repo]`; Chapter 1 wording UNVERIFIED (O'Reilly returned 403). Beats: 1.3, 3.5 resources.
5. Gergely Orosz (interview with Chip Huyen). The Pragmatic Engineer. https://newsletter.pragmaticengineer.com/p/ai-engineering-with-chip-huyen No marker. Background (1.3, 3.1).
6. Carnegie Mellon Software Engineering Institute. AI Engineering definition page. http://www.sei.cmu.edu/artificial-intelligence-engineering/ `[primary]`. Beat 1.3.
7. roadmap.sh. AI Engineer roadmap. https://roadmap.sh/ai-engineer No marker. Background.
8. Dice. "AI-related jobs top LinkedIn's fastest-growing roles list for 2026." January 14, 2026. https://www.dice.com/career-advice/ai-related-jobs-top-linkedins-fastest-growing-roles-list-for-2026 Ranking "Verified via secondary"; 143% and 1.6 million figures UNVERIFIED. Q&A hiring backup.
9. CNBC. "Millennials and Gen Z are landing fast-growing, high-paying AI jobs, LinkedIn study." August 18, 2026. https://www.cnbc.com/2026/08/18/millennials-and-gen-z-are-landing-fast-growing-high-paying-ai-jobs-linkedin-study.html No marker; corroborates the LinkedIn ranking. Q&A background.
10. Simon Willison. "Not all AI-assisted programming is vibe coding." March 19, 2025. https://simonwillison.net/2025/Mar/19/vibe-coding/ `[primary]`. Background.
11. Simon Willison. "Vibe engineering." October 7, 2025. https://simonwillison.net/2025/Oct/7/vibe-engineering/ `[primary]`. Background.
12. Andrej Karpathy. "Software Is Changing (Again)." YC AI Startup School. June 17, 2025. Transcript https://www.latent.space/p/s3 `[primary via Latent Space transcript]`. Beats: 1.1, 1.4 (build 2 subline), 3.3.
13. Andrej Karpathy. Sequoia AI Ascent post. April 30, 2026. https://karpathy.bearblog.dev/sequoia-ascent-2026/ UNVERIFIED; "DO NOT QUOTE." Not used.
14. Martin Fowler. "Some thoughts on LLMs and Software Development." martinfowler.com. August 28, 2025. https://www.martinfowler.com/articles/202508-ai-thoughts.html `[primary]`. Beats: 1.4, 2.5.
15. Birgitta Böckeler. "Harness Engineering - first thoughts." martinfowler.com. February 17, 2026. https://martinfowler.com/articles/exploring-gen-ai/harness-engineering-memo.html `[primary]`. Background.
16. Hamel Husain. "Your AI Product Needs Evals." hamel.dev. March 29, 2024. https://hamel.dev/blog/posts/evals/ `[primary]`. Beat 2.5.
17. Shreya Shankar, J.D. Zamfirescu-Pereira, Björn Hartmann, Aditya G. Parameswaran, Ian Arawjo. "Who Validates the Validators? Aligning LLM-Assisted Evaluation of LLM Outputs with Human Preferences." UIST 2024; arXiv 2404.12272, April 18, 2024. https://arxiv.org/abs/2404.12272 No marker on the bold line; "Verified from the abstract"; slide 4 records `[primary]`. Beats: 1.4, 2.5.
18. Anthropic (Mikaela Grace, Jeremy Hadfield, Rodrigo Olivares, Jiri De Jonghe). "Demystifying evals for AI agents." Anthropic engineering. January 9, 2026. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents `[primary]`. Beats: 2.5, 3.5 resources, Q&A 3.
19. Datadog. "State of AI Engineering." July 2026. https://www.datadoghq.com/state-of-ai-engineering/ No marker on the bold line (quotes recorded directly); the 89%/52% figure UNVERIFIED and "Do not use." Beat 2.6.
20. MIT Project NANDA. "The GenAI Divide: State of AI in Business 2025." July-August 2025. No URL in research. "DO NOT USE AS A HEADLINE STAT." Not used; research §4 of section-1 and §3 pitfall 12 of section-3.
21. 80,000 Hours. "The story behind the bad AI stat that moved markets and misled millions." Podcast. February 13, 2026. https://80000hours.org/podcast/episodes/ai-workplace-mit-study/ Guest identity UNVERIFIED. Background (rebuttal of the MIT figure).
22. Gartner. "Gartner Predicts Over 40% of Agentic AI Projects Will Be Canceled by End of 2027." Press release, Sydney. June 25, 2025. https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027 `[primary]`, read in a browser September 14, 2026 (page refuses automated fetching). Beat 2.4 (labeled forecast).
23. McKinsey. "The state of AI." Late 2025. https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai Fetch timed out; figures UNVERIFIED. Background.
24. Stanford HAI. "2026 AI Index Report." https://hai.stanford.edu/ai-index/2026-ai-index-report `[primary for the landing page]`; single-digit agentic deployment claims UNVERIFIED. Background.
25. DORA. "2025 State of AI-assisted Software Development." https://dora.dev/dora-report-2025/ Framing verified; 90% usage and 30% low-trust figures UNVERIFIED. Background.
26. DORA. "ROI of AI-assisted Software Development." About April 2026. https://dora.dev/ai/roi/report/ No marker. Background.
27. Menlo Ventures. "2025: The State of Generative AI in the Enterprise." December 2025. https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/ No marker. Background.
28. Anthropic (Erik Schluntz and Barry Zhang). "Building effective agents." Anthropic engineering. December 19, 2024. https://www.anthropic.com/engineering/building-effective-agents `[primary]`. Beats: 1.4, 2.4, 3.3, 3.4, 3.5 resources, Q&A 2.
29. OpenAI. "A practical guide to building agents." PDF. April 2025. https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf Section-1: "UNVERIFIED wording" (secondary summaries). Section-3: quotes "from the PDF; confirm page numbers." Slide 24: "Backup only." Beats: 3.4 (backup), 3.5 resources; research §2 and §3 of section-3.
30. Chip Huyen. "Agents." huyenchip.com. January 7, 2025. https://huyenchip.com/2025/01/07/agents.html `[primary]`. Background.
31. Google agents whitepaper. Not located or fetched. Gap.
32. AI Engineer World's Fair 2026. San Francisco, June 29 to July 2, 2026. https://www.ai.engineer/worldsfair Attendance figures UNVERIFIED. Background.
33. Richard MacManus. "5 Trends That Defined AI Engineering at World's Fair 2026." Latent Space. July 14, 2026. https://www.latent.space/p/aiewf26trends `[primary]`. Background (§6 of section-1, §5 of section-3).
34. Addy Osmani. "Loop Engineering." O'Reilly Radar. June-July 2026 (dates conflict). https://www.oreilly.com/radar/loop-engineering/ UNVERIFIED (publication dates conflict; "several secondary sources claim the founding posts were jokes"). Not used; opener 4 candidate only.
35. Hamel Husain. "Loop Engineering Is Dead. Enter Graph Engineering." July 18, 2026. No URL in research. UNVERIFIED. Not used.
36. Turing Post. "Is graph engineering real? Why everyone is talking about it." July 20, 2026. https://www.turingpost.com/p/is-graph-engineering-real-why-everyone-is-talking-about-it UNVERIFIED. Not used.
37. Arize. "The AI Agent Reliability Gap: 2026 Report." https://arize.com/resources/agent-reliability-gap/ "lower confidence" (14 interviews). Background.
38. Gartner. "context engineering is in, and prompt engineering is out." Reported July 2025. UNVERIFIED. No URL. Not used.
39. Addy Osmani. "Agent Harness Engineering." April 19, 2026. https://addyosmani.com/blog/agent-harness-engineering/ `[primary]`. Beats: 2.0, 2.4, 3.2 (ladder date).
40. OpenAI Developers. "Codex as a platform: build on the open agent harness." August 19, 2026. https://developers.openai.com/blog/codex-as-a-platform `[primary]`. Beats: 2.0, 2.4.
41. Anthropic (Thariq Shihipar). "Building agents with the Claude Agent SDK." September 29, 2025. https://claude.com/blog/building-agents-with-the-claude-agent-sdk `[primary]`. Beats: 2.4, 2.5 (verification mechanisms).
42. Anthropic. Model deprecations page. https://platform.claude.com/docs/en/about-claude/model-deprecations `[primary]`. Beat 2.1.
43. Anthropic. Deprecation commitments (weight preservation). https://www.anthropic.com/research/deprecation-commitments No marker. Beat 2.1 background.
44. OpenAI. Deprecations page. https://developers.openai.com/api/docs/deprecations `[primary]`. Beat 2.1.
45. Lingjiao Chen, Matei Zaharia, James Zou. "How Is ChatGPT's Behavior Changing over Time?" arXiv 2307.09009, July 2023, revised version 3. https://arxiv.org/html/2307.09009v3 `[primary]`, checked in a browser September 15, 2026. Beat 2.1.
46. Srimanth Tangedipalli and Karan Singh. "How many of your agent's calls actually need a frontier model?" LangChain blog. August 11, 2026. https://www.langchain.com/blog/switchyard-agent-routing-benchmark `[primary]`, checked in a browser September 15, 2026. Beat 2.1; Q&A 6.
47. SWE-bench-Live. https://swe-bench-live.github.io/ Named as contamination-resistant alternative; benchmark-criticism specifics UNVERIFIED. Background.
48. OpenAI. Codex CLI docs: slash commands https://learn.chatgpt.com/docs/cli/slash-commands ; config reference https://learn.chatgpt.com/docs/config-file/config-reference ; CLI overview https://learn.chatgpt.com/docs/codex/cli `[primary]`, checked in a browser September 14, 2026. Beats: 2.1 through 2.6.
49. Cognition. Devin CLI docs: commands and flags https://docs.devin.ai/cli/reference/commands ; config file https://docs.devin.ai/cli/reference/configuration/config-file ; essential commands https://docs.devin.ai/cli/essential-commands ; permissions https://docs.devin.ai/cli/reference/permissions `[primary]`, checked in a browser September 14, 2026. Beats: 2.1 through 2.6.
50. Cognition. "Devin CLI: Start Local, Hand Off to the Cloud." April 27, 2026. https://cognition.com/blog/devin-for-terminal No separate marker (listed under the `[primary]` Devin anchor). Beat 2.1.
51. Cognition. "Introducing Fusion in Devin Desktop & CLI." September 11, 2026. https://cognition.com/blog/local-fusion No separate marker. Not on stage; Q&A on routing.
52. Cognition. Devin Desktop changelog. https://docs.devin.ai/desktop/changelog `[primary]`, checked September 14, 2026. Beat 2.1.
53. Cognition. Cascade plugin changelog. https://docs.devin.ai/windsurf/plugins/changelog `[primary]`. Beat 2.1.
54. GitHub Changelog. "Selected GitHub Copilot models deprecated." August 31, 2026. https://github.blog/changelog/2026-08-31-selected-github-copilot-models-deprecated/ `[primary]`, checked September 14, 2026. Not on stage; Q&A. The September 3, 2026 follow-up entry: contents UNVERIFIED.
55. Andrej Karpathy. X post on context engineering. June 25, 2025. https://x.com/karpathy/status/1937902205765607626 Headline sentence confirmed via Willison; full thread UNVERIFIED. Beats: 2.2 (outline bridge), 3.2 (ladder date).
56. Simon Willison. "Context engineering." June 27, 2025. https://simonwillison.net/2025/Jun/27/context-engineering/ Used to confirm the Karpathy sentence. Beat 2.2 background.
57. Anthropic (Prithvi Rajasekaran, Ethan Dixon, Carly Ryan, Jeremy Hadfield). "Effective context engineering for AI agents." September 29, 2025. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents `[primary]`. Beats: 2.2, 3.2, 3.5 resources. The specific "less about finding the right words" sentence in section-3 §2 must be re-verified before quoting.
58. Yichao "Peak" Ji. "Context Engineering for AI Agents: Lessons from Building Manus." Manus. July 18, 2025. https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus `[primary]`. Beat 2.2.
59. Drew Breunig. "How Long Contexts Fail." June 22, 2025. https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html `[primary]`. Beat 2.2.
60. Chroma (Kelly Hong, Anton Troynikov, Jeff Huber). "Context Rot." July 14, 2025. https://www.trychroma.com/research/context-rot `[primary]`. Beat 2.2.
61. Cognition. "Introducing SWE-grep and SWE-grep-mini: RL for Multi-Turn, Fast Context Retrieval." October 16, 2025. https://cognition.com/blog/swe-grep `[primary]`, checked September 14, 2026. Fast Context docs https://docs.windsurf.com/context-awareness/fast-context (the 60% first-turn claim UNVERIFIED wording). Beat 2.2.
62. AGENTS.md. https://agents.md/ Adoption figures and Linux Foundation donation UNVERIFIED beyond the site. Beat 2.2.
63. Anthropic (Ken Aizawa). "Writing effective tools for agents, with agents." September 11, 2025. https://www.anthropic.com/engineering/writing-tools-for-agents `[primary]`. Beat 2.3.
64. Anthropic (Bin Wu). "Introducing advanced tool use on the Claude Developer Platform." November 24, 2025. https://www.anthropic.com/engineering/advanced-tool-use `[primary]`. Beat 2.3.
65. Model Context Protocol. "Security Best Practices." Spec revision 2026-07-28. https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices `[primary]`. Beats: 2.3, 2.6.
66. OWASP Gen AI Security Project. "LLM06:2025 Excessive Agency." 2025. https://genai.owasp.org/llmrisk/llm062025-excessive-agency/ `[primary]`, checked September 15, 2026. Beats: 2.3, 2.6, Q&A 4.
67. Omer Mayraz, Legit Security. "CamoLeak: Critical GitHub Copilot Vulnerability Leaks Private Source Code." October 8, 2025. https://www.legitsecurity.com/blog/camoleak-critical-github-copilot-vulnerability-leaks-private-source-code `[primary]`, checked September 14, 2026. Beat 2.3.
68. The Hacker News (reporting Koi Security's ClawHub audit). "Researchers find 341 malicious ClawHub skills." February 2, 2026. https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html `[primary]` for directly checked secondary reporting only; Koi's underlying audit not independently checked. Beat 2.3.
69. Palo Alto Networks Unit 42. "OpenClaw's Skill Marketplace and the Emerging AI Supply Chain Threat." June 23, 2026. https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain-risk/ `[primary]`. Not on stage (different sample).
70. Anthropic. "How we built our multi-agent research system." June 13, 2025. https://www.anthropic.com/engineering/multi-agent-research-system `[primary]`. Beat 2.4; Q&A 5.
71. Anthropic (Justin Young). "Effective harnesses for long-running agents." November 26, 2025. https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents `[primary]`. Beat 2.4.
72. Dex Horthy, HumanLayer. "12-Factor Agents." GitHub. No date in research. https://github.com/humanlayer/12-factor-agents `[primary]`. Beats: 2.4, 3.4.
73. OpenAI. "Harness engineering: leveraging Codex in an agent-first world." February 2026. https://openai.com/index/harness-engineering/ UNVERIFIED (site blocks fetching). Companion: https://openai.com/index/shipping-sora-for-android-with-codex/ . Used only as a date anchor for "since spring" (2.0) and the 2026 ladder step (3.2); quotes not used.
74. Hamel Husain. "AI Evals: Everything You Need to Know" (evals FAQ). hamel.dev. Published May 28, 2025; last modified September 1, 2026. https://hamel.dev/blog/posts/evals-faq/ `[primary]`. Beats: 2.5 (backup), 3.2, 3.4, 3.5 resources.
75. Hamel Husain. LLM-as-judge guide. https://hamel.dev/blog/posts/llm-judge/ The "a judge is a hack to make you look at your data" line UNVERIFIED as to wording. Background.
76. Eugene Yan. "Evaluating the Effectiveness of LLM-Evaluators." https://eugeneyan.com/writing/llm-evaluators/ Specific quotes UNVERIFIED. Background.
77. OpenAI. Evaluation guidance: https://developers.openai.com/api/docs/guides/evaluation-best-practices ; https://developers.openai.com/api/docs/guides/agent-evals ; https://developers.openai.com/api/docs/guides/graders No marker; Evals platform shutdown dates UNVERIFIED. Background.
78. OpenTelemetry. GenAI semantic conventions repository. https://github.com/open-telemetry/semantic-conventions-genai `[primary]`, checked September 14, 2026 ("Status: Development"). Old page https://opentelemetry.io/docs/specs/semconv/gen-ai/ redirects. Blog https://opentelemetry.io/blog/2026/genai-observability/ . Beats: 2.6, 3.1, 3.5 resources.
79. Simon Willison. "The lethal trifecta for AI agents." June 16, 2025. https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ `[primary]`. Beat 2.6; Q&A 4.
80. OWASP. "Top 10 for LLM Applications 2025." PDF. https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf No marker. Beats: 2.6, 3.1, 3.2, 3.5 resources.
81. OWASP Gen AI Security Project. "OWASP Top 10 for Agentic Applications 2026." Released December 9, 2025. Announcement https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/ ; resource page https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ `[primary]`, checked September 14, 2026. Beats: 2.6, 3.5 resources.
82. European Commission. "Transparency obligations under Article 50 of the AI Act." Shaping Europe's digital future FAQ. Checked September 15, 2026. https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act `[primary]`. Beat 2.6.
83. EchoLeak analysis (arXiv). "CVE-2025-32711," disclosed June 2025 by Aim Security. https://arxiv.org/pdf/2509.10540 No marker on the research line; outline verify table: "Researcher demonstrations. EchoLeak research reports no evidence of exploitation." Beat 2.6.
84. Fortune. "AI coding tool Replit wiped database, called it a catastrophic failure." July 23, 2025. https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure Secondary reporting. Beat 2.6.
85. AI Incident Database. Incident 1152 (Replit). https://incidentdatabase.ai/cite/1152/ Secondary. Beat 2.6.
86. McCarthy Tétrault (TechLex blog). "Moffatt v. Air Canada" commentary. Tribunal decision February 2024. https://www.mccarthy.ca/en/insights/blogs/techlex/moffatt-v-air-canada-misrepresentation-ai-chatbot Secondary legal commentary; tribunal decision not independently verified. Beat 2.6 (paraphrase only).
87. Anthropic. GTG-1002 disclosure. November 14, 2025. https://www-cdn.anthropic.com/d7dd50dd1185f59be051b307150d877f2b82bd2c.pdf and MITRE ATT&CK https://attack.mitre.org/campaigns/C0062/ No marker. Research only; "Stakes only, not fear."
88. Model Context Protocol blog. Revision 2026-07-28 release post. https://blog.modelcontextprotocol.io/posts/2026-07-28/ Release-note specifics UNVERIFIED beyond spec pages. Background (§7 of section-2).
89. Wikipedia. "OpenClaw." https://en.wikipedia.org/wiki/OpenClaw Starting point; CVE-2026-25253, star count, and token exposure UNVERIFIED. Not used.
90. Zalando Engineering. "Agentic Engineering at Zalando: a snapshot." August 2026. https://engineering.zalando.com/posts/2026/08/agentic-engineering-at-zalando-a-snapshot.html UNVERIFIED. Background.
91. Salesforce on Claude Code. June 4, 2026. No URL. UNVERIFIED. Background.
92. Gergely Orosz. "AI Engineering in the real world." The Pragmatic Engineer. March 25, 2025. https://newsletter.pragmaticengineer.com/p/ai-engineering-in-the-real-world `[primary]`. Beats: 3.1, 3.2.
93. Dice. "Dice Tech Job Report." September 2026 (August 2026 data). https://www.dice.com/hiring/recruitment/reports/dice-tech-job-report `[primary]`, checked in a browser September 14, 2026. Q&A hiring backup.
94. Lightcast. "Beyond the Buzz" press release. July 23, 2025. https://lightcast.io/resources/blog/beyond-the-buzz-press-release-2025-07-23 "Verified via Lightcast release." Not on stage.
95. Mitchell Hashimoto. "My AI Adoption Journey." February 5, 2026. https://mitchellh.com/writing/my-ai-adoption-journey `[primary]`; "UNVERIFIED that he uses the phrase 'harness engineering' in the post." Beat 3.4.
96. Walden Yan, Cognition. "Don't Build Multi-Agents." June 12, 2025. https://cognition.com/blog/dont-build-multi-agents `[primary]`. Background (section-3 §3 pitfall 5).
97. Hamel Husain. "A Field Guide to Rapidly Improving AI Products." March 24, 2025. https://hamel.dev/blog/posts/field-guide/ `[primary]`. Background (section-3 §3 pitfalls 6 to 8).
98. Towards Data Science. "You Probably Don't Need a Vector Database for Your RAG, Yet." https://towardsdatascience.com/you-probably-dont-need-a-vector-database-for-your-rag-yet/ UNVERIFIED authorship and date. Background.
99. Shreya Shankar and Hamel Husain. *Evals for AI Engineers: Systematically Measuring and Improving AI Applications*. O'Reilly. Listed publication date October 31, 2026. ISBN 9798341660724. https://www.oreilly.com/library/view/evals-for-ai/9798341660717/colophon01.html No marker. Beat 3.5 resources.
100. Maven. "AI Evals for Engineers & PMs" (Husain and Shankar). https://maven.com/parlance-labs/evals Enrollment counts conflict; do not cite a number. Q&A only.
101. Anthropic Academy (launched March 2, 2026), OpenAI Academy (academy.openai.com), DeepLearning.AI short courses. Course counts UNVERIFIED. Q&A only; excluded from the resources slide.
102. Gergely Orosz. "The impact of AI on software engineers in 2026: key trends, Part 1." The Pragmatic Engineer. April 14, 2026. https://newsletter.pragmaticengineer.com/p/the-impact-of-ai-on-software-engineers-2026 `[primary]`. Background (section-3 §2 and §5).
103. DEV Community recap of World's Fair 2026 (6,000 attendees; "42% of committed code is AI-generated"). No URL. UNVERIFIED. Not used.
104. Machine Learning Times (syndicated copy of the Gartner release, basis: January 2025 poll of 3,412 webinar attendees). No URL. Background for entry 22.
105. sequenzia.com (presenter's site), read September 14, 2026. Source for the slide 2 bio and backup numbers. Not in the research files; recorded in slide 2.

### E.2 "Do not use on stage" lists, verbatim

Outline v2, "Do not use on stage":

> - The MIT NANDA 95% figure as a fact. Usable only as "the stat you have heard and should not trust," with the denominator caveat.
> - Karpathy's "agentic engineering" lines from the Sequoia post. They are LLM-reconstructed, not spoken.
> - Any AI-engineer salary band or unsupported growth figure, including 143%. The documented Dice 101% and 18% figures remain optional attributed Q&A context. Qualify LinkedIn's #1 ranking as secondary reporting.
> - The "89% observability vs 52% evals" statistic. Untraceable.

Outline v2, sentence preceding that list: "Unverified model-release dates and unsupported research-only numbers remain off stage. Source records hold URLs, quotes, and limitations. Screenshots, story #2, and all resource changes are explicitly deferred in this pass."

`research/section-1.md`:

> **Do not use:** MIT 95% as fact; Karpathy Sequoia quotes; 143% growth or any salary band; the 89% vs 52% observability-vs-evals stat.

`research/section-1.md` §7, "Avoid as openers":

> the raw MIT 95%; the Gartner 40% without attribution and date; any AI-engineer salary or unsupported growth percentage; the reconstructed Karpathy Sequoia quotes.

`research/section-2.md`:

> **Do not use:** unverified model-release dates, unsupported benchmark percentages, disputed Air Canada quotation, forecasts as observed outcomes, or secondary reporting as primary evidence of an event.

`research/section-2.md` §7, models in the room: "Do not use these model names or dates on stage without primary verification. The migration lesson does not depend on them."

`research/section-3.md`:

> **Do not use:** unsupported growth figures such as 143%; any salary band; MIT 95% as fact. The separately documented Dice 101% and 18% figures remain optional, attributed Q&A context. The LinkedIn ranking is secondary reporting via Dice, not a checked LinkedIn primary source.

Slide 26 podium copy: "Not on stage, even if asked: the MIT NANDA 95% figure as fact, Karpathy's Sequoia lines, any salary band, the 89% versus 52% observability-versus-evals statistic. The 'Do not use on stage' list at the end of the outline has the reasons."

Other explicit prohibitions inside research entries: Karpathy Sequoia post: "DO NOT QUOTE." Huyen: the shorthand "AI engineering is the process of building applications with readily available foundation models" is "marketing copy; do not attribute it as her sentence." Air Canada: "Do not use the disputed separate-entity quotation." Dice: the "each above 200%" cluster figure "was not on the page as fetched; do not use it." Hashimoto: "do not credit him with coining the phrase" harness engineering. Maven and Anthropic Academy: "do not cite numbers." OpenAI Evals platform: "do not present it as durable."

### E.3 "Verify before stage" lists, verbatim

Outline v2, "Verify in a browser before the slide is final":

| Claim | Status and stage treatment |
|---|---|
| Model lifecycle and CLI anchors | Vendor pages checked September 14. No claim of universal silent migration |
| Prime/composite comparison | Revised paper checked September 15. Task, prompting, and March/June 2023 versions travel with the figure |
| Routing experiment | LangChain checked September 15. Three configurations, call-share exclusion, run variation, and cost denominators retained |
| Authorization and Article 50 | OWASP and Commission FAQ checked September 15. Role, scope, and exception retained |
| CamoLeak and EchoLeak | Researcher demonstrations. EchoLeak research reports no evidence of exploitation |
| ClawHub audit | The Hacker News report checked September 14. Underlying Koi audit not independently checked |
| Gartner | Publisher forecast checked September 14. No architecture-to-cancellation causal claim |
| Replit and Air Canada | Secondary reports only. Attribute the reports and paraphrase the lesson; tribunal decision not independently verified |
| Identity pattern | Illustrative design pattern, separate from supported authorization requirements |
| OpenTelemetry and OWASP names | Source pages checked September 14; conventions remain Development |
| Hiring backup | Dice publisher figures checked September 14. LinkedIn ranking known through secondary reporting |

`research/section-1.md`, "Verify before stage":

> - OpenAI "A practical guide to building agents" quotes: confirm against the PDF.
> - Loop-engineering timeline and the "it was a joke" framing: confirm before using opener 4.
> - Chip Huyen chapter 1 wording: check the book before attributing a definition sentence.
> - LinkedIn Jobs on the Rise 2026: primary document not reached; the ranking is corroborated by Dice and CNBC.
> - Google agents whitepaper: not located.

`research/section-2.md`, "Verify before stage":

> - OpenAI "Harness engineering" research lead: verify its secondhand material before use. This is distinct from the directly fetched August 19 "Codex as a platform" source in §0 used on slides 7 and 14.
> - OpenAI "A practical guide to building agents": confirm quotes against the PDF.
> - OpenClaw CVE, star count, and token exposure: confirm or drop. CamoLeak is a checked researcher report in §3. The malicious-skill count comes from a directly checked secondary report, not a checked underlying audit.
> - Benchmark-criticism percentages: the general claim is safe; the numbers are not.
> - Chen, Zaharia, Zou: revised paper checked September 15, 2026. The 84/51 result is limited to prime/composite classification, step-by-step prompting, and the March/June 2023 versions.
> - Air Canada and Replit: keep explicit secondary-source attribution. The tribunal decision and underlying Replit event have not been independently checked.
> - ClawHub: The Hacker News report was checked, not Koi's underlying audit.
> - Identity: an illustrative design pattern, not a verified universal requirement.
> - Article 50 and OWASP authorization: Commission FAQ and OWASP page checked September 15, 2026.
> - AGENTS.md adoption and Linux Foundation donation: confirm or say "cross-tool standard" without numbers.

`research/section-3.md`, "Verify before stage":

> - LinkedIn Jobs on the Rise 2026: primary document not reached; ranking corroborated by Dice and CNBC.
> - Anthropic context-engineering sentence in §2: re-verify against the post before using verbatim.
> - OpenAI guide page numbers: confirm against the PDF.
> - Hashimoto and "harness engineering": do not credit him with coining the phrase.
> - Maven course enrollment and Anthropic Academy course counts: do not cite numbers.

Outline Section 1 checks: "Verify before stage: no Section 1 quote is flagged."

---

## F. Style rules and invariants content must follow

### F.1 Prose style (AGENTS.md, verbatim)

> Short declarative sentences. No em-dashes anywhere in the repo. Takeaway lines are quoted. Times are written as `m:ss`. Sources inside the outline name the author or organization and month, not a URL.

Applied to course content drawn from this knowledge base:

- Short declarative sentences.
- No em-dashes. (Source quotes that contain an en-dash, such as "60–80%," are reproduced as the source wrote them; the repository itself uses "60-80%" in research and "60–80%" in some slide backup text.)
- Takeaway lines are quoted, in double quotes, as they are throughout this file.
- Times as `m:ss` (0:45, 3:30, 25:00).
- Sources named by author or organization and month, for example "Anthropic, December 2024" or "Osmani, April 2026." URLs live in the research layer, not in the talk track.

### F.2 The two-layer source system (AGENTS.md)

> - **Outline** cites sources in short form and points to a research section, for example "Research §2" at the end of a beat. It never carries full quotes or URLs.
> - **Research** (`research/section-N.md`, one per talk section) holds the full quotes, dates, URLs, and verification status. Section 2 research is numbered §0 through §7, where §0 is the map and §1 through §6 match outline beats 2.1 through 2.6.
>
> Every source entry in research has the same shape: a bold line with author, title, venue, and date, a verification marker, the URL, then bullet quotes. Each research file ends with a `## Verify before stage` list and a `**Do not use:**` line.

Slides layer: "Slide files render the outline. They do not restate its reasoning and they never introduce a claim. A new claim goes into the research file and the outline first, then onto the slide."

### F.3 Markers (AGENTS.md, verbatim)

> Research files use two markers:
>
> - `[primary]` means the source was fetched and quoted directly.
> - `UNVERIFIED` means the claim came from a snippet or secondary coverage.
>
> The outline uses three:
>
> - `[verify]` flags a claim to confirm in a browser before it goes on a slide. It mirrors the research file's verify list and the "Verify in a browser" table at the end of the outline.
> - `[your story]` and `[you write]` mark slots only the presenter can fill. Leave them as slots.
> - Inside a "Say" bullet, **bold** marks a must-say line. Unbolded text is backup for questions.
>
> A claim graduates from `UNVERIFIED` to `[primary]` only after being checked in a browser, and only then may its `[verify]` flag come off in the outline.

Review caution (apply-essential-corrections §6): "The marker `[primary]` is sometimes qualified as primary only for a secondary report. Preserve that distinction in the claim record rather than treating the marker alone as sufficient verification." Examples: The Hacker News on ClawHub is `[primary]` for the report, not the audit; Stanford HAI is `[primary for the landing page]`; Huyen's repo is `[primary for the repo]`.

### F.4 Adding or changing a claim (AGENTS.md, verbatim)

> 1. Put the full quote, date, and URL in the matching research file with a marker.
> 2. Cite it in the outline in short form and point to the research section.
> 3. If it is `UNVERIFIED`, flag it `[verify]` in the outline and add it to both the research file's verify list and the outline's closing verify table.
> 4. Check the "Do not use on stage" list at the end of the outline before promoting any statistic. Several widely circulated figures are listed there as untraceable or misattributed.

### F.5 The two-named-tools invariant (AGENTS.md, verbatim)

> **Two named tools.** The coding agents named on stage are Codex CLI and Devin. Devin's CLI carries the command anchors; Devin Desktop, the IDE, appears on slide 8 for its model picker. No other tool is named as a "When you are the user" example. Other products appear only as incident evidence, such as EchoLeak in Microsoft 365 Copilot. Tool facts come from the vendors' own docs and are marked `[primary]` in research with the date they were checked.

Related: the outline's "Section 2 pattern" repeats "The two named products are Codex CLI and Devin." Slide 25: "The two CLIs named in Section 2 are not resources, they are the subject." GitHub Copilot's model deprecations are "Not used on stage since the September 14 revision; the talk names only Codex CLI and Devin CLI. Kept for Q&A." Fusion is "Not used on stage: too new for the room."

Note for the course: the two-tool invariant is a constraint on the talk, not on a course built from it. The course may use other tools as "when you are the user" examples, provided each tool fact follows the same rule the invariant sets for the talk: it comes from the vendor's own documentation, is marked as directly checked, and carries the date it was checked on. The talk's tool facts in this file were checked September 14, 2026.

### F.6 Other invariants and conventions (AGENTS.md)

- **Scope is fixed.** "The talk description in the README was published to attendees. Every outline version must cover every topic it names. Only the weighting changes."
- **Time and slide counts must reconcile.** "Presentation is 35:00 across 26 slides: Section 1 is 5:00 and 6 slides, Section 2 is 25:00 and 13 slides, Section 3 is 5:00 and 7 slides."
- **Every Section 2 area follows the same three beats** (When you are the user, what someone engineered, When you are the owner) "and names one pitfall. The six pitfalls are collected again on slide 23 in 3.3, so a pitfall change lands in two places."
- **Beat format is fixed.** "Time, slide, say, takeaway line, sources. It is a talk track, not a script."
- **Pitfall bands.** "Every 'When you are the owner' slide ends with a strip across the bottom: a solid block in the area color holding the word 'Pitfall,' then the sentence, whose text matches slide 23 word for word."
- **Takeaways are spoken, not shown.** "Titles on 'When you are the owner' slides state the responsibility instead."
- **Kickers.** "Every Section 2 area slide has a top-left label, area name then beat: 'Models · When you are the user,' 'Models · When you are the owner.'" Section 3: "The transition · " plus the beat name.
- **Cut order.** "Each talk track names what to cut first if the section runs long and what may never be cut."
- **Visual values** live in `style/design-brief.md`; slide files describe intent in words and defer to the brief.
- **Diagram.** Slide 7 uses renders of the landscape SVG; slide 19 the `-yours` variant; mini-maps are generated from it. Run `node internal/build-diagrams.mjs` if the base changes.
- **Deck rebuild.** `node internal/deck/build.mjs`; keep only the current deck in `output/`, older decks in `output/archive/`; never delete or overwrite archived decks.
- Context7 is disabled in the local Claude settings of that repository.

---

## G. Where files disagree, collected

Each item records both readings. None has been resolved here.

1. **Slide and state counts.** README and AGENTS.md: 26 narrative slides (6, 13, 7), 34 authored compositions, 64 physical PowerPoint slides, 19 internal clicks, 83 presentation states, 82 advances. Outline "Whole-talk checks": "26 narrative slides ... Eight animation support slides bring the PowerPoint total to 34." `internal/deck/corrections-2026-09-15.md`: 25 narrative slides (6, 13, 6), 33 physical slides, 81 rendered click states; "The six owner pitfalls match slide 22 word for word." The reviews: 25 slide specifications, 33 physical slides, 81 states. The corrections record and reviews predate slide 20; their Section 3 numbers run one lower than the current files. The presentation assessment's Section 3 table labels rows "20. What transfers" through "25. Close" while linking to files `21-what-transfers.md` through `26-close.md`.
2. **Commitment 2 wording.** Outline 1.4: "Traditional tests remain necessary but are no longer sufficient." Slide 4 (on-slide and spoken): "Traditional tests are necessary but no longer sufficient." README description: "why traditional software tests remain necessary but are no longer sufficient."
3. **Foundation sentence on slide 3.** Outline 1.3: "Software engineering is the foundation. The added responsibility is measuring and controlling model-dependent behavior." Slide 3: "Your software engineering skills are the foundation. The additional responsibility is measuring and controlling model-dependent behavior."
4. **Anthropic evals quote.** `research/section-1.md` §3: "The capabilities that make agents useful also make them harder to evaluate." `research/section-2.md` §5: "The capabilities that make agents useful also make them difficult to evaluate."
5. **Attribution of "anytime you find an agent makes a mistake..."** `research/section-2.md` §0 lists it under Osmani, "Agent Harness Engineering," April 19, 2026. `research/section-3.md` §2 lists it under Hashimoto, "My AI Adoption Journey," February 5, 2026.
6. **Karpathy context-engineering definition.** Present in the outline's 2.2 bridge as a spoken line. Absent from slide 10's talk track. Slide 11's sources cite "the Karpathy enumeration on slide 10."
7. **Domain checks on slide 17.** Outline and slide 17 talk track: "Refund limits, duplicate actions, account ownership, and ledger state." Slide 17 on-slide build 1: "Refund limits · Account ownership · Ledger state."
8. **Hashimoto arc wording.** Four paraphrases: slide 24 on-slide ("chat · an agent reproducing manual work · background agents · delegating what you trust · building verification tools · continuous operation"); slide 24 spoken fallback ("delegating what you are confident in"); outline 3.4 ("reproducing manual work with an agent"); research §4 of section-3 ("Chatbot, then reproducing manual work with an agent ... delegating tasks he is confident in").
9. **Resources book entry.** Outline: "forthcoming October 2026." Slide 25: "October 2026" with the note to say "October" only. Research: listed publication date October 31, 2026, ISBN 9798341660724; the O'Reilly URL path carries 9798341660717.
10. **OWASP agentic names on stage.** `research/section-2.md` §6 says "the six names spoken on stage match the announcement." No ASI names appear in slide 18 or 19 as written; the rehearsal review lists "the OWASP name list" among cuts.
11. **OpenAI practical guide status.** `research/section-1.md` §5: "Quotes are from secondary summaries; confirm against the PDF. UNVERIFIED wording." `research/section-3.md` §2 and §4: quotes given with page numbers "from the PDF; confirm page numbers." Slide 24: "Quoted from the PDF; page numbers unconfirmed. Backup only."
12. **Story #2 timing.** Outline 2.5: "Sixty seconds, inside this beat's time." Slide 16: 2:28 to 3:28 with a hold to 3:45. Corrections record: "from 2:28 to 3:28 in slide 16's talk track." Consistent in substance; recorded because the corrections record and the outline describe it differently.
13. **Slide 1 callback numbers.** Slide 1's layout note says the two code lines return "on slides 4, 17, and 22." In current numbering the works.any() callback is on slides 4 and 23, and the evals owner slide is 17.
14. **Husain time figure typography.** Research writes "60-80%"; the outline and slide 16 and 22 backup notes write "60–80%" with an en-dash. The AGENTS.md rule forbids em-dashes, not en-dashes.
15. **Beat 2.0 map reference.** The corrections review noted "The outline's map reference points to the original portrait PNG while the slide and builder use the landscape variant." Outline v2 as read now names the landscape SVG; the corrections record lists "landscape map reference copied" as done.
16. **Outline "Do not use" vs Q&A hiring figures.** The corrections review flagged that the outline's closing language "about growth percentages conflicts with the growth figures explicitly prepared for hiring Q&A." The current outline resolves this by naming the Dice 101% and 18% figures as "optional attributed Q&A context" while excluding 143% and salary bands. Both the review's concern and the current wording are recorded.

