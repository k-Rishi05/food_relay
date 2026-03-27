import { Tabs } from 'expo-router';
import { PackageSearch, Zap } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0A0A',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
          paddingTop: 10,
          paddingBottom: 25,
          height: 85,
        },
        tabBarActiveTintColor: '#FFF',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        }
      }}>
      
      <Tabs.Screen
        name="my-orders"
        options={{
          title: 'My Orders',
          tabBarIcon: ({ color }) => <PackageSearch size={24} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="index"
        options={{
          title: 'Run & Earn',
          tabBarIcon: ({ color }) => <Zap size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
