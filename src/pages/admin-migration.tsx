import { useState } from 'react';
import { trpc } from '../utils/trpc';

export default function AdminMigration() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const cleanupMutation = trpc.chat.cleanupOldGroundingFields.useMutation();

  const runMigration = async () => {
    setIsRunning(true);
    try {
      const result = await cleanupMutation.mutateAsync();
      setResult(result);
      console.log('Migration result:', result);
    } catch (error) {
      console.error('Migration failed:', error);
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Database Migration</h1>
      <p className="mb-4">
        This will clean up old grounding fields (groundingSearchQueries and groundedSegments) from the database.
      </p>
      
      <button
        onClick={runMigration}
        disabled={isRunning}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {isRunning ? 'Running Migration...' : 'Run Migration'}
      </button>
      
      {result && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="font-bold">Migration Result:</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 