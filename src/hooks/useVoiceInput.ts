import { useState, useCallback } from 'react';

export const useVoiceInput = (onTranscript: (text: string) => void) => {
  const [accumulatedTranscript, setAccumulatedTranscript] = useState('');

  const handleTranscript = useCallback((newText: string) => {
    // Clean up the transcript
    const cleanText = newText.trim();
    if (!cleanText) return;

    // Add proper spacing and capitalization
    const formattedText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    
    // Accumulate the transcript
    setAccumulatedTranscript(prev => {
      const combined = prev ? `${prev} ${formattedText}` : formattedText;
      onTranscript(combined);
      return combined;
    });
  }, [onTranscript]);

  const clearTranscript = useCallback(() => {
    setAccumulatedTranscript('');
  }, []);

  const appendToInput = useCallback((currentInput: string, newTranscript: string) => {
    const cleanTranscript = newTranscript.trim();
    if (!cleanTranscript) return currentInput;

    // Add proper spacing between existing input and new transcript
    if (currentInput.trim()) {
      return `${currentInput.trim()} ${cleanTranscript}`;
    }
    return cleanTranscript;
  }, []);

  return {
    accumulatedTranscript,
    handleTranscript,
    clearTranscript,
    appendToInput
  };
}; 