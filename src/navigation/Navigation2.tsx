import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import SubScreen from '../screens/SubScreen';
import TabOneScreen from '../screens/TabOneScreen';

const Stack = createStackNavigator();

export function Navigation2() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="TabOneScreen"
          component={TabOneScreen}
          options={{ headerTitle: 'Tab One Title' }}
        />
        <Stack.Screen
          name="SubScreen"
          component={SubScreen}
          options={{ headerTitle: 'SubScreen' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}