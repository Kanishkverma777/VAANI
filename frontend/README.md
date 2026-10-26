# VAANI Voice AI Platform — Frontend

Next.js 16 (App Router) single-page and server-rendered web application for the VAANI Conversational Voice AI Platform.

## Architecture

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI & Styling**: Vanilla CSS + Tailwind CSS v4, Lucide Icons, Canvas Audio-Reactive Orbs
- **Authentication**: Firebase Authentication (Google Popup & Email/Password) with backend JWT sync
- **Voice Interactivity**: Web Speech API (`SpeechRecognition`), ElevenLabs Conversational AI WebRTC Embed (`<elevenlabs-convai>`)

## Directory Layout

```
frontend/
├── app/                         # App Router pages and routes
│   ├── call/[id]/               # Public voice calling page
│   ├── dashboard/               # Main dashboard, agent list, knowledge base
│   │   ├── agents/              # Fleet management & Agent Builder (Manual / Speak prompt)
│   │   │   ├── [id]/            # Agent workspace & editor
│   │   │   └── [id]/playground/ # Live WebRTC testing playground & telephony dialer
│   │   ├── analytics/           # Analytics, latency metrics & logs
│   │   ├── knowledge/           # RAG document uploader & vector indexer
│   │   ├── settings/            # Workspace settings & API credentials
│   │   └── voices/              # ElevenLabs Voice library explorer
│   ├── login/                   # Firebase Google & Email sign-in
│   └── signup/                  # Firebase registration
├── components/                  # Modular React components
│   ├── agents/                  # Prompt builders, agent cards, voice prompt creators
│   ├── dashboard/               # Metrics, fleet summary, activity feed
│   ├── layout/                  # Header and navigation sidebar
│   └── ui/                      # Audio-reactive orbs, buttons, modal dialogs
├── hooks/                       # Reusable React hooks (useAgents, useVoices)
├── lib/                         # API client, Firebase service, language configs
├── public/                      # Static assets & brand icons
├── types/                       # TypeScript interfaces
├── .env.local                   # Local frontend environment config
└── package.json                 # Scripts and dependencies
```

## Running the Frontend

```bash
cd frontend
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).
