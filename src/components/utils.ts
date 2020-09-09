import Animated, {
  clockRunning,
  Easing,
  Value,
  not,
  cond,
  startClock,
  stopClock,
  Clock,
  block,
} from 'react-native-reanimated';

export interface TimingParams {
  clock?: Animated.Clock;
  fromValue?: Animated.Adaptable<number>;
  toValue?: Animated.Adaptable<number>;
  duration?: Animated.Adaptable<number>;
  easing?: Animated.EasingFunction;
}

export const timing = (params: TimingParams) => {
  const { clock, easing, duration, fromValue, toValue } = {
    clock: new Clock(),
    easing: Easing.linear,
    duration: 250,
    fromValue: 0,
    toValue: 1,
    ...params,
  };

  const state: Animated.TimingState = {
    finished: new Value(0),
    position: new Value(0),
    time: new Value(0),
    frameTime: new Value(0),
  };

  const config = {
    toValue: new Value(0),
    duration,
    easing,
  };

  return block([
    cond(not(clockRunning(clock)), [
      Animated.set(config.toValue, toValue),
      Animated.set(state.frameTime, 0),
    ]),
    block([
      cond(not(clockRunning(clock)), [
        Animated.set(state.finished, 0),
        Animated.set(state.time, 0),
        Animated.set(state.position, fromValue),
        startClock(clock),
      ]),
      Animated.timing(clock, state, config),
      cond(state.finished, stopClock(clock)),
      state.position,
    ]),
  ]);
};
