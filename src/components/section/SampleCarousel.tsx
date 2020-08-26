import { defaultAnimatedStyles, defaultScrollInterpolator } from 'components/animations';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export type SampleCarouselProps = {
  ref?: any;
  data: any[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onSnapToItem?: (index: number) => void;
  sliderWidth: number;
  itemWidth: number;
  renderItem: any;
  firstItem?: number;
  inactiveSlideOpacity?: number;
  inactiveSlideScale?: number;
  loop?: boolean;
  loopClonesPerSide?: number;
  swipeThreshold?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  autoplayInterval?: number;
  style?: StyleProp<ViewStyle>;
};

type Distance = { start: number; end: number; };

const getScrollOffset = (event: NativeSyntheticEvent<NativeScrollEvent>): number => {
  return (event && event.nativeEvent && event.nativeEvent.contentOffset &&
    event.nativeEvent.contentOffset['x']) || 0;
};

export const SampleCarousel = ({
                                 onSnapToItem,
                                 onScroll,
                                 data, renderItem,
                                 sliderWidth, itemWidth, style,
                                 firstItem = 0,
                                 inactiveSlideOpacity = 0.8,
                                 inactiveSlideScale = 0.9,
                                 loop = false,
                                 loopClonesPerSide = 3,
                                 swipeThreshold = 30,
                                 autoplay = true,
                                 autoplayDelay = 1000,
                                 autoplayInterval = 3000,
                               }: SampleCarouselProps) => {
  const carouselRef = useRef<FlatList>();
  const [activeItem, setActiveItem] = useState<any>();
  const [previousActiveItem, setPreviousActiveItem] = useState<number>();
  const [previousFirstItem, setPreviousFirstItem] = useState<number>();
  const [itemToSnapTo, setItemToSnapTo] = useState<number>();
  const [currentContentOffset, setCurrentContentOffset] = useState<number>(0);
  const [scrollOffsetStart, setScrollOffsetStart] = useState<number>();
  const [positions, setPositions] = useState<Distance[]>([]);
  const [interpolators, setInterpolators] = useState<Animated.AnimatedInterpolation[]>([]);

  const [canFireCallback, setCanFireCallback] = useState<boolean>(false);
  const [scrollPosition, setScrollPosition] = useState<Animated.Value>();
  const [scrollHandler, setScrollHandler] = useState<any>();

  const [scrollOffset, setScrollOffset] = useState<Distance>({ start: 0, end: 0 });
  const [scrollActive, setScrollActive] = useState<Distance>({ start: 0, end: 0 });

  if (!data || !renderItem) {
    return null;
  }

  const enableLoop = loop && data?.length > 1;
  const visibleItems = Math.ceil(sliderWidth / itemWidth) + 1;
  const initialNumPerSide = enableLoop ? loopClonesPerSide : 2;
  const initialNumToRender = visibleItems + (initialNumPerSide * 2);
  const maxToRenderPerBatch = 1 + (initialNumToRender * 2);
  const windowSize = maxToRenderPerBatch;
  const containerInnerMargin = (sliderWidth - itemWidth) / 2;
  const viewportOffset = sliderWidth / 2;
  const getCenter = useCallback((offset: number) => {
    return offset + viewportOffset - containerInnerMargin;
  }, [viewportOffset, containerInnerMargin]);
  const dataLength = data?.length;
  const cloneCount = Math.min(dataLength, loopClonesPerSide);

  const getCustomDataLength = useMemo(() => {
    if (!data?.length) {
      return 0;
    }
    return enableLoop ? data.length + (2 * cloneCount) : data.length;
  }, [data, enableLoop, cloneCount]);


  const getActiveItem = useCallback((offset: number): number => {
    const center = getCenter(offset);
    const centerOffset = swipeThreshold;
    const lastIndex = positions.length - 1;
    const conditionIndex = positions.findIndex(
      ({ start, end }) => center + centerOffset >= start && center - centerOffset <= end
    )

    if (conditionIndex !== -1) return conditionIndex;

    return (positions[lastIndex] && center - centerOffset > positions[lastIndex].end) ? lastIndex : 0;
  }, [swipeThreshold, positions, getCenter]);

  const handleRenderItem = useCallback(({ item, index }: { item: any; index: number; }) => {
    const animatedValue = interpolators && interpolators[index];
    if (!animatedValue && animatedValue !== 0) {
      return null;
    }
    const animatedStyle = {
      ...defaultAnimatedStyles(index, animatedValue, { inactiveSlideOpacity, inactiveSlideScale }),
      width: itemWidth,
    };
    return (
      <Animated.View style={animatedStyle} pointerEvents={'box-none'}>
        {renderItem({ item, index })}
      </Animated.View>
    );
  }, [
    data,
    itemWidth,
    renderItem,
    interpolators,
    inactiveSlideOpacity,
    inactiveSlideScale,
  ])

  const scrollTo = useCallback((offset: number, animated = true) => {
    if (!carouselRef) {
      return;
    }

    carouselRef?.current?.scrollToOffset({ offset, animated });
  }, []);

  const snapToItem = useCallback((index: number, animated = true, fireCallback = true) => {
    const itemsLength = getCustomDataLength;

    if (!itemsLength || !carouselRef) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(index, itemsLength - 1));

    if (nextIndex !== previousActiveItem) {
      setPreviousActiveItem(nextIndex);

      if (fireCallback && onSnapToItem) {
        setCanFireCallback(true);
      }
    }

    setItemToSnapTo(nextIndex);
    setScrollOffsetStart(positions[nextIndex]?.start);

    if (!scrollOffsetStart && scrollOffsetStart !== 0) {
      return;
    }

    scrollTo(scrollOffsetStart, animated);
    setScrollOffset({ ...scrollOffset, end: currentContentOffset });
  }, [getCustomDataLength, onSnapToItem, positions]);

  const snapScroll = useCallback((delta: number) => {
    const { start, end } = scrollActive;

    if (start !== end) {
      // Snap to the new active item
      snapToItem(end);
    } else {
      // Snap depending on delta
      if (delta > 0) {
        if (delta > swipeThreshold) {
          snapToItem(start + 1);
        } else {
          snapToItem(end);
        }
      } else if (delta < 0) {
        if (delta < -swipeThreshold) {
          snapToItem(start - 1);
        } else {
          snapToItem(end);
        }
      } else {
        // Snap to current
        snapToItem(end);
      }
    }
  }, []);

  const getCustomData = useMemo(() => {
    const dataLength = data?.length;

    if (!dataLength) {
      return [];
    }

    if (!enableLoop) {
      return data;
    }
    const previousItems = data.slice(-cloneCount);
    const nextItems = data.slice(0, cloneCount);

    return previousItems.concat(data, nextItems);
  }, [data, cloneCount, enableLoop]);

  const getCustomIndex = useCallback((index: number) => {
    const itemsLength = getCustomDataLength;
    if (!itemsLength || (!index && index !== 0)) {
      return 0;
    }

    return index;
  }, [getCustomDataLength]);

  const getFirstItem = useCallback((index: number) => {
    const itemsLength = getCustomDataLength;

    if (!itemsLength || index > itemsLength - 1 || index < 0) {
      return 0;
    }

    return enableLoop ? index + loopClonesPerSide : index;
  }, [enableLoop, loopClonesPerSide, getCustomDataLength]);


  const initPositionsAndInterpolators = useCallback(() => {
    const sizeRef = itemWidth;

    if (!data || !data.length) {
      return;
    }

    let interpolators: Animated.AnimatedInterpolation[] = [];
    const positions: Distance[] = [];

    getCustomData.forEach((itemData, index) => {
      const _index = getCustomIndex(index);
      let animatedValue;

      positions[index] = {
        start: index * sizeRef,
        end: index * sizeRef + sizeRef
      };

      let interpolator: Animated.InterpolationConfigType = defaultScrollInterpolator(_index, { itemWidth });

      if (scrollPosition) {
        animatedValue = scrollPosition.interpolate({
          ...interpolator,
          extrapolate: 'clamp',
        });

        interpolators.push(animatedValue);
      }
    });

    setPositions(positions);
    setInterpolators(interpolators);
  }, [data, itemWidth])

  const repositionScroll = useCallback((index: number) => {
    const dataLength = data && data.length;

    if (!enableLoop || !dataLength ||
      (index >= loopClonesPerSide && index < dataLength + loopClonesPerSide)) {
      return;
    }

    let repositionTo = index;

    if (index >= dataLength + loopClonesPerSide) {
      repositionTo = index - dataLength;
    } else if (index < loopClonesPerSide) {
      repositionTo = index + dataLength;
    }

    snapToItem(repositionTo, false, false);
  }, [data, loopClonesPerSide]);

  const handleSnap = useCallback((index: number) => {
    if (!carouselRef) {
      return;
    }
    setCanFireCallback(false);
    onSnapToItem && onSnapToItem(index);
  }, [onSnapToItem, carouselRef]);

  const getDataIndex = useCallback((index: number) => {
    const dataLength = data && data.length;

    if (!enableLoop || !dataLength) {
      return index;
    }

    if (index >= dataLength + cloneCount) {
      return cloneCount > dataLength ? (index - cloneCount) % dataLength : index - dataLength - cloneCount;
    } else if (index < cloneCount) {
      return index + dataLength - cloneCount;
    } else {
      return index - cloneCount;
    }
  }, [data, enableLoop]);


  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event ? getScrollOffset(event) : currentContentOffset;
    const nextActiveItem = getActiveItem(scrollOffset);
    const itemReached = nextActiveItem === itemToSnapTo;
    const scrollConditions = scrollOffset >= Number(scrollOffsetStart) && scrollOffset <= Number(scrollOffsetStart);
    setCurrentContentOffset(scrollOffset);

    if (activeItem !== nextActiveItem && itemReached) {
      if (scrollConditions) {
        setActiveItem(nextActiveItem);
        if (canFireCallback) {
          handleSnap(getDataIndex(nextActiveItem));
        }
      }
    }

    if (nextActiveItem === itemToSnapTo && scrollOffset === scrollOffsetStart) {
      repositionScroll(nextActiveItem);
    }

    if (typeof onScroll === 'function' && event) {
      onScroll(event);
    }
  }, [onScroll, canFireCallback, repositionScroll]);

  const handleScrollBeginDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollOffset({ ...scrollOffset, start: getScrollOffset(event) });
    setScrollActive({ ...scrollActive, start: getActiveItem(scrollOffset.start) });
  }, [scrollOffset, scrollActive]);

  const handleTouchEnd = useCallback(() => {
    // const { autoplayDelay } = this.props;

    if (currentContentOffset === scrollOffset.end) {
      return;
    }

    setScrollOffset({ ...scrollOffset, end: currentContentOffset });
    setScrollActive({ ...scrollActive, end: getActiveItem(scrollOffset.end) })

    snapScroll(currentContentOffset - scrollOffset.start);

    // if (this.autoplay && !this.autoplaying) {
    //   this.enableAutoplayTimeout && clearTimeout(this.enableAutoplayTimeout);
    //   this.enableAutoplayTimeout = setTimeout(() => {
    //     this.startAutoplay();
    //   }, autoplayDelay + 50);
    // }
  }, []);

  const handleTouchStart = useCallback(() => {
    // if (this.autoplaying) {
    //   this.pauseAutoPlay();
    // }
  }, []);

  const handleScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (carouselRef?.current) {
      handleTouchEnd && handleTouchEnd();
    }
  }, [carouselRef]);

  useEffect(() => {
    const scrollX = new Animated.Value(0);
    setScrollPosition(scrollX);
    setScrollHandler(Animated.event(
      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
      {
        listener: handleScroll,
        useNativeDriver: true,
      }
    ));
  }, [data]);

  useLayoutEffect(() => {
    const _firstItem = getFirstItem(firstItem);

    initPositionsAndInterpolators();

    // Without 'requestAnimationFrame' or a `0` timeout, images will randomly not be rendered on Android...
    // requestAnimationFrame(() => {
    snapToItem(_firstItem, false, false);
      // if (autoplay) {
      // this.startAutoplay();
      // }
    // });
  }, [data/*initPositionsAndInterpolators, snapToItem*/]);

  const props = {
    initialNumToRender,
    maxToRenderPerBatch,
    windowSize,
    horizontal: true,
    numColumns: 1,
    data: data,//getCustomData,
    renderItem: handleRenderItem,
    onScrollBeginDrag: handleScrollBeginDrag,
    onScrollEndDrag: handleScrollEndDrag,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    keyExtractor: (item: any, index: number) => {
      return `flatlist-item-${index}`;
    },
    onScroll: scrollHandler,
    scrollEventThrottle: 1,
    contentContainerStyle: {
      paddingLeft: containerInnerMargin,
      paddingRight: containerInnerMargin,
    },
    style: [
      style || {},
      { width: sliderWidth, flexDirection: 'row' }
    ],
    directionalLockEnabled: true,
    pinchGestureEnabled: false,
    scrollsToTop: false,
    removeClippedSubviews: true,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    overScrollMode: 'never',
    automaticallyAdjustContentInsets: false,
  };

  return (<Animated.FlatList {...props} ref={carouselRef as any} />);
};
