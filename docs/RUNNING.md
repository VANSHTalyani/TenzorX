# Running the Loan Wizard locally

## Prerequisites

- Docker + Docker Compose
- ~12 GB free RAM (Whisper + Ollama + Postgres + frontend)
- Modern browser (Chrome / Edge / Firefox) for camera + WebRTC

## One-command boot

```bash
docker compose up --build
```

First boot will:

1. Pull / build images for Postgres, MinIO, Ollama, backend and frontend.
2. Start everything; the backend will create database tables automatically.
3. The frontend becomes available at <http://localhost:3000>.
4. The backend API is at <http://localhost:8000> (Swagger UI at `/docs`).

## Pulling the local LLM

The `ollama` container starts empty. From a second terminal, pull the model:

```bash
docker compose exec ollama ollama pull qwen2.5:7b-instruct
```

(One-time, ~4–5 GB download.)

## Optional: train the risk model

The risk scorer works with rules-only out of the box. To enable the XGBoost
propensity layer:

```bash
docker compose exec backend python scripts/train_risk_model.py
```

This produces `data/models/risk_xgb.json` and `risk_features.json` — the
scorer auto-loads them on the next request.

## Smoke test

Open <http://localhost:3000>, click **Start onboarding**, allow camera/mic,
talk for 30–60 s, then click **Finish & get offers**.

The operator console at <http://localhost:3000/operator> lets you paste the
session UUID (returned in browser dev tools) to inspect transcript, audit log
and decision.

## Service URLs

| Service | URL | Default creds |
|---|---|---|
| Frontend | http://localhost:3000 | — |
| Backend API + Swagger | http://localhost:8000/docs | — |
| MinIO console | http://localhost:9001 | minioadmin / minioadmin |
| Postgres | localhost:5432 | loan / loan / loanwizard |
| Ollama | http://localhost:11434 | — |

## Hardware tips

- For faster STT, set `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE_TYPE=float16` if you have an NVIDIA GPU.
- Use `WHISPER_MODEL_SIZE=tiny` for very low-end machines (lower accuracy).
- For Ollama on GPU, use the `ollama/ollama:latest` image with `--gpus all` (Docker Compose: `deploy.resources.reservations.devices`).
