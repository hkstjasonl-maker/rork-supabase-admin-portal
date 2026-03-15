import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import Sidebar from '@/components/Sidebar';
import { Colors } from '@/constants/colors';

export default function DrawerLayout() {
  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'none',
        }}
      />
      <Sidebar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
