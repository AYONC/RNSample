import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  lessThan,
  multiply,
} from 'react-native-reanimated';

const HalfCircle = ({ color, radius = 100 }: any) => {
  return (
    <View
      style={{
        width: radius * 2,
        height: radius,
        overflow: 'hidden',
      }}>
      <View
        style={{
          backgroundColor: color,
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
        }}
      />
    </View>
  );
};

export const transformOrigin = (
  { x, y }: { x: number; y: number },
  ...transformations: any[]
) => [
  { translateX: x },
  { translateY: y },
  ...transformations,
  { translateX: multiply(x, -1) },
  { translateY: multiply(y, -1) },
];

type Props = {
  progress: Animated.Node<number>;
  bg: string;
  fg: string;
  radius: number;
};

const PI = 3.14;

export const CircularProgressInner = ({ bg, fg, progress, radius }: Props) => {
  const theta = multiply(progress, 2 * PI);
  const opacity = lessThan(theta, PI);
  const rotate = interpolate(theta, {
    inputRange: [PI, 2 * PI],
    outputRange: [0, PI],
    extrapolate: Extrapolate.CLAMP,
  });
  return (
    <>
      <View style={{ zIndex: 1 }}>
        <HalfCircle color={fg} radius={radius} />
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            transform: transformOrigin(
              { x: 0, y: radius / 2 },
              { rotate: theta },
            ),
            opacity,
          }}>
          <HalfCircle color={bg} radius={radius} />
        </Animated.View>
      </View>
      <View style={{ transform: [{ rotate: '180deg' }] }}>
        <HalfCircle color={fg} radius={radius} />
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            transform: transformOrigin({ x: 0, y: radius / 2 }, { rotate }),
          }}>
          <HalfCircle color={bg} radius={radius} />
        </Animated.View>
      </View>
    </>
  );
};
