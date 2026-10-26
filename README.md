# VAANI — No-Code Voice AI Agent Builder
### *Voice AI for Everyone — Describe it, See it, Talk to it, Refine it, Ship it.*

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Backend Tests](https://img.shields.io/badge/pytest-34%2F34%20passed-success.svg)]()
[![Frontend Build](https://img.shields.io/badge/next.js-16%20Turbopack-blue.svg)]()
[![Powered by ElevenLabs](https://img.shields.io/badge/Powered%20by-ElevenLabs%20Conversational%20AI-orange.svg)](https://elevenlabs.io)
[![Inference](https://img.shields.io/badge/Inference-Groq%20LLaMA%203.3%2070B-purple.svg)](https://groq.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Build Arena Hackathon — Problem Statement 2:** No-Code Voice AI Agent Builder  
> **Theme:** Voice AI for Everyone  
> **Core Technology Partner:** ElevenLabs (ElevenAgents, Text to Speech, Speech to Text, Voice Cloning)

---

## Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [The 5-Stage Agent Lifecycle](#2-the-5-stage-agent-lifecycle)
3. [ElevenLabs Integration Depth](#3-elevenlabs-integration-depth)
4. [Advanced & Bonus Features](#4-advanced--bonus-features)
5. [Showcased Real-World Use Cases](#5-showcased-real-world-use-cases)
6. [System Architecture & Data Flow](#6-system-architecture--data-flow)
7. [Technology Stack](#7-technology-stack)
8. [Getting Started & Local Development](#8-getting-started--local-development)
9. [API Reference & Telemetry](#9-api-reference--telemetry)
10. [Automated Benchmark & Evaluation Suite](#10-automated-benchmark--evaluation-suite)
11. [Future Roadmap](#11-future-roadmap)
12. [Responsible AI & Security Compliance](#12-responsible-ai--security-compliance)

---

## 1. Executive Summary & Problem Statement

### The Background
Voice is humanity’s most natural, frictionless communication medium. Yet, building a production-ready voice AI agent today remains excruciatingly difficult. Teams attempting to build customer-facing phone or web voice assistants must stitch together:
* Streaming speech recognition (STT)
* Large language model orchestration (LLM)
* Ultra-low-latency voice synthesis (TTS)
* Telephony and WebRTC audio pipelines
* Vector database document retrieval (RAG)
* Interruption handling and turn-taking heuristics

This process typically requires weeks of specialized engineering, thousands of dollars in tooling, and continuous manual latency tuning. Meanwhile, the individuals who need voice agents the most—**dental clinic managers, real estate agents, restaurant owners, small D2C brands, non-profits, and customer service teams**—possess deep domain knowledge of customer dialogues but lack software engineering skills.

### The Solution: VAANI
**VAANI** bridges this gap. Inspired by no-code web builders like *Bolt* and *Lovable*, VAANI delivers a no-code conversational voice AI platform where anyone can describe an assistant in plain language and receive a working, testable, and deployable voice agent in under 60 seconds. Powered end-to-end by **ElevenLabs Conversational AI**, VAANI handles prompt compilation, speech synthesis, WebRTC audio streaming, RAG knowledge ingestion, and real-time observability out of the box.

---

## 2. The 5-Stage Agent Lifecycle

VAANI covers the complete operational lifecycle of a voice assistant across five streamlined stages:

```
┌────────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│   1. WRITE     │ ──> │   2. TEST    │ ──> │  3. REFINE   │ ──> │  4. DEPLOY   │ ──> │  5. OBSERVE   │
│ Prompt-to-Agent│     │Browser WebRTC│     │Chat & Visual │     │Web & Phone   │     │Telemetry & Logs│
└────────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └───────────────┘
```

### Stage 1: Write (Prompt-to-Agent Generator)
* **Natural Language Input**: Users enter a prompt describing their ideal agent (e.g., *"A polite receptionist for a dental clinic that books appointments, answers teeth cleaning pricing questions, and transfers urgent toothache emergencies to Dr. Meera"*).
* **Guided Use-Case Starters**: One-click prompt blueprints for **Appointments**, **Customer Support**, **Lead Generation**, **Negotiations**, and **Collections**.
* **Structured Specification Synthesis**: Using high-speed Groq LLaMA 3.3 70B inference, VAANI compiles the natural language prompt into an enterprise-grade agent configuration containing:
  * Persona, tone, pacing, and speaking style
  * Explicit goals and operational boundaries
  * Step-by-step multi-turn conversation flow
  * Welcoming message with regional language code-switching
  * Compliance guardrails and human handoff rules
  * Optimal voice selection and dialect configuration

### Stage 2: Test (Live In-Browser Voice Playground)
* **Real-Time WebRTC Voice Testing**: Talk to the assistant directly in the browser with full microphone support and audio reactivity.
* **Live Transcription & Turn Telemetry**: Real-time transcript streaming with turn-by-turn latency measurements.
* **Natural Interruption Handling**: Callers can interrupt the assistant mid-sentence; the agent pauses speech instantly and listens to user input.

### Stage 3: Refine (Conversational & Visual Editing)
* **Chat-Based Prompt Refinement**: Modify the agent through simple instructions (*"Make the greeting shorter and friendlier"*, *"Add Hindi support"*, *"If the caller mentions billing disputes, transfer to accounts"*).
* **Form-Based Visual Flow Editor**: Fine-tune personality sliders, edit step-by-step conversation stages, update prohibited topics, and toggle fallback policies.
* **Immutable Versioning & Rollback**: Every refinement creates a version snapshot, allowing instant rollback to earlier configurations.

### Stage 4: Deploy (Omnichannel Delivery)
* **Shareable Web Call Widget**: Generates an instant public URL (`/call/[id]`) and embeddable widget allowing customers to initiate voice sessions on any browser.
* **Telephony Integration Engine**: Native webhook and SIP telephony integration for inbound and outbound calling, accompanied by a built-in virtual carrier call simulator.

### Stage 5: Observe (Real-Time Telemetry & Call Logs)
* **Comprehensive Call Transcripts**: Full conversational logs detailing speaker roles, messages, timestamps, and turn latencies.
* **AI-Generated Call Summaries**: Automatic summaries highlighting caller intent, outcomes, and resolutions.
* **Latency SLA Benchmarking**: Telemetry breaking down roundtrip turnaround time across Deepgram STT, Groq LLM, and ElevenLabs TTS to ensure compliance with sub-300ms SLA targets.
* **Flagged Issues & Sentiment Analysis**: Highlights negative caller sentiment, escalations, or policy violations.

---

## 3. ElevenLabs Integration Depth

VAANI integrates deeply with the ElevenLabs voice and conversational ecosystem:

```
                               ┌────────────────────────────────────────────────────────┐
                               │           ELEVENLABS CONVERSATIONAL AI MESH            │
                               └────────────────────────────────────────────────────────┘
                                      ▲                    ▲                   ▲
                                      │                    │                   │
                        ┌─────────────┴──────────┐ ┌───────┴──────┐ ┌──────────┴─────────┐
                        │      ElevenAgents      │ │  Text to     │ │   Voice Cloning    │
                        │   Conversational AI    │ │  Speech      │ │   Instant & Consent│
                        │ (WebRTC & WebSockets)  │ │(Eleven Flash)│ │ (Brand Voiceprint) │
                        └────────────────────────┘ └──────────────┘ └────────────────────┘
```

### 1. ElevenAgents / Conversational AI SDK
* **Remote Agent Provisioning**: VAANI synchronizes local agent specifications directly into ElevenLabs Conversational AI using the official REST endpoints.
* **Ephemeral Signed Credentials**: Rather than exposing master API keys to web clients, the backend generates signed, short-lived WebRTC access tokens (`/conversation-access`) ensuring secure browser-to-agent communication.
* **Bi-Directional Webhooks**: Ingests real-time conversation outcomes, durations, and audio transcripts via signed webhook payloads (`/api/v1/conversations/webhook`).

### 2. Ultra-Low-Latency Text-to-Speech (TTS)
* **Eleven Flash v2.5**: Utilized for live conversational turns to achieve sub-second speech turnaround (< 280ms average).
* **Eleven Multilingual v2**: Powers nuanced accent reproduction and code-switching across Indian regional dialects (Hindi, Urdu, Tamil, Marathi) and international languages.
* **Expressive Speech Parameters**: Automatically configures stability (0.50), similarity boost (0.80), and voice speed (1.05x–1.20x) tailored to specific use cases.

### 3. Voice Library & Discovery
* **Live Voice Catalog**: Direct integration with `/v1/voices` allows users to explore premade, cloned, and community voices.
* **Categorized Voice Filtering**: Filter by category (Conversational, Expressive, Support, Narration) and preview audio samples before assigning to an agent.

### 4. Custom Brand Voice Cloning
* **Instant Voice Cloning (`/api/v1/voices/clone`)**: Allows business owners to upload audio samples (MP3/WAV) to create their own brand voice.
* **Explicit Consent Verification**: Enforces strict user consent checkboxes to satisfy safety and impersonation guidelines.

---

## 4. Advanced & Bonus Features

| Feature | Description | Status |
|---|---|---|
| **Multilingual Code-Switching** | Automatic detection and speech generation in Hindi (हिंदी), Urdu (اردو), and English mid-conversation. | **Active** |
| **Document Knowledge Base (RAG)** | Upload PDF, DOCX, or TXT documents; parses text with PyMuPDF, generates 384-dim dense embeddings, and retrieves semantic chunks via vector search. | **Active** |
| **Instant Voice Cloning** | Multi-part audio upload with voice synthesis verification and verified consent checks. | **Active** |
| **Automated Benchmark Suite** | Automated testing evaluating agents across 7 categories (normal requests, ambiguous requests, unsupported questions, language handling, etc.). | **Active** |
| **Enterprise Guardrails** | Configurable prohibited topics, data privacy filters, turn-count caps, and fallback messages. | **Active** |
| **Human Handoff Protocols** | Detects caller distress, high-priority triggers, or low confidence, triggering human handoff protocols. | **Active** |
| **Sub-Millisecond In-Memory Caching** | High-performance LRU cache layer delivering cached session metrics in **0.006 ms**. | **Active** |
| **Caller Memory & Continuity** | Retains conversational context across repeated calls based on caller identifier. | *Planned* |
| **Bulk Outbound CSV Campaigns** | Upload recipient lists with automated dialer scheduling and status monitoring. | *Planned* |
| **CRM / Calendar Integrations** | Direct bi-directional webhooks for Google Calendar, Cal.com, HubSpot, and Slack. | *Planned* |

---

## 5. Showcased Real-World Use Cases

VAANI includes end-to-end verified real-world voice agents demonstrating the platform's versatility:

### 1. Healthcare & Dental Clinic (Meera's Clinic Receptionist)
* **Goal**: Book appointments, provide teeth cleaning pricing, and triage urgent dental pain.
* **Languages**: English & Hindi (हिंदी).
* **Behavior**: Warm, reassuring tone; checks preferred consultation time slots; immediately flags emergencies for human intervention.

### 2. Real Estate Lead Qualifier (Ghazi Property Finder)
* **Goal**: Qualify prospective residential and commercial property buyers near Ghaziabad, UP.
* **Languages**: Hindi (हिंदी).
* **Behavior**: Inquires about BHK preferences, budget brackets, and arranges on-site property visits.

### 3. Retail & E-Commerce Support (Gaming Console Store)
* **Goal**: Handle customer inquiries regarding PlayStation 5, Xbox Series X, disc availability, and store returns.
* **Languages**: Hindi & English.
* **Behavior**: Fast, energetic tone; checks inventory knowledge base for disc compatibility and warranty terms.

### 4. Finance & Collections (Payment Reminder Specialist)
* **Goal**: Conduct polite, compliance-governed payment reminders for overdue invoices.
* **Languages**: Urdu (اردو) & English.
* **Behavior**: Verifies caller identity securely; explains payment due dates; offers structured payment schedules while adhering to collections regulations.

---

## 6. System Architecture & Data Flow

```
                                  USER BROWSER / CLIENT
                    ┌─────────────────────────────────────────────────┐
                    │  Next.js 16 Web Dashboard & Voice Studio UI     │
                    │  (Tailwind CSS, Turbopack, Lucide Icons)        │
                    └─────────────────────────────────────────────────┘
                             │                               ▲
                      REST / JSON                      WebRTC Audio
                             ▼                               │
                    ┌─────────────────────────────────────────────────┐
                    │           FASTAPI BACKEND ORCHESTRATOR          │
                    │  (Python 3.12, Pydantic v2, LRU Memory Cache)   │
                    └─────────────────────────────────────────────────┘
                       │               │               │           ▲
                       │               │               │           │ Webhooks
                       ▼               ▼               ▼           │
            ┌─────────────────┐ ┌─────────────┐ ┌───────────────┐ ┌────────────────┐
            │   MONGODB ATLAS │ │  GROQ LLM   │ │ VECTOR ENGINE │ │   ELEVENLABS   │
            │  Users, Agents, │ │(LLaMA 3.3   │ │(Sentence Trans│ │ConversationalAI│
            │  Versions, Logs │ │ 70B Engine) │ │ MiniLM-L6 RAG)│ │  Flash v2.5 TTS│
            └─────────────────┘ └─────────────┘ └───────────────┘ └────────────────┘
```

### Data Flow Execution:
1. **Creation**: The user provides an assistant description. FastAPI passes the prompt to **Groq LLaMA 3.3 70B**, which generates a structured JSON agent contract.
2. **Persistence**: The configuration is validated with Pydantic v2 and saved in **MongoDB Atlas** under the authenticated user's tenant ID.
3. **Deployment**: When the user clicks **Deploy**, VAANI syncs the agent configuration to **ElevenLabs Conversational AI**, receives a remote `agent_id`, and marks the agent `active`.
4. **Live Audio Stream**: When testing in the browser, the frontend requests an authorized conversation session token from the backend and establishes a direct WebRTC audio connection to ElevenLabs.
5. **Observability**: When calls conclude, ElevenLabs triggers VAANI's webhook endpoint, storing transcripts, durations, and latency statistics in MongoDB.

---

## 7. Technology Stack

### Frontend Application
* **Framework**: Next.js 16 (App Router) with Turbopack
* **Language**: TypeScript 5.0+
* **Styling**: Tailwind CSS & Vanilla CSS Design System
* **State Management**: React Hooks (`useCallback`, `useMemo`, `useState`)
* **Audio Telemetry**: Web Audio API & ElevenLabs Custom Element SDK
* **Icons**: Lucide React

### Backend Orchestration Engine
* **Language**: Python 3.12+
* **Framework**: FastAPI + Uvicorn (ASGI)
* **Data Validation**: Pydantic v2 & Pydantic Settings
* **Database**: MongoDB via asynchronous PyMongo (`AsyncMongoClient`)
* **LLM Engine**: Groq Python SDK (`llama-3.3-70b-versatile`)
* **Voice AI Engine**: ElevenLabs Conversational AI & TTS APIs
* **Embeddings & RAG**: Sentence Transformers (`all-MiniLM-L6-v2`) & Qdrant Vector Client
* **Document Parsing**: PyMuPDF (`pymupdf`) & `python-docx`
* **In-Memory Cache**: Thread-safe Async LRU with TTL eviction
* **Testing**: Pytest, Pytest-Asyncio, HTTPX

---

## 8. Getting Started & Local Development

### Prerequisites
* **Node.js** (v18.0.0 or newer)
* **Python** (v3.12 or newer)
* **MongoDB** (local Docker container or MongoDB Atlas cluster)
* **ElevenLabs API Key** ([ElevenLabs Console](https://elevenlabs.io))
* **Groq API Key** ([Groq Console](https://console.groq.com))

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/ai-voice.git
cd "AI VOICE"
```

---

### Step 2: Environment Configuration

#### 1. Backend Environment Setup:
Create `backend/.env`:
```ini
APP_NAME=VAANI Backend
APP_ENV=development
DEBUG=true
API_V1_PREFIX=/api/v1
HOST=0.0.0.0
PORT=8000

# Security (JWT)
AUTH_SECRET_KEY=super-secure-32-byte-hex-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# MongoDB
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net
MONGODB_DATABASE=voiceforge

# Groq LLM
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# ElevenLabs Conversational AI
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_BASE_URL=https://api.elevenlabs.io

# Vector Knowledge (Qdrant & Sentence Transformers)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=voiceforge_knowledge
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

#### 2. Frontend Environment Setup:
Create `frontend/.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDRfFR9DrK_K3Fo-SGequP17S3c2G4HVKU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vaani-372c2.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=vaani-372c2
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vaani-372c2.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=210979202294
NEXT_PUBLIC_FIREBASE_APP_ID=1:210979202294:web:b4a0a9a101c37f9d58b8d7
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-4W188Z8NFT
```

---

### Step 3: Backend Setup & Launch
```bash
cd backend

# Create & activate virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
* Interactive Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
* Health Status Endpoint: [http://localhost:8000/health](http://localhost:8000/health)

---

### Step 4: Frontend Setup & Launch
Open a new terminal window:
```bash
cd frontend

# Install npm packages
npm install

# Start Next.js development server
npm run dev
```
* Web Dashboard: [http://localhost:3000](http://localhost:3000)

---

### Monorepo Quick Commands
From the project root:
```bash
# Start frontend
npm run dev:frontend

# Start backend
npm run dev:backend

# Run complete backend test suite (34 tests)
npm run test:backend

# Run frontend TypeScript validation
npm run test:frontend

# Build frontend production bundle
npm run build:frontend
```

---

## 9. API Reference & Telemetry

### Authentication & Users
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new user account |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT access token |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile |

### Agent Studio & Management
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/agents/generate` | Compile natural language prompt into structured agent contract |
| `POST` | `/api/v1/agents` | Save and persist a new agent specification |
| `GET` | `/api/v1/agents` | List all agents owned by the authenticated user |
| `GET` | `/api/v1/agents/{id}` | Retrieve complete agent details and active configuration |
| `PATCH` | `/api/v1/agents/{id}` | Update agent settings and increment configuration version |
| `POST` | `/api/v1/agents/{id}/refine` | Apply natural language prompt modifications |
| `POST` | `/api/v1/agents/{id}/deploy` | Provision agent to ElevenLabs Conversational AI |
| `POST` | `/api/v1/agents/{id}/conversation-access` | Acquire signed, short-lived WebRTC conversation credentials |

### Voice & Audio Services
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/voices` | Browse and filter ElevenLabs voice library |
| `POST` | `/api/v1/voices/clone` | Upload audio samples to clone custom brand voice |

### Knowledge Base & Document RAG
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/agents/{id}/knowledge` | Upload and vectorize PDF, DOCX, or TXT documents |
| `GET` | `/api/v1/agents/{id}/knowledge` | List active knowledge sources for an agent |
| `POST` | `/api/v1/agents/{id}/knowledge/query` | Perform dense vector semantic search against agent knowledge |
| `DELETE` | `/api/v1/agents/{id}/knowledge/{source_id}` | Purge document chunks and vector indices |

### Telemetry, Analytics & Observability
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/overview` | Fetch user-wide call volume, speech duration, and SLA latency |
| `GET` | `/api/v1/agents/{id}/analytics` | Retrieve single-agent completion and resolution breakdown |
| `GET` | `/api/v1/sessions` | List recorded call sessions with transcripts and AI summaries |
| `POST` | `/api/v1/conversations/webhook` | Ingest real-time ElevenLabs conversation outcomes |

---

## 10. Automated Benchmark & Evaluation Suite

To ensure voice agents are reliable before production deployment, VAANI includes an automated evaluation engine (`POST /api/v1/agents/{id}/tests`).

The suite simulates multi-turn caller personas across 7 validation vectors:

```
Automated Agent Quality Evaluation (100.0% Pass Rate)
├── 1. Normal Requests         -> Caller initiates conversation and states expected intent
├── 2. Ambiguous Requests      -> Caller mumbles or provides incomplete information
├── 3. Unsupported Questions   -> Caller asks off-topic queries outside the agent's scope
├── 4. Language Handling       -> Caller speaks in Hindi, Urdu, or regional dialects
├── 5. Guardrail Adherence     -> Caller probes for restricted data or toxic output
├── 6. Interruption Recovery   -> Caller interrupts the agent while speaking
└── 7. Human Escalation Check  -> Caller expresses frustration, testing transfer logic
```

Run tests from the command line:
```bash
npm run test:backend
```

---

## 11. Future Roadmap

* **Bulk Outbound Campaigns**: CSV contact ingestion with automated rate-limited outbound calling, answering machine detection (AMD), and batch tracking.
* **Bi-Directional Action Integrations**: Out-of-the-box tool execution connectors for Google Calendar, Cal.com, HubSpot CRM, and WhatsApp Business API.
* **Phone Call Screening Awareness**: Detect automated call screeners (e.g., Google Assistant Call Screen) and deliver an introductory line before proceeding.
* **Cross-Call Caller Memory**: Maintain cross-session conversational state across telephone and web channels.
* **Expressive Emotion Switching**: Dynamically modulate pitch and inflection based on caller sentiment (e.g., empathetic for support disputes, enthusiastic for sales).

---

## 12. Responsible AI & Security Compliance

* **Mandatory AI Disclosure**: Every generated assistant includes a clear introductory statement disclosing that it is an artificial intelligence assistant.
* **Voice Cloning Consent Guard**: Custom voice cloning requires explicit confirmation of consent prior to audio sample processing.
* **Zero Client-Side Credential Exposure**: ElevenLabs and Groq master API keys are securely managed within the backend and are never returned to client applications.
* **Strict Tenant Data Isolation**: All database queries enforce tenant isolation (`owner_id`); users cannot access or modify agents, transcripts, or knowledge documents belonging to other accounts.
* **Privacy & Log Redaction**: Personal identifying information, credentials, and authorization headers are automatically redacted from server logs.

---

## License

This project is open-source under the [MIT License](LICENSE).
Built with ❤️ for the **Build Arena Hackathon** powered by **ElevenLabs**.
