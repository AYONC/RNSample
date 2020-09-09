import {
  animatedStyles,
  scrollInterpolator,
} from 'components/animations';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';

export type NewCarouselProps = {
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

export type CustomCarouselState = {
  interpolators: Animated.AnimatedInterpolation[];
};

type Distance = { start: number; end: number };

function getScrollOffset(
  event: NativeSyntheticEvent<NativeScrollEvent>,
): number {
  return (
    (event &&
      event.nativeEvent &&
      event.nativeEvent.contentOffset &&
      event.nativeEvent.contentOffset.x) ||
    0
  );
}

export const NewCarousel = ({
  onSnapToItem,
  onScroll,
  data,
  renderItem,
  sliderWidth,
  itemWidth,
  style,
  firstItem = 0,
  inactiveSlideOpacity = 0.8,
  inactiveSlideScale = 0.9,
  loop = false,
  loopClonesPerSide = 3,
  swipeThreshold = 30,
  autoplay = true,
  autoplayDelay = 1000,
  autoplayInterval = 3000,
}: NewCarouselProps) => {
  const carouselRef = useRef<FlatList>();

  const [currentContentOffset, setCurrentContentOffset] = useState(0);
  const [itemToSnapTo, setItemToSnapTo] = useState(0);
  const [actionStartOffset, setActionStartOffset] = useState(0);
  const [activeItem, setActiveItem] = useState(0);
  const [previousActiveItem, setPreviousActiveItem] = useState(0);
  const [canFireCallback, setCanFireCallback] = useState(false);

  const [scrollOffsetStart, setScrollOffsetStart] = useState(0);
  const [scrollOffsetEnd, setScrollOffsetEnd] = useState(0);
  const [scrollActiveStart, setScrollActiveStart] = useState(0);
  const [scrollActiveEnd, setScrollActiveEnd] = useState(0);

  const enableLoop = loop && data?.length > 1;
  const visibleItems = Math.ceil(sliderWidth / itemWidth) + 1;
  const initialNumPerSide = enableLoop ? loopClonesPerSide : 2;
  const initialNumToRender = visibleItems + initialNumPerSide * 2;
  const maxToRenderPerBatch = 1 + initialNumToRender * 2;
  const windowSize = maxToRenderPerBatch;
  const containerInnerMargin = (sliderWidth - itemWidth) / 2;
  const viewportOffset = sliderWidth / 2;
  const dataLength = data?.length;
  const cloneCount = Math.min(dataLength, loopClonesPerSide);
  const customData = useMemo(() => {
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

  const getDataIndex = useCallback(
    (index: number) => {
      const dataLength = data && data.length;

      if (!enableLoop || !dataLength) {
        return index;
      }

      if (index >= dataLength + cloneCount) {
        return cloneCount > dataLength
          ? (index - cloneCount) % dataLength
          : index - dataLength - cloneCount;
      } else if (index < cloneCount) {
        return index + dataLength - cloneCount;
      } else {
        return index - cloneCount;
      }
    },
    [cloneCount, data, enableLoop],
  );

  const getCustomDataLength = useCallback(() => {
    if (!data?.length) {
      return 0;
    }
    return enableLoop ? data.length + 2 * cloneCount : data.length;
  }, [data, cloneCount, enableLoop]);

  const getCustomIndex = useCallback(
    (index) => {
      const itemsLength = getCustomDataLength();
      return !itemsLength || (!index && index !== 0) ? 0 : index;
    },
    [getCustomDataLength],
  );

  const [scrollPosition, setScrollPosition] = useState(new Animated.Value(0));

  const [interpolators, positions] = useMemo(() => {
    const _interpolators: Animated.AnimatedInterpolation[] = [];
    const _positions: Distance[] = [];

    customData.forEach((item, index) => {
      _positions[index] = {
        start: index * itemWidth,
        end: index * itemWidth + itemWidth,
      };
      const _index = getCustomIndex(index);
      let interpolator: Animated.InterpolationConfigType = scrollInterpolator(
        _index,
        { itemWidth },
      );
      if (scrollPosition) {
        const animatedValue = scrollPosition.interpolate({
          ...interpolator,
          extrapolate: 'clamp',
        });
        _interpolators.push(animatedValue);
      }
    });
    return [_interpolators, _positions];
  }, [itemWidth, customData, getCustomIndex, scrollPosition]);

  const getActiveItem = useCallback(
    (offset: number) => {
      const center = offset + viewportOffset - containerInnerMargin;
      const centerOffset = swipeThreshold;
      const lastIndex = positions.length - 1;
      const conditionIndex = positions.findIndex(
        ({ start, end }) =>
          center + centerOffset >= start && center - centerOffset <= end,
      );

      if (conditionIndex !== -1) {
        return conditionIndex;
      }

      return positions[lastIndex] &&
        center - centerOffset > positions[lastIndex].end
        ? lastIndex
        : 0;
    },
    [viewportOffset, containerInnerMargin, swipeThreshold, positions],
  );

  const snapToItem = useCallback(
    (index: number, animated = true, fireCallback = true) => {
      const itemsLength = getCustomDataLength();

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

      const start = positions[nextIndex]?.start;
      carouselRef?.current?.scrollToOffset({ offset: start, animated });
      setItemToSnapTo(nextIndex);
      setActionStartOffset(start);
      setScrollOffsetEnd(currentContentOffset);
    },
    [
      currentContentOffset,
      getCustomDataLength,
      onSnapToItem,
      positions,
      previousActiveItem,
    ],
  );

  const snapScroll = useCallback(
    (delta: number) => {
      const start = scrollActiveStart;
      const end = scrollActiveEnd;

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
    },
    [scrollActiveEnd, scrollActiveStart, snapToItem, swipeThreshold],
  );

  const repositionScroll = useCallback(
    (index: number) => {
      const dataLength = data && data.length;

      if (
        !enableLoop ||
        !dataLength ||
        (index >= loopClonesPerSide && index < dataLength + loopClonesPerSide)
      ) {
        return;
      }

      let repositionTo = index;

      if (index >= dataLength + loopClonesPerSide) {
        repositionTo = index - dataLength;
      } else if (index < loopClonesPerSide) {
        repositionTo = index + dataLength;
      }
      snapToItem(repositionTo, false, false);
    },
    [data, enableLoop, loopClonesPerSide, snapToItem],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollOffset = event
        ? getScrollOffset(event)
        : currentContentOffset;
      const nextActiveItem = getActiveItem(scrollOffset);
      const itemReached = nextActiveItem === itemToSnapTo;
      const scrollConditions =
        scrollOffset >= Number(actionStartOffset) &&
        scrollOffset <= Number(actionStartOffset);
      setCurrentContentOffset(scrollOffset);
      if (activeItem !== nextActiveItem && itemReached) {
        if (scrollConditions) {
          setActiveItem(nextActiveItem);
          if (canFireCallback) {
            const dataIndex = getDataIndex(nextActiveItem);
            onSnapToItem && onSnapToItem(dataIndex);
            setCanFireCallback(false);
          }
        }
      }

      if (
        nextActiveItem === itemToSnapTo &&
        scrollOffset === actionStartOffset
      ) {
        repositionScroll(nextActiveItem);
      }

      if (typeof onScroll === 'function' && event) {
        onScroll(event);
      }
    },
    [
      currentContentOffset,
      getActiveItem,
      itemToSnapTo,
      actionStartOffset,
      activeItem,
      onScroll,
      canFireCallback,
      getDataIndex,
      onSnapToItem,
      repositionScroll,
    ],
  );

  const scrollAniHandler = useMemo(() => {
    return Animated.event(
      [{ nativeEvent: { contentOffset: { x: scrollPosition } } }],
      {
        listener: handleScroll,
        useNativeDriver: true,
      },
    );
  }, [scrollPosition, handleScroll]);

  const handleRenderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const animatedValue = interpolators && interpolators[index];

      if (!animatedValue && animatedValue !== 0) {
        return null;
      }

      const animatedStyle = {
        ...animatedStyles(index, animatedValue, {
          inactiveSlideOpacity,
          inactiveSlideScale,
        }),
        width: itemWidth,
      };

      return (
        <Animated.View style={animatedStyle} pointerEvents={'box-none'}>
          {renderItem({ item, index })}
        </Animated.View>
      );
    },
    [
      interpolators,
      inactiveSlideOpacity,
      inactiveSlideScale,
      itemWidth,
      renderItem,
    ],
  );

  const getFirstItem = useCallback(
    (index: number) => {
      const itemsLength = getCustomDataLength();

      if (!itemsLength || index > itemsLength - 1 || index < 0) {
        return 0;
      }

      return enableLoop ? index + loopClonesPerSide : index;
    },
    [enableLoop, getCustomDataLength, loopClonesPerSide],
  );

  const handleTouchStart = useCallback(() => {
    // if (this.autoplaying) {
    //   this.pauseAutoPlay();
    // }
  }, []);

  const handleTouchEnd = useCallback(() => {
    // const { autoplayDelay } = this.props;

    if (currentContentOffset === scrollOffsetEnd) {
      return;
    }

    setScrollOffsetEnd(currentContentOffset);
    setScrollActiveEnd(getActiveItem(scrollOffsetEnd));

    snapScroll(currentContentOffset - scrollOffsetStart);

    // if (this.autoplay && !this.autoplaying) {
    //   this.enableAutoplayTimeout && clearTimeout(this.enableAutoplayTimeout);
    //   this.enableAutoplayTimeout = setTimeout(() => {
    //     this.startAutoplay();
    //   }, autoplayDelay + 50);
    // }
  }, [
    currentContentOffset,
    getActiveItem,
    scrollOffsetEnd,
    scrollOffsetStart,
    snapScroll,
  ]);

  const handleScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollOffsetStart(getScrollOffset(event));
      setScrollActiveStart(getActiveItem(scrollOffsetStart));
    },
    [getActiveItem, scrollOffsetStart],
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (carouselRef?.current) {
        handleTouchEnd && handleTouchEnd();
      }
    },
    [handleTouchEnd],
  );

  useEffect(() => {
    const _firstItem = getFirstItem(firstItem);
    snapToItem(_firstItem);
  }, [data, firstItem, getFirstItem, snapToItem]);

  const props = {
    initialNumToRender,
    maxToRenderPerBatch,
    windowSize,
    horizontal: true,
    numColumns: 1,
    data: customData,
    renderItem: handleRenderItem,
    onScrollBeginDrag: handleScrollBeginDrag,
    onScrollEndDrag: handleScrollEndDrag,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    keyExtractor: (item: any, index: number) => {
      return `flatlist-item-${index}`;
    },
    onScroll: scrollAniHandler,
    scrollEventThrottle: 1,
    contentContainerStyle: {
      paddingLeft: containerInnerMargin,
      paddingRight: containerInnerMargin,
    },
    style: [style || {}, { width: sliderWidth, flexDirection: 'row' }],
    directionalLockEnabled: true,
    pinchGestureEnabled: false,
    scrollsToTop: false,
    removeClippedSubviews: true,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    overScrollMode: 'never',
    automaticallyAdjustContentInsets: false,
  };

  return <Animated.FlatList {...props} ref={carouselRef as any} />;
};
