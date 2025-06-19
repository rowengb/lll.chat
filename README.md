# lll.chat

A modern, high-performance AI chat application that brings together multiple AI providers in a unified interface. Built with Next.js, TypeScript, and Convex for real-time performance.

## Features

### Multi-Provider AI Support

- **OpenAI**: GPT-4o, o4-mini with vision capabilities and plenty more!
- **Anthropic**: Claude 4 Sonnet with document analysis
- **Google**: Gemini 2.5 Flash with web search and multimodal support
- **DeepSeek**: Advanced reasoning models
- **OpenRouter**: Access to 200+ models through unified API

### User Experience

- **Real-time streaming** responses with typing indicators
- **Customizable favorites** - pin your preferred models
- **Thread management** with search, pinning, and organization
- **File attachments** with support for images and documents
- **Dark/light mode** with system preference detection
- **Responsive design** optimized for desktop and mobile

### Technical Features

- **Real-time database** with Convex for instant synchronization
- **Type-safe APIs** with tRPC and end-to-end TypeScript
- **Authentication** with Clerk for secure user management
- **Token tracking** and usage monitoring
- **Optimized performance** with edge deployment ready

## Quick Start

### Prerequisites

- Node.js 19+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lll.chat.git
cd lll.chat

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Start Convex development server
npx convex dev

# Start the application
pnpm dev
```

Visit `http://localhost:3000` to start chatting.

## Configuration

### Required Environment Variables

Create a `.env.local` file with the following variables:

```env
# Convex (Required)
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url
CONVEX_DEPLOYMENT=your_convex_deployment_name

# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### Setting Up Services

#### 1. Convex Database

1. Sign up at [Convex](https://convex.dev)
2. Create a new project
3. Run `npx convex dev` to initialize
4. Copy the deployment URL to your `.env.local`

#### 2. Clerk Authentication

1. Sign up at [Clerk](https://clerk.com)
2. Create a new application
3. Copy the API keys to your `.env.local`
4. Configure OAuth providers as needed

#### 3. AI Provider APIs

Configure the AI providers you want to use:

- **OpenAI**: Get API key from [OpenAI Platform](https://platform.openai.com/)
- **Anthropic**: Get API key from [Anthropic Console](https://console.anthropic.com/)
- **Google AI**: Get API key from [Google AI Studio](https://makersuite.google.com/)
- **DeepSeek**: Get API key from [DeepSeek Platform](https://platform.deepseek.com/)
- **OpenRouter**: Get API key from [OpenRouter](https://openrouter.ai/)

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Backend**: Convex (real-time database)
- **API Layer**: tRPC with React Query
- **Authentication**: Clerk
- **Styling**: Tailwind CSS with custom components
- **AI Integration**: Multiple provider SDKs
- **Deployment**: Vercel (recommended)

## Project Structure

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

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm dev:convex       # Start Convex development server

# Building
pnpm build            # Build for production
pnpm start            # Start production server

# Database
npx convex dev        # Start Convex development
npx convex deploy     # Deploy to production
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## Deployment

### Vercel Deployment (Recommended)

1. Deploy your Convex backend:

   ```bash
   npx convex deploy --prod
   ```

2. Connect your GitHub repository to Vercel

3. Configure environment variables in Vercel dashboard

4. Deploy automatically on every push to main

### Environment Variables for Production

Ensure all required environment variables are set in your production environment:

- Database: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`
- Authentication: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- AI Providers: Configure the APIs you want to enable

## Security

- All API keys are encrypted and stored securely
- User authentication handled by Clerk
- Rate limiting implemented for AI API calls
- Input validation and sanitization throughout

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/yourusername/lll.chat/issues)
- **Discussions**: Join the conversation in [GitHub Discussions](https://github.com/yourusername/lll.chat/discussions)

## Acknowledgments

Built with these amazing technologies:

- [Next.js](https://nextjs.org/) - React framework
- [Convex](https://convex.dev/) - Real-time backend
- [Clerk](https://clerk.com/) - Authentication
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [tRPC](https://trpc.io/) - Type-safe APIs
