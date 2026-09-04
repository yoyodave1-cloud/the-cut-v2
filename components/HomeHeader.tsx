import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';

const HEADER_STRAPLINE = 'Pro golf · Creator golf · All golf';
const LOGO_SPIN_MS = 4000;
const STRAPLINE_TYPE_MS = 2000;

export default function HomeHeader() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const spin = useRef(new Animated.Value(0)).current;
  const [typed, setTyped] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      setStatusBarStyle('light');
    }, []),
  );

  useEffect(() => {
    spin.setValue(0);
    setTyped('');
    let typeTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    Animated.timing(spin, {
      toValue: 1,
      duration: LOGO_SPIN_MS,
      easing: Easing.bezier(0.12, 0.72, 0.22, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || cancelled) return;
      const total = HEADER_STRAPLINE.length;
      const step = STRAPLINE_TYPE_MS / total;
      const tick = (count: number) => {
        if (cancelled) return;
        setTyped(HEADER_STRAPLINE.slice(0, count));
        if (count < total) {
          typeTimer = setTimeout(() => tick(count + 1), step);
        }
      };
      tick(1);
    });

    return () => {
      cancelled = true;
      if (typeTimer) clearTimeout(typeTimer);
    };
  }, [spin]);

  const rotateY = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1800deg'],
  });

  return (
    <>
      {isFocused ? <StatusBar style="light" /> : null}
      <View style={[styles.navbar, { paddingTop: insets.top + 14 }]}>
        <View style={styles.navbarLeft}>
          <View style={styles.markLogoSlot}>
            <Animated.View
              style={[
                styles.markLogo,
                { transform: [{ perspective: 900 }, { rotateY }] },
              ]}
            >
              <Image
                source={require('../assets/logo-ball-marker-transparent.png')}
                style={styles.markLogoImage}
                resizeMode="contain"
              />
            </Animated.View>
          </View>
          <Text style={styles.headerStrapline} numberOfLines={1}>
            {typed}
          </Text>
        </View>
        <View style={styles.profileButton}>
          <Ionicons name="person-outline" size={16} color="#FFFFFF" />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  navbar: {
    zIndex: 20,
    backgroundColor: colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(138,155,176,0.16)',
    paddingLeft: 10,
    paddingRight: 16,
    paddingBottom: 14,
    overflow: 'visible',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navbarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 14,
  },
  markLogoSlot: {
    width: 88,
    height: 44,
    overflow: 'visible',
  },
  markLogo: {
    position: 'absolute',
    width: 88,
    height: 88,
    top: -22,
    left: 0,
  },
  markLogoImage: {
    width: 88,
    height: 88,
  },
  headerStrapline: {
    color: colors.voltCyan,
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.mutedGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
