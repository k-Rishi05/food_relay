import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { supabase } from '../../services/supabase';
import { Package, Utensils, CheckCircle, Clock } from 'lucide-react-native';

import { useRouter } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [requestedOrders, setRequestedOrders] = useState([]);
  const [fulfilledOrders, setFulfilledOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests'); 

  useEffect(() => {
    loadProfileAndHistory();
  }, []);

  const loadProfileAndHistory = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`requester_id.eq.${user.id},fulfiller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setRequestedOrders(data.filter(o => o.requester_id === user.id));
        setFulfilledOrders(data.filter(o => o.fulfiller_id === user.id));
      }
    }
    setLoading(false);
  };

  const renderOrderItem = ({ item }) => {
    const isGate = item.type === 'gate';
    const isCompleted = item.status === 'accepted'; 
    
    return (
      <TouchableOpacity onPress={() => router.push(`/order/${item.id}`)} activeOpacity={0.8}>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.iconOnly}>
              {isGate ? <Package size={22} color="#2f81f7" /> : <Utensils size={22} color="#d29922" />}
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{isGate ? 'Gate Pickup' : 'Restaurant Relay'}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>{item.item_description}</Text>
            </View>
            <View style={styles.statusArea}>
              {isCompleted ? <CheckCircle size={14} color="#3fb950" style={{marginRight: 4}}/> : <Clock size={14} color="#d29922" style={{marginRight: 4}}/>}
              <Text style={[styles.statusText, {color: isCompleted ? '#3fb950' : '#d29922'}]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commander Profile</Text>
        <Text style={styles.emailText}>{user?.email || '...'}</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'requests' && styles.tabBtnActive]} 
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveTab('requests'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'requests' && styles.tabBtnTextActive]}>My Requests ({requestedOrders.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'services' && styles.tabBtnActive]} 
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveTab('services'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'services' && styles.tabBtnTextActive]}>Orders of Service ({fulfilledOrders.length})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={activeTab === 'requests' ? requestedOrders : fulfilledOrders}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No history found here.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: {
    paddingTop: 65, paddingBottom: 20, paddingHorizontal: 24,
    backgroundColor: '#050505', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', letterSpacing: -0.5, marginBottom: 4 },
  emailText: { fontSize: 15, color: '#888' },
  
  tabsContainer: { flexDirection: 'row', padding: 20, paddingBottom: 8, gap: 12 },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabBtnActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  tabBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
  tabBtnTextActive: { color: '#000' },

  emptyText: { textAlign: 'center', marginTop: 80, color: '#666', fontSize: 16 },
  
  card: {
    padding: 20, borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0A0A0A'
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconOnly: { marginRight: 16, width: 32, alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#FFF', marginBottom: 2 },
  cardSubtitle: { fontSize: 14, color: '#888' },
  
  statusArea: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
