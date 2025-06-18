import { type NextPage } from "next";
import { useUser } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { 
  ArrowRightIcon, 
  SparklesIcon, 
  ZapIcon, 
  EyeIcon, 
  GlobeIcon, 
  FileTextIcon, 
  BrainIcon, 
  ShieldCheckIcon,
  CheckIcon,
  PlayIcon,
  ChevronRightIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Home: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to app if authenticated
  useEffect(() => {
    if (isLoaded && user) {
      router.push('/app');
    }
  }, [isLoaded, user, router]);

  if (!mounted) {
    return null;
  }

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400"></div>
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400 animation-delay-100"></div>
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400 animation-delay-200"></div>
          </div>
          <span className="text-base text-white/80 animate-pulse">Loading...</span>
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

      <div className="min-h-screen bg-black text-white overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-blue-600/5"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.15)_0%,transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.1)_0%,transparent_50%)]"></div>
        </div>
        
        {/* Header */}
        <header className="relative z-10 px-6 py-6">
          <nav className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-4xl text-white">
                <span className="font-bold">lll</span>.chat
              </span>
              <div className="px-3 py-1 text-sm bg-blue-600/20 border border-blue-500/30 rounded-md text-blue-300">
                Open Source
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <SignInButton mode="modal">
                <Button 
                  variant="ghost" 
                  className="text-white/80 hover:text-white hover:bg-white/10 border-0"
                >
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-500/25"
                >
                  Get Started
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Button>
              </SignUpButton>
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <main className="relative z-10 px-6 pt-16 pb-24">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-8">
                <SparklesIcon className="w-4 h-4 mr-2 text-blue-400" />
                <span className="text-sm text-blue-300">Next-generation AI chat interface</span>
              </div>
              
              <h1 className="text-6xl md:text-7xl font-bold mb-6 text-white leading-tight">
                Chat with AI
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                  like never before
                </span>
              </h1>
              
              <p className="text-xl text-white/70 mb-12 max-w-3xl mx-auto leading-relaxed">
                Experience the future of AI conversation with multi-modal capabilities, 
                real-time web search, document analysis, and support for all major AI models.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <SignUpButton mode="modal">
                  <Button 
                    size="lg" 
                    className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-2xl shadow-blue-500/40 px-8 py-4 text-lg"
                  >
                    Start Chatting
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </Button>
                </SignUpButton>
                
                <Button 
                  size="lg" 
                  variant="ghost" 
                  className="text-white/80 hover:text-white hover:bg-white/5 border border-white/10 px-8 py-4 text-lg backdrop-blur-sm"
                >
                  <PlayIcon className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
              {[
                {
                  icon: <ZapIcon className="w-6 h-6 text-white" />,
                  title: "Lightning Fast",
                  description: "Optimized for speed with instant responses and seamless real-time streaming."
                },
                {
                  icon: <EyeIcon className="w-6 h-6 text-white" />,
                  title: "Vision Capabilities",
                  description: "Upload and analyze images, documents, and visual content with advanced AI models."
                },
                {
                  icon: <GlobeIcon className="w-6 h-6 text-white" />,
                  title: "Web Search",
                  description: "Get real-time information from the web integrated directly into your conversations."
                },
                {
                  icon: <FileTextIcon className="w-6 h-6 text-white" />,
                  title: "Document Analysis",
                  description: "Upload PDFs, documents, and files for intelligent analysis and summarization."
                },
                {
                  icon: <BrainIcon className="w-6 h-6 text-white" />,
                  title: "Advanced Reasoning",
                  description: "Access to the most sophisticated AI models including GPT-4, Claude, and Gemini."
                },
                {
                  icon: <ShieldCheckIcon className="w-6 h-6 text-white" />,
                  title: "Privacy First",
                  description: "Your conversations are private and secure with end-to-end encryption."
                }
              ].map((feature, index) => (
                <div 
                  key={index}
                  className="group relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300 hover:scale-105"
                >
                  <div className="inline-flex p-3 rounded-xl bg-blue-600/20 border border-blue-500/30 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-blue-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-white/70 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Pricing Section */}
            <div className="text-center mb-20">
              <h2 className="text-4xl font-bold mb-4 text-white">
                Simple, Transparent Pricing
              </h2>
              <p className="text-xl text-white/70 mb-12">
                Bring your own API keys. No subscriptions, no hidden fees.
              </p>
              
              <div className="max-w-md mx-auto p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">Free Forever</h3>
                  <p className="text-white/70">Just bring your API keys</p>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {[
                    "Access to all AI models",
                    "Unlimited conversations",
                    "Vision & document analysis",
                    "Web search integration",
                    "Privacy-first design"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center text-white/80">
                      <CheckIcon className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <SignUpButton mode="modal">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-500/25"
                  >
                    Get Started Now
                    <ChevronRightIcon className="w-4 h-4 ml-2" />
                  </Button>
                </SignUpButton>
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center">
              <div className="p-12 rounded-3xl bg-blue-600/10 backdrop-blur-sm border border-white/10">
                <h2 className="text-4xl font-bold mb-4 text-white">
                  Ready to transform your AI experience?
                </h2>
                <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
                  Join thousands of users who are already experiencing the future of AI conversation.
                </p>
                <SignUpButton mode="modal">
                  <Button 
                    size="lg" 
                    className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-2xl shadow-blue-500/40 px-12 py-4 text-lg"
                  >
                    Start Your Journey
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </Button>
                </SignUpButton>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 px-6 py-12 border-t border-white/10">
          <div className="max-w-7xl mx-auto text-center">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <span className="text-2xl text-white">
                <span className="font-bold">lll</span>.chat
              </span>
              <div className="px-3 py-1 text-sm bg-blue-600/20 border border-blue-500/30 rounded-md text-blue-300">
                Open Source
              </div>
            </div>
            <p className="text-white/50">
              © 2024 lll.chat. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home; 