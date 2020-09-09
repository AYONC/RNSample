import { timing } from 'components/utils';
import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { set, useCode, Value } from 'react-native-reanimated';
import { CircularProgressInner } from './CircularProgressInner';

export const DownloadProgress = ({
  width = 30,
  radius = 15,
  percent = 20,
}: any) => {
  const prev = useRef<number>();
  const progress = new Value(0);
  useCode(() => {
    const dest = percent / 100;
    const anim = set(
      progress,
      timing({
        duration: 1000 * dest,
        fromValue: prev.current,
        toValue: dest,
      }),
    );
    prev.current = dest;
    return anim;
  }, [progress]);

  const bgColor = 'gray';
  const fgColor = 'blue';

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <CircularProgressInner
          bg={bgColor}
          fg={fgColor}
          {...{ progress }}
          radius={radius}
        />
      </View>
      <View style={styles.overlay}>
        <View
          style={{
            width: radius * 2 - width,
            height: radius * 2 - width,
            borderRadius: radius - width / 2,
            backgroundColor: bgColor,
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
