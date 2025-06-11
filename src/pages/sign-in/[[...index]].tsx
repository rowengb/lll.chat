import { SignIn } from "@clerk/nextjs";
import Head from "next/head";

export default function SignInPage() {
  return (
    <>
      <Head>
        <title>Sign In - lll.chat</title>
        <meta name="description" content="Sign in to lll.chat" />
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Welcome to lll.chat
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Sign in to continue to your conversations
            </p>
          </div>
          <div className="flex justify-center">
            <SignIn 
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                  card: "shadow-lg",
                }
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
} 