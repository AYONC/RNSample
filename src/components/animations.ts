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

export function getInputRangeFromIndexes(range: number[], index: number, carouselProps: any): number[] {
  const sizeRef = carouselProps.vertical ? carouselProps.itemHeight : carouselProps.itemWidth;
  let inputRange = [];

  for (let i = 0; i < range.length; i++) {
    inputRange.push((index - range[i]) * sizeRef);
  }

  return inputRange;
}

export type Interpolator = {
  inputRange: number[];
  outputRange: number[];
  extrapolate?: 'extend' | 'identity' | 'clamp';
};

// Default behavior
// Scale and/or opacity effect
// Based on props 'inactiveSlideOpacity' and 'inactiveSlideScale'
export function defaultScrollInterpolator(index: number, carouselProps: any): Interpolator {
  const range = [1, 0, -1];
  const inputRange = getInputRangeFromIndexes(range, index, carouselProps);
  const outputRange = [0, 1, 0];

  return { inputRange, outputRange };
}

export function defaultAnimatedStyles(index: number, animatedValue: any, carouselProps: any) {
  let animatedOpacity = {};
  let animatedScale = {};

  if (carouselProps.inactiveSlideOpacity < 1) {
    animatedOpacity = {
      opacity: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [carouselProps.inactiveSlideOpacity, 1]
      })
    };
  }

  if (carouselProps.inactiveSlideScale < 1) {
    animatedScale = {
      transform: [{
        scale: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [carouselProps.inactiveSlideScale, 1]
        })
      }]
    };
  }

  return {
    ...animatedOpacity,
    ...animatedScale
  };
}
