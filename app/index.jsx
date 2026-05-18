import { Redirect } from 'expo-router';
import { useAuth } from './providers/AuthProvider';
import { View, ActivityIndicator } from 'react-native';

export default function RootIndex() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}
