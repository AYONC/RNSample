// You can explore the built-in icon families and icons on the web at:
// https://icons.expo.fyi/
import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';

export const TabBarIcon = (props: { name: string; color: string }) => {
  return <Ionicons size={30} style={{ marginBottom: -3 }} {...props} />;
}