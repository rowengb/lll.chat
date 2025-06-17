import React, { useState, useRef, useEffect } from 'react';
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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check browser support on mount
  useEffect(() => {
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    console.log('🎤 [VoiceInput] MediaRecorder API available:', supported);
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

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
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
      console.log('🎤 [VoiceInput] Requesting microphone permission...');
      
      // Set recording state immediately to update UI
      setIsRecording(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      console.log('🎤 [VoiceInput] Microphone permission granted, starting recording...');
      
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
        console.log('🎤 [VoiceInput] Recording stopped, processing...');
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
      console.log('🎤 [VoiceInput] Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudioWithWhisper = async () => {
    setIsProcessing(true);
    
    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: audioChunksRef.current[0]?.type || 'audio/webm' 
      });
      
      console.log('🎤 [VoiceInput] Audio blob created:', audioBlob.size, 'bytes');
      
      // Convert to file for upload
      const audioFile = new File([audioBlob], 'recording.webm', { 
        type: audioBlob.type 
      });
      
      // Create FormData for API call
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en'); // You can make this configurable
      
      console.log('🎤 [VoiceInput] Sending to Whisper API...');
      
      // Call our API endpoint
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('🎤 [VoiceInput] Whisper response:', result);
      
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

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  console.log('🎤 [VoiceInput] Rendering. Supported:', isSupported, 'Recording:', isRecording, 'Processing:', isProcessing);

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
    return (
      <div className={`relative ${className}`}>
        <Button
          type="button"
          variant="ghost"
          onClick={toggleRecording}
          disabled={disabled || isProcessing}
          className={`group h-10 w-10 shadow-sm transition-all mobile-button ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
              : isProcessing
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-foreground/5 hover:bg-foreground/10 text-foreground border border-foreground/15 dark:border-gray-800'
          }`}
          style={{ 
            borderRadius: '10px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}
          size="sm"
          title={
            isProcessing ? 'Processing with Whisper...' :
            isRecording ? `Recording... ${formatTime(recordingTime)}` : 'Start voice recording'
          }
        >
          {isProcessing ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : isRecording ? (
            <>
              {/* Timer - visible by default */}
              <div className="flex flex-col items-center justify-center text-xs font-mono text-white group-hover:opacity-0 transition-opacity duration-200 ease-in-out">
                <div className="text-[10px] leading-none text-white">{formatTime(recordingTime)}</div>
              </div>
              {/* Stop icon - visible on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                <Square className="h-6 w-6 fill-current text-white" />
              </div>
            </>
          ) : (
            <MicIcon className="h-6 w-6" />
          )}
        </Button>
        
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