# Social Media AI Agent — MySentry.AI

A multi-user, AI-powered SaaS platform for social media management. Uses specialized AI agents to build customer profiles, identify pain points, generate strategic content calendars, and create AI visuals — all from a single dashboard.

## Project Structure

```
project-root/
├── .env                          # Environment variables (all API keys)
├── .gitignore                    # Git ignore rules
├── CLAUDE.md / AGENTS.md / GEMINI.md  # AI agent instructions (mirrored)
├── README.md                     # This file
├── PROJECT_DOCUMENTATION.txt     # Detailed technical documentation
│
├── backend/                      # Express API server
│   ├── index.js                  # Entry point & route registration
│   ├── package.json
│   ├── controllers/
│   │   ├── agentController.js    # Agent execution, config cache, user overrides
│   │   ├── adminController.js    # Admin panel CRUD & playground
│   │   ├── chatController.js     # Orchestrator chat with tool calling
│   │   ├── companyController.js  # Multi-company CRUD
│   │   ├── contentController.js  # Image generation (Gemini/Imagen)
│   │   └── fileController.js     # File uploads to Supabase Storage
│   ├── middleware/
│   │   └── adminAuth.js          # Admin role verification
│   └── services/
│       ├── unifiedAIService.js   # Provider routing (OpenAI/Gemini + fallback)
│       ├── aiService.js          # OpenAI SDK integration
│       ├── geminiService.js      # Google Gemini/Imagen integration
│       └── researchService.js    # Serper web search
│
├── frontend/                     # React/Vite SPA
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── public/
│   │   └── google.png            # Google OAuth button asset
│   └── src/
│       ├── main.jsx              # React entry point
│       ├── App.jsx               # Root component (AuthProvider)
│       ├── App.css / index.css   # Global styles
│       ├── config.js             # Frontend configuration
│       ├── context/
│       │   └── AuthContext.jsx    # Auth state + company management
│       ├── services/
│       │   ├── api.js            # API client (auth, agents, companies, files)
│       │   ├── adminApi.js       # Admin panel API client
│       │   └── supabase.js       # Supabase client init
│       ├── pages/
│       │   ├── Dashboard.jsx     # Main page (view router)
│       │   └── Dashboard.css
│       └── components/
│           ├── AdminPanel.jsx/css    # Admin: agent configs, API keys, playground
│           ├── Agents.jsx/css        # Agent runner with per-card Settings
│           ├── ChatInterface.jsx/css # AI chat with orchestrator
│           ├── CompanyProfile.jsx/css# Multi-company management
│           ├── CreateCompany.jsx/css # New company form
│           ├── CustomerProfile.jsx/css # ICP analysis display
│           ├── ContentCalendar.jsx/css # Editable spreadsheet calendar
│           ├── ContentGeneration.jsx/css # AI image factory
│           ├── Onboarding.jsx/css    # Registration & login
│           ├── Sidebar.jsx/css       # Navigation sidebar
│           ├── SocialAccounts.jsx/css# Social connections (placeholder)
│           └── shared/
│               ├── CompanySelector.jsx/css # Company switcher dropdown
│               ├── PreviewModal.jsx/css    # Agent results preview
│               ├── ThinkingModal.jsx/css   # Agent execution progress
│               ├── ThinkingIndicator.jsx   # Chat loading animation
│               ├── Toast.jsx/css           # Toast notifications
│               └── WorkerSelector.jsx      # Sub-agent selector
│
├── database/
│   └── migrations/
│       ├── 001_multicompany_setup.sql       # Companies, files, calendars tables
│       ├── 002_fix_company_files_columns.sql # Column fixes
│       ├── 003_admin_panel_setup.sql         # Admin role + agent_configs table
│       ├── 004_user_agent_overrides.sql      # Per-user agent customizations
│       ├── seed_agent_configs.js             # Seed agent configs from directives
│       └── migrate_files_to_storage.js       # Base64 -> Supabase Storage migration
│
└── directives/                   # AI agent SOPs (markdown templates)
    ├── ai_orchestrator.md        # Chat orchestrator system prompt
    ├── icp_analyst.md            # Agent 1: ICP analysis
    ├── icp_problem_id.md         # Agent 2: Pain point identification
    ├── content_calendar.md       # Agent 3: Calendar generation
    ├── messaging_manager.md      # Messaging strategy orchestrator
    ├── visual_content_creator.md # Visual content SOP
    ├── dashboard_chat.md         # Chat interface spec
    ├── fetch_user_profile.md     # Profile fetch spec
    ├── phase1_client_creation.md # Registration flow spec
    └── messaging/                # 10 messaging framework agents (A-J)
```

