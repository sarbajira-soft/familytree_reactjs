import React, { useRef, useState } from 'react';
import { FiMic, FiStopCircle } from 'react-icons/fi';

const VoiceRecorder = ({
  onRecorded,
  disabled,
  className = '',
  iconSize = 20,
  title,
}) => {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }

    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];

    return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
  };

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleToggleRecording = async () => {
    if (disabled) return;

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }

    if (
      typeof window === 'undefined' ||
      !navigator?.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      window.alert('Voice recording is not supported on this device. You can still attach an audio file.');
      return;
    }

    try {
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const supportedMimeType = getSupportedMimeType();
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const resolvedMimeType = String(
          recorder.mimeType || chunksRef.current?.[0]?.type || 'audio/webm',
        ).toLowerCase();
        const blob = new Blob(chunksRef.current, {
          type: resolvedMimeType,
        });
        const extension = resolvedMimeType.includes('mp4')
          ? 'mp4'
          : resolvedMimeType.includes('ogg')
            ? 'ogg'
            : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${extension}`, {
          type: resolvedMimeType,
        });
        onRecorded?.(file);
        setIsRecording(false);
        stopTracks();
      };

      recorder.onerror = () => {
        setIsRecording(false);
        stopTracks();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.warn('Voice recording failed:', error);
      stopTracks();
    }
  };

  return (
    <button
      className={className || 'chat-input-attach'}
      title={title || (isRecording ? 'Stop recording' : 'Record voice note')}
      type="button"
      disabled={disabled}
      onClick={handleToggleRecording}
      style={isRecording ? { color: '#dc2626' } : undefined}
    >
      {isRecording ? <FiStopCircle size={iconSize} /> : <FiMic size={iconSize} />}
    </button>
  );
};

export default React.memo(VoiceRecorder);
