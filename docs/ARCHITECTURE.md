# Architecture

## Layered Design (SOLID)

```
┌──────────────────────────────────────────────┐
│ API layer (FastAPI routers)                  │  thin HTTP/WebSocket adapters
├──────────────────────────────────────────────┤
│ Application layer (SessionOrchestrator)      │  use-case coordination
├──────────────────────────────────────────────┤
│ Domain layer (schemas, enums, interfaces)    │  pure business types + contracts
├──────────────────────────────────────────────┤
│ Infrastructure (concrete services)           │  Whisper, Ollama, DeepFace, …
│ Persistence (SQLAlchemy models)              │  Postgres
└──────────────────────────────────────────────┘
```

### SOLID compliance

| Principle | Where it lives |
|---|---|
| **S**ingle Responsibility | Each service file does one job. ORM models hold no business logic. |
| **O**pen/Closed | `PolicyEngine` accepts `IPolicyRule`s — new rules added without editing the engine. |
| **L**iskov Substitution | Any `ISpeechToText` / `ILLMClient` impl works with the orchestrator. |
| **I**nterface Segregation | Five small interfaces (`ISpeechToText`, `IAgeEstimator`, …) instead of one god-interface. |
| **D**ependency Inversion | `SessionOrchestrator` depends only on abstractions; concrete classes wired in `api/dependencies.py`. |

## End-to-end flow (matches the diagram)

```
Campaign  ─►  Customer clicks link  ─►  Browser captures video + audio + geo
                                                        │
                                                        ▼
                                  ┌───────────────────────────────────────────┐
                                  │  Backend: SessionOrchestrator              │
                                  │                                            │
                                  │  STT (Whisper)  ─┐                         │
                                  │  Vision (Age)   ─┤                         │
                                  │  Geo validate   ─┤                         │
                                  │  LLM extract    ─┼─► AutoFill profile      │
                                  │  Bureau fetch   ─┤                         │
                                  │  Risk + Policy  ─┤                         │
                                  │  Offer generate ─┘                         │
                                  └───────────────────────────────────────────┘
                                                        │
                                                        ▼
                       Central audit repository (Postgres `audit_events`)
```

## Data model

- `loan_sessions` — one row per onboarding session.
- `transcripts` — append-only STT segments.
- `consents` — explicit verbal/UI consents with timestamps.
- `offers` — generated personalized offers.
- `audit_events` — JSON-payloaded log of every event in the flow.

All tables are per-session-keyed; deleting a session cascades to its records.

## Why local LLM?

For data residency and zero ongoing cost, we use Ollama with **Qwen 2.5 7B
Instruct**. It produces strict JSON reliably (the model is finetuned for tool
use) and runs on a CPU + 16 GB RAM laptop. Swap in any OpenAI-compatible model
by writing a new `ILLMClient` and updating `dependencies.py`.

## Scalability notes

- All I/O is async (FastAPI + asyncpg + asyncio).
- The orchestrator is **stateless** — horizontally scale behind a load balancer.
- Heavy CPU work (Whisper, DeepFace) runs in `asyncio.to_thread` so the event loop stays responsive.
- For high concurrency, run Whisper / DeepFace as separate microservices and replace the in-process implementations with HTTP clients implementing the same interfaces.
