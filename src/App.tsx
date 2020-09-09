import { DownloadProgress } from 'components/DownloadProgress';
import { registerRootComponent } from 'expo';
import React, { useCallback, useState } from 'react';
import { Button } from 'react-native';

import useCachedResources from './hooks/useCachedResources';
import useColorScheme from './hooks/useColorScheme';

export default function App() {
  const isLoadingComplete = useCachedResources();
  const colorScheme = useColorScheme();

  const [progress, setProgress] = useState(0);
  const handlePress = useCallback(() => {
    setProgress(progress + 10 > 100 ? 0 : progress + 10);
  }, [progress]);

  if (!isLoadingComplete) {
    return null;
  } else {
    // return (<CarouselApp />);
    // return (
    //   <DownloadProgress
    //     activeColor="darkgrey"
    //     passiveColor="darkviolet"
    //     baseColor="white"
    //     width={30}
    //     percent={100}
    //     radius={15}
    //     duration={1000}
    //   />
    // );
    return (
      <>
        <DownloadProgress percent={progress} />
        <Button onPress={handlePress} title={'click'} />
      </>
    );
  }
}

/*
export default function App() {
  const isLoadingComplete = useCachedResources();
  const colorScheme = useColorScheme();

  if (!isLoadingComplete) {
    return null;
  } else {
    return (
      <SafeAreaProvider>
        <Navigation colorScheme={colorScheme} />
        <Navigation2 />
        <Navigation3 />
        <StatusBar />
      </SafeAreaProvider>
    );
  }
}
*/

registerRootComponent(App);
