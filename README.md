# Poonawalla Loan Wizard

End-to-end **video-based digital loan origination, KYC, risk assessment, and
offer generation** built on a 100% free, self-hostable stack.

Implements the full flow from the problem statement:

```
Campaign → Customer clicks link → Video call (audio + video + geo)
        → STT (Whisper) + Age estimation (DeepFace) + Liveness (MediaPipe)
        → Auto-fill via local LLM (Ollama / Qwen 2.5)
        → Bureau data + Policy rules + Risk + Propensity (XGBoost)
        → Personalized loan offers
        → Central audit repository (Postgres)
```

## Tech stack (all free / open source)

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | FastAPI (async Python) |
| STT | faster-whisper (CTranslate2) |
| LLM | Ollama + **Qwen 2.5 7B Instruct** |
| Vision | MediaPipe FaceMesh + DeepFace |
| Risk ML | XGBoost (rules + ML hybrid) |
| Persistence | PostgreSQL 16 + SQLAlchemy 2 (async) |
| Object storage | MinIO (S3-compatible) |
| Orchestration | Docker Compose |

## Quick start

```bash
docker compose up --build
docker compose exec ollama ollama pull qwen2.5:7b-instruct  # one-time
```

Open <http://localhost:3000>.

(Optional ML model: `docker compose exec backend python scripts/train_risk_model.py`.)

Full guide → [docs/RUNNING.md](docs/RUNNING.md).

## Highlights

- **Strict SOLID**: every external dependency is hidden behind an interface
  (`app/services/interfaces.py`), wired in one composition root
  (`app/api/dependencies.py`). Swap Whisper for a cloud STT, or Ollama for
  OpenAI, by adding one class and changing one wiring line.
- **Append-only audit log** of every event in the flow — satisfies the
  "central repository for all internal/external logs" requirement.
- **Deterministic policy engine** (`Open/Closed`) — rules are pluggable;
  policy is never overridden by the LLM.
- **LLM is advisory only** — it normalises unstructured speech into a
  validated Pydantic schema; deterministic risk + policy still gate the
  decision.
- **Fully async** I/O; CPU-bound work runs in a thread pool so the event loop
  stays responsive.

## Repository layout

```
backend/
  app/
    api/             # HTTP routers + composition root
    core/            # config, logging, exceptions
    db/              # async session, init
    models/          # SQLAlchemy ORM
    schemas/         # Pydantic domain types + enums
    services/
      interfaces.py  # ALL service contracts (DIP)
      stt/           # FasterWhisperSTT
      vision/        # DeepFaceAgeEstimator, MediaPipeLivenessChecker
      llm/           # OllamaLLMClient + prompts
      risk/          # PolicyEngine, HybridRiskScorer, SyntheticBureauProvider
      offer/         # RuleBasedOfferGenerator
      video/         # HeuristicGeoValidator
      storage/       # MinioObjectStorage
      audit/         # SqlAuditRepository
      session_orchestrator.py  # the use-case coordinator
  scripts/
    train_risk_model.py
  data/models/                # XGBoost artifacts (generated)

frontend/
  src/app/
    page.tsx                  # landing
    onboard/                  # customer video onboarding flow
    operator/                 # operator/audit console

docker-compose.yml
docs/
  ARCHITECTURE.md
  API.md
  RUNNING.md
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — design, SOLID mapping, data flow
- [API reference](docs/API.md)
- [Running locally](docs/RUNNING.md)

## License

MIT.
