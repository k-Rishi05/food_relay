import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import { useRouter } from 'expo-router';
import { ChevronRight, CreditCard, History, Settings, TrendingUp, User } from 'lucide-react-native';
import Header from '../components/Header';

export default function UserProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      const { data } = await supabase.from('profiles').select('phone').eq('id', user.id).single();
      if (data) setPhone(data.phone || '');
    }
    setLoading(false);
  };

  const handleNotImplemented = (feature: string) => {
    Alert.alert('Coming Soon', `${feature} will be available in the next update.`);
  };

  const MenuItem = ({ icon: Icon, title, onPress, value }: { icon: any, title: string, onPress: () => void, value?: string }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuItemLeft}>
        <View style={styles.iconBox}>
          <Icon size={20} color="#FFF" />
        </View>
        <Text style={styles.menuItemTitle}>{title}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {value && <Text style={styles.menuItemValue}>{value}</Text>}
        <ChevronRight size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header showBackButton showLogout />
      
      {loading ? (
        <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.profileHeader}>
            <View style={styles.avatarLarge}>
              <User size={40} color="#FFF" />
            </View>
            <Text style={styles.emailText}>{user?.email}</Text>
            {phone ? <Text style={styles.phoneText}>+91 {phone}</Text> : null}
          </View>

          <Text style={styles.sectionTitle}>FINANCE</Text>
          <View style={styles.sectionBlock}>
            <MenuItem icon={History} title="Earnings History" onPress={() => handleNotImplemented('Earnings History')} />
            <View style={styles.divider} />
            <MenuItem icon={CreditCard} title="Bank & UPI Details" onPress={() => handleNotImplemented('Bank & UPI')} />
          </View>

          <Text style={styles.sectionTitle}>ACTIVITY</Text>
          <View style={styles.sectionBlock}>
            <MenuItem icon={TrendingUp} title="My Stats (Orders of Service)" onPress={() => handleNotImplemented('My Stats')} />
          </View>

          <Text style={styles.sectionTitle}>APP</Text>
          <View style={styles.sectionBlock}>
            <MenuItem icon={Settings} title="App Settings" onPress={() => handleNotImplemented('App Settings')} />
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scrollContent: { padding: 24, paddingBottom: 60 },
  
  profileHeader: { alignItems: 'center', marginBottom: 40, marginTop: 10 },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  emailText: { fontSize: 20, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  phoneText: { fontSize: 15, color: '#888' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 10, marginLeft: 16, letterSpacing: 1 },
  sectionBlock: {
    backgroundColor: '#0F0F0F',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden'
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 16,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  menuItemTitle: { fontSize: 16, fontWeight: '500', color: '#FFF' },
  menuItemRight: { flexDirection: 'row', alignItems: 'center' },
  menuItemValue: { fontSize: 15, color: '#888', marginRight: 8 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 60 }
});
