// Each tab has its own navigation stack, you can read more about this pattern here:
// https://reactnavigation.org/docs/tab-based-navigation#a-stack-navigator-for-each-tab
import { createStackNavigator } from '@react-navigation/stack';
import * as React from 'react';
import TabOneScreen from '../screens/TabOneScreen';
import { TabOneParamList } from '../types';

const TabOneStack = createStackNavigator<TabOneParamList>();

export const TabOneNavigator = () => (
  <TabOneStack.Navigator>
    <TabOneStack.Screen
      name="TabOneScreen"
      component={TabOneScreen}
      options={{ headerTitle: 'Tab One Title' }}
    />
  </TabOneStack.Navigator>
);
