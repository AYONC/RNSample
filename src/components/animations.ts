// Get scroll interpolator's input range from an array of slide indexes
// Indexes are relative to the current active slide (index 0)
// For example, using [3, 2, 1, 0, -1] will return:
// [
//     (index - 3) * sizeRef, // active + 3
//     (index - 2) * sizeRef, // active + 2
//     (index - 1) * sizeRef, // active + 1
//     index * sizeRef, // active
//     (index + 1) * sizeRef // active - 1
// ]

import { Animated } from 'react-native';

export const getInputRangeFromIndexes = (
  range: number[],
  index: number,
  { itemWidth }: { itemWidth: number },
): number[] => {
  return range.map((rangeData) => (index - rangeData) * itemWidth);
};

export const scrollInterpolator = (
  index: number,
  carouselProps: { itemWidth: number },
): Animated.InterpolationConfigType => {
  const range = [1, 0, -1];
  const inputRange = getInputRangeFromIndexes(range, index, carouselProps);
  const outputRange = [0, 1, 0];

  return { inputRange, outputRange };
};

export const animatedStyles = (
  index: number,
  animatedValue: any,
  carouselProps: { inactiveSlideOpacity: number; inactiveSlideScale: number },
) => {
  let animatedOpacity = {};
  let animatedScale = {};

  if (carouselProps.inactiveSlideOpacity < 1) {
    animatedOpacity = {
      opacity: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [carouselProps.inactiveSlideOpacity, 1],
      }),
    };
  }

  if (carouselProps.inactiveSlideScale < 1) {
    animatedScale = {
      transform: [
        {
          scale: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [carouselProps.inactiveSlideScale, 1],
          }),
        },
      ],
    };
  }

  return {
    ...animatedOpacity,
    ...animatedScale,
  };
};
