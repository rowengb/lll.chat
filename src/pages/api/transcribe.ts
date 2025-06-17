import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs';

// Disable default body parser to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB limit (Whisper's max)
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    
    const audioFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('📝 [Transcribe API] Processing audio file:', {
      originalFilename: audioFile.originalFilename,
      mimetype: audioFile.mimetype,
      size: audioFile.size,
    });

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Read the audio file
    const audioBuffer = fs.readFileSync(audioFile.filepath);
    
    // Create a File object for OpenAI API
    const audioFileForAPI = new File([audioBuffer], audioFile.originalFilename || 'recording.webm', {
      type: audioFile.mimetype || 'audio/webm',
    });

    // Call Whisper API
    console.log('📝 [Transcribe API] Calling Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFileForAPI,
      model: 'whisper-1',
      language: fields.language?.[0] || 'en',
      response_format: 'json',
    });

    console.log('📝 [Transcribe API] Transcription completed:', {
      text: transcription.text,
      length: transcription.text.length,
    });

    // Clean up temporary file
    fs.unlinkSync(audioFile.filepath);

    // Return the transcription
    res.status(200).json({
      text: transcription.text,
      language: fields.language?.[0] || 'en',
    });

  } catch (error) {
    console.error('📝 [Transcribe API] Error:', error);
    
    // Clean up any temporary files
    try {
      const form = formidable();
      const [, files] = await form.parse(req);
      const audioFile = Array.isArray(files.file) ? files.file[0] : files.file;
      if (audioFile?.filepath) {
        fs.unlinkSync(audioFile.filepath);
      }
    } catch (cleanupError) {
      console.error('📝 [Transcribe API] Cleanup error:', cleanupError);
    }

    if (error instanceof Error) {
      res.status(500).json({ 
        error: 'Transcription failed', 
        details: error.message 
      });
    } else {
      res.status(500).json({ error: 'Unknown transcription error' });
    }
  }
} 