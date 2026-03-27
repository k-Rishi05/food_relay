import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, LayoutAnimation, ScrollView } from 'react-native';
import { supabase } from '../../services/supabase';
import { useRouter } from 'expo-router';
import { Plus, Package, Utensils, CheckCircle, Clock, Check } from 'lucide-react-native';
import Header from '../../components/Header';
import Slider from '@react-native-community/slider';

export default function MyOrdersScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);

  // Create Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState('gate');
  const [description, setDescription] = useState('');
  const [rewardOption, setRewardOption] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadOrders();
    const channel = supabase.channel('my_orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const configureAnimation = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const loadOrders = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
    if (!currentUser) return;

    const { data, error } = await supabase.from('orders')
      .select('*')
      .eq('requester_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      configureAnimation();
      setActiveOrders(data.filter(o => o.status !== 'completed'));
      setHistoryOrders(data.filter(o => o.status === 'completed'));
    }
    setLoading(false);
  };

  const handleSubmitRequest = async () => {
    if (!description || !user) return Alert.alert('Error', 'Please enter a description.');
    setIsSubmitting(true);
    try {
      const { error: dbError } = await supabase.from('orders').insert([{
        requester_id: user.id,
        type: type,
        item_description: description,
        reward_amount: rewardOption, // Adding the selected reward amount
        status: 'pending'
        // NOTE: Make sure reward_amount exists in your Supabase schema!
      }]);
      if (dbError) throw new Error(dbError.message);

      configureAnimation();
      setModalVisible(false);
      setDescription('');
      setRewardOption(20);
      loadOrders();
    } catch (e: any) {
      Alert.alert('Submission Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const isGate = item.type === 'gate';
    const isPending = item.status === 'pending';
    
    return (
      <TouchableOpacity onPress={() => router.push(`/order/${item.id}`)} activeOpacity={0.8}>
        <View style={styles.card}>
          <View style={styles.iconOnly}>
            {isGate ? <Package size={22} color="#2f81f7" /> : <Utensils size={22} color="#d29922" />}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{isGate ? 'Gate Pickup' : 'Restaurant Relay'}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>{item.item_description}</Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={[styles.statusText, {color: isPending ? '#d29922' : '#3fb950'}]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const delivererCut = Math.floor(rewardOption * 0.9);
  const platformFee = rewardOption - delivererCut;

  return (
    <View style={styles.container}>
      <Header />

      <View style={styles.content}>
        {/* Massive Request Button */}
        <TouchableOpacity style={styles.giantBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <View style={styles.giantBtnIcon}><Plus size={28} color="#000" /></View>
          <Text style={styles.giantBtnText}>Request a Pickup</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Active Tracking */}
            <Text style={styles.sectionTitle}>ACTIVE ORDER</Text>
            {activeOrders.length === 0 ? (
               <View style={styles.emptyBox}>
                 <Text style={styles.emptyText}>No active relays for you right now.</Text>
               </View>
            ) : (
               activeOrders.map(item => <View key={item.id}>{renderOrderItem({ item })}</View>)
            )}

            {/* History Tracker */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>HISTORY</Text>
            {historyOrders.length === 0 ? (
              <Text style={[styles.emptyText, { marginLeft: 16 }]}>Nothing in history.</Text>
            ) : (
               historyOrders.map(item => <View key={item.id}>{renderOrderItem({ item })}</View>)
            )}
          </ScrollView>
        )}
      </View>

      {/* CREATE MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Draft a Request</Text>
              
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity style={[styles.typeBtn, type === 'gate' && styles.typeBtnActiveGate]} onPress={() => { configureAnimation(); setType('gate'); }}>
                  <Package size={16} color={type === 'gate' ? '#000' : '#888'} />
                  <Text style={[styles.typeBtnText, type === 'gate' && {color: '#000'}]}>Gate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeBtn, type === 'restaurant' && styles.typeBtnActiveRestaurant]} onPress={() => { configureAnimation(); setType('restaurant'); }}>
                  <Utensils size={16} color={type === 'restaurant' ? '#000' : '#888'} />
                  <Text style={[styles.typeBtnText, type === 'restaurant' && {color: '#000'}]}>Restaurant</Text>
                </TouchableOpacity>
              </View>

              <TextInput 
                style={styles.inputGlassRaw} 
                placeholder="Description (e.g. McDonald's Bag)" 
                placeholderTextColor="#666" 
                value={description} 
                onChangeText={setDescription} 
              />

              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Pick a Reward: ₹{rewardOption}</Text>
                <Slider
                  style={{width: '100%', height: 40, marginTop: 10}}
                  minimumValue={10}
                  maximumValue={100}
                  step={5}
                  value={rewardOption}
                  onValueChange={setRewardOption}
                  minimumTrackTintColor="#FFF"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#FFF"
                />
                <View style={styles.feeBreakdown}>
                  <Text style={styles.feeText}>Runner gets: ₹{delivererCut}</Text>
                  <Text style={styles.feeText}>Platform fee (10%): ₹{platformFee}</Text>
                </View>
              </View>

              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" style={{ marginVertical: 20 }} />
              ) : (
                <TouchableOpacity style={[styles.primaryActionBtn, {marginTop: 25}]} onPress={handleSubmitRequest} activeOpacity={0.8}>
                   <Check size={18} color="#000" style={{marginRight: 8}} />
                   <Text style={styles.primaryActionBtnText}>Broadcast Request (₹{rewardOption})</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.dismissBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.dismissBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  
  giantBtn: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#FFF',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 4},
    elevation: 5
  },
  giantBtnIcon: { marginRight: 12 },
  giantBtnText: { color: '#000', fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#666', letterSpacing: 1, marginBottom: 16, marginLeft: 4 },
  
  emptyBox: { 
    padding: 24, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0A0A0A', alignItems: 'center'
  },
  emptyText: { color: '#666', fontSize: 15 },

  card: { 
    flexDirection: 'row', padding: 20, borderRadius: 16, marginBottom: 12, alignItems: 'center', 
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0A0A0A' 
  },
  iconOnly: { marginRight: 16, width: 32, alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#888' },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { 
    width: '100%', backgroundColor: '#0A0A0A', borderTopLeftRadius: 28, borderTopRightRadius: 28, 
    padding: 28, maxHeight: '90%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' 
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 28, color: '#FFF', letterSpacing: -0.5 },
  
  typeSelectorRow: { flexDirection: 'row', marginBottom: 24, gap: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderRadius: 16, gap: 8 },
  typeBtnActiveGate: { backgroundColor: '#FFF', borderColor: '#FFF' },
  typeBtnActiveRestaurant: { backgroundColor: '#FFF', borderColor: '#FFF' },
  typeBtnText: { color: '#888', fontWeight: '600', fontSize: 15 },
  
  inputGlassRaw: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 18, fontSize: 16, color: '#FFF', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  
  sliderContainer: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 10
  },
  sliderLabel: { color: '#FFF', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  feeBreakdown: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  feeText: { color: '#888', fontSize: 13 },

  primaryActionBtn: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  primaryActionBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },
  dismissBtn: { padding: 16, alignItems: 'center' },
  dismissBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
});
