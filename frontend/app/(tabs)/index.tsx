import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, TextInput, Image, ActivityIndicator, Alert, LayoutAnimation } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabase';
import { useRouter } from 'expo-router';
import { ShieldCheck, Camera, Check, Utensils, Package, Globe } from 'lucide-react-native';
import Header from '../../components/Header';

export default function FeedScreen() {
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [user, setUser] = useState<any>(null);
  
  // Profile Completion State
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [studentIdImage, setStudentIdImage] = useState<string | null>(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  useEffect(() => {
    loadOrders();
    const channel = supabase.channel('public:orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const configureAnimation = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const loadOrders = async () => {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    if (!currentUser) return;

    // Security Gate
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', currentUser.id).single();
    if (!profile) {
      setNeedsProfileCompletion(true);
      setLoading(false);
      return; 
    }

    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      
    if (!error && data) {
      configureAnimation();
      const market = data.filter(o => o.status === 'pending' && o.requester_id !== currentUser.id);
      setFeed(market);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const handlePickStudentId = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setStudentIdImage(result.assets[0].uri);
  };

  const handleCompleteProfile = async () => {
    if (!phone || !rollNumber || !studentIdImage || !user) return Alert.alert('Error', 'Please fill all fields and attach your Student ID.');
    setIsSubmittingProfile(true);
    try {
      const ext = studentIdImage.split('.').pop() || 'jpg';
      const fileName = `student_ids/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const response = await fetch(studentIdImage);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage.from('images').upload(fileName, blob, { contentType: `image/${ext}` });
      if (uploadError) throw new Error(uploadError.message);
      
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);

      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id, phone, roll_number: rollNumber, student_id_url: publicUrl, is_verified: false
      });
      if (profileError) throw new Error(profileError.message);
      
      setNeedsProfileCompletion(false);
      loadOrders();
    } catch(e: any) { Alert.alert('Error', e.message); }
    finally { setIsSubmittingProfile(false); }
  };

  const handleAcceptOrder = async (orderId: string) => {
    Alert.alert('Accept Relay?', 'Are you sure you want to run this relay?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: async () => {
          const { error } = await supabase.from('orders').update({
            fulfiller_id: user.id,
            status: 'accepted'
          }).eq('id', orderId);

          if (error) Alert.alert('Error', error.message);
          else loadOrders();
      }}
    ]);
  };

  const renderJobCard = ({ item }: { item: any }) => {
    const isGate = item.type === 'gate';
    const totalReward = item.reward_amount || 20;
    const runnerCut = Math.floor(totalReward * 0.9);
    
    return (
      <View style={styles.cardInfoBox}>
        <View style={styles.jobTop}>
          <View style={styles.jobIconWrap}>
            {isGate ? <Package size={20} color="#000" /> : <Utensils size={20} color="#000" />}
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.jobActionText}>{isGate ? 'Gate Pickup' : 'Restaurant Relay'}</Text>
            <Text style={styles.jobDesc} numberOfLines={2}>{item.item_description}</Text>
          </View>
        </View>

        <View style={styles.jobDivider} />
        
        <View style={styles.jobBottom}>
          <Text style={styles.rewardText}>Earn ₹{runnerCut}</Text>
          
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptOrder(item.id)} activeOpacity={0.8}>
            <Text style={styles.acceptBtnText}>ACCEPT RUN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header showRefresh onRefresh={loadOrders} />

      {loading && feed.length === 0 ? (
        <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 50 }} />
      ) : feed.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Globe size={40} color="#333" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>The grid is quiet. No runs available.</Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderJobCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListHeaderComponent={<Text style={styles.feedTitle}>Available Runs</Text>}
        />
      )}

      {/* PROFILE COMPLETION SECURITY GATE */}
      <Modal visible={needsProfileCompletion} animationType="slide" transparent={false}>
        <View style={[styles.container, { padding: 32, justifyContent: 'center' }]}>
          <Text style={[styles.modalTitle, {fontSize: 28, marginBottom: 8}]}>Hold Up Agent.</Text>
          <Text style={{color: '#888', marginBottom: 32, fontSize: 16, lineHeight: 22}}>We detected a Google SSO log-in without Student Identity Verification. To access the grid, you must prove your clearance level.</Text>
          
          <TextInput style={styles.inputGlassRaw} placeholder="Phone Number" placeholderTextColor="#666" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.inputGlassRaw} placeholder="University Roll Number" placeholderTextColor="#666" value={rollNumber} onChangeText={setRollNumber} autoCapitalize="characters" />
          
          <TouchableOpacity style={[styles.secondaryActionBtn, {marginBottom: 24}]} onPress={handlePickStudentId}>
            <Camera size={18} color="#FFF" style={{marginRight: 8}} />
            <Text style={styles.secondaryActionBtnText}>{studentIdImage ? 'Student ID Attached' : 'Attach Student ID card'}</Text>
          </TouchableOpacity>
          {studentIdImage && <Image source={{ uri: studentIdImage }} style={styles.thumbImage} />}

          {isSubmittingProfile ? (
             <ActivityIndicator size="small" color="#FFF" style={{marginVertical: 10}} />
          ) : (
            <TouchableOpacity style={[styles.primaryActionBtn, {backgroundColor: '#FFF'}]} onPress={handleCompleteProfile}>
               <ShieldCheck size={18} color="#000" style={{marginRight: 8}} />
               <Text style={[styles.primaryActionBtnText, {color: '#000'}]}>Verify & Enter Grid</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleLogout} style={{marginTop: 20, alignItems: 'center'}}>
            <Text style={{color: '#da3633', fontWeight: 'bold', fontSize: 16}}>Abort & Log Out</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 16, maxWidth: 200 },
  
  feedTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', letterSpacing: -0.5, marginBottom: 20, marginLeft: 8 },

  cardInfoBox: { 
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
    overflow: 'hidden'
  },
  jobTop: { flexDirection: 'row', padding: 20, alignItems: 'center' },
  jobIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  jobActionText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  jobDesc: { color: '#888', fontSize: 14, marginTop: 4 },
  
  jobDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  
  jobBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'rgba(255,255,255,0.02)' },
  rewardText: { color: '#3fb950', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  acceptBtn: { backgroundColor: '#FFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  acceptBtnText: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 28, color: '#FFF', letterSpacing: -0.5 },
  inputGlassRaw: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 18, fontSize: 16, color: '#FFF', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  thumbImage: { width: 100, height: 100, borderRadius: 16, alignSelf: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  primaryActionBtn: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  primaryActionBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },
  secondaryActionBtn: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  secondaryActionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
