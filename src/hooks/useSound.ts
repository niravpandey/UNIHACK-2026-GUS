import { useRef, useCallback } from "react";

const sounds = {
  splash: "/audio/splash.wav",
  click: "/audio/click.wav",
  fan: "/audio/fan.wav",
} as const;

type SoundKey = keyof typeof sounds; // "splash" | "click" | "fan"

export const useSound = (soundKey: SoundKey) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumes = {
    splash: 0.4,
    click: 0.4,
    fan: 0.4,
  };

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(sounds[soundKey]);
    }
    return audioRef.current;
  }, [soundKey]);

  const playOnce = useCallback(() => {
    const audio = getAudio();
    audio.loop = false;
    audio.currentTime = 0;
    audio.volume = volumes[soundKey] || 1.0;
    audio.play();
  }, [getAudio]);

  const playLoop = useCallback(() => {
    const audio = getAudio();
    audio.loop = true;
    audio.currentTime = 0;
    audio.volume = volumes[soundKey] || 1.0;
    audio.play();
  }, [getAudio]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return { playOnce, playLoop, stop };
};