import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { supabase } from '../services/supabase';
import { BlurView } from 'expo-blur';
import { AntDesign } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ShieldCheck } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [studentIdImage, setStudentIdImage] = useState(null);
  
  const [loading, setLoading] = useState(false);

  const handleSupabaseGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectTo = makeRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success') {
          const { params, errorCode } = QueryParams.getQueryParams(res.url);
          if (errorCode) throw new Error(errorCode);
          if (params.access_token && params.refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
            });
            if (sessionError) throw sessionError;
          }
        }
      }
    } catch (e) { Alert.alert('OAuth Error', e.message); } 
    finally { setLoading(false); }
  };

  const handleSignIn = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please enter email and password');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Authentication Failed', error.message);
    setLoading(false);
  };

  const handlePickStudentId = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setStudentIdImage(result.assets[0].uri);
  };

  const handleSignUp = async () => {
    if (!email || !password || !phone || !rollNumber || !studentIdImage) {
      return Alert.alert('Error', 'Please fill all fields and upload your Student ID proof.');
    }
    setLoading(true);
    try {
      const ext = studentIdImage.split('.').pop() || 'jpg';
      const fileName = `student_ids/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const response = await fetch(studentIdImage);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage.from('images').upload(fileName, blob, { contentType: `image/${ext}` });
      if (uploadError) throw new Error(uploadError.message);
      
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);

      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw new Error(authError.message);
      
      if (authData?.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          phone,
          roll_number: rollNumber,
          student_id_url: publicUrl,
          is_verified: false
        });
        if (profileError) throw new Error(profileError.message);
        
        Alert.alert('Registration Successful', 'Your profile is awaiting verification. You can log in now!');
        setIsLogin(true);
      }
    } catch(e) {
      Alert.alert('Registration Failed', e.message);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <BlurView intensity={30} tint="dark" style={styles.card}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Relay</Text>
          <Text style={styles.subtitle}>Peer-to-peer delivery network.</Text>
          
          <TextInput style={styles.input} placeholder="Email address" placeholderTextColor="#666" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />

          {!isLogin && (
            <>
              <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#666" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <TextInput style={styles.input} placeholder="University Roll Number" placeholderTextColor="#666" value={rollNumber} onChangeText={setRollNumber} autoCapitalize="characters" />
              
              <TouchableOpacity style={styles.imageActionBtn} onPress={handlePickStudentId}>
                <Camera size={18} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.imageActionBtnText}>{studentIdImage ? 'Student ID Attached' : 'Attach Student ID card'}</Text>
              </TouchableOpacity>
              {studentIdImage && <Image source={{ uri: studentIdImage }} style={styles.thumbImage} />}
            </>
          )}

          {loading ? (
            <ActivityIndicator size="small" color="#FFF" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.primaryBtn} onPress={isLogin ? handleSignIn : handleSignUp} activeOpacity={0.8}>
                {isLogin ? null : <ShieldCheck size={18} color="#FFF" style={{marginRight: 8}} />}
                <Text style={styles.primaryBtnText}>{isLogin ? 'Log In' : 'Submit Registration'}</Text>
              </TouchableOpacity>
              
              {isLogin && (
                <TouchableOpacity style={styles.googleBtn} onPress={handleSupabaseGoogleSignIn} activeOpacity={0.8}>
                  <View style={styles.googleBtnContent}>
                    <AntDesign name="google" size={20} color="#000" />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsLogin(!isLogin)} activeOpacity={0.6}>
                <Text style={styles.secondaryBtnText}>{isLogin ? 'Create Account' : 'Back to Login'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </BlurView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, padding: 32, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)', maxHeight: '90%' },
  title: { color: '#FFF', fontSize: 32, fontWeight: '600', letterSpacing: -1, marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, color: '#FFF', fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  imageActionBtn: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  imageActionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  thumbImage: { width: '100%', height: 100, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  buttonContainer: { marginTop: 12, gap: 12 },
  primaryBtn: { flexDirection: 'row', backgroundColor: '#333', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#444' },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  googleBtn: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, alignItems: 'center' },
  googleBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleBtnText: { color: '#000', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { backgroundColor: 'transparent', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  secondaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '500' }
});
