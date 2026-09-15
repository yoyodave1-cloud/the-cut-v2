import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_900Black } from '@expo-google-fonts/playfair-display';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { RockSalt_400Regular } from '@expo-google-fonts/rock-salt';
import { PlatformPressable } from '@react-navigation/elements';
import { NavigationContainer } from '@react-navigation/native';
import {
  BottomTabBarButtonProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from './HomeScreen';
import HomeTabScreen from './screens/HomeTabScreen';
import WatchLaterPage from './screens/WatchLaterPage';
import CreatorsStackNavigator from './navigation/CreatorsStackNavigator';
import { colors } from './constants/colors';
import { AuthProvider } from './context/AuthContext';
import { WatchLaterProvider } from './context/WatchLaterContext';
import type { MainTabParamList, RootStackParamList } from './navigation/rootStackTypes';

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const TAB_BAR_CONTENT_HEIGHT = 28;

function TabBarButton({ style, children, ...rest }: BottomTabBarButtonProps) {
  return (
    <PlatformPressable {...rest} style={[style, styles.tabBarButton]}>
      <View style={styles.tabBarButtonContent}>{children}</View>
    </PlatformPressable>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      id="MainTabs"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.mutedGrey,
        tabBarStyle: {
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: 0,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarButton: TabBarButton,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTabScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Tour"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="golf-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Creators"
        component={CreatorsStackNavigator}
        options={{
          title: 'Creator',
          tabBarLabel: 'Creator',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_900Black,
    BricolageGrotesque_800ExtraBold,
    RockSalt_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <WatchLaterProvider>
          <NavigationContainer>
            <RootStack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
              <RootStack.Screen name="MainTabs" component={MainTabs} />
              <RootStack.Screen name="WatchLater" component={WatchLaterPage} />
            </RootStack.Navigator>
          </NavigationContainer>
        </WatchLaterProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBarItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabBarButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  tabBarButtonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBarIcon: {
    marginBottom: 0,
  },
  tabBarLabel: {
    marginTop: 0,
    marginBottom: 0,
  },
});
