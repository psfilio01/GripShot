# Checklist Before Claude Code Starts

## Anthropic and Claude Code
- [ ] Claude Code is installed and authenticated
- [ ] project is opened at repository root
- [ ] Anthropic Console workspace spend limit is set to 100 USD for the Claude Code workspace
- [ ] you know whether the repo primary branch is `main` or something else

## Local machine
- [ ] Node.js LTS installed
- [ ] pnpm installed
- [ ] Docker installed and running
- [ ] Playwright browsers installed

## Google stack
- [ ] Google Cloud project created
- [ ] Cloud Run API enabled
- [ ] Firebase project attached or created
- [ ] Firebase Authentication enabled with email and Google sign in
- [ ] Cloud Storage bucket available
- [ ] Firestore enabled

## Stripe
- [ ] Stripe account ready
- [ ] products and prices planned or created
- [ ] webhook endpoint strategy decided

## Repo readiness
- [ ] current repository is committed before large automated changes begin
- [ ] `.env.example` exists or is created before sensitive work starts
- [ ] existing `workflow-core` package builds and tests locally
- [ ] README and docs folders are present in version control

## Recommended first Claude Code session setup
- [ ] run `/init` and compare with the provided `CLAUDE.md`
- [ ] add the provided `CLAUDE.md` to repo root
- [ ] optionally add the provided subagents under `.claude/agents/`
- [ ] start with the bootstrap prompt from `prompts/claude-code-bootstrap.md`
