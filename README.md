# lll.chat

A high-performance AI chat application built with Next.js, TypeScript, Convex, and modern web technologies. Featuring real-time streaming, token tracking, and optimized for speed.

## 🚀 Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp .env.example .env.local

# 3. Start Convex development
npx convex dev

# 4. Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see lll.chat running!

## ✨ Features

- 🚀 **Ultra-fast Performance**: Convex real-time backend for 80-118 TPS
- 🤖 **AI Integration**: OpenAI GPT models with streaming responses
- 📊 **Token Tracking**: Real-time token counting and TPS monitoring
- 🔐 **Authentication**: NextAuth.js with GitHub OAuth + mock mode
- 💾 **Real-time Database**: Convex for instant data synchronization
- 🎨 **Modern UI**: Tailwind CSS + shadcn/UI components
- ⚡ **Type-safe APIs**: End-to-end type safety with tRPC + Convex
- 📱 **Responsive**: Mobile-friendly chat interface
- 🌍 **Edge Optimized**: Global CDN deployment ready

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **Language**: TypeScript
- **Backend**: Convex (Real-time database)
- **Styling**: Tailwind CSS + shadcn/UI
- **API**: tRPC with React Query
- **Auth**: NextAuth.js
- **AI**: OpenAI API
- **Deployment**: Vercel + Convex

## 📁 Project Structure

```
├── convex/
│   ├── schema.ts             # Convex database schema
│   ├── users.ts             # User management functions
│   ├── threads.ts           # Thread operations
│   ├── messages.ts          # Message handling
│   └── apiKeys.ts           # API key management
├── public/                   # Static assets
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/UI components
│   │   ├── ChatWindow.tsx  # Main chat interface
│   │   ├── ModelSelector.tsx
│   │   └── Sidebar.tsx     # Thread list
│   ├── hooks/
│   │   └── useConvexAuth.ts # Convex auth integration
│   ├── lib/
│   │   ├── convex.tsx      # Convex provider setup
│   │   └── utils.ts        # Utility functions
│   ├── pages/              # Next.js pages
│   │   ├── api/
│   │   │   ├── auth/       # NextAuth endpoints
│   │   │   ├── chat/
│   │   │   │   └── stream.ts # Streaming API with token tracking
│   │   │   └── trpc/       # tRPC endpoints
│   │   ├── auth/
│   │   │   └── signin.tsx  # Sign-in page
│   │   ├── _app.tsx        # App wrapper with Convex provider
│   │   └── index.tsx       # Main page
│   ├── server/             # Backend logic
│   │   ├── ai/
│   │   │   └── client.ts   # AI client with token tracking
│   │   ├── auth/
│   │   │   ├── mock.ts     # Mock auth config
│   │   │   └── real.ts     # Real auth config
│   │   └── trpc/           # tRPC setup
│   │       ├── context.ts  # Request context
│   │       ├── router.ts   # Main router
│   │       ├── trpc.ts     # Base tRPC config
│   │       └── routers/
│   │           ├── chat-convex.ts    # Chat with Convex
│   │           └── apiKeys-convex.ts # API keys with Convex
│   ├── styles/
│   │   └── globals.css     # Global styles
│   └── utils/
│       └── trpc.ts         # tRPC client
├── .env.example            # Environment template
├── next.config.js         # Next.js config
├── package.json           # Dependencies & scripts
├── tailwind.config.js     # Tailwind config
└── tsconfig.json          # TypeScript config
```

## 🔧 Environment Configuration

### Development Mode (Default)
Perfect for development with Convex:

```env
AI_MODE=mock
AUTH_MODE=mock
NEXT_PUBLIC_CONVEX_URL=https://your-convex-url.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment
```

### Production Mode
Real services with optimized performance:

```env
AI_MODE=real
AUTH_MODE=real
OPENAI_API_KEY=your-openai-key
GITHUB_ID=your-github-oauth-id
GITHUB_SECRET=your-github-oauth-secret
NEXT_PUBLIC_CONVEX_URL=https://your-prod-convex-url.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment
```

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm dev:real` | Start with real AI/auth |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `npx convex dev` | Start Convex development |
| `npx convex deploy --prod` | Deploy Convex to production |

## 🚀 Performance Features

### Token Tracking & Monitoring
- Real-time token counting (input/output/total)
- Live TPS (Tokens Per Second) calculation
- Performance logging and optimization
- Streaming response monitoring

### Speed Optimizations
- Convex real-time backend (80-118 TPS)
- Edge-optimized global deployment
- Minimal database latency
- Optimized AI streaming pipeline

## 🔑 Setting Up Real Services

### OpenAI API
1. Get API key from [OpenAI Platform](https://platform.openai.com/)
2. Add to `.env.local`: `OPENAI_API_KEY=sk-...`
3. Set `AI_MODE=real`

### GitHub OAuth
1. Create OAuth App in GitHub Settings
2. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Add credentials to `.env.local`:
   ```env
   GITHUB_ID=your_client_id
   GITHUB_SECRET=your_client_secret
   ```
4. Set `AUTH_MODE=real`

### Convex Setup
1. Sign up at [Convex](https://convex.dev)
2. Run `npx convex dev` to setup development
3. For production: `npx convex deploy --prod`

## 🚀 Deployment

### Vercel + Convex (Recommended)
1. Deploy Convex: `npx convex deploy --prod`
2. Connect GitHub repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

Expected performance: **80-118 TPS** 🚀

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Convex development environment
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- [Convex](https://convex.dev/) for the real-time backend
- [T3 Stack](https://create.t3.gg/) for the foundation
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [OpenAI](https://openai.com/) for AI capabilities 