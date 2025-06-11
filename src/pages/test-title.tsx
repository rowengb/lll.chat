import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";

export default function TestTitle() {
  const [threadId, setThreadId] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<any>(null);

  const generateTitle = trpc.chat.generateTitle.useMutation({
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      setResult({ error: error.message });
    },
  });

  const handleTest = () => {
    if (!threadId || !message) {
      alert("Please fill in both fields");
      return;
    }

    generateTitle.mutate({
      threadId,
      firstMessage: message,
    });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Title Generation</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Thread ID</label>
          <input
            type="text"
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Enter thread ID"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">First Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 h-32"
            placeholder="Enter the first message to generate a title for"
          />
        </div>

        <Button 
          onClick={handleTest}
          disabled={generateTitle.isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {generateTitle.isLoading ? "Generating..." : "Generate Title"}
        </Button>

        {result && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-medium mb-2">Result:</h3>
            <pre className="text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
} 