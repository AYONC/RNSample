import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { Animated } from 'react-native';

export const usePausableTimer = (onTiming: any, duration: number = 3000) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  const handleStop = useCallback(() => {
    if (timeoutRef?.current !== null) {
      timeoutRef?.current.stop();
    }
  }, []);

  const handleStart = useCallback(() => {
    timeoutRef?.current?.start((done: any) => {
      if (mounted) {
        onTiming(done);
      }
    });
  }, [timeoutRef, onTiming, mounted]);

  useEffect(() => {
    handleStart();
  }, [handleStart]);

  useEffect(() => {
    timeoutRef.current = Animated.timing(slideAnim, {
      toValue: 0,
      duration,
      useNativeDriver: true,
    });
  }, [slideAnim, onTiming, duration]);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
    };
  }, []);

  return [handleStop, handleStart];
};
