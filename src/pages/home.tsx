import { type NextPage } from "next";
import { useUser } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { 
  ArrowRightIcon, 
  GlobeIcon,
  Zap,
  Eye,
  Sparkles,
  Brain,
  Shield,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Home: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to app if user is authenticated
  useEffect(() => {
    if (isLoaded && user) {
      router.replace('/app');
    }
  }, [isLoaded, user, router]);

  if (!mounted) {
    return null;
  }

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/60"></div>
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/60 animation-delay-100"></div>
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/60 animation-delay-200"></div>
          </div>
          <span className="text-base text-foreground/80 animate-pulse">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>lll.chat — AI Chat Interface</title>
        <meta name="description" content="The most advanced AI chat interface with multi-modal capabilities, web search, and document analysis." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950/80 to-black text-white overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-600/5"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.15)_0%,transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.1)_0%,transparent_50%)]"></div>
        </div>
        
        {/* Header */}
        <header className="relative z-10 px-6 py-6">
          <nav className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl text-white font-[500]">
                <span className="font-[650]">lll</span>.chat
              </span>
              <div className="px-2.5 py-1 text-xs bg-white/[0.06] border border-white/[0.08] rounded-md text-white/70 font-[450]">
                Open Source
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                className="text-white/60 hover:text-white/80 hover:bg-white/[0.04] border-0 text-sm font-[450] px-4 py-2 h-auto"
                onClick={() => window.open('https://github.com/rowengb/lll.chat', '_blank')}
              >
                <svg width="16" height="16" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-1.5">
                  <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" transform="scale(64)" fill="currentColor"/>
                </svg>
                GitHub
              </Button>
              <SignInButton mode="modal">
                <Button 
                  variant="ghost" 
                  className="text-white/60 hover:text-white/80 hover:bg-white/[0.04] border-0 text-sm font-[450] px-4 py-2 h-auto"
                >
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button 
                  className="relative bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-lg text-sm font-medium px-5 py-2.5 h-auto transition-all duration-200 hover:scale-[1.02] overflow-hidden"
                >
                  {/* Blurry gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 to-blue-500/80 blur-xl"></div>
                  <div className="relative z-10 flex items-center">
                    Get Started
                    <ArrowRightIcon className="w-4 h-4 ml-1.5" />
                  </div>
                </Button>
              </SignUpButton>
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <main className="relative z-10 px-6 pt-20 pb-32">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse" />
                <span className="text-xs text-white/60 font-medium">Sub-50ms response times</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-[650] mb-8 text-white leading-[0.75] tracking-[-0.02em]">
                The AI chat app
                <br />
                <span className="text-white/40">built for speed</span>
              </h1>
              
              <p className="text-lg text-white/50 mb-12 max-w-2xl mx-auto leading-relaxed font-[450]">
                Linear-fast AI conversations. Access GPT-4, Claude, Gemini, and 50+ models 
                with your own keys. Zero latency. Maximum control.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24">
                <SignUpButton mode="modal">
                  <Button 
                    size="lg" 
                    className="relative bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-xl font-medium px-8 py-3.5 h-auto text-base transition-all duration-200 hover:scale-[1.02] overflow-hidden"
                  >
                    {/* Blurry gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/60 to-blue-500/60 blur-2xl"></div>
                    <div className="relative z-10 flex items-center">
                      Get started
                      <ArrowRightIcon className="w-5 h-5 ml-2" />
                    </div>
                  </Button>
                </SignUpButton>
                
                <Button 
                  size="lg" 
                  variant="ghost" 
                  className="text-white/60 hover:text-white/80 hover:bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] px-8 py-3.5 h-auto text-base font-medium transition-all duration-200"
                  onClick={() => window.open('https://github.com/rowengb/lll.chat', '_blank')}
                >
                  <svg width="20" height="20" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" transform="scale(64)" fill="currentColor"/>
                  </svg>
                  View source
                </Button>
              </div>
              
              {/* Visual separator */}
              <div className="flex items-center justify-center my-16">
                <div className="w-20 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              </div>
            </div>

            {/* Features Section */}
            <div className="mb-32">
              <div className="text-center mb-20">
                <h2 className="text-3xl md:text-4xl font-[650] mb-6 text-white tracking-[-0.02em]">
                  Built for performance
                </h2>
                <p className="text-white/50 text-lg font-[450] max-w-2xl mx-auto">
                  Every interaction optimized. Every response instant. Every feature purpose-built.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  {
                    icon: <Zap className="w-6 h-6 text-white" />,
                    title: "Lightning Fast",
                    description: "Sub-50ms response times with optimized streaming and zero perceived latency.",
                    metric: "< 50ms"
                  },
                  {
                    icon: <Eye className="w-6 h-6 text-white" />,
                    title: "Vision & Analysis",
                    description: "Upload and analyze images, documents, and visual content with advanced AI models.",
                    metric: "Multi-modal"
                  },
                  {
                    icon: <Sparkles className="w-6 h-6 text-white" />,
                    title: "Image Generation",
                    description: "Create stunning visuals with DALL-E, Midjourney, and other cutting-edge AI art models.",
                    metric: "AI Art"
                  },
                  {
                    icon: <Search className="w-6 h-6 text-white" />,
                    title: "Web Search",
                    description: "Get real-time information from the web integrated directly into your conversations.",
                    metric: "Real-time"
                  },
                  {
                    icon: <Brain className="w-6 h-6 text-white" />,
                    title: "50+ AI Models",
                    description: "Access GPT-4, Claude, Gemini, and dozens of other AI models in one interface.",
                    metric: "50+ Models"
                  },
                  {
                    icon: <Shield className="w-6 h-6 text-white" />,
                    title: "Privacy First",
                    description: "Your data stays yours. Use your own API keys for complete control and privacy.",
                    metric: "100% Private"
                  }
                ].map((feature, index) => (
                  <div 
                    key={index}
                    className="group relative p-8 rounded-2xl bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] hover:border-blue-500/[0.15] hover:bg-white/[0.04] transition-all duration-300"
                  >
                    {/* Subtle blue gradient overlay */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* Blurry blue glow on hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/[0.08] to-blue-600/[0.04] opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
                    
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <div className="relative p-3 rounded-xl bg-white/[0.06] border border-white/[0.08] group-hover:bg-blue-500/[0.08] group-hover:border-blue-500/[0.15] transition-all duration-300 overflow-hidden">
                          {/* Subtle blue glow behind icon */}
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.05] to-blue-600/[0.03] opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
                          <div className="relative z-10">
                            {feature.icon}
                          </div>
                        </div>
                        <div className="text-xs font-[500] text-white/40 group-hover:text-white/60 transition-colors duration-300">
                          {feature.metric}
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-[600] text-white mb-3 group-hover:text-white/95 transition-colors duration-300">
                        {feature.title}
                      </h3>
                      
                      <p className="text-white/60 text-sm font-[450] leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech Stack */}
            <div className="text-center mb-32">
              <div className="flex items-center justify-center my-16">
                <div className="w-20 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              </div>
              
              <h2 className="text-2xl font-[500] mb-8 text-white/60">
                Built with modern tools
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
                {[
                  {
                    name: "Next.js",
                    icon: (
                      <svg width="32" height="32" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <mask id="mask0_408_139" style={{maskType:"alpha"}} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
                          <circle cx="90" cy="90" r="90" fill="black"/>
                        </mask>
                        <g mask="url(#mask0_408_139)">
                          <circle cx="90" cy="90" r="87" fill="black" stroke="white" strokeWidth="6"/>
                          <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#paint0_linear_408_139)"/>
                          <rect x="115" y="54" width="12" height="72" fill="url(#paint1_linear_408_139)"/>
                        </g>
                        <defs>
                          <linearGradient id="paint0_linear_408_139" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
                            <stop stopColor="white"/>
                            <stop offset="1" stopColor="white" stopOpacity="0"/>
                          </linearGradient>
                          <linearGradient id="paint1_linear_408_139" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
                            <stop stopColor="white"/>
                            <stop offset="1" stopColor="white" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    )
                  },
                  {
                    name: "TypeScript",
                    icon: (
                      <svg viewBox="0 0 256 256" width="32" height="32" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
                        <path d="M20 0h216c11.046 0 20 8.954 20 20v216c0 11.046-8.954 20-20 20H20c-11.046 0-20-8.954-20-20V20C0 8.954 8.954 0 20 0Z" fill="#3178C6"/>
                        <path d="M150.518 200.475v27.62c4.492 2.302 9.805 4.028 15.938 5.179 6.133 1.151 12.597 1.726 19.393 1.726 6.622 0 12.914-.633 18.874-1.899 5.96-1.266 11.187-3.352 15.678-6.257 4.492-2.906 8.048-6.704 10.669-11.394 2.62-4.689 3.93-10.486 3.93-17.391 0-5.006-.749-9.394-2.246-13.163a30.748 30.748 0 0 0-6.479-10.055c-2.821-2.935-6.205-5.567-10.149-7.898-3.945-2.33-8.394-4.531-13.347-6.602-3.628-1.497-6.881-2.949-9.761-4.359-2.879-1.41-5.327-2.848-7.342-4.316-2.016-1.467-3.571-3.021-4.665-4.661-1.094-1.64-1.641-3.495-1.641-5.567 0-1.899.489-3.61 1.468-5.135s2.362-2.834 4.147-3.927c1.785-1.094 3.973-1.942 6.565-2.547 2.591-.604 5.471-.906 8.638-.906 2.304 0 4.737.173 7.299.518 2.563.345 5.14.877 7.732 1.597a53.669 53.669 0 0 1 7.558 2.719 41.7 41.7 0 0 1 6.781 3.797v-25.807c-4.204-1.611-8.797-2.805-13.778-3.582-4.981-.777-10.697-1.165-17.147-1.165-6.565 0-12.784.705-18.658 2.115-5.874 1.409-11.043 3.61-15.506 6.602-4.463 2.993-7.99 6.805-10.582 11.437-2.591 4.632-3.887 10.17-3.887 16.615 0 8.228 2.375 15.248 7.127 21.06 4.751 5.811 11.963 10.731 21.638 14.759a291.458 291.458 0 0 1 10.625 4.575c3.283 1.496 6.119 3.049 8.509 4.66 2.39 1.611 4.276 3.366 5.658 5.265 1.382 1.899 2.073 4.057 2.073 6.474a9.901 9.901 0 0 1-1.296 4.963c-.863 1.524-2.174 2.848-3.93 3.97-1.756 1.122-3.945 1.999-6.565 2.632-2.62.633-5.687.95-9.2.95-5.989 0-11.92-1.05-17.794-3.151-5.875-2.1-11.317-5.25-16.327-9.451Zm-46.036-68.733H140V109H41v22.742h35.345V233h28.137V131.742Z" fill="#FFF"/>
                      </svg>
                    )
                  },
                  {
                    name: "Convex",
                    icon: (
                      <svg viewBox="28 28 128 132" xmlns="http://www.w3.org/2000/svg" fill="none" width="32" height="32">
                        <path fill="#F3B01C" d="M108.092 130.021c18.166-2.018 35.293-11.698 44.723-27.854-4.466 39.961-48.162 65.218-83.83 49.711-3.286-1.425-6.115-3.796-8.056-6.844-8.016-12.586-10.65-28.601-6.865-43.135 10.817 18.668 32.81 30.111 54.028 28.122Z"/>
                        <path fill="#8D2676" d="M53.401 90.174c-7.364 17.017-7.682 36.94 1.345 53.336-31.77-23.902-31.423-75.052-.388-98.715 2.87-2.187 6.282-3.485 9.86-3.683 14.713-.776 29.662 4.91 40.146 15.507-21.3.212-42.046 13.857-50.963 33.555Z"/>
                        <path fill="#EE342F" d="M114.637 61.855C103.89 46.87 87.069 36.668 68.639 36.358c35.625-16.17 79.446 10.047 84.217 48.807.444 3.598-.139 7.267-1.734 10.512-6.656 13.518-18.998 24.002-33.42 27.882 10.567-19.599 9.263-43.544-3.065-61.704Z"/>
                      </svg>
                    )
                  },
                  {
                    name: "tRPC",
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 512 512">
                        <rect width="512" height="512" fill="#398CCB" rx="150"/>
                        <path fill="#fff" fillRule="evenodd" d="m255.446 75 71.077 41.008v22.548l86.031 49.682v84.986l23.077 13.322v82.062L364.6 409.615l-31.535-18.237-76.673 44.268-76.214-44.012-31.093 17.981-71.031-41.077v-81.992l22.177-12.803v-85.505l84.184-48.6.047-.002v-23.628L255.446 75Zm71.077 84.879v38.144l-71.031 41.008-71.03-41.008v-37.087l-.047.002-65.723 37.962v64.184l30.393-17.546 71.03 41.008v81.992l-21.489 12.427 57.766 33.358 58.226-33.611-21.049-12.174v-81.992l71.031-41.008 29.492 17.027V198.9l-67.569-39.021Zm-14.492 198.09v-50.054l43.338 25.016v50.054l-43.338-25.016Zm105.138-50.123-43.338 25.016v50.123l43.338-25.085v-50.054ZM96.515 357.9v-50.054l43.339 25.016v50.053L96.515 357.9Zm105.139-50.054-43.339 25.016v50.053l43.339-25.015v-50.054Zm119.608-15.923 43.338-25.015 43.338 25.015-43.338 25.039-43.338-25.039Zm-172.177-25.085-43.339 25.085 43.339 24.969 43.338-24.969-43.338-25.085Zm53.838-79.476v-50.054l43.292 25.038v50.031l-43.292-25.015Zm105.092-50.054-43.292 25.038v50.008l43.292-24.992v-50.054Zm-95.861-15.97 43.292-25.015 43.339 25.015-43.339 25.016-43.292-25.016Z" clipRule="evenodd"/>
                      </svg>
                    )
                  },
                  {
                    name: "Clerk",
                    icon: (
                      <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" height="32" width="32">
                        <path d="m21.47 20.829 -2.881 -2.881a0.572 0.572 0 0 0 -0.7 -0.084 6.854 6.854 0 0 1 -7.081 0 0.576 0.576 0 0 0 -0.7 0.084l-2.881 2.881a0.576 0.576 0 0 0 -0.103 0.69 0.57 0.57 0 0 0 0.166 0.186 12 12 0 0 0 14.113 0 0.58 0.58 0 0 0 0.239 -0.423 0.576 0.576 0 0 0 -0.172 -0.453Zm0.002 -17.668 -2.88 2.88a0.569 0.569 0 0 1 -0.701 0.084A6.857 6.857 0 0 0 8.724 8.08a6.862 6.862 0 0 0 -1.222 3.692 6.86 6.86 0 0 0 0.978 3.764 0.573 0.573 0 0 1 -0.083 0.699l-2.881 2.88a0.567 0.567 0 0 1 -0.864 -0.063A11.993 11.993 0 0 1 6.771 2.7a11.99 11.99 0 0 1 14.637 -0.405 0.566 0.566 0 0 1 0.232 0.418 0.57 0.57 0 0 1 -0.168 0.448Zm-7.118 12.261a3.427 3.427 0 1 0 0 -6.854 3.427 3.427 0 0 0 0 6.854Z" fill="white" strokeWidth="1"/>
                      </svg>
                    )
                  },
                  {
                    name: "Tailwind",
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 54 33" width="32" height="20">
                        <g clipPath="url(#a)">
                          <path fill="#38bdf8" fillRule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.513 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z" clipRule="evenodd"/>
                        </g>
                        <defs>
                          <clipPath id="a">
                            <path fill="#fff" d="M0 0h54v32.4H0z"/>
                          </clipPath>
                        </defs>
                      </svg>
                    )
                  },
                  {
                    name: "OpenAI",
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" preserveAspectRatio="xMidYMid" viewBox="0 0 256 260">
                        <path fill="white" d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"/>
                      </svg>
                    )
                  },
                  {
                    name: "Anthropic",
                    icon: (
                      <svg fill="white" fillRule="evenodd" style={{flexShrink: 0, lineHeight: 1}} viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                        <title>Anthropic</title>
                        <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"/>
                      </svg>
                    )
                  },
                  {
                    name: "Radix UI",
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="white" style={{marginRight:"3px"}} viewBox="4 0 17 25" width="32" height="32">
                        <path d="M12 25a8 8 0 1 1 0-16v16zM12 0H4v8h8V0zM17 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="white"/>
                      </svg>
                    )
                  },
                  {
                    name: "Framer Motion",
                    icon: (
                      <svg viewBox="0 0 256 384" width="32" height="32" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
                        <path d="M0 0h256v128H128L0 0Zm0 128h128l128 128H128v128L0 256V128Z" fill="white"/>
                      </svg>
                    )
                  }
                ].map((tech, index) => (
                  <div 
                    key={index}
                    className="group flex flex-col items-center justify-center space-y-3 p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 h-20 w-full"
                  >
                    <div className="opacity-60 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center h-6">
                      {tech.icon}
                    </div>
                    <span className="text-white/50 text-xs font-[450] group-hover:text-white/70 transition-colors duration-200 whitespace-nowrap">
                      {tech.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center">
              <div className="flex items-center justify-center my-16">
                <div className="w-20 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              </div>
              
              <div className="max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-[650] mb-6 text-white tracking-[-0.02em]">
                  Start building with AI
                </h2>
                <p className="text-lg text-white/50 mb-10 font-[450]">
                  Join developers and teams using lll.chat to accelerate their AI workflows.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <SignUpButton mode="modal">
                    <Button 
                      size="lg" 
                      className="relative bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 shadow-xl font-medium px-8 py-3.5 h-auto text-base transition-all duration-200 hover:scale-[1.02] overflow-hidden"
                    >
                      {/* Blurry gradient background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/60 to-blue-500/60 blur-2xl"></div>
                      <div className="relative z-10 flex items-center">
                        Get started for free
                        <ArrowRightIcon className="w-5 h-5 ml-2" />
                      </div>
                    </Button>
                  </SignUpButton>
                  
                  <Button 
                    size="lg" 
                    variant="ghost" 
                    className="text-white/60 hover:text-white/80 hover:bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] px-8 py-3.5 h-auto text-base font-medium transition-all duration-200"
                    onClick={() => window.open('https://github.com/rowengb/lll.chat', '_blank')}
                  >
                    <svg width="20" height="20" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                      <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" transform="scale(64)" fill="currentColor"/>
                    </svg>
                    View on GitHub
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/[0.08] mt-20">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-3 mb-4 md:mb-0">
                <span className="text-xl text-white font-[500]">
                  <span className="font-[650]">lll</span>.chat
                </span>
                <div className="px-2 py-0.5 text-xs bg-white/[0.06] border border-white/[0.08] rounded text-white/60 font-[450]">
                  Open Source
                </div>
              </div>
              
              <div className="flex items-center space-x-6 text-white/40 text-sm font-[450]">
                <button 
                  onClick={() => window.open('https://github.com/rowengb/lll.chat', '_blank')}
                  className="hover:text-white/60 transition-colors duration-200 flex items-center"
                >
                  <svg width="16" height="16" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" transform="scale(64)" fill="currentColor"/>
                  </svg>
                  GitHub
                </button>
                <span className="text-white/20">•</span>
                <span>Built with Cursor AI</span>
                <span className="text-white/20">•</span>
                <span>MIT License</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home; 