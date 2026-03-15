import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useDrawer } from '@/providers/DrawerProvider';

interface ScreenHeaderProps {
  title: string;
  rightContent?: React.ReactNode;
}

export default function ScreenHeader({ title, rightContent }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={openDrawer}
          style={styles.menuButton}
          activeOpacity={0.7}
          testID="menu-button"
        >
          <Menu size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.rightSlot}>
          {rightContent}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginLeft: 14,
    letterSpacing: -0.3,
  },
  rightSlot: {
    marginLeft: 8,
  },
});
