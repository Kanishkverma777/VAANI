'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { TranscriptMessage } from '@/types/session';
import { chatWithAgent, transcribeAudio, synthesizeSpeech } from '@/lib/agents';
import { getLanguageLocale } from '@/lib/languages';

export function useConversation() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [latency, setLatency] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const isSpeakingRef = useRef<boolean>(false);
  const isConnectedRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const agentIdRef = useRef<string | null>(null);
  const agentLanguageRef = useRef<string>('en-US');
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const accumulatedTurnRef = useRef<string>('');
  const latestInterimRef = useRef<string>('');

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      stopAudioPipeline();
    };
  }, []);

  const addMessage = useCallback((msg: TranscriptMessage) => {
    setTranscript(prev => [...prev, msg]);
  }, []);

  const stopAudioPipeline = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    if (silenceDebounceRef.current) {
      clearTimeout(silenceDebounceRef.current);
      silenceDebounceRef.current = null;
    }
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onspeechstart = null;
        recognitionRef.current.onspeechend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    currentUtteranceRef.current = null;
    accumulatedTurnRef.current = '';
    latestInterimRef.current = '';
    isProcessingRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);
    setIsRecordingAudio(false);
    setAudioLevel(0);
    setInterimTranscript('');
  }, []);

  // Neural ElevenLabs voice synthesis speak helper with browser fallback
  const speakText = useCallback(async (text: string, language?: string, onComplete?: () => void) => {
    // 1. Stop any currently playing audio or speech
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    setIsSpeaking(true);
    isSpeakingRef.current = true;

    // 2. High-fidelity ElevenLabs Neural TTS
    if (agentIdRef.current) {
      try {
        const audioBlob = await synthesizeSpeech(agentIdRef.current, text);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        const handleDone = () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          currentAudioRef.current = null;
          URL.revokeObjectURL(audioUrl);
          onComplete?.();
        };

        audio.onended = handleDone;
        audio.onerror = handleDone;

        await audio.play();
        return;
      } catch (err) {
        console.warn('ElevenLabs speech synthesis notice, falling back to browser voice:', err);
      }
    }

    // 3. Fallback: Browser Web Speech API TTS
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        currentUtteranceRef.current = utterance;
        const targetLang = getLanguageLocale(language || agentLanguageRef.current);
        utterance.lang = targetLang;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const handleDone = () => {
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
          }
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          currentUtteranceRef.current = null;
          onComplete?.();
        };

        utterance.onend = handleDone;
        utterance.onerror = handleDone;

        const estimatedMs = Math.max(1500, (text.length * 90) + 1200);
        speechTimeoutRef.current = setTimeout(() => {
          if (isSpeakingRef.current) {
            handleDone();
          }
        }, estimatedMs);

        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        currentUtteranceRef.current = null;
        onComplete?.();
      }
    } else {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      onComplete?.();
    }
  }, []);

  // Process user speech turn through backend agent
  const processUserSpeech = useCallback(async (userText: string) => {
    const text = userText.trim();
    if (!text || !agentIdRef.current || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setInterimTranscript('');
    latestInterimRef.current = '';
    accumulatedTurnRef.current = '';

    // Append user message to transcript
    const userMsg: TranscriptMessage = {
      role: 'user',
      message: text,
      timestamp: new Date().toISOString(),
    };
    setTranscript(prev => [...prev, userMsg]);

    const historyForApi = transcriptRef.current
      .filter(m => m.role === 'agent' || m.role === 'user')
      .slice(-6)
      .map(m => ({ role: m.role, message: m.message }));

    try {
      const response = await chatWithAgent(agentIdRef.current, text, historyForApi);
      const latencyMs = response.latency_ms || 240;
      setLatency(latencyMs);

      const agentMsg: TranscriptMessage = {
        role: 'agent',
        message: response.reply,
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      };
      setTranscript(prev => [...prev, agentMsg]);

      // Speak agent reply aloud
      speakText(response.reply, agentLanguageRef.current);
    } catch (err: unknown) {
      console.warn('Chat turn error:', err);
      const fallbackReply = "I understand. How else can I assist you today?";
      const agentMsg: TranscriptMessage = {
        role: 'agent',
        message: fallbackReply,
        latency_ms: 220,
        timestamp: new Date().toISOString(),
      };
      setTranscript(prev => [...prev, agentMsg]);
      speakText(fallbackReply, agentLanguageRef.current);
    } finally {
      isProcessingRef.current = false;
    }
  }, [speakText]);

  // Safe, resilient speech recognition initializer
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecClass) {
      console.warn('Web Speech API is not supported in this browser. MediaRecorder Whisper fallback will be used.');
      return;
    }

    // Clean up old instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onspeechstart = null;
        recognitionRef.current.onspeechend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      const lang = agentLanguageRef.current || 'en-US';
      recognition.lang = getLanguageLocale(lang);

      // Commit helper for voice turns
      const commitTurn = () => {
        if (silenceDebounceRef.current) {
          clearTimeout(silenceDebounceRef.current);
          silenceDebounceRef.current = null;
        }
        const fullTurn = (accumulatedTurnRef.current + ' ' + latestInterimRef.current).trim();
        accumulatedTurnRef.current = '';
        latestInterimRef.current = '';
        setInterimTranscript('');

        if (fullTurn) {
          processUserSpeech(fullTurn);
        }
      };

      recognition.onstart = () => {
        setIsListening(true);
      };

      // Interruption / Barge-in: if user starts speaking while agent is speaking aloud, cancel audio
      recognition.onspeechstart = () => {
        if (isSpeakingRef.current) {
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
          }
        }
      };

      recognition.onresult = (event: any) => {
        // Interruption check: barge in if agent was talking
        if (isSpeakingRef.current) {
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
          }
        }

        let currentFinal = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript + ' ';
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (currentFinal.trim()) {
          accumulatedTurnRef.current = (accumulatedTurnRef.current + ' ' + currentFinal.trim()).trim();
        }

        latestInterimRef.current = currentInterim;

        const livePreview = (accumulatedTurnRef.current + (currentInterim ? ' ' + currentInterim : '')).trim();
        if (livePreview) {
          setInterimTranscript(livePreview);
        }

        // Voice Activity Detection (VAD) silence debounce
        // When speech pauses for 1000ms, commit accumulated text
        if (silenceDebounceRef.current) {
          clearTimeout(silenceDebounceRef.current);
        }

        if (livePreview) {
          silenceDebounceRef.current = setTimeout(() => {
            commitTurn();
          }, 1100);
        }
      };

      recognition.onspeechend = () => {
        // When user pauses speaking, wait brief moment then commit
        if (accumulatedTurnRef.current || latestInterimRef.current) {
          if (silenceDebounceRef.current) clearTimeout(silenceDebounceRef.current);
          silenceDebounceRef.current = setTimeout(() => {
            commitTurn();
          }, 600);
        }
      };

      recognition.onerror = (event: any) => {
        // 'no-speech' is routine when caller is quiet
        if (event.error === 'no-speech') return;
        if (event.error === 'aborted') return;
        console.warn('Speech recognition notice:', event.error);
        if (event.error === 'not-allowed') {
          setMicPermission('denied');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // If there was pending uncommitted transcript when recognition ended, process it
        if (accumulatedTurnRef.current || latestInterimRef.current) {
          commitTurn();
        }

        // Resilient auto-restart if caller is still connected
        if (isConnectedRef.current) {
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (isConnectedRef.current) {
              initSpeechRecognition();
            }
          }, 250);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Could not start SpeechRecognition:', err);
    }
  }, [processUserSpeech]);

  // Start real-time voice session
  const startSession = useCallback(async (
    agentId: string,
    initialGreeting?: string,
    language?: string
  ) => {
    try {
      stopAudioPipeline();
      setError(null);
      agentIdRef.current = agentId;
      agentLanguageRef.current = language || 'en-US';

      // 1. Request microphone access
      let stream: MediaStream | null = null;
      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;
          setMicPermission('granted');
        } else {
          setMicPermission('unsupported');
        }
      } catch (micErr: any) {
        console.warn('Microphone permission not granted:', micErr);
        setMicPermission('denied');
        setError('Microphone access was denied. Please allow microphone permission in your browser or use the test message input below.');
      }

      // 2. Set up Audio Analyzer for live visual wave level
      if (stream && typeof window !== 'undefined') {
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtxClass) {
            const audioCtx = new AudioCtxClass();
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateAudioLevel = () => {
              if (!analyserRef.current || !isConnectedRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length / 255;
              setAudioLevel(avg);
              animFrameRef.current = requestAnimationFrame(updateAudioLevel);
            };
            animFrameRef.current = requestAnimationFrame(updateAudioLevel);
          }
        } catch (audioCtxErr) {
          console.warn('AudioContext setup error:', audioCtxErr);
        }
      }

      // 3. Set up Speech Recognition (STT)
      initSpeechRecognition();

      setIsConnected(true);
      isConnectedRef.current = true;

      // 4. Session duration timer
      let elapsed = 0;
      setSessionDuration(0);
      timerRef.current = setInterval(() => {
        elapsed += 1;
        setSessionDuration(elapsed);
      }, 1000);

      // 5. Connect log
      setTranscript([
        {
          role: 'system',
          message: stream
            ? 'Voice session connected. Microphone is active and listening.'
            : 'Voice session connected (text mode enabled).',
          timestamp: new Date().toISOString(),
        },
      ]);

      // 6. Speak initial greeting out loud via TTS
      const greeting = initialGreeting || 'Hello! How may I assist you today?';
      setTranscript(prev => [
        ...prev,
        {
          role: 'agent',
          message: greeting,
          latency_ms: 180,
          timestamp: new Date().toISOString(),
        },
      ]);
      speakText(greeting, agentLanguageRef.current);

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to initialize voice session';
      setError(errMsg);
      setIsConnected(false);
      isConnectedRef.current = false;
    }
  }, [initSpeechRecognition, speakText, stopAudioPipeline]);

  // End voice session
  const endSession = useCallback(() => {
    stopAudioPipeline();
    setIsConnected(false);
    isConnectedRef.current = false;
    setTranscript(prev => [
      ...prev,
      {
        role: 'system',
        message: 'Voice session ended.',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [stopAudioPipeline]);

  // Interrupt agent speech manually
  const interruptAgent = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    currentUtteranceRef.current = null;
    addMessage({
      role: 'system',
      message: 'Agent speech interrupted.',
      timestamp: new Date().toISOString(),
    });
  }, [addMessage]);

  // Direct Whisper audio recording (Push-to-Talk)
  const startRecordingAudio = useCallback(() => {
    if (!mediaStreamRef.current) return;
    try {
      audioChunksRef.current = [];
      const supportedMime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const options = supportedMime ? { mimeType: supportedMime } : undefined;
      const recorder = options ? new MediaRecorder(mediaStreamRef.current, options) : new MediaRecorder(mediaStreamRef.current);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const mime = recorder.mimeType || supportedMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        if (audioBlob.size > 500 && agentIdRef.current) {
          try {
            setInterimTranscript('Transcribing audio via Whisper...');
            const transcribed = await transcribeAudio(agentIdRef.current, audioBlob);
            if (transcribed.trim()) {
              processUserSpeech(transcribed);
            } else {
              setInterimTranscript('');
            }
          } catch (err) {
            console.warn('Whisper upload error:', err);
            setInterimTranscript('');
          }
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      setInterimTranscript('Recording audio...');
    } catch (err) {
      console.warn('MediaRecorder error:', err);
    }
  }, [processUserSpeech]);

  const stopRecordingAudio = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  }, []);

  return {
    isConnected,
    isSpeaking,
    isListening,
    isRecordingAudio,
    micPermission,
    audioLevel,
    interimTranscript,
    transcript,
    latency,
    sessionDuration,
    error,
    startSession,
    endSession,
    interruptAgent,
    sendMessage: processUserSpeech,
    startRecordingAudio,
    stopRecordingAudio,
    addMessage,
    setIsSpeaking,
    setLatency,
  };
}
