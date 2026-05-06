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

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined,
      });

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${extension}`, {
          type: blob.type || 'audio/webm',
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
