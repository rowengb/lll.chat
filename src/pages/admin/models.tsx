import { useState } from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { getProviderIcon } from "@/components/ModelSelector";

export default function ModelsAdmin() {
  const [activeTab, setActiveTab] = useState<'favorites' | 'others'>('favorites');
  
  const { data: favoriteModels, refetch: refetchFavorites } = trpc.models.getFavoriteModels.useQuery();
  const { data: otherModels, refetch: refetchOthers } = trpc.models.getOtherModels.useQuery();
  const seedModelsMutation = trpc.models.seedModels.useMutation();

  const handleSeedModels = async () => {
    try {
      await seedModelsMutation.mutateAsync();
      refetchFavorites();
      refetchOthers();
      alert('Models seeded successfully!');
    } catch (error) {
      alert('Error seeding models: ' + error);
    }
  };

  const currentModels = activeTab === 'favorites' ? favoriteModels : otherModels;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Models Management</h1>
            <Button 
              onClick={handleSeedModels}
              disabled={seedModelsMutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {seedModelsMutation.isLoading ? 'Seeding...' : 'Seed Models'}
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mb-6">
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'favorites'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Favorites ({favoriteModels?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('others')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'others'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Others ({otherModels?.length || 0})
            </button>
          </div>

          {/* Models Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentModels?.map((model) => (
              <div
                key={model._id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    {getProviderIcon(model.provider, model.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{model.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {model.provider}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Order: {model.order}
                      </span>
                      {model.contextWindow && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {(model.contextWindow / 1000).toFixed(0)}K ctx
                        </span>
                      )}
                    </div>
                    {model.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {model.capabilities.map((capability, index) => (
                          <span
                            key={index}
                            className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                          >
                            {capability}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!currentModels?.length && (
            <div className="text-center py-12">
              <p className="text-gray-500">No models found. Try seeding the database first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 