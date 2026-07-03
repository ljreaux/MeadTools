import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glow} />
      <View style={styles.content}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mark}>
          <View style={[styles.cell, styles.cellTopLeft]} />
          <View style={[styles.cell, styles.cellTopRight]} />
          <View style={[styles.cell, styles.cellBottom]} />
        </View>
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
    width: 156,
    height: 144,
  },
  cell: {
    position: 'absolute',
    width: 72,
    height: 82,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#171717',
    transform: [{ rotate: '30deg' }],
  },
  cellTopLeft: {
    top: 0,
    left: 14,
    backgroundColor: '#343434',
  },
  cellTopRight: {
    top: 0,
    right: 14,
    backgroundColor: '#F7B733',
  },
  cellBottom: {
    bottom: 0,
    left: 42,
    backgroundColor: '#D68400',
  },
  brand: {
    color: '#FAFAFA',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 7,
  },
});
