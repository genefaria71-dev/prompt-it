import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/(auth)');
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#43f5d5" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null; // will redirect via useEffect
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="create-project"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="project/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="workflows"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="marketplace"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#080a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