## Quick Start

### 1. Environment Setup

Copy the example and fill in your keys:

```bash
# Root .env (backend uses this)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-key
OPENAI_API_KEY=sk-your-openai-key
GEMINI_API_KEY=your-gemini-key
SERPER_API_KEY=your-serper-key
AI_PROVIDER=openai              # 'openai' or 'gemini'
PORT=3000

# Frontend .env (frontend/.env)
VITE_BACKEND_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

### 2. Database Setup

Run migrations in order in Supabase SQL Editor:
1. `database/migrations/001_multicompany_setup.sql`
2. `database/migrations/002_fix_company_files_columns.sql`
3. `database/migrations/003_admin_panel_setup.sql`
4. `database/migrations/004_user_agent_overrides.sql`

Then seed the agent configs:
```bash
node database/migrations/seed_agent_configs.js
```

Set admin role (replace with your email):
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### 3. Install & Run

```bash
# Backend
cd backend
npm install
npm start        # Runs on port 3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev      # Runs on port 5173
```

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | React 19, Vite 7, Vanilla CSS (dark glassmorphism theme) |
| Backend  | Node.js, Express 5 |
| Database | Supabase (PostgreSQL) + Supabase Storage |
| AI       | OpenAI GPT-4o, Google Gemini/Imagen (unified with auto-fallback) |
| Search   | Serper.dev (web + image search) |

## Key Features

- **3 Specialized AI Agents**: ICP Analyst, Problem Identifier, Content Calendar Strategist
- **DB-Driven Agent Configs**: Admin-editable prompts, models, and templates stored in database
- **Per-User Agent Settings**: Users can customize prompts and AI models, persisted across sessions
- **Admin Panel**: Agent config management, API key management, prompt playground
- **Multi-Company Support**: Create/switch between companies, each with isolated data
- **AI Chat Orchestrator**: ChatGPT-style interface with calendar modification via tool calling
- **Content Calendar**: Editable spreadsheet with auto-sync, CSV export, custom columns
- **AI Image Generation**: Gemini/Imagen with multiple model options
- **Unified AI Service**: OpenAI/Gemini provider routing with automatic fallback
- **10 Messaging Framework Agents**: StoryBrand, AIDA, PAS, Hormozi, Cialdini, and more

## API Endpoints

| Verb | Endpoint | Description |
|------|----------|-------------|
| GET | `/api/agents/list` | List all agent configs (full) |
| GET | `/api/agents/:agentId/config` | Single agent config |
| POST | `/api/run-agent` | Execute an AI agent |
| POST | `/api/save-results` | Persist agent results |
| POST | `/api/reset-results` | Clear agent results |
| GET | `/api/user-overrides` | Load user's agent overrides |
| PUT | `/api/user-overrides` | Save/delete user override |
| POST | `/api/orchestrator-chat` | Chat with AI orchestrator |
| POST | `/api/generate-image` | Generate image via AI |
| GET/POST/PUT/DELETE | `/api/companies/*` | Company CRUD |
| POST/GET/DELETE | `/api/companies/:id/files` | File management |
| GET/PUT/POST | `/api/admin/*` | Admin panel (protected) |
| GET | `/health` | Health check |

## Architecture

This project follows a **3-layer architecture** (see `CLAUDE.md`):

1. **Directives** (`directives/`) — SOPs in Markdown defining agent behavior
2. **Orchestration** — AI decision-making layer (backend controllers + services)
3. **Execution** — Deterministic scripts and API integrations

## License

MIT License
