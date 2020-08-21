import * as React from 'react';
import { Dimensions, SafeAreaView, Text, View } from 'react-native';

import Carousel from 'react-native-snap-carousel';

type CarouselAppState = {
  carouselItems: any[];
  activeIndex: number;
}

export class CarouselApp extends React.Component<{}, CarouselAppState> {
  constructor(props: any) {
    super(props);
    this.state = {
      activeIndex: 0,
      carouselItems: [
        {
          title: 'Item 1',
          text: 'Text 1',
        },
        {
          title: 'Item 2',
          text: 'Text 2',
        },
        {
          title: 'Item 3',
          text: 'Text 3',
        },
        {
          title: 'Item 4',
          text: 'Text 4',
        },
        {
          title: 'Item 5',
          text: 'Text 5',
        },
      ]
    }
  }

  _renderItem({ item, index }: { item: any, index: number }) {
    return (
      <View
        style={{
          backgroundColor: 'floralwhite',
          borderRadius: 5,
          height: 250,
          padding: 20,
          marginLeft: 10,
          marginRight: 10,
        }}
      >
        <Text style={{ fontSize: 30, textAlign: 'center', lineHeight: 100 }}>{item.title}</Text>
        <Text style={{ textAlign: 'center', lineHeight: 100 }}>{item.text}</Text>
      </View>

    )
  }

  render() {
    const { carouselItems } = this.state;
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const marginTop = (screenHeight - 250) / 2;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rebeccapurple' }}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', marginTop }}>
          <Carousel
            layout={'default'}
            data={carouselItems}
            sliderWidth={screenWidth}
            itemWidth={screenWidth - 20}
            renderItem={this._renderItem}
            autoplay={true}
            autoplayDelay={300}
            loop={true}
            loopClonesPerSide={carouselItems.length}
            onSnapToItem={index => this.setState({ activeIndex: index })} />
        </View>
      </SafeAreaView>
    );
  }
}

