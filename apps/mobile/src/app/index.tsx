import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glow} />
      <View style={styles.content}>
        <Image
          accessibilityIgnoresInvertColors
          source={require('@/assets/images/meadtools-logo.png')}
          style={styles.mark}
        />
        <Text accessibilityRole="header" style={styles.brand}>
          MEADTOOLS
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#171717',
  },
  glow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#F5A623',
    opacity: 0.12,
    top: '50%',
    left: '50%',
    transform: [{ translateX: -180 }, { translateY: -210 }],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  mark: {
    width: 196,
    height: 168,
    resizeMode: 'contain',
  },
  brand: {
    color: '#FAFAFA',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 7,
  },
});
