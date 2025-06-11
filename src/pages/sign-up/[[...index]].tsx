import { SignUp } from "@clerk/nextjs";
import Head from "next/head";

export default function SignUpPage() {
  return (
    <>
      <Head>
        <title>Sign Up - lll.chat</title>
        <meta name="description" content="Create your lll.chat account" />
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Join lll.chat
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Create your account to start chatting
            </p>
          </div>
          <div className="flex justify-center">
            <SignUp 
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