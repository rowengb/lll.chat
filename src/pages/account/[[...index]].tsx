import { type NextPage } from "next";
import { useUser, UserProfile, SignOutButton } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, LogOutIcon } from "lucide-react";

const AccountPage: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <>
      <Head>
        <title>lll.chat - Account Settings</title>
        <meta name="description" content="lll.chat account settings and profile management" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-8">
                              <div className="flex items-center gap-4 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                  className="rounded-full hover:bg-gray-100 p-2"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <h1 className="text-2xl font-semibold text-gray-900">Account Settings</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage your account settings and preferences
                  </p>
                </div>
                <SignOutButton>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <LogOutIcon className="h-4 w-4" />
                    Sign Out
                  </Button>
                </SignOutButton>
              </div>
            </div>

            <div className="w-full">
              <UserProfile 
                appearance={{
                  elements: {
                    rootBox: "w-full shadow-none border border-gray-200 rounded-lg bg-white",
                    card: "shadow-none border-0 bg-transparent p-0",
                    cardBox: "shadow-none",
                    main: "shadow-none",
                    navbar: "hidden",
                    navbarButton: "text-gray-700 hover:text-gray-900",
                    navbarButtonIcon: "text-gray-500",
                    headerTitle: "text-xl font-semibold text-gray-900",
                    headerSubtitle: "text-sm text-gray-500",
                    socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50 bg-white text-gray-700",
                    formButtonPrimary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-md transition-colors",
                    formFieldInput: "border-gray-300 focus:border-gray-500 focus:ring-gray-500 bg-white",
                    identityPreviewEditButton: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                    profileSectionPrimaryButton: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                    badge: "bg-gray-100 text-gray-800",
                    avatarImageActions: "bg-white border border-gray-300 rounded-lg",
                    avatarImageActionsUpload: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md",
                    profileSection: "bg-white rounded-lg border border-gray-200 p-6 mb-6 -ml-2 mr-6 mt-6",
                    profileSectionContent: "space-y-4",
                    button: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                    buttonPrimary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                    modalCloseButton: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                    fileDropAreaButton: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                    fileDropAreaButtonPrimary: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                  },
                  variables: {
                    colorPrimary: "#6B7280",
                    colorText: "#374151", 
                    colorTextSecondary: "#6B7280",
                    colorBackground: "transparent",
                    colorInputBackground: "#FFFFFF",
                    colorInputText: "#374151",
                    borderRadius: "0.5rem",
                  }
                }}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default AccountPage; 