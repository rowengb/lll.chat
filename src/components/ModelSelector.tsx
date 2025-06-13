import { useState, useEffect, useRef } from "react";
import { ChevronDownIcon, CheckIcon, ZapIcon, SearchIcon, EyeIcon, GlobeIcon, FileTextIcon, BrainIcon, SparklesIcon, ChevronUpIcon, StarIcon, FilterIcon, ChevronLeftIcon, KeyIcon, FlaskConical, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

// Type definition for model data from Convex
interface ModelData {
  _id: string;
  id: string;
  name: string;
  displayNameTop?: string;
  displayNameBottom?: string;
  description: string;
  provider: string;
  capabilities: string[];
  isFavorite: boolean;
  isActive: boolean;
  order: number;
  apiUrl?: string;
  contextWindow?: number;
  maxTokens?: number;
  costPer1kTokens?: number;
  subtitle?: string;
}

export const getProviderIcon = (provider: string, modelName?: string) => {
  // Check if it's a DeepSeek model regardless of hosting provider
  if (modelName && modelName.toLowerCase().includes('deepseek')) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" style={{flex: 'none', lineHeight: 1}} viewBox="0 0 24 24" className="w-4 h-4">
        <path fill="#4D6BFE" d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 0 1 .415-.287.302.302 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 0 1-.254-.078.253.253 0 0 1-.114-.358c.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"/>
      </svg>
    );
  }

  switch (provider) {
    case 'gemini':
      return (
        <svg height="1em" style={{flex: 'none', lineHeight: 1}} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
          <title>Gemini</title>
          <defs>
            <linearGradient id="lobe-icons-gemini-fill" x1="0%" x2="68.73%" y1="100%" y2="30.395%">
              <stop offset="0%" stopColor="#1C7DFF"></stop>
              <stop offset="52.021%" stopColor="#1C69FF"></stop>
              <stop offset="100%" stopColor="#F0DCD6"></stop>
            </linearGradient>
          </defs>
          <path d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12" fill="url(#lobe-icons-gemini-fill)" fillRule="nonzero"></path>
        </svg>
      );
    case 'openai':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" preserveAspectRatio="xMidYMid" viewBox="0 0 256 260" className="w-4 h-4">
          <path fill="currentColor" d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"/>
        </svg>
      );
    case 'anthropic':
      return (
        <svg fill="currentColor" fillRule="evenodd" style={{flex: 'none', lineHeight: 1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
          <title>Anthropic</title>
          <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"></path>
        </svg>
      );
    case 'deepseek':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" style={{flex: 'none', lineHeight: 1}} viewBox="0 0 24 24" className="w-4 h-4">
          <path fill="#4D6BFE" d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 0 1 .415-.287.302.302 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 0 1-.254-.078.253.253 0 0 1-.114-.358c.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"/>
        </svg>
      );
    case 'together':
      // Meta/Llama models hosted on Together.xyz - use Meta logo
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" preserveAspectRatio="xMidYMid" viewBox="0 0 256 171" className="w-4 h-4" style={{flex: 'none', lineHeight: 1}}>
          <defs>
            <linearGradient id="meta-gradient-a" x1="13.878%" x2="89.144%" y1="55.934%" y2="58.694%">
              <stop offset="0%" stopColor="#0064E1"/>
              <stop offset="40%" stopColor="#0064E1"/>
              <stop offset="83%" stopColor="#0073EE"/>
              <stop offset="100%" stopColor="#0082FB"/>
            </linearGradient>
            <linearGradient id="meta-gradient-b" x1="54.315%" x2="54.315%" y1="82.782%" y2="39.307%">
              <stop offset="0%" stopColor="#0082FB"/>
              <stop offset="100%" stopColor="#0064E0"/>
            </linearGradient>
          </defs>
          <path fill="#0081FB" d="M27.651 112.136c0 9.775 2.146 17.28 4.95 21.82 3.677 5.947 9.16 8.466 14.751 8.466 7.211 0 13.808-1.79 26.52-19.372 10.185-14.092 22.186-33.874 30.26-46.275l13.675-21.01c9.499-14.591 20.493-30.811 33.1-41.806C161.196 4.985 172.298 0 183.47 0c18.758 0 36.625 10.87 50.3 31.257C248.735 53.584 256 81.707 256 110.729c0 17.253-3.4 29.93-9.187 39.946-5.591 9.686-16.488 19.363-34.818 19.363v-27.616c15.695 0 19.612-14.422 19.612-30.927 0-23.52-5.484-49.623-17.564-68.273-8.574-13.23-19.684-21.313-31.907-21.313-13.22 0-23.859 9.97-35.815 27.75-6.356 9.445-12.882 20.956-20.208 33.944l-8.066 14.289c-16.203 28.728-20.307 35.271-28.408 46.07-14.2 18.91-26.324 26.076-42.287 26.076-18.935 0-30.91-8.2-38.325-20.556C2.973 139.413 0 126.202 0 111.148l27.651.988Z"/>
          <path fill="url(#meta-gradient-a)" d="M21.802 33.206C34.48 13.666 52.774 0 73.757 0 85.91 0 97.99 3.597 110.605 13.897c13.798 11.261 28.505 29.805 46.853 60.368l6.58 10.967c15.881 26.459 24.917 40.07 30.205 46.49 6.802 8.243 11.565 10.7 17.752 10.7 15.695 0 19.612-14.422 19.612-30.927l24.393-.766c0 17.253-3.4 29.93-9.187 39.946-5.591 9.686-16.488 19.363-34.818 19.363-11.395 0-21.49-2.475-32.654-13.007-8.582-8.083-18.615-22.443-26.334-35.352l-22.96-38.352C118.528 64.08 107.96 49.73 101.845 43.23c-6.578-6.988-15.036-15.428-28.532-15.428-10.923 0-20.2 7.666-27.963 19.39L21.802 33.206Z"/>
          <path fill="url(#meta-gradient-b)" d="M73.312 27.802c-10.923 0-20.2 7.666-27.963 19.39-10.976 16.568-17.698 41.245-17.698 64.944 0 9.775 2.146 17.28 4.95 21.82L9.027 149.482C2.973 139.413 0 126.202 0 111.148 0 83.772 7.514 55.24 21.802 33.206 34.48 13.666 52.774 0 73.757 0l-.445 27.802Z"/>
        </svg>
      );
    case 'fireworks':
      // TODO: Add Fireworks AI logo - but for now, check if it's a DeepSeek model
      return <span className="text-orange-500 font-bold text-xs">🔥</span>;
    case 'openrouter':
      // TODO: Add OpenRouter logo - but for now, check if it's a DeepSeek model  
      return <span className="text-purple-500 font-bold text-xs">🔀</span>;
    case 'xai':
      return (
        <svg width="1em" height="1em" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" style={{flex: 'none', lineHeight: 1}}>
          <path d="M395.479 633.828L735.91 381.105C752.599 368.715 776.454 373.548 784.406 392.792C826.26 494.285 807.561 616.253 724.288 699.996C641.016 783.739 525.151 802.104 419.247 760.277L303.556 814.143C469.49 928.202 670.987 899.995 796.901 773.282C896.776 672.843 927.708 535.937 898.785 412.476L899.047 412.739C857.105 231.37 909.358 158.874 1016.4 10.6326C1018.93 7.11771 1021.47 3.60279 1024 0L883.144 141.651V141.212L395.392 633.916" fill="currentColor"/>
          <path d="M325.226 695.251C206.128 580.84 226.662 403.776 328.285 301.668C403.431 226.097 526.549 195.254 634.026 240.596L749.454 186.994C728.657 171.88 702.007 155.623 671.424 144.2C533.19 86.9942 367.693 115.465 255.323 228.382C147.234 337.081 113.244 504.215 171.613 646.833C215.216 753.423 143.739 828.818 71.7385 904.916C46.2237 931.893 20.6216 958.87 0 987.429L325.139 695.339" fill="currentColor"/>
        </svg>
      );
    case 'alibaba':
      return (
        <svg fill="currentColor" fillRule="evenodd" height="1em" style={{flex: 'none', lineHeight: 1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
          <title>Qwen</title>
          <path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z"/>
        </svg>
      );
    default:
      return '•';
  }
};

const getCapabilityIcon = (capability: string) => {
  switch (capability) {
    case 'vision':
      return <EyeIcon className="h-4 w-4" />;
    case 'web':
      return <GlobeIcon className="h-4 w-4" />;
    case 'documents':
      return <FileTextIcon className="h-4 w-4" />;
    case 'reasoning':
      return <BrainIcon className="h-4 w-4" />;
    case 'experimental':
      return <FlaskConical className="h-4 w-4" />;
    case 'image-generation':
      return <Palette className="h-4 w-4" />;
    default:
      return <SparklesIcon className="h-4 w-4" />;
  }
};

const getCapabilityColor = (capability: string) => {
  switch (capability) {
    case 'vision':
      return 'bg-green-100 text-green-600';
    case 'web':
      return 'bg-blue-100 text-blue-600';
    case 'documents':
      return 'bg-purple-100 text-purple-600';
    case 'reasoning':
      return 'bg-orange-100 text-orange-600';
    case 'experimental':
      return 'bg-yellow-100 text-yellow-600';
    case 'image-generation':
      return 'bg-pink-100 text-pink-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterModalRef = useRef<HTMLDivElement>(null);
  
  // Fetch models from database
  const { data: favoriteModels = [] } = trpc.models.getFavoriteModels.useQuery();
  const { data: otherModels = [] } = trpc.models.getOtherModels.useQuery();
  
  const allModels = [...favoriteModels, ...otherModels];
  
  const selectedModelData = allModels.find(m => m.id === selectedModel) || allModels[0];
  
  // Fetch API keys from database
  const { data: apiKeys } = trpc.apiKeys.getApiKeys.useQuery();
  
  // Function to check if a model has an API key
  const hasApiKey = (provider: string) => {
    if (!apiKeys) return false;
    const key = apiKeys[provider as keyof typeof apiKeys];
    return !!key && key.trim().length > 0;
  };
  
  // Function to check if a model is disabled (no API key)
  const isModelDisabled = (provider: string) => {
    return !hasApiKey(provider);
  };

  // Define filter categories based on the image
  const filterCategories = [
    { id: 'fast', name: 'Fast', icon: ZapIcon, color: 'bg-yellow-100 text-yellow-600' },
    { id: 'vision', name: 'Vision', icon: EyeIcon, color: 'bg-green-100 text-green-600' },
    { id: 'web', name: 'Search', icon: GlobeIcon, color: 'bg-blue-100 text-blue-600' },
    { id: 'documents', name: 'PDFs', icon: FileTextIcon, color: 'bg-purple-100 text-purple-600' },
    { id: 'reasoning', name: 'Reasoning', icon: BrainIcon, color: 'bg-orange-100 text-orange-600' },
    { id: 'experimental', name: 'Effort Control', icon: FlaskConical, color: 'bg-yellow-100 text-yellow-600' },
    { id: 'image-generation', name: 'Image Generation', icon: SparklesIcon, color: 'bg-pink-100 text-pink-600' },
  ];

  // Function to check if model matches filter criteria
  const matchesFilters = (model: ModelData) => {
    if (selectedFilters.length === 0) return true;
    
    // Special handling for "fast" filter - check if model is in favorites (typically faster models)
    if (selectedFilters.includes('fast')) {
      if (model.isFavorite) return true;
    }
    
    // Check if model has any of the selected capabilities
    return selectedFilters.some(filter => {
      if (filter === 'fast') return model.isFavorite; // Fast = favorites
      return model.capabilities.includes(filter);
    });
  };

  // Filter models based on search query and selected filters
  const filteredModels = allModels.filter((model: ModelData) => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch && matchesFilters(model);
  });

  // Show top models or all based on showAll state
  const displayedModels = showAll ? filteredModels : filteredModels.slice(0, 7);

  // Toggle filter selection
  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev => 
      prev.includes(filterId) 
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedFilters([]);
  };

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setShowAll(false);
        setShowFilters(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    // Close filter modal when clicking outside of it (but keep main dropdown open)
    const handleFilterClickOutside = (event: MouseEvent) => {
      if (filterModalRef.current && !filterModalRef.current.contains(event.target as Node)) {
        // Also check if the click was on the filter toggle button to avoid immediate reopening
        const target = event.target as Element;
        const isFilterButton = target.closest('[data-filter-toggle]');
        if (!isFilterButton) {
          setShowFilters(false);
        }
      }
    };

    if (showFilters) {
      document.addEventListener('mousedown', handleFilterClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleFilterClickOutside);
    };
  }, [showFilters]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className={`justify-start gap-2 px-2 py-1 h-auto font-normal text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ${
          isOpen ? 'bg-gray-100 text-gray-900' : ''
        }`}
      >
        <div className="flex items-center gap-1.5">
          <div className="flex-shrink-0">
            {getProviderIcon(selectedModelData?.provider || '', selectedModelData?.name)}
          </div>
          <span className="text-sm font-medium">{selectedModelData?.name}</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
          {selectedModelData?.provider}
        </span>
        {hasApiKey(selectedModelData?.provider || '') && (
          <div className="flex items-center gap-1 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-md">
            <ZapIcon className="h-3 w-3" />
            Real AI
          </div>
        )}
        <ChevronDownIcon className="h-3 w-3 ml-1" />
      </Button>

      {isOpen && (
        <div className={`absolute bottom-full left-0 z-50 mb-2 rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all duration-300 ease-in-out ${showAll ? 'w-[600px]' : 'w-[420px]'}`}>
          {/* Fixed Search Bar */}
          <div className="flex-shrink-0 p-2 border-b border-gray-100 rounded-t-2xl bg-white">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {showAll ? (
            // Grid View - Show All
            <div className="flex flex-col animate-in fade-in duration-300 overflow-hidden" style={{height: '850px'}}>
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" style={{scrollbarGutter: 'stable'}}>
                {/* Favorites Section */}
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <StarIcon className="h-4 w-4 text-yellow-500" />
                    Favorites
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {filteredModels.filter(model => model.isFavorite).length === 0 ? (
                      <div className="col-span-4 flex flex-col items-center justify-center py-8 text-center">
                        <StarIcon className="h-8 w-8 text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">No favorite models match your filters</p>
                      </div>
                    ) : (
                      filteredModels.filter(model => model.isFavorite).map((model: ModelData) => {
                        const disabled = isModelDisabled(model.provider);
                        return (
                        <button
                          type="button"
                          key={model.id}
                          onClick={() => {
                            if (!disabled) {
                              onModelChange(model.id);
                              setIsOpen(false);
                              setSearchQuery("");
                              setShowAll(false);
                            }
                          }}
                          disabled={disabled}
                          className={`relative p-3 rounded-xl border-2 transition-all min-h-[160px] ${
                            disabled 
                              ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' 
                              : selectedModel === model.id 
                                ? 'border-blue-500 bg-blue-50 hover:border-blue-200 hover:bg-blue-50' 
                                : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2 justify-between h-full">
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl text-lg font-medium">
                                {getProviderIcon(model.provider, model.name)}
                              </div>
                              <div className="text-center">
                                {model.displayNameTop && model.displayNameBottom ? (
                                  <>
                                    <div className="font-medium text-sm text-gray-900">{model.displayNameTop}</div>
                                    <div className="font-medium text-sm text-gray-900">{model.displayNameBottom}</div>
                                  </>
                                ) : (
                                  <div className="font-medium text-sm text-gray-900">{model.name}</div>
                                )}
                                {model.subtitle && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {model.subtitle}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-center gap-1 min-h-[32px] items-center">
                              {model.capabilities.filter(cap => cap !== 'experimental').slice(0, 4).map((capability: string, index: number) => (
                                <div
                                  key={index}
                                  className={`p-1 rounded-md ${getCapabilityColor(capability)}`}
                                  title={capability}
                                >
                                  {getCapabilityIcon(capability)}
                                </div>
                              ))}
                            </div>
                          </div>
                          {model.capabilities.includes('experimental') && (
                            <div className="absolute top-2 left-2" title="Experimental">
                              <FlaskConical className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          {selectedModel === model.id && (
                            <CheckIcon className="absolute top-2 right-2 h-4 w-4 text-blue-500" />
                          )}
                          {(model.provider === 'anthropic' || model.provider === 'openai') && !disabled && (
                            <div className="absolute top-2 right-2">
                                                          <span className="bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded flex items-center">
                                <ZapIcon className="h-3 w-3" />
                              </span>
                            </div>
                          )}
                          {disabled && (
                            <div className="absolute top-2 right-2">
                              <KeyIcon className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                        </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Others Section */}
                <div className="p-4 border-t border-gray-100">
                  <h3 className="font-medium text-gray-900 mb-4">Others</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {filteredModels.filter(model => !model.isFavorite).length === 0 ? (
                      <div className="col-span-4 flex flex-col items-center justify-center py-8 text-center">
                        <FilterIcon className="h-8 w-8 text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">No other models match your filters</p>
                      </div>
                    ) : (
                      filteredModels.filter(model => !model.isFavorite).map((model: ModelData) => {
                        const disabled = isModelDisabled(model.provider);
                        return (
                        <button
                          type="button"
                          key={model.id}
                          onClick={() => {
                            if (!disabled) {
                              onModelChange(model.id);
                              setIsOpen(false);
                              setSearchQuery("");
                              setShowAll(false);
                            }
                          }}
                          disabled={disabled}
                          className={`relative p-3 rounded-xl border-2 transition-all min-h-[160px] ${
                            disabled 
                              ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' 
                              : selectedModel === model.id 
                                ? 'border-blue-500 bg-blue-50 hover:border-blue-200 hover:bg-blue-50' 
                                : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-2 justify-between h-full">
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl text-lg font-medium">
                                {getProviderIcon(model.provider, model.name)}
                              </div>
                              <div className="text-center">
                                {model.displayNameTop && model.displayNameBottom ? (
                                  <>
                                    <div className="font-medium text-sm text-gray-900">{model.displayNameTop}</div>
                                    <div className="font-medium text-sm text-gray-900">{model.displayNameBottom}</div>
                                  </>
                                ) : (
                                  <div className="font-medium text-sm text-gray-900">{model.name}</div>
                                )}
                                {model.subtitle && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {model.subtitle}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-center gap-1 min-h-[32px] items-center">
                              {model.capabilities.filter(cap => cap !== 'experimental').slice(0, 4).map((capability: string, index: number) => (
                                <div
                                  key={index}
                                  className={`p-1 rounded-md ${getCapabilityColor(capability)}`}
                                  title={capability}
                                >
                                  {getCapabilityIcon(capability)}
                                </div>
                              ))}
                            </div>
                          </div>
                          {model.capabilities.includes('experimental') && (
                            <div className="absolute top-2 left-2" title="Experimental">
                              <FlaskConical className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          {selectedModel === model.id && (
                            <CheckIcon className="absolute top-2 right-2 h-4 w-4 text-blue-500" />
                          )}
                          {disabled && (
                            <div className="absolute top-2 right-2">
                              <KeyIcon className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                        </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Bar */}
              <div className="flex-shrink-0 bg-white border-t border-gray-100 p-2 rounded-b-2xl">
                <div className="flex items-center justify-between">
                  <button 
                    type="button"
                    onClick={() => setShowAll(false)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <StarIcon className="h-4 w-4" />
                    Favorites
                  </button>
                  <div className="relative">
                    <button 
                      type="button"
                      data-filter-toggle
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        showFilters || selectedFilters.length > 0 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <FilterIcon className="h-4 w-4" />
                      {selectedFilters.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                          {selectedFilters.length}
                        </span>
                      )}
                    </button>
                    
                    {showFilters && (
                      <div ref={filterModalRef} className="fixed bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-48 z-[100] animate-in fade-in duration-300"
                           style={{
                             bottom: '60px',
                             left: showAll ? '630px' : '450px',
                             transition: 'left 300ms ease-in-out'
                           }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-medium text-gray-900">Filters</h3>
                          {selectedFilters.length > 0 && (
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {filterCategories.map((category) => {
                            const Icon = category.icon;
                            const isSelected = selectedFilters.includes(category.id);
                            return (
                              <button
                                type="button"
                                key={category.id}
                                onClick={() => toggleFilter(category.id)}
                                className={`flex items-center gap-2 p-1.5 rounded text-left transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-50 border border-blue-200' 
                                    : 'hover:bg-gray-50 border border-transparent'
                                }`}
                              >
                                <div className={`p-1 rounded ${category.color}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {category.name}
                                </span>
                                {isSelected && (
                                  <CheckIcon className="h-4 w-4 text-blue-600 ml-auto" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // List View - Default
            <div className="flex flex-col animate-in fade-in duration-300 overflow-hidden" style={{height: '450px'}}>
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent" style={{scrollbarGutter: 'stable'}}>
                <div className="p-2">
                  {displayedModels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FilterIcon className="h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500 mb-1">No models match your filters</p>
                                              <button
                          type="button"
                          onClick={clearFilters}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Clear filters
                        </button>
                    </div>
                  ) : (
                    displayedModels.map((model: ModelData) => {
                      const disabled = isModelDisabled(model.provider);
                      return (
                      <button
                        type="button"
                        key={model.id}
                        onClick={() => {
                          if (!disabled) {
                            onModelChange(model.id);
                            setIsOpen(false);
                            setSearchQuery("");
                            setShowAll(false);
                          }
                        }}
                        disabled={disabled}
                        className={`flex w-full items-center justify-between px-3 py-3 text-left rounded-lg transition-colors group ${
                          disabled 
                            ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="relative flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                            {getProviderIcon(model.provider, model.name)}
                            {model.capabilities.includes('experimental') && (
                              <div className="absolute -top-1 -left-1" title="Experimental">
                                <FlaskConical className="h-3 w-3 text-gray-400" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 text-sm">{model.name}</span>
                              {model.subtitle && (
                                <span className="text-xs text-gray-500">
                                  {model.subtitle}
                                </span>
                              )}  
                              {model.provider === 'openai' && model.name.includes('GPT') && (
                                <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-md flex items-center">
                                  <ZapIcon className="h-3 w-3" />
                              </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {model.capabilities.filter(cap => cap !== 'experimental').map((capability: string, index: number) => (
                              <div
                                key={index}
                                className={`p-1 rounded-md ${getCapabilityColor(capability)}`}
                                title={capability}
                              >
                                {getCapabilityIcon(capability)}
                              </div>
                            ))}
                          </div>
                        </div>

                        {selectedModel === model.id && (
                          <CheckIcon className="h-4 w-4 text-blue-500 ml-2" />
                        )}
                        
                        {disabled && (
                          <div className="flex items-center gap-1 ml-2">
                            <KeyIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                      </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Fixed Bottom Bar */}
              <div className="flex-shrink-0 bg-white border-t border-gray-100 p-2 rounded-b-2xl">
                <div className="flex items-center justify-between">
                  {!showAll && filteredModels.length > 7 ? (
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ChevronUpIcon className="h-4 w-4" />
                      Show all
                    </button>
                  ) : (
                    <div></div>
                  )}
                  <div className="relative">
                    <button 
                      type="button"
                      data-filter-toggle
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        showFilters || selectedFilters.length > 0 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <FilterIcon className="h-4 w-4" />
                      {selectedFilters.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                          {selectedFilters.length}
                        </span>
                      )}
                    </button>
                    
                    {showFilters && (
                      <div ref={filterModalRef} className="fixed bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-48 z-[100] animate-in fade-in duration-300"
                           style={{
                             bottom: '60px',
                             left: showAll ? '630px' : '450px',
                             transition: 'left 300ms ease-in-out'
                           }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-medium text-gray-900">Filters</h3>
                          {selectedFilters.length > 0 && (
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {filterCategories.map((category) => {
                            const Icon = category.icon;
                            const isSelected = selectedFilters.includes(category.id);
                            return (
                              <button type="button"
                                key={category.id}
                                onClick={() => toggleFilter(category.id)}
                                className={`flex items-center gap-2 p-1.5 rounded text-left transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-50 border border-blue-200' 
                                    : 'hover:bg-gray-50 border border-transparent'
                                }`}
                              >
                                <div className={`p-1 rounded ${category.color}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {category.name}
                                </span>
                                {isSelected && (
                                  <CheckIcon className="h-4 w-4 text-blue-600 ml-auto" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 