# T3 Chat Clone - Development Setup

This is a complete T3.chat clone built with Next.js, TypeScript, Tailwind CSS, shadcn/UI, tRPC, Prisma, and NextAuth.js.

## Features

- 🔄 **Development-first approach** with mock AI and auth
- 🤖 **AI Integration** with OpenAI (switchable between mock and real)
- 🔐 **Authentication** with NextAuth.js (GitHub OAuth + mock mode)
- 💾 **Database** with Prisma (SQLite for dev, Postgres for prod)
- 🎨 **Modern UI** with Tailwind CSS and shadcn/UI components
- ⚡ **Type-safe APIs** with tRPC
- 🐳 **Docker** support for production services

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Environment

```bash
cp .env.example .env.local
```

### 3. Start Development Services (Optional)

For real database and Redis:

```bash
pnpm docker:up
```

### 4. Setup Database

```bash
pnpm migrate
```

### 5. Start Development Server

**Mock Mode (Default):**
```bash
pnpm dev
```

**Real AI/Auth Mode:**
```bash
pnpm dev:real
```

## Environment Modes

### Mock Mode (Default)
- **AI_MODE=mock**: Uses mock AI responses
- **AUTH_MODE=mock**: Uses mock authentication (auto-login)
- **DATABASE_URL**: Uses SQLite file database

### Real Mode
- **AI_MODE=real**: Uses OpenAI API (requires OPENAI_API_KEY)
- **AUTH_MODE=real**: Uses GitHub OAuth (requires GITHUB_ID/SECRET)
- **DATABASE_URL**: Can use Postgres via Docker

## Available Scripts

- `pnpm dev` - Start development server (mock mode)
- `pnpm dev:real` - Start development server (real AI/auth)
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm docker:up` - Start Docker services (Postgres + Redis)
- `pnpm docker:down` - Stop Docker services
- `pnpm migrate` - Apply database migrations
- `pnpm db:studio` - Open Prisma Studio

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/UI components
│   ├── Sidebar.tsx     # Thread list and model selector
│   ├── ChatWindow.tsx  # Chat interface
│   └── ModelSelector.tsx
├── pages/              # Next.js pages
│   ├── api/trpc/       # tRPC API routes
│   ├── _app.tsx        # App wrapper with providers
│   └── index.tsx       # Main chat page
├── server/             # Backend logic
│   ├── ai/             # AI client (mock + real)
│   ├── auth/           # Auth configs (mock + real)
│   ├── db/             # Database client
│   └── trpc/           # tRPC routers and procedures
├── styles/             # Global styles
└── utils/              # Utilities and tRPC client
```

## Configuration

### For Real AI (OpenAI)
1. Get an API key from [OpenAI](https://platform.openai.com/)
2. Set `OPENAI_API_KEY` in `.env.local`
3. Set `AI_MODE=real`

### For Real Auth (GitHub OAuth)
1. Create a GitHub OAuth App
2. Set `GITHUB_ID` and `GITHUB_SECRET` in `.env.local`
3. Set `AUTH_MODE=real`

### For Production Database
1. Start Docker services: `pnpm docker:up`
2. Update `DATABASE_URL` to Postgres connection string
3. Run migrations: `pnpm migrate`

## Development Tips

- The app works out of the box in mock mode - no external services needed
- Use `pnpm dev:real` to test with real AI and authentication
- Mock mode is perfect for UI development and testing
- All TypeScript errors will resolve once dependencies are installed

## Deployment

1. Set environment variables for production
2. Use Postgres database (update DATABASE_URL)
3. Set up Redis for session storage
4. Configure OAuth providers
5. Build and deploy: `pnpm build && pnpm start` 