import { Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';

const SOUND_MODULE = require('../assets/sounds/community-siren-alert-96052.mp3');

const VIBRATION_PATTERN = [0, 700, 300, 700, 300, 700];

let nativeSound: Audio.Sound | null = null;
let audioElement: HTMLAudioElement | null = null;
let _alarmActive = false;
let _webAudioUnlocked = false;

export function isAlarmPlaying(): boolean {
  return _alarmActive;
}

export function isWebAudioUnlocked(): boolean {
  if (Platform.OS !== 'web') return true;
  return _webAudioUnlocked;
}

export async function unlockAlertSound(): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;

  try {
    if (!audioElement) {
      audioElement = new window.Audio(SOUND_MODULE);
      audioElement.loop = true;
      audioElement.volume = 0.85;
      audioElement.preload = 'auto';
    }

    audioElement.muted = true;
    await audioElement.play();
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.muted = false;

    _webAudioUnlocked = true;
    return true;
  } catch {
    _webAudioUnlocked = false;
    return false;
  }
}

async function playNativeSound(): Promise<boolean> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
    });

    if (!nativeSound) {
      const created = await Audio.Sound.createAsync(
        SOUND_MODULE,
        {
          shouldPlay: false,
          isLooping: true,
          volume: 1,
        },
      );
      nativeSound = created.sound;
    }

    await nativeSound.setIsLoopingAsync(true);
    await nativeSound.setVolumeAsync(1);
    await nativeSound.setPositionAsync(0);
    await nativeSound.playAsync();

    Vibration.vibrate(VIBRATION_PATTERN, true);
    _alarmActive = true;
    return true;
  } catch {
    _alarmActive = false;
    return false;
  }
}

async function playWebSound(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;

  try {
    if (!audioElement) {
      audioElement = new window.Audio(SOUND_MODULE);
      audioElement.loop = true;
      audioElement.volume = 0.85;
      audioElement.preload = 'auto';
    }

    audioElement.loop = true;
    audioElement.volume = 0.85;
    audioElement.muted = false;

    if (_alarmActive && !audioElement.paused) return true;

    audioElement.currentTime = 0;
    await audioElement.play();

    _alarmActive = true;
    _webAudioUnlocked = true;
    return true;
  } catch {
    _alarmActive = false;
    return false;
  }
}

export async function playAlertSound(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return playWebSound();
  }

  return playNativeSound();
}

export async function stopAlertSound(): Promise<void> {
  _alarmActive = false;

  try {
    Vibration.cancel();
  } catch {
    // noop
  }

  if (Platform.OS === 'web') {
    if (!audioElement) return;

    try {
      audioElement.loop = false;
      audioElement.pause();
      audioElement.currentTime = 0;
    } catch {
      // noop
    }

    return;
  }

  if (!nativeSound) return;

  try {
    await nativeSound.stopAsync();
    await nativeSound.setPositionAsync(0);
  } catch {
    // noop
  }
}

export async function unloadAlertSound(): Promise<void> {
  await stopAlertSound();

  if (nativeSound) {
    try {
      await nativeSound.unloadAsync();
    } catch {
      // noop
    }
    nativeSound = null;
  }

  audioElement = null;
}