import {
  animatedStyles,
  scrollInterpolator,
} from 'components/animations';
import React, { Component, createRef } from 'react';
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';

export type CustomCarouselProps = {
  ref?: any;
  data: any[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onSnapToItem?: (index: number) => void;
  sliderWidth: number;
  itemWidth: number;
  renderItem: any;
  firstItem: number;
  inactiveSlideOpacity: number;
  inactiveSlideScale: number;
  loop: boolean;
  loopClonesPerSide: number;
  swipeThreshold: number;
  autoplay: boolean;
  autoplayDelay: number;
  autoplayInterval: number;
  style?: StyleProp<ViewStyle>;
};

export type CustomCarouselState = {
  interpolators: Animated.AnimatedInterpolation[];
};

type Distance = { start: number; end: number };

export default class CustomCarousel extends Component<
  CustomCarouselProps,
  CustomCarouselState
> {
  static defaultProps = {
    firstItem: 0,
    inactiveSlideOpacity: 0.8,
    inactiveSlideScale: 0.9,
    loop: false,
    loopClonesPerSide: 3,
    swipeThreshold: 30,
    autoplay: true,
    autoplayDelay: 1000,
    autoplayInterval: 3000,
  };

  private carouselRef: React.RefObject<FlatList> = createRef();
  private activeItem: number;
  private previousActiveItem: number;
  private previousFirstItem: number;
  private itemToSnapTo?: number;
  private currentContentOffset: number;
  private scrollOffsetStart?: number;

  private mounted: boolean;
  private positions: Distance[];

  private canFireCallback: boolean;
  private scrollPosition?: Animated.Value;
  private onScrollHandler?: (...args: any[]) => void;

  private scrollOffset: Distance = { start: 0, end: 0 };
  private scrollActive: Distance = { start: 0, end: 0 };

  private autoplay: boolean = false;
  private autoplaying?: boolean;
  private autoplayInterval?: number;
  private enableAutoplayTimeout?: number;
  private autoplayTimeout?: number;

  constructor(props: CustomCarouselProps) {
    super(props);

    this.state = {
      interpolators: [],
    };

    // The following values are not stored in the state because 'setState()' is asynchronous
    // and this results in an absolutely crappy behavior on Android while swiping (see #156)
    const initialActiveItem = this.getFirstItem(props.firstItem);
    this.activeItem = initialActiveItem;
    this.previousActiveItem = initialActiveItem;
    this.previousFirstItem = initialActiveItem;
    this.mounted = false;
    this.positions = [];
    this.currentContentOffset = 0; // store ScrollView's scroll position
    this.canFireCallback = false;
    this.scrollOffsetStart = undefined;

    this.setScrollHandler();
  }

  componentDidMount() {
    const { autoplay, firstItem } = this.props;
    const _firstItem = this.getFirstItem(firstItem);

    this.mounted = true;
    this.initPositionsAndInterpolators();

    // Without 'requestAnimationFrame' or a `0` timeout, images will randomly not be rendered on Android...
    requestAnimationFrame(() => {
      if (!this.mounted) {
        return;
      }

      this.snapToItem(_firstItem, false, false);
      if (autoplay) {
        this.startAutoplay();
      }
    });
  }

  componentDidUpdate(prevProps: CustomCarouselProps) {
    const { interpolators } = this.state;
    const { firstItem, itemWidth, sliderWidth } = this.props;
    const itemsLength = this.getCustomDataLength(this.props);

    if (!itemsLength) {
      return;
    }

    const nextFirstItem = this.getFirstItem(firstItem, this.props);
    let nextActiveItem =
      this.activeItem || this.activeItem === 0
        ? this.activeItem
        : nextFirstItem;

    const hasNewSliderWidth =
      sliderWidth && sliderWidth !== prevProps.sliderWidth;
    const hasNewItemWidth = itemWidth && itemWidth !== prevProps.itemWidth;

    // Prevent issues with dynamically removed items
    if (nextActiveItem > itemsLength - 1) {
      nextActiveItem = itemsLength - 1;
    }

    if (
      interpolators.length !== itemsLength ||
      hasNewSliderWidth ||
      hasNewItemWidth
    ) {
      this.activeItem = nextActiveItem;

      this.initPositionsAndInterpolators(this.props);

      if (hasNewSliderWidth || hasNewItemWidth) {
        this.snapToItem(nextActiveItem, false, false);
      }
    } else if (
      nextFirstItem !== this.previousFirstItem &&
      nextFirstItem !== this.activeItem
    ) {
      this.activeItem = nextFirstItem;
      this.previousFirstItem = nextFirstItem;
      this.snapToItem(nextFirstItem, false, true);
    }

    if (this.props.onScroll !== prevProps.onScroll) {
      this.setScrollHandler();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
    this.stopAutoplay();
  }

  private setScrollHandler() {
    this.scrollPosition = new Animated.Value(0);

    this.onScrollHandler = Animated.event(
      [{ nativeEvent: { contentOffset: { x: this.scrollPosition } } }],
      {
        listener: this.onScroll,
        useNativeDriver: true,
      },
    );
  }

  private getCloneCount() {
    const { loopClonesPerSide, data } = this.props;
    const dataLength = data?.length;
    return Math.min(dataLength, loopClonesPerSide);
  }

  private enableLoop() {
    const { data, loop } = this.props;
    return loop && data?.length > 1;
  }

  private getCustomData(props = this.props) {
    const { data } = props;
    const dataLength = data?.length;

    if (!dataLength) {
      return [];
    }

    if (!this.enableLoop()) {
      return data;
    }
    const cloneCount = this.getCloneCount();
    const previousItems = data.slice(-cloneCount);
    const nextItems = data.slice(0, cloneCount);

    return previousItems.concat(data, nextItems);
  }

  private getCustomDataLength(props = this.props) {
    const { data } = props;
    if (!data?.length) {
      return 0;
    }
    return this.enableLoop()
      ? data.length + 2 * this.getCloneCount()
      : data.length;
  }

  private getCustomIndex(index: number, props = this.props) {
    const itemsLength = this.getCustomDataLength(props);
    if (!itemsLength || (!index && index !== 0)) {
      return 0;
    }

    return index;
  }

  private getDataIndex(index: number) {
    const { data } = this.props;
    const dataLength = data && data.length;

    if (!this.enableLoop() || !dataLength) {
      return index;
    }

    const cloneCount = this.getCloneCount();
    if (index >= dataLength + cloneCount) {
      return cloneCount > dataLength
        ? (index - cloneCount) % dataLength
        : index - dataLength - cloneCount;
    } else if (index < cloneCount) {
      return index + dataLength - cloneCount;
    } else {
      return index - cloneCount;
    }
  }

  private getFirstItem(index: number, props = this.props) {
    const { loopClonesPerSide } = props;
    const itemsLength = this.getCustomDataLength(props);

    if (!itemsLength || index > itemsLength - 1 || index < 0) {
      return 0;
    }

    return this.enableLoop() ? index + loopClonesPerSide : index;
  }

  private getWrappedRef() {
    if (this.carouselRef?.current?.scrollToOffset) {
      return this.carouselRef;
    }
  }

  private getScrollOffset(
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

  private getContainerInnerMargin() {
    const { sliderWidth, itemWidth } = this.props;
    return (sliderWidth - itemWidth) / 2;
  }

  private getViewportOffset() {
    const { sliderWidth } = this.props;
    return sliderWidth / 2;
  }

  private getCenter(offset: number) {
    return offset + this.getViewportOffset() - this.getContainerInnerMargin();
  }

  private getActiveItem(offset: number): number {
    const { swipeThreshold } = this.props;
    const center = this.getCenter(offset);
    const centerOffset = swipeThreshold;
    const lastIndex = this.positions.length - 1;
    const conditionIndex = this.positions.findIndex(
      ({ start, end }) =>
        center + centerOffset >= start && center - centerOffset <= end,
    );

    if (conditionIndex !== -1) {
      return conditionIndex;
    }

    return this.positions[lastIndex] &&
      center - centerOffset > this.positions[lastIndex].end
      ? lastIndex
      : 0;
  }

  private repositionScroll(index: number) {
    const { data, loopClonesPerSide } = this.props;
    const dataLength = data && data.length;

    console.log('repositionScroll', index);
    if (
      !this.enableLoop() ||
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

    this.snapToItem(repositionTo, false, false);
  }

  private scrollTo(offset: number, animated = true) {
    const wrappedRef = this.getWrappedRef();

    if (!this.mounted || !wrappedRef) {
      return;
    }

    wrappedRef?.current?.scrollToOffset({ offset, animated });
  }

  private snapScroll(delta: number) {
    const { swipeThreshold } = this.props;
    const { start, end } = this.scrollActive;

    if (start !== end) {
      // Snap to the new active item
      this.snapToItem(end);
    } else {
      // Snap depending on delta
      if (delta > 0) {
        if (delta > swipeThreshold) {
          this.snapToItem(start + 1);
        } else {
          this.snapToItem(end);
        }
      } else if (delta < 0) {
        if (delta < -swipeThreshold) {
          this.snapToItem(start - 1);
        } else {
          this.snapToItem(end);
        }
      } else {
        // Snap to current
        this.snapToItem(end);
      }
    }
  }

  private snapToItem(index: number, animated = true, fireCallback = true) {
    const { onSnapToItem } = this.props;
    const itemsLength = this.getCustomDataLength();
    console.log('snapToItem', index, itemsLength);
    const wrappedRef = this.getWrappedRef();

    if (!itemsLength || !wrappedRef) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(index, itemsLength - 1));

    if (nextIndex !== this.previousActiveItem) {
      this.previousActiveItem = nextIndex;

      if (fireCallback && onSnapToItem) {
        this.canFireCallback = true;
      }
    }

    this.itemToSnapTo = nextIndex;
    this.scrollOffsetStart = this.positions[nextIndex]?.start;

    if (!this.scrollOffsetStart && this.scrollOffsetStart !== 0) {
      return;
    }

    this.scrollTo(this.scrollOffsetStart, animated);
    this.scrollOffset.end = this.currentContentOffset;
  }

  initPositionsAndInterpolators = (props = this.props) => {
    const { data, itemWidth } = props;
    const sizeRef = itemWidth;

    if (!data || !data.length) {
      return;
    }

    let interpolators: Animated.AnimatedInterpolation[] = [];
    this.positions = [];

    this.getCustomData(props).forEach((itemData, index) => {
      const _index = this.getCustomIndex(index, props);
      let animatedValue;

      this.positions[index] = {
        start: index * sizeRef,
        end: index * sizeRef + sizeRef,
      };

      let interpolator: Animated.InterpolationConfigType = scrollInterpolator(
        _index,
        props,
      );

      if (this.scrollPosition) {
        animatedValue = this.scrollPosition.interpolate({
          ...interpolator,
          extrapolate: 'clamp',
        });

        interpolators.push(animatedValue);
      }
    });

    this.setState({ interpolators });
  };

  getKeyExtractor = (item: any, index: number) => {
    return `flatlist-item-${index}`;
  };

  onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { onScroll } = this.props;

    const scrollOffset = event
      ? this.getScrollOffset(event)
      : this.currentContentOffset;
    const nextActiveItem = this.getActiveItem(scrollOffset);
    const itemReached = nextActiveItem === this.itemToSnapTo;
    const scrollConditions =
      scrollOffset >= Number(this.scrollOffsetStart) &&
      scrollOffset <= Number(this.scrollOffsetStart);
    this.currentContentOffset = scrollOffset;

    if (this.activeItem !== nextActiveItem && itemReached) {
      if (scrollConditions) {
        this.activeItem = nextActiveItem;
        if (this.canFireCallback) {
          this.onSnap(this.getDataIndex(nextActiveItem));
        }
      }
    }

    if (
      nextActiveItem === this.itemToSnapTo &&
      scrollOffset === this.scrollOffsetStart
    ) {
      this.repositionScroll(nextActiveItem);
    }

    if (typeof onScroll === 'function' && event) {
      onScroll(event);
    }
  };

  onTouchStart = () => {
    if (this.autoplaying) {
      this.pauseAutoPlay();
    }
  };

  onScrollBeginDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    this.scrollOffset.start = this.getScrollOffset(event);
    this.scrollActive.start = this.getActiveItem(this.scrollOffset.start);
  };

  onScrollEndDrag = (/*event: NativeSyntheticEvent<NativeScrollEvent>*/) => {
    if (this.carouselRef?.current) {
      this.onTouchEnd && this.onTouchEnd();
    }
  };

  onTouchEnd = () => {
    const { autoplayDelay } = this.props;

    if (this.currentContentOffset === this.scrollOffset.end) {
      return;
    }

    this.scrollOffset.end = this.currentContentOffset;
    this.scrollActive.end = this.getActiveItem(this.scrollOffset.end);

    this.snapScroll(this.scrollOffset.end - this.scrollOffset.start);

    if (this.autoplay && !this.autoplaying) {
      this.enableAutoplayTimeout && clearTimeout(this.enableAutoplayTimeout);
      this.enableAutoplayTimeout = setTimeout(() => {
        this.startAutoplay();
      }, autoplayDelay + 50);
    }
  };

  onSnap = (index: number) => {
    const { onSnapToItem } = this.props;

    if (!this.carouselRef) {
      return;
    }

    this.canFireCallback = false;
    onSnapToItem && onSnapToItem(index);
  };

  startAutoplay() {
    const { autoplayInterval, autoplayDelay } = this.props;
    this.autoplay = true;

    if (this.autoplaying) {
      return;
    }

    this.autoplayTimeout && clearTimeout(this.autoplayTimeout);
    this.autoplayTimeout = setTimeout(() => {
      this.autoplaying = true;
      this.autoplayInterval = setInterval(() => {
        if (this.autoplaying) {
          this.snapToNext();
        }
      }, autoplayInterval);
    }, autoplayDelay);
  }

  pauseAutoPlay() {
    this.autoplaying = false;
    this.enableAutoplayTimeout && clearTimeout(this.enableAutoplayTimeout);
    this.autoplayTimeout && clearTimeout(this.autoplayTimeout);
    this.autoplayInterval && clearInterval(this.autoplayInterval);
  }

  stopAutoplay() {
    this.pauseAutoPlay();
  }

  snapToNext(animated = true, fireCallback = true) {
    const itemsLength = this.getCustomDataLength();

    let newIndex = this.activeItem + 1;
    if (newIndex > itemsLength - 1) {
      if (!this.enableLoop()) {
        return;
      }
      newIndex = 0;
    }
    this.snapToItem(newIndex, animated, fireCallback);
  }

  renderItem = ({ item, index }: { item: any; index: number }) => {
    const { interpolators } = this.state;
    const { itemWidth, renderItem } = this.props;

    const animatedValue = interpolators && interpolators[index];

    if (!animatedValue && animatedValue !== 0) {
      return null;
    }

    const animatedStyle = {
      ...animatedStyles(index, animatedValue, this.props),
      width: itemWidth,
    };

    return (
      <Animated.View style={animatedStyle} pointerEvents={'box-none'}>
        {renderItem({ item, index })}
      </Animated.View>
    );
  };

  render() {
    const {
      sliderWidth,
      style,
      itemWidth,
      loopClonesPerSide,
      data,
      renderItem,
    } = this.props;

    if (!data || !renderItem) {
      return null;
    }

    const visibleItems = Math.ceil(sliderWidth / itemWidth) + 1;
    const initialNumPerSide = this.enableLoop() ? loopClonesPerSide : 2;
    const initialNumToRender = visibleItems + initialNumPerSide * 2;
    const maxToRenderPerBatch = 1 + initialNumToRender * 2;
    const windowSize = maxToRenderPerBatch;

    const props = {
      horizontal: true,
      numColumns: 1,
      data: this.getCustomData(),
      renderItem: this.renderItem,
      onScrollBeginDrag: this.onScrollBeginDrag,
      onScrollEndDrag: this.onScrollEndDrag,
      onTouchStart: this.onTouchStart,
      onTouchEnd: this.onTouchEnd,
      keyExtractor: this.getKeyExtractor,
      onScroll: this.onScrollHandler,
      scrollEventThrottle: 1,
      contentContainerStyle: {
        paddingLeft: this.getContainerInnerMargin(),
        paddingRight: this.getContainerInnerMargin(),
      },
      style: [style || {}, { width: sliderWidth, flexDirection: 'row' }],
      initialNumToRender,
      maxToRenderPerBatch,
      windowSize,
      directionalLockEnabled: true,
      pinchGestureEnabled: false,
      scrollsToTop: false,
      removeClippedSubviews: true,
      showsHorizontalScrollIndicator: false,
      showsVerticalScrollIndicator: false,
      overScrollMode: 'never',
      automaticallyAdjustContentInsets: false,
    };

    return <Animated.FlatList {...props} ref={this.carouselRef} />;
  }
}
