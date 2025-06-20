import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { MicIcon, MicOffIcon, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'circular' | 'compact';
  showTranscriptAboveTextarea?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  disabled = false,
  className = "",
  variant = 'default',
  showTranscriptAboveTextarea = false,
  textareaRef
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [textareaPosition, setTextareaPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Check browser support on mount
  useEffect(() => {
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setIsSupported(supported);
  }, []);

  // Update textarea position when recording starts
  useEffect(() => {
    if (isRecording && textareaRef?.current && showTranscriptAboveTextarea) {
      const updatePosition = () => {
        const rect = textareaRef.current!.getBoundingClientRect();
        setTextareaPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      };
      
      updatePosition();
      
      const handleUpdate = () => updatePosition();
      window.addEventListener('scroll', handleUpdate);
      window.addEventListener('resize', handleUpdate);
      
      return () => {
        window.removeEventListener('scroll', handleUpdate);
        window.removeEventListener('resize', handleUpdate);
      };
    } else {
      setTextareaPosition(null);
    }
  }, [isRecording, textareaRef, showTranscriptAboveTextarea]);

  // Simple recording timer - let React handle everything
  useEffect(() => {
    if (isRecording) {
      let startTime = Date.now();
      
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);
      };
      
      // Set up interval timer
      recordingIntervalRef.current = setInterval(updateTimer, 1000);
      
      // Initial update
      updateTimer();
      
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (!isSupported) {
      toast.error('Audio recording not supported in this browser.');
      return;
    }

    // Clear any previous audio chunks
    audioChunksRef.current = [];

    try {
      // Set recording state immediately with synchronous update
      flushSync(() => {
        setIsRecording(true);
        setForceUpdate(prev => prev + 1);
      });
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length > 0) {
          await processAudioWithWhisper();
        } else {
          // Reset processing state if no audio was recorded
          setIsProcessing(false);
        }
      };

      mediaRecorder.onerror = (error) => {
        console.error('🎤 [VoiceInput] MediaRecorder error:', error);
        setIsRecording(false);
        setIsProcessing(false);
        stream.getTracks().forEach(track => track.stop());
        toast.error('Recording error occurred. Please try again.');
      };

      mediaRecorder.start();
      toast.success('Recording started! Click stop when finished.');
      
    } catch (error) {
      console.error('🎤 [VoiceInput] Error starting recording:', error);
      // Reset state on error
      setIsRecording(false);
      setIsProcessing(false);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clean up direct styles when stopping
      setTimeout(() => {
        if (buttonRef.current) {
          buttonRef.current.style.backgroundColor = '';
          buttonRef.current.style.color = '';
          buttonRef.current.classList.remove('animate-pulse');
          buttonRef.current.offsetHeight; // Force reflow
        }
      }, 0);
      
      // Force re-render to ensure mobile CSS updates
      setForceUpdate(prev => prev + 1);
    }
  };

  const processAudioWithWhisper = async () => {
    setIsProcessing(true);
    
    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: audioChunksRef.current[0]?.type || 'audio/webm' 
      });
      
      // Convert to file for upload
      const audioFile = new File([audioBlob], 'recording.webm', { 
        type: audioBlob.type 
      });
      
      // Create FormData for API call
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // You can make this configurable
      
      // Call our API endpoint
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.text && result.text.trim()) {
        onTranscript(result.text.trim());
        toast.success('Transcription completed!');
      } else {
        toast.error('No speech detected in recording.');
      }
      
    } catch (error) {
      console.error('🎤 [VoiceInput] Error processing audio:', error);
      toast.error('Failed to transcribe audio. Please try again.');
    } finally {
      // Clean up state
      setIsProcessing(false);
      setIsRecording(false);
      audioChunksRef.current = [];
    }
  };

  const toggleRecording = () => {
    if (isProcessing) return; // Don't allow toggle while processing
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Mobile-specific touch handler to force immediate visual feedback
  const handleTouchStart = () => {
    if (isProcessing || isRecording) return;
    
    // Force immediate React state update
    flushSync(() => {
      setForceUpdate(prev => prev + 1);
    });
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show not supported state
  if (!isSupported) {
    if (variant === 'compact') {
      return (
        <div className={`relative ${className}`}>
          <Button
            type="button"
            variant="ghost"
            disabled={true}
            className="h-10 w-10 shadow-sm transition-all mobile-button bg-muted/50 text-muted-foreground opacity-50"
            style={{ borderRadius: '10px' }}
            size="sm"
            title="Audio recording not supported in this browser"
          >
            <MicIcon className="h-6 w-6" />
          </Button>
        </div>
      );
    }
    
    return (
      <div className={`relative ${className}`}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={true}
          className="h-7 text-muted-foreground border border-border rounded-full px-3 opacity-50"
          title="Audio recording not supported in this browser"
        >
          <MicIcon className="h-3.5 w-3.5" />
          <span className="ml-1 hidden sm:inline">Voice (Not Supported)</span>
        </Button>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    // Calculate current recording time to force fresh renders
    const currentTime = isRecording ? recordingTime : 0;
    const timeDisplay = formatTime(currentTime);
    
    // Force complete re-render by using different elements for different states
    const buttonContent = isProcessing ? (
      <div className="flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    ) : isRecording ? (
      <>
        {/* Timer - clean and visible */}
        <div className="flex flex-col items-center justify-center text-xs font-mono text-white">
          <div className="text-xs leading-none text-white font-medium">{timeDisplay}</div>
        </div>
      </>
    ) : (
      <MicIcon className="h-6 w-6" />
    );

    return (
      <div className={`relative ${className}`}>
        {isRecording || isProcessing ? (
          // Recording/Processing button - white background with red text
          <button
            ref={buttonRef}
            type="button"
            onClick={toggleRecording}
            disabled={disabled || isProcessing}
            className="group h-10 w-10 transition-colors mobile-button bg-white border border-red-200 dark:border-red-800"
            style={{ 
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}

            title={
              isProcessing ? 'Processing with Whisper...' :
              `Recording... ${formatTime(recordingTime)}`
            }
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Timer - clean and visible */}
                <div className="flex flex-col items-center justify-center text-xs font-mono text-red-500">
                  <div className="text-xs leading-none text-red-500 font-medium">{timeDisplay}</div>
                </div>
              </>
            )}
          </button>
        ) : (
          // Normal button - default styling
          <Button
            ref={buttonRef}
            type="button"
            variant="ghost"
            onClick={toggleRecording}
            onTouchStart={handleTouchStart}
            disabled={disabled}
            className="h-10 w-10 transition-all mobile-button bg-white text-gray-600 hover:text-gray-800 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 dark:bg-white/10 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/20 dark:border-white/10 dark:hover:border-white/20"
            style={{ 
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            size="sm"
            title="Start voice recording"
          >
            <MicIcon className="h-6 w-6" />
          </Button>
        )}
        
        {/* Fallback recording indicator (when not using textarea positioning) */}
        {(isRecording || isProcessing) && !showTranscriptAboveTextarea && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-background border border-border rounded-lg px-2 py-1 text-xs whitespace-nowrap z-50 shadow-lg">
            {isRecording && (
              <div className="flex items-center gap-1 text-red-500">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Recording... {formatTime(recordingTime)}
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-1 text-blue-500">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Processing...
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={`relative ${className}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggleRecording}
        disabled={disabled || isProcessing}
        className={`h-7 transition-all duration-200 rounded-full px-3 ${
          isRecording 
            ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 border border-red-200 dark:border-red-800' 
            : isProcessing
            ? 'text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-border hover:border-border/80'
        }`}
        title={
          isProcessing ? 'Processing with Whisper...' :
          isRecording ? 'Stop recording' : 'Start voice recording'
        }
      >
        {isProcessing ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin flex-shrink-0" />
            <span className="ml-1 hidden sm:inline">Processing...</span>
          </>
        ) : isRecording ? (
          <>
            <Square className="h-3.5 w-3.5 fill-current" />
            <span className="ml-1 hidden sm:inline">Stop ({formatTime(recordingTime)})</span>
          </>
        ) : (
          <>
            <MicIcon className="h-3.5 w-3.5" />
            <span className="ml-1 hidden sm:inline">Voice</span>
          </>
        )}
      </Button>
    </div>
  );
}; 