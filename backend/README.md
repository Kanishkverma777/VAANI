# VAANI Voice AI Platform — Backend

Production FastAPI backend service for the VAANI Conversational Voice AI Platform.

## Architecture

- **Framework**: FastAPI (Python 3.12, Uvicorn)
- **Database**: MongoDB (Atlas) via PyMongo
- **LLM Engine**: Groq Cloud API (`openai/gpt-oss-120b`)
- **Voice Synthesis & ConvAI**: ElevenLabs Conversational AI (`eleven_turbo_v2_5`, `eleven_v4_turbo`)
- **Vector Knowledge Base**: Qdrant Cloud / Local Vector DB with Sentence Transformers (`all-MiniLM-L6-v2`)
- **Authentication**: JWT Bearer Tokens & Firebase Authentication integration

## Directory Layout

```
backend/
├── app/
│   ├── api/
│   │   ├── dependencies.py      # Auth and service dependencies
│   │   └── routes/              # FastAPI APIRouters (agents, auth, voice, etc.)
│   ├── core/                    # Security, logging, exceptions
│   ├── database.py              # MongoDB connection & indexing
│   ├── integrations/            # ElevenLabs, Groq, Twilio, Qdrant
│   ├── main.py                  # FastAPI application entrypoint
│   ├── models/                  # Database entity representations
│   ├── repositories/            # Data access layers
│   ├── schemas/                 # Pydantic v2 schemas
│   ├── services/                # Business logic services
│   └── config.py                # Environment configuration
├── scripts/                     # Seeders and migration utilities
├── static/                      # Static assets & public embeds
├── tests/                       # Pytest test suite
├── pyproject.toml               # Python build config & dependencies
├── requirements.txt             # Pip requirements
└── .env                         # Environment variables
```

## Running the Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Running Tests

```bash
cd backend
.venv/bin/pytest -v
```
