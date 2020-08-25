import {
  defaultAnimatedStyles,
  defaultScrollInterpolator,
  Interpolator
} from 'components/animations';
import React, { Component, createRef } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import { Animated, FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export type CustomCarouselProps = {
  ref?: any,
  data: any[],
  onScroll?: any,
  onScrollEndDrag?: any,
  onScrollBeginDrag?: any,
  onSnapToItem?: any,
  onBeforeSnapToItem?: any,
  onTouchStart?: any,
  sliderWidth: number,
  itemWidth: number,
  renderItem: any,
  containerCustomStyle: any,
  contentContainerCustomStyle?: any,
  firstItem: number,
  inactiveSlideOpacity: number,
  inactiveSlideScale: number,
  loop: boolean,
  loopClonesPerSide: number,
  slideStyle: any,
  swipeThreshold: number,
  autoplay: boolean,
  autoplayDelay: number,
  autoplayInterval: number,
  style?: StyleProp<ViewStyle>,
};

export type CustomCarouselState = {
  hideCarousel: boolean,
  interpolators: any[],
};

export default class CustomCarousel extends Component<CustomCarouselProps, CustomCarouselState> {
  static defaultProps = {
    containerCustomStyle: {},
    contentContainerCustomStyle: {},
    firstItem: 0,
    //required
    inactiveSlideOpacity: 0.8,
    inactiveSlideScale: 0.9,
    loop: false,
    loopClonesPerSide: 3,
    slideStyle: {},
    swipeThreshold: 30,
    autoplay: true,
    autoplayDelay: 1000,
    autoplayInterval: 3000,
  }
  private carouselRef: React.RefObject<FlatList> = createRef();
  private activeItem: number;
  private previousActiveItem: number;
  private previousFirstItem: number;
  private previousItemsLength: number;
  private mounted: boolean;
  private positions: any[];
  private currentContentOffset: number;
  private canFireBeforeCallback: boolean;
  private canFireCallback: boolean;
  private scrollOffsetRef?: any;
  private onScrollTriggered: boolean;
  private lastScrollDate: number;
  private hackSlideAnimationTimeout?: number;
  private enableAutoplayTimeout?: number;
  private autoplayTimeout?: number;
  private scrollPos?: Animated.Value;
  private onScrollHandler?: (...args: any[]) => void;
  private itemToSnapTo?: number;
  private autoplaying?: boolean;
  private scrollStartOffset: number = 0;
  private scrollStartActive: number = 0;
  private scrollEndOffset: number = 0;
  private scrollEndActive: number = 0;
  private onLayoutInitDone: boolean = false;
  private autoplay: boolean = false;
  private autoplayInterval?: number;

  constructor(props: CustomCarouselProps) {
    super(props);

    this.state = {
      hideCarousel: true,
      interpolators: []
    };

    // The following values are not stored in the state because 'setState()' is asynchronous
    // and this results in an absolutely crappy behavior on Android while swiping (see #156)
    const initialActiveItem = this.getFirstItem(props.firstItem);
    this.activeItem = initialActiveItem;
    this.previousActiveItem = initialActiveItem;
    this.previousFirstItem = initialActiveItem;
    this.previousItemsLength = initialActiveItem;
    this.mounted = false;
    this.positions = [];
    this.currentContentOffset = 0; // store ScrollView's scroll position
    this.canFireBeforeCallback = false;
    this.canFireCallback = false;
    this.scrollOffsetRef = null;
    this.onScrollTriggered = true; // used when momentum is enabled to prevent an issue with edges items
    this.lastScrollDate = 0; // used to work around a FlatList bug

    this.setScrollHandler();
  }

  componentDidMount() {
    const { autoplay, firstItem } = this.props;
    const _firstItem = this.getFirstItem(firstItem);
    const apparitionCallback = () => {
      this.setState({ hideCarousel: false });
      if (autoplay) {
        this.startAutoplay();
      }
    };

    this.mounted = true;
    this.initPositionsAndInterpolators();

    // Without 'requestAnimationFrame' or a `0` timeout, images will randomly not be rendered on Android...
    requestAnimationFrame(() => {
      if (!this.mounted) {
        return;
      }

      this.snapToItem(_firstItem, false, false);
      this.hackActiveSlideAnimation(_firstItem, 'start', true);

      apparitionCallback();
    });
  }

  shouldComponentUpdate(nextProps: CustomCarouselProps, nextState: CustomCarouselState): boolean {
    return shallowCompare(this, nextProps, nextState);
  }

  componentDidUpdate(prevProps: CustomCarouselProps) {
    const { interpolators } = this.state;
    const { firstItem, itemWidth, sliderWidth } = this.props;
    const itemsLength = this.getCustomDataLength(this.props);

    if (!itemsLength) {
      return;
    }

    const nextFirstItem = this.getFirstItem(firstItem, this.props);
    let nextActiveItem = this.activeItem || this.activeItem === 0 ? this.activeItem : nextFirstItem;

    const hasNewSliderWidth = sliderWidth && sliderWidth !== prevProps.sliderWidth;
    const hasNewItemWidth = itemWidth && itemWidth !== prevProps.itemWidth;

    // Prevent issues with dynamically removed items
    if (nextActiveItem > itemsLength - 1) {
      nextActiveItem = itemsLength - 1;
    }

    if (interpolators.length !== itemsLength || hasNewSliderWidth || hasNewItemWidth) {
      this.activeItem = nextActiveItem;
      this.previousItemsLength = itemsLength;

      this.initPositionsAndInterpolators(this.props);

      // Handle scroll issue when dynamically removing items (see #133)
      // This also fixes first item's active state on Android
      // Because 'initialScrollIndex' apparently doesn't trigger scroll
      if (this.previousItemsLength > itemsLength) {
        this.hackActiveSlideAnimation(nextActiveItem, undefined, true);
      }

      if (hasNewSliderWidth || hasNewItemWidth) {
        this.snapToItem(nextActiveItem, false, false);
      }
    } else if (nextFirstItem !== this.previousFirstItem && nextFirstItem !== this.activeItem) {
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
    if (this.hackSlideAnimationTimeout != null) {
      clearTimeout(this.hackSlideAnimationTimeout);
    }
    if (this.enableAutoplayTimeout != null) {
      clearTimeout(this.enableAutoplayTimeout);
    }
    if (this.autoplayTimeout != null) {
      clearTimeout(this.autoplayTimeout);
    }
  }

  private setScrollHandler() {
    // Native driver for scroll events
    const scrollEventConfig = {
      listener: this.onScroll,
      useNativeDriver: true,
    };
    this.scrollPos = new Animated.Value(0);
    const argMapping = [{ nativeEvent: { contentOffset: { x: this.scrollPos } } }];

    this.onScrollHandler = Animated.event(
      argMapping,
      scrollEventConfig
    );
  }

  private enableLoop() {
    const { data, loop } = this.props;
    return loop && data && data.length && data.length > 1;
  }

  private getCustomData(props = this.props) {
    const { data, loopClonesPerSide } = props;
    const dataLength = data && data.length;

    if (!dataLength) {
      return [];
    }

    if (!this.enableLoop()) {
      return data;
    }

    let previousItems = [];
    let nextItems = [];

    if (loopClonesPerSide > dataLength) {
      const dataMultiplier = Math.floor(loopClonesPerSide / dataLength);
      const remainder = loopClonesPerSide % dataLength;

      for (let i = 0; i < dataMultiplier; i++) {
        previousItems.push(...data);
        nextItems.push(...data);
      }

      previousItems.unshift(...data.slice(-remainder));
      nextItems.push(...data.slice(0, remainder));
    } else {
      previousItems = data.slice(-loopClonesPerSide);
      nextItems = data.slice(0, loopClonesPerSide);
    }

    return previousItems.concat(data, nextItems);
  }

  private getCustomDataLength(props = this.props) {
    const { data, loopClonesPerSide } = props;
    const dataLength = data && data.length;

    if (!dataLength) {
      return 0;
    }

    return this.enableLoop() ? dataLength + (2 * loopClonesPerSide) : dataLength;
  }

  private getCustomIndex(index: number, props = this.props) {
    const itemsLength = this.getCustomDataLength(props);

    if (!itemsLength || (!index && index !== 0)) {
      return 0;
    }

    return index;
  }

  private getDataIndex(index: number) {
    const { data, loopClonesPerSide } = this.props;
    const dataLength = data && data.length;

    if (!this.enableLoop() || !dataLength) {
      return index;
    }

    if (index >= dataLength + loopClonesPerSide) {
      return loopClonesPerSide > dataLength ?
        (index - loopClonesPerSide) % dataLength :
        index - dataLength - loopClonesPerSide;
    } else if (index < loopClonesPerSide) {
      // TODO: is there a simpler way of determining the interpolated index?
      if (loopClonesPerSide > dataLength) {
        const baseDataIndexes = [];
        const dataIndexes = [];
        const dataMultiplier = Math.floor(loopClonesPerSide / dataLength);
        const remainder = loopClonesPerSide % dataLength;

        for (let i = 0; i < dataLength; i++) {
          baseDataIndexes.push(i);
        }

        for (let j = 0; j < dataMultiplier; j++) {
          dataIndexes.push(...baseDataIndexes);
        }

        dataIndexes.unshift(...baseDataIndexes.slice(-remainder));
        return dataIndexes[index];
      } else {
        return index + dataLength - loopClonesPerSide;
      }
    } else {
      return index - loopClonesPerSide;
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
    if (this.carouselRef && this.carouselRef?.current?.scrollToOffset) {
      return this.carouselRef;
    }
  }

  getKeyExtractor = (item: any, index: number) => {
    return `flatlist-item-${index}`;
  }

  private getScrollOffset(event: NativeSyntheticEvent<any>): number {
    return (event && event.nativeEvent && event.nativeEvent.contentOffset &&
      event.nativeEvent.contentOffset['x']) || 0;
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

    for (let i = 0; i < this.positions.length; i++) {
      const { start, end } = this.positions[i];
      if (center + centerOffset >= start && center - centerOffset <= end) {
        return i;
      }
    }

    const lastIndex = this.positions.length - 1;
    if (this.positions[lastIndex] && center - centerOffset > this.positions[lastIndex].end) {
      return lastIndex;
    }

    return 0;
  }

  initPositionsAndInterpolators = (props = this.props) => {
    const { data, itemWidth } = props;
    const sizeRef = itemWidth;

    if (!data || !data.length) {
      return;
    }

    let interpolators: any[] = [];
    this.positions = [];

    this.getCustomData(props).forEach((itemData, index) => {
      const _index = this.getCustomIndex(index, props);
      let animatedValue;

      this.positions[index] = {
        start: index * sizeRef,
        end: index * sizeRef + sizeRef
      };

      let interpolator: Interpolator = defaultScrollInterpolator(_index, props);

      animatedValue = this.scrollPos?.interpolate({
        ...interpolator,
        extrapolate: 'clamp'
      });

      interpolators.push(animatedValue);
    });

    this.setState({ interpolators });
  }

  private hackActiveSlideAnimation(index: number, goTo?: string, force = false) {
    const { data } = this.props;

    if (!this.mounted || !this.carouselRef || !this.positions[index] || (!force && this.enableLoop())) {
      return;
    }

    const offset = this.positions[index] && this.positions[index].start;

    if (!offset && offset !== 0) {
      return;
    }

    const itemsLength = data && data.length;
    const direction = goTo || itemsLength === 1 ? 'start' : 'end';

    this.scrollTo(offset + (direction === 'start' ? -1 : 1), false);

    if (this.hackSlideAnimationTimeout != null) {
      clearTimeout(this.hackSlideAnimationTimeout);
    }
    this.hackSlideAnimationTimeout = setTimeout(() => {
      this.scrollTo(offset, false);
    }, 50); // works randomly when set to '0'
  }

  private repositionScroll(index: number) {
    const { data, loopClonesPerSide } = this.props;
    const dataLength = data && data.length;

    if (!this.enableLoop() || !dataLength ||
      (index >= loopClonesPerSide && index < dataLength + loopClonesPerSide)) {
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

    const specificOptions = {
      offset
    };
    const options = {
      ...specificOptions,
      animated
    };

    wrappedRef?.current?.scrollToOffset(options);
  }

  onScroll = (event: NativeSyntheticEvent<any>) => {
    const { onScroll } = this.props;

    const scrollOffset = event ? this.getScrollOffset(event) : this.currentContentOffset;
    const nextActiveItem = this.getActiveItem(scrollOffset);
    const itemReached = nextActiveItem === this.itemToSnapTo;
    const scrollConditions =
      scrollOffset >= this.scrollOffsetRef &&
      scrollOffset <= this.scrollOffsetRef;

    this.currentContentOffset = scrollOffset;
    this.onScrollTriggered = true;
    this.lastScrollDate = Date.now();

    if (this.activeItem !== nextActiveItem && itemReached) {
      if (this.canFireBeforeCallback) {
        this.onBeforeSnap(this.getDataIndex(nextActiveItem));
      }

      if (scrollConditions) {
        this.activeItem = nextActiveItem;
        if (this.canFireCallback) {
          this.onSnap(this.getDataIndex(nextActiveItem));
        }
      }
    }

    if (nextActiveItem === this.itemToSnapTo &&
      scrollOffset === this.scrollOffsetRef) {
      this.repositionScroll(nextActiveItem);
    }

    if (typeof onScroll === 'function' && event) {
      onScroll(event);
    }
  }

  onTouchStart = () => {
    const { onTouchStart } = this.props

    if (this.autoplaying) {
      this.pauseAutoPlay();
    }

    if (onTouchStart) {
      onTouchStart()
    }
  }

  onScrollBeginDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { onScrollBeginDrag } = this.props;
    this.scrollStartOffset = this.getScrollOffset(event);
    this.scrollStartActive = this.getActiveItem(this.scrollStartOffset);

    if (onScrollBeginDrag) {
      onScrollBeginDrag(event);
    }
  }

  onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { onScrollEndDrag } = this.props;

    if (this.carouselRef?.current) {
      this.onScrollEnd && this.onScrollEnd();
    }

    if (onScrollEndDrag) {
      onScrollEndDrag(event);
    }
  }

  onScrollEnd = () => {
    const { autoplayDelay } = this.props;

    if (this.currentContentOffset === this.scrollEndOffset) {
      return;
    }

    this.scrollEndOffset = this.currentContentOffset;
    this.scrollEndActive = this.getActiveItem(this.scrollEndOffset);

    this.snapScroll(this.scrollEndOffset - this.scrollStartOffset);

    // The touchEnd event is buggy on Android, so this will serve as a fallback whenever needed
    // https://github.com/facebook/react-native/issues/9439
    if (this.autoplay && !this.autoplaying) {
      if (this.enableAutoplayTimeout != null) {
        clearTimeout(this.enableAutoplayTimeout);
      }
      this.enableAutoplayTimeout = setTimeout(() => {
        this.startAutoplay();
      }, autoplayDelay + 50);
    }
  }

  onLayout = () => {
    // Prevent unneeded actions during the first 'onLayout' (triggered on init)
    if (this.onLayoutInitDone) {
      this.initPositionsAndInterpolators();
      this.snapToItem(this.activeItem, false, false);
    } else {
      this.onLayoutInitDone = true;
    }
  }

  private snapScroll(delta: number) {
    const { swipeThreshold } = this.props;

    if (this.scrollStartActive !== this.scrollEndActive) {
      // Snap to the new active item
      this.snapToItem(this.scrollEndActive);
    } else {
      // Snap depending on delta
      if (delta > 0) {
        if (delta > swipeThreshold) {
          this.snapToItem(this.scrollStartActive + 1);
        } else {
          this.snapToItem(this.scrollEndActive);
        }
      } else if (delta < 0) {
        if (delta < -swipeThreshold) {
          this.snapToItem(this.scrollStartActive - 1);
        } else {
          this.snapToItem(this.scrollEndActive);
        }
      } else {
        // Snap to current
        this.snapToItem(this.scrollEndActive);
      }
    }
  }

  private snapToItem(index: number, animated = true, fireCallback = true) {
    const { onSnapToItem, onBeforeSnapToItem } = this.props;
    const itemsLength = this.getCustomDataLength();
    const wrappedRef = this.getWrappedRef();

    if (!itemsLength || !wrappedRef) {
      return;
    }

    if (!index || index < 0) {
      index = 0;
    } else if (itemsLength > 0 && index >= itemsLength) {
      index = itemsLength - 1;
    }

    if (index !== this.previousActiveItem) {
      this.previousActiveItem = index;

      if (fireCallback) {
        if (onBeforeSnapToItem) {
          this.canFireBeforeCallback = true;
        }

        if (onSnapToItem) {
          this.canFireCallback = true;
        }
      }
    }

    this.itemToSnapTo = index;
    this.scrollOffsetRef = this.positions[index] && this.positions[index].start;
    this.onScrollTriggered = false;

    if (!this.scrollOffsetRef && this.scrollOffsetRef !== 0) {
      return;
    }

    this.scrollTo(this.scrollOffsetRef, animated);

    this.scrollEndOffset = this.currentContentOffset;
  }

  private onBeforeSnap(index: number) {
    const { onBeforeSnapToItem } = this.props;

    if (!this.carouselRef) {
      return;
    }

    this.canFireBeforeCallback = false;
    onBeforeSnapToItem && onBeforeSnapToItem(index);
  }

  onSnap = (index: number) => {
    const { onSnapToItem } = this.props;

    if (!this.carouselRef) {
      return;
    }

    this.canFireCallback = false;
    onSnapToItem && onSnapToItem(index);
  }

  startAutoplay() {
    const { autoplayInterval, autoplayDelay } = this.props;
    this.autoplay = true;

    if (this.autoplaying) {
      return;
    }

    if (this.autoplayTimeout != null) {
      clearTimeout(this.autoplayTimeout);
    }
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
    if (this.autoplayTimeout != null) {
      clearTimeout(this.autoplayTimeout);
    }
    if (this.enableAutoplayTimeout != null) {
      clearTimeout(this.enableAutoplayTimeout);
    }
    if (this.autoplayInterval != null) {
      clearInterval(this.autoplayInterval);
    }
  }

  stopAutoplay() {
    this.autoplay = false;
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

  private getSlideInterpolatedStyle(index: number, animatedValue: any) {
    return defaultAnimatedStyles(index, animatedValue, this.props);
  }

  renderItem = ({ item, index }: { item: any; index: number; }) => {
    const { interpolators } = this.state;
    const {
      itemWidth,
      renderItem,
      slideStyle,
    } = this.props;

    const animatedValue = interpolators && interpolators[index];

    if (!animatedValue && animatedValue !== 0) {
      return null;
    }

    const Component = Animated.View;
    const animatedStyle = this.getSlideInterpolatedStyle(index, animatedValue);
    const mainDimension = { width: itemWidth };
    const specificProps = {};

    return (
      <Component style={[mainDimension, slideStyle, animatedStyle]} pointerEvents={'box-none'} {...specificProps}>
        {renderItem({ item, index })}
      </Component>
    );
  }

  render() {
    const { hideCarousel } = this.state;
    const {
      containerCustomStyle,
      contentContainerCustomStyle,
      sliderWidth,
      style,
      itemWidth,
      loopClonesPerSide,
    } = this.props;

    const { data, renderItem } = this.props;

    if (!data || !renderItem) {
      return null;
    }

    const visibleItems = Math.ceil(sliderWidth / itemWidth) + 1;
    const initialNumPerSide = this.enableLoop() ? loopClonesPerSide : 2;
    const initialNumToRender = visibleItems + (initialNumPerSide * 2);
    const maxToRenderPerBatch = 1 + (initialNumToRender * 2);
    const windowSize = maxToRenderPerBatch;

    const props = {
      horizontal: true,
      numColumns: 1,
      data: this.getCustomData(),
      renderItem: this.renderItem,
      onScrollBeginDrag: this.onScrollBeginDrag,
      onScrollEndDrag: this.onScrollEndDrag,
      onTouchStart: this.onTouchStart,
      onTouchEnd: this.onScrollEnd,
      onLayout: this.onLayout,
      keyExtractor: this.getKeyExtractor,
      onScroll: this.onScrollHandler,
      scrollEventThrottle: 1,
      contentContainerStyle: [
        {
          paddingLeft: this.getContainerInnerMargin(),
          paddingRight: this.getContainerInnerMargin()
        },
        contentContainerCustomStyle || {}
      ],
      style: [
        containerCustomStyle || style || {},
        hideCarousel ? { opacity: 0 } : {},
        { width: sliderWidth, flexDirection: 'row' }
      ],
      initialNumToRender: initialNumToRender,
      maxToRenderPerBatch: maxToRenderPerBatch,
      windowSize: windowSize,
      directionalLockEnabled: true,
      pinchGestureEnabled: false,
      scrollsToTop: false,
      removeClippedSubviews: true,
      decelerationRate: 'fast',
      showsHorizontalScrollIndicator: false,
      showsVerticalScrollIndicator: false,
      overScrollMode: 'never',
      automaticallyAdjustContentInsets: false,
    };

    return (<Animated.FlatList {...props} ref={this.carouselRef}/>);
  }
}