import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AcademyDashboardScreen from '../screens/academy/AcademyDashboardScreen';
import SessionHistoryScreen from '../screens/academy/SessionHistoryScreen';
import ShotTypeSelectScreen from '../screens/academy/ShotTypeSelectScreen';
import RecordUploadScreen from '../screens/academy/RecordUploadScreen';
import SwingAnalysisScreen from '../screens/academy/SwingAnalysisScreen';
import CompareSwingsScreen from '../screens/academy/CompareSwingsScreen';
import RecommendationsScreen from '../screens/academy/RecommendationsScreen';
import type { AcademyStackParamList } from './academyStackTypes';

const Stack = createNativeStackNavigator<AcademyStackParamList>();

export default function AcademyStackNavigator() {
  return (
    <Stack.Navigator id="AcademyStack" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AcademyDashboard" component={AcademyDashboardScreen} />
      <Stack.Screen name="SessionHistory" component={SessionHistoryScreen} />
      <Stack.Screen name="ShotTypeSelect" component={ShotTypeSelectScreen} />
      <Stack.Screen name="RecordUpload" component={RecordUploadScreen} />
      <Stack.Screen name="SwingAnalysis" component={SwingAnalysisScreen} />
      <Stack.Screen name="CompareSwings" component={CompareSwingsScreen} />
      <Stack.Screen name="Recommendations" component={RecommendationsScreen} />
    </Stack.Navigator>
  );
}
