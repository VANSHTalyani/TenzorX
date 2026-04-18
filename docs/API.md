# API Reference

Base URL (local): `http://localhost:8000`

Interactive Swagger UI: `http://localhost:8000/docs`

## Sessions

### `POST /sessions`
Create a new onboarding session.

```json
{
  "campaign": { "campaign_id": "DEMO-2026", "channel": "whatsapp" },
  "customer_msisdn": "+9198xxxxxxxx"
}
```

Response: `{ "session_id": "<uuid>" }`

### `POST /sessions/{id}/geo`
Attach geo-location and detect basic fraud signals.

```json
{ "latitude": 18.52, "longitude": 73.85, "accuracy_m": 25 }
```

### `POST /sessions/{id}/audio`
`multipart/form-data` with field `audio` containing a webm/wav/ogg blob.
Returns the transcript segments produced by Whisper.

### `POST /sessions/{id}/face`
`multipart/form-data` with field `frames` (one or more JPEG frames).
Returns age estimation + liveness result.

### `POST /sessions/{id}/consent`
```json
{
  "consent_type": "bureau_pull",
  "granted": true,
  "transcript_excerpt": "Yes I agree."
}
```

### `POST /sessions/{id}/finalize`
Runs LLM extraction → bureau fetch → risk → policy → offer generation.
Returns the full `DecisionResult` (outcome, risk band, offers, explanation).

### `GET /sessions/{id}`
Full session view.

### `GET /sessions/{id}/audit`
Full append-only audit log.

### `GET /sessions/{id}/transcript`
All transcript segments in order.

## Campaigns

### `POST /campaigns/links`
Generate a tokenized onboarding link to share via SMS / WhatsApp.

```json
{
  "campaign_id": "DEMO-2026",
  "channel": "whatsapp",
  "customer_msisdn": "+9198xxxxxxxx",
  "base_url": "https://loan.example.com"
}
```
