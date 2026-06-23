import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CreatorsTabScreen from '../screens/CreatorsTabScreen';
import CreatorProfilePage from '../screens/CreatorProfilePage';
import type { CreatorsStackParamList } from './creatorsStackTypes';

const Stack = createNativeStackNavigator<CreatorsStackParamList>();

export default function CreatorsStackNavigator() {
  return (
    <Stack.Navigator id="CreatorsStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CreatorsTabScreen" component={CreatorsTabScreen} />
      <Stack.Screen name="CreatorProfilePage" component={CreatorProfilePage} />
    </Stack.Navigator>
  );
}
