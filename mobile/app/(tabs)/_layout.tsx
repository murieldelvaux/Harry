import React from 'react';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none',
          height: 0,
          borderTopWidth: 0,
          elevation: 0,
          opacity: 0,
          position: 'absolute',
        },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="expenses" />
      <Tabs.Screen name="goals" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="shopping-list" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
