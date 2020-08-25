import EditScreenInfo from 'components/EditScreenInfo';
import { Text, View } from 'components/Themed';
import * as React from 'react';
import { Button, StyleSheet } from 'react-native';

export default function TabOneScreen({ navigation: { navigate } }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab One</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <EditScreenInfo path="/screens/TabOneScreen.tsx" />
      <Button
        title={"Go to SubScreen"}
        onPress={() => navigate('SubScreen')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
