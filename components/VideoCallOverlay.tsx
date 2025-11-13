import React from 'react';
import AIAvatar from './AIAvatar';
import { MicrophoneIcon, MicrophoneOffIcon, VideoOffIcon, VolumeUpIcon, VolumeOffIcon } from './Icons';
import type { UserProfile } from '../types';
import { tr } from '../locales/tr';

interface VideoCallOverlayProps {
  isAiSpeaking: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  currentUserProfile: UserProfile | null;
  isMuted: boolean;
  aiVolume: number;
  userMicLevel: number;
  liveUserTranscript: string;
  liveAiTranscript: string;
  toggleMute: () => void;
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  stopVideoCall: () => void;
}

const VideoCallOverlay: React.FC<VideoCallOverlayProps> = ({
  isAiSpeaking,
  videoRef,
  canvasRef,
  currentUserProfile,
  isMuted,
  aiVolume,
  userMicLevel,
  liveUserTranscript,
  liveAiTranscript,
  toggleMute,
  handleVolumeChange,
  stopVideoCall,
}) => {
  const userVideoStyle = {
    boxShadow: `0 0 ${userMicLevel * 15}px 5px rgba(239, 68, 68, ${userMicLevel * 0.7})`,
    transition: 'box-shadow 0.1s ease-out',
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row relative">
      <div className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden">
        {/* Main AI Avatar View */}
        <AIAvatar isSpeaking={isAiSpeaking} />
        
        {/* Live Transcription Overlay */}
        <div className="absolute bottom-28 md:bottom-24 left-0 right-0 p-6 max-h-48 overflow-y-auto pointer-events-none">
            <div className="max-w-4xl mx-auto space-y-2">
                {liveAiTranscript && (
                    <p className="text-white text-lg md:text-xl font-medium drop-shadow-lg animate-[fade-in_0.3s_ease-out]">
                        <span className="text-red-400 font-bold">{tr.videoCall.participantAI}: </span>{liveAiTranscript}
                    </p>
                )}
                {liveUserTranscript && (
                     <p className="text-white text-lg md:text-xl font-medium drop-shadow-lg text-right animate-[fade-in_0.3s_ease-out]">
                        <span className="text-blue-400 font-bold">{tr.videoCall.participantYou}: </span>{liveUserTranscript}
                    </p>
                )}
            </div>
        </div>
      </div>
      
      {/* User Video Feed */}
      <div 
        className="relative w-full md:w-1/4 max-w-sm md:max-w-none mx-auto md:mx-0 aspect-video md:aspect-auto border-t-2 md:border-t-0 md:border-l-2 border-red-900"
        style={userVideoStyle}
      >
        <div className="absolute top-2 left-2 z-10 bg-black/50 px-2 py-1 rounded-md text-sm">{currentUserProfile?.name || tr.videoCall.participantYou}</div>
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover"></video>
      </div>

      <canvas ref={canvasRef} className="hidden"></canvas>

      {/* Call Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-sm p-3 rounded-full shadow-lg border border-gray-800">
        <button onClick={toggleMute} title={isMuted ? tr.videoCall.unmuteShortcut : tr.videoCall.muteShortcut} className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-600' : 'bg-gray-700'} hover:bg-gray-600`}>
          {isMuted ? <MicrophoneOffIcon className="w-6 h-6"/> : <MicrophoneIcon className="w-6 h-6"/>}
        </button>
        <div className="flex items-center gap-2">
          {aiVolume > 0 ? <VolumeUpIcon className="w-6 h-6 text-gray-300"/> : <VolumeOffIcon className="w-6 h-6 text-gray-500"/>}
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={aiVolume}
            onChange={handleVolumeChange}
            className="w-24"
            aria-label={tr.videoCall.aiVolume}
          />
        </div>
        <button onClick={stopVideoCall} title={tr.videoCall.endShortcut} className="p-3 rounded-full bg-red-800 hover:bg-red-700 transition-colors">
          <VideoOffIcon className="w-6 h-6"/>
        </button>
      </div>
    </div>
  );
};

export default VideoCallOverlay;
