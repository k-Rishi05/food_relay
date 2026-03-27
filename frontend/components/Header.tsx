import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';
import { Zap, DollarSign, UserCircle, LogOut, RefreshCcw } from 'lucide-react-native';

interface HeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
  showLogout?: boolean;
}

export default function Header({ showBackButton = false, onBackPress, onRefresh, showRefresh = false, showLogout = false }: HeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        // Fetch profile with wallet balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', currentUser.id)
          .single();
        
        if (profile) {
          setWalletBalance(profile.wallet_balance || 0);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePress = () => {
    router.push('/user-profile');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        }}
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Left: Logo or Back Button */}
      <View style={styles.leftSection}>
        {showBackButton ? (
          <TouchableOpacity onPress={onBackPress || (() => router.back())} style={styles.backButton}>
            <Zap size={22} color="#FFF" fill="#FFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoContainer}>
            <Zap size={22} color="#FFF" fill="#FFF" />
            <Text style={styles.logoText}>Relay</Text>
          </View>
        )}
      </View>

      {/* Right: Refresh + Wallet + Profile + Logout */}
      <View style={styles.rightSection}>
        {showRefresh && (
          <TouchableOpacity onPress={onRefresh} style={styles.iconButton}>
            <RefreshCcw size={20} color="#FFF" />
          </TouchableOpacity>
        )}
        
        {loading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            {/* Wallet Balance */}
            <View style={styles.walletContainer}>
              <DollarSign size={14} color="#3fb950" />
              <Text style={styles.walletText}>₹{walletBalance}</Text>
            </View>

            {/* Profile Icon */}
            <TouchableOpacity onPress={handleProfilePress} style={styles.profileButton} activeOpacity={0.7}>
              {user?.email ? (
                <View style={styles.profileAvatar}>
                  <UserCircle size={24} color="#FFF" />
                </View>
              ) : (
                <View style={styles.profileAvatar}>
                  <UserCircle size={24} color="#666" />
                </View>
              )}
            </TouchableOpacity>

            {/* Logout Button */}
            {showLogout && (
              <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
                <LogOut size={20} color="#da3633" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 65,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(63, 185, 80, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.3)',
    gap: 4,
  },
  walletText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3fb950',
  },
  profileButton: {
    padding: 0,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
