import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { MapPin, CheckCircle, ArrowLeft, ShieldCheck, User as UserIcon, Zap, PhoneCall } from 'lucide-react-native';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [contactProfile, setContactProfile] = useState(null);

  useEffect(() => {
    loadOrderDetails();
    
    const channel = supabase.channel(`public:orders:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, payload => {
        setOrder(payload.new);
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, [id]);

  const loadOrderDetails = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();

    if (error) {
      Alert.alert('Error', error.message);
      router.back();
    } else {
      setOrder(data);
      if (user && data) {
        // If I am requester and someone is fulfilling -> fetch their profile
        // If I am fulfiller -> fetch requester profile
        let fetchId = null;
        if (data.requester_id === user.id && data.fulfiller_id) fetchId = data.fulfiller_id;
        else if (data.fulfiller_id === user.id) fetchId = data.requester_id;

        if (fetchId) {
          const { data: profileData } = await supabase.from('profiles').select('*').eq('id', fetchId).single();
          if (profileData) setContactProfile(profileData);
        }
      }
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (statusUpdate) => {
    const { error } = await supabase.from('orders').update(statusUpdate).eq('id', order.id);
    if (error) Alert.alert('Action Failed', error.message);
    else loadOrderDetails();
  };

  const openLocation = async (url) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert('Error', `Cannot open native Maps for URL: ${url}`);
  };

  if (loading) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#FFF" /></View>;
  if (!order) return null;

  const isMine = order.requester_id === currentUser?.id;
  const isServing = order.fulfiller_id === currentUser?.id;
  const shortCourierId = order.fulfiller_id ? order.fulfiller_id.substring(0, 8).toUpperCase() : null;

  return (
    <View style={styles.container}>
      {/* Dynamic Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}><ArrowLeft size={24} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Relay Intel</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Top Status */}
        <View style={styles.statusBlock}>
          <Text style={styles.statusLabel}>MISSION STATUS</Text>
          <Text style={[styles.statusValue, { color: order.status === 'completed' ? '#3fb950' : (order.status === 'accepted' ? '#2f81f7' : '#d29922') }]}>
            {order.status === 'completed' ? 'SECURED' : (order.status === 'accepted' ? 'IN TRANSIT' : 'AWAITING COURIER')}
          </Text>
        </View>

        {/* Dynamic Partner Contact Block (Courier OR Requester depending on who views it) */}
        {contactProfile && (
          <View style={styles.courierCard}>
            <Text style={styles.sectionHeader}>{isServing ? 'Requester Coordinates' : 'Courier Assigned'}</Text>
            <View style={styles.courierRow}>
              <View style={styles.courierAvatar}>
                <UserIcon size={24} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.courierId}>AGT {contactProfile.id.substring(0, 6)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <ShieldCheck size={14} color="#3fb950" style={{marginRight: 4}}/>
                  <Text style={styles.courierBadge}>{contactProfile.is_verified ? 'Identity Verified' : 'ID Pending'}</Text>
                </View>
              </View>
              {contactProfile.phone && (
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${contactProfile.phone}`)}>
                  <PhoneCall size={20} color="#000" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.sectionHeader}>Manifest</Text>
          <Text style={styles.manifestText}>{order.item_description}</Text>
          <Text style={styles.metaData}>Relay Type: {order.type.toUpperCase()}</Text>
        </View>

        {order.location_url ? (
          <View style={styles.mapCard}>
            <Text style={styles.sectionHeader}>Target Coordinates</Text>
            {/* WebView removed since embedding throws errors or doesn't resolve deep links */}
            <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => openLocation(order.location_url)}>
              <MapPin size={18} color="#FFF" style={{marginRight: 8}} />
              <Text style={styles.secondaryActionBtnText}>Launch Externally in Maps</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {order.image_url ? (
          <View style={styles.intelCard}>
            <Text style={styles.sectionHeader}>Visual Intel</Text>
            <Image source={{ uri: order.image_url }} style={styles.previewImage} resizeMode="cover" />
          </View>
        ) : null}

        <View style={styles.actionsContainer}>
          {isMine && order.status === 'accepted' ? (
            <TouchableOpacity style={[styles.primaryActionBtn, {backgroundColor: '#FFF'}]} onPress={() => handleUpdateStatus({ status: 'completed' })}>
              <CheckCircle size={18} color="#000" style={{marginRight: 8}} />
              <Text style={[styles.primaryActionBtnText, {color: '#000'}]}>Confirm Drop-off</Text>
            </TouchableOpacity>
          ) : isServing && order.status === 'accepted' ? (
            <TouchableOpacity style={[styles.primaryActionBtn, {backgroundColor: '#FFF'}]} onPress={() => handleUpdateStatus({ status: 'completed' })}>
              <Zap size={18} color="#000" fill="#000" style={{marginRight: 8}} />
              <Text style={[styles.primaryActionBtnText, {color: '#000'}]}>I Have Delivered This</Text>
            </TouchableOpacity>
          ) : order.status === 'pending' && !isMine ? (
            <TouchableOpacity style={[styles.primaryActionBtn, {backgroundColor: '#FFF'}]} onPress={() => handleUpdateStatus({ status: 'accepted', fulfiller_id: currentUser?.id })}>
              <Zap size={18} color="#000" fill="#000" style={{marginRight: 8}} />
              <Text style={[styles.primaryActionBtnText, {color: '#000'}]}>Accept Mission</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 65, paddingBottom: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: '#050505', zIndex: 10 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', letterSpacing: -0.5 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  statusBlock: { alignItems: 'center', marginBottom: 32, marginTop: 10 },
  statusLabel: { fontSize: 12, fontWeight: '800', color: '#666', letterSpacing: 2, marginBottom: 8 },
  statusValue: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  
  courierCard: { backgroundColor: '#0A0A0A', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 20 },
  courierRow: { flexDirection: 'row', alignItems: 'center' },
  courierAvatar: { width: 44, height: 44, borderRadius: 25, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  courierId: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: 1 },
  courierBadge: { color: '#888', fontSize: 12, fontWeight: '600' },
  callBtn: { backgroundColor: '#FFF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  
  infoCard: { backgroundColor: '#0A0A0A', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 20 },
  manifestText: { fontSize: 18, color: '#FFF', lineHeight: 28, marginBottom: 12 },
  metaData: { fontSize: 13, color: '#666', fontWeight: '600', letterSpacing: 0.5 },
  
  mapCard: { backgroundColor: '#0A0A0A', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 20 },
  intelCard: { backgroundColor: '#0A0A0A', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 32 },
  previewImage: { width: '100%', height: 250, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  actionsContainer: { marginTop: 10 },
  primaryActionBtn: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  primaryActionBtnText: { color: '#000', fontSize: 18, fontWeight: '700' },
  secondaryActionBtn: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  secondaryActionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
