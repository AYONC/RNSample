import { createStackNavigator } from '@react-navigation/stack';
import * as React from 'react';
import TabTwoScreen from 'screens/TabTwoScreen';
import { TabTwoParamList } from 'types';

const TabTwoStack = createStackNavigator<TabTwoParamList>();

export const TabTwoNavigator = () => (
  <TabTwoStack.Navigator>
    <TabTwoStack.Screen
      name="TabTwoScreen"
      component={TabTwoScreen}
      options={{ headerTitle: '두번째 탭 타이틀' }}
    />
  </TabTwoStack.Navigator>
);

