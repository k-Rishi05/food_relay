import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SectionList, TouchableOpacity, Modal, TextInput, Image, ActivityIndicator, Alert, Linking, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';
import { useRouter } from 'expo-router';
import { RefreshCcw, LogOut, Plus, ShieldCheck, Camera, Check, Utensils, Package, Zap, Rocket, Box, Globe, ClipboardPaste } from 'lucide-react-native';

// Android LayoutAnimation is automatically enabled in New Architecture

export default function FeedScreen() {
  const router = useRouter();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  
  const [user, setUser] = useState(null);
  
  // Profile Completion State (Catch Google OAuth Users)
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [studentIdImage, setStudentIdImage] = useState(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  // Order Creation State
  const [type, setType] = useState('gate');
  const [description, setDescription] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadOrders();
    const channel = supabase.channel('public:orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders(); }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const configureAnimation = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const loadOrders = async () => {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    if (!currentUser) return;

    // Security Gate: Enforce Profile Verification
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', currentUser.id).single();
    if (!profile) {
      setNeedsProfileCompletion(true);
      setLoading(false);
      return; 
    }

    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      
    if (!error && data) {
      configureAnimation();
      
      const serving = data.filter(o => o.fulfiller_id === currentUser.id && o.status === 'accepted');
      const myRequests = data.filter(o => o.requester_id === currentUser.id && o.status !== 'completed');
      const market = data.filter(o => o.status === 'pending' && o.requester_id !== currentUser.id);

      const newSections = [];
      if (serving.length > 0) newSections.push({ title: 'Active Deliveries', icon: 'Rocket', data: serving });
      if (myRequests.length > 0) newSections.push({ title: 'My Placed Requests', icon: 'Box', data: myRequests });
      if (market.length > 0) newSections.push({ title: 'Available Market', icon: 'Globe', data: market });

      setSections(newSections);
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
    } catch(e) { Alert.alert('Error', e.message); }
    finally { setIsSubmittingProfile(false); }
  };

  const autofillFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text && (text.includes('http') || text.includes('www'))) {
      setLocationUrl(text);
      Alert.alert('Pasted', 'Auto-filled link from clipboard!');
    } else {
      Alert.alert('No Link Found', 'Make sure you copied a Google Maps link first.');
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSubmitRequest = async () => {
    if (!description || !locationUrl || !imageUri || !user) return Alert.alert('Validation Error', 'Please complete all fields.');
    setIsSubmittingProfile(true); // Reusing loader safely
    try {
      const ext = imageUri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage.from('images').upload(fileName, blob, { contentType: `image/${ext}` });
      if (uploadError) throw new Error(uploadError.message);
      
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('orders').insert([{
          requester_id: user.id, type: type, location_url: locationUrl, item_description: description, image_url: publicUrl, status: 'pending'
      }]);
      if (dbError) throw new Error(dbError.message);

      configureAnimation();
      setCreateModalVisible(false);
      setDescription('');
      setLocationUrl('');
      setImageUri(null);
      loadOrders();
    } catch (e) {
      Alert.alert('Submission Error', e.message);
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const renderOrderItem = ({ item }) => {
    const isGate = item.type === 'gate';
    const isMine = item.requester_id === user?.id;
    const isServing = item.fulfiller_id === user?.id && item.status === 'accepted';
    
    return (
      <TouchableOpacity onPress={() => router.push(`/order/${item.id}`)} activeOpacity={0.8}>
        <View style={styles.card}>
          <View style={styles.iconOnly}>{isGate ? <Package size={22} color="#2f81f7" /> : <Utensils size={22} color="#d29922" />}</View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{isGate ? 'Gate Pickup' : 'Restaurant Relay'}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>{item.item_description}</Text>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={[styles.statusText, {color: isServing ? '#2f81f7' : (isMine ? '#d29922' : '#3fb950')}]}>
              {isServing ? 'DELIVERING' : (isMine ? item.status.toUpperCase() : 'AVAILABLE')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }) => {
    let IconComponent = Globe;
    if (section.icon === 'Rocket') IconComponent = Rocket;
    if (section.icon === 'Box') IconComponent = Box;

    return (
      <View style={styles.sectionHeaderWrap}>
        <IconComponent size={14} color="#666" style={{marginRight: 6}} />
        <Text style={styles.sectionHeader}>{section.title}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <Zap size={22} color="#FFF" fill="#FFF" />
          <Text style={styles.headerTitle}>Relay</Text>
        </View>
        <View style={{flexDirection: 'row', gap: 20}}>
          <TouchableOpacity onPress={loadOrders} style={styles.iconBtn}><RefreshCcw size={20} color="#FFF" /></TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}><LogOut size={20} color="#da3633" /></TouchableOpacity>
        </View>
      </View>

      {loading && sections.length === 0 ? (
        <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 50 }} />
      ) : sections.length === 0 ? (
        <Text style={styles.emptyText}>Zero active relays. It's quiet...</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderOrderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          stickySectionHeadersEnabled={false}
        />
      )}

      <TouchableOpacity style={styles.fabWrap} onPress={() => setCreateModalVisible(true)} activeOpacity={0.8}>
        <View style={styles.fab}><Plus size={28} color="#000" /></View>
      </TouchableOpacity>

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

      {/* CREATE MODAL */}
      <Modal visible={isCreateModalVisible} animationType="slide" transparent>
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

              <TextInput style={styles.inputGlassRaw} placeholder="Description (e.g. McDonald's Bag)" placeholderTextColor="#666" value={description} onChangeText={setDescription} />

              <View style={styles.clipboardRow}>
                <TextInput style={[styles.inputGlassRaw, {flex: 1, marginBottom: 0}]} placeholder="Google Maps URL" placeholderTextColor="#666" value={locationUrl} onChangeText={setLocationUrl} keyboardType="url" autoCapitalize="none" />
                <TouchableOpacity style={styles.clipboardBtn} onPress={autofillFromClipboard}>
                  <ClipboardPaste size={20} color="#FFF" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.secondaryActionBtn, {marginTop: 16}]} onPress={handlePickImage} activeOpacity={0.7}>
                <Camera size={18} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.secondaryActionBtnText}>{imageUri ? 'Photo Attached (Tap to Change)' : 'Attach Verification Photo'}</Text>
              </TouchableOpacity>
              
              {imageUri && <Image source={{ uri: imageUri }} style={styles.thumbImage} />}

              {isSubmittingProfile ? (
                <ActivityIndicator size="small" color="#FFF" style={{ marginVertical: 20 }} />
              ) : (
                <TouchableOpacity style={[styles.primaryActionBtn, {marginTop: 15}]} onPress={handleSubmitRequest} activeOpacity={0.8}>
                   <Check size={18} color="#000" style={{marginRight: 8}} />
                   <Text style={styles.primaryActionBtnText}>Broadcast Request</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.dismissBtn} onPress={() => setCreateModalVisible(false)}><Text style={styles.dismissBtnText}>Cancel</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { paddingTop: 65, paddingBottom: 20, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#050505', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', letterSpacing: -0.5 },
  iconBtn: { padding: 4 },
  emptyText: { textAlign: 'center', marginTop: 80, color: '#666', fontSize: 16 },
  
  sectionHeaderWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 12, marginLeft: 4 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  
  card: { flexDirection: 'row', padding: 20, borderRadius: 16, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0A0A0A', overflow: 'hidden' },
  iconOnly: { marginRight: 16, width: 32, alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#888' },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  
  clipboardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clipboardBtn: { backgroundColor: '#333', padding: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#444' },

  fabWrap: { position: 'absolute', bottom: 90, right: 30, borderRadius: 32, elevation: 8, shadowColor: '#FFF', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4}},
  fab: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { width: '100%', backgroundColor: '#0A0A0A', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, maxHeight: '90%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 28, color: '#FFF', letterSpacing: -0.5 },
  
  typeSelectorRow: { flexDirection: 'row', marginBottom: 24, gap: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderRadius: 16, gap: 8 },
  typeBtnActiveGate: { backgroundColor: '#FFF', borderColor: '#FFF' },
  typeBtnActiveRestaurant: { backgroundColor: '#FFF', borderColor: '#FFF' },
  typeBtnText: { color: '#888', fontWeight: '600', fontSize: 15 },
  
  inputGlassRaw: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 18, fontSize: 16, color: '#FFF', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  thumbImage: { width: 100, height: 100, borderRadius: 16, alignSelf: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  primaryActionBtn: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  primaryActionBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },
  secondaryActionBtn: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 16, padding: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  secondaryActionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  dismissBtn: { padding: 16, alignItems: 'center' },
  dismissBtnText: { color: '#666', fontSize: 16, fontWeight: '600' },
});
