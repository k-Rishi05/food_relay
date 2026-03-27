import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { fetchPendingOrders, acceptOrder, createOrder } from "./services/api";

export default function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);

  // Form State
  const [type, setType] = useState("gate");
  const [description, setDescription] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await fetchPendingOrders();
      setOrders(data);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleAcceptOrder = async (orderId) => {
    try {
      await acceptOrder(orderId);
      Alert.alert("Success", "Order accepted successfully!");
      setSelectedOrder(null);
      loadOrders(); // Refresh
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmitRequest = async () => {
    if (!description || !locationUrl || !imageUri) {
      Alert.alert(
        "Validation Error",
        "Please provide a description, location URL, and select an image.",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrder({ type, locationUrl, description, imageUri });
      Alert.alert("Success", "Relay request created!");
      setCreateModalVisible(false);

      // Reset form
      setDescription("");
      setLocationUrl("");
      setImageUri(null);
      setType("gate");

      loadOrders();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openLocation = async (url) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", `Cannot open this URL: ${url}`);
    }
  };

  const renderOrderItem = ({ item }) => {
    const isGate = item.type === "gate";
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedOrder(item)}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: isGate ? "#2196F3" : "#F44336" },
          ]}
        >
          <Text style={styles.avatarText}>{isGate ? "G" : "R"}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>
            {isGate ? "Gate Pickup" : "Restaurant Order"}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {item.item_description}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Food Relay - Pending</Text>
        <TouchableOpacity onPress={loadOrders}>
          <Text style={styles.refreshBtn}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      ) : orders.length === 0 ? (
        <Text style={styles.emptyText}>No pending requests right now.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          renderItem={renderOrderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Order Details Modal */}
      <Modal visible={!!selectedOrder} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <ScrollView>
                <Text style={styles.modalTitle}>Request Details</Text>
                <Text style={styles.label}>Description:</Text>
                <Text style={styles.value}>
                  {selectedOrder.item_description}
                </Text>

                {selectedOrder.image_url ? (
                  <Image
                    source={{ uri: selectedOrder.image_url }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                ) : null}

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => openLocation(selectedOrder.location_url)}
                >
                  <Text style={styles.secondaryButtonText}>
                    Open Location in Maps
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.button}
                  onPress={() => handleAcceptOrder(selectedOrder._id)}
                >
                  <Text style={styles.buttonText}>Accept Request</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setSelectedOrder(null)}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Request Modal */}
      <Modal visible={isCreateModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>New Relay Request</Text>

              <Text style={styles.label}>Type</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    type === "gate" && styles.typeBtnActive,
                  ]}
                  onPress={() => setType("gate")}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      type === "gate" && styles.typeBtnTextActive,
                    ]}
                  >
                    Gate
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    type === "restaurant" && styles.typeBtnActive,
                  ]}
                  onPress={() => setType("restaurant")}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      type === "restaurant" && styles.typeBtnTextActive,
                    ]}
                  >
                    Restaurant
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. McDonald's bag"
                value={description}
                onChangeText={setDescription}
              />

              <Text style={styles.label}>Location URL (Maps Link)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://maps.apple.com/..."
                value={locationUrl}
                onChangeText={setLocationUrl}
                keyboardType="url"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={styles.imagePickerBtn}
                onPress={handlePickImage}
              >
                <Text style={styles.imagePickerBtnText}>
                  {imageUri ? "Change Image" : "Pick Proof Image"}
                </Text>
              </TouchableOpacity>

              {imageUri && (
                <Image source={{ uri: imageUri }} style={styles.thumbImage} />
              )}

              {isSubmitting ? (
                <ActivityIndicator size="large" />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleSubmitRequest}
                  >
                    <Text style={styles.buttonText}>Submit Request</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => setCreateModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { height: 2 },
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  refreshBtn: { color: "#4CAF50", fontWeight: "bold" },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    color: "#888",
    fontSize: 16,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { height: 1 },
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSubtitle: { fontSize: 14, color: "#666", marginTop: 4 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: "#4CAF50",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { height: 2 },
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "bold" },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
    marginTop: 10,
  },
  value: { fontSize: 16, color: "#222", marginBottom: 15 },
  input: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  typeSelectorRow: { flexDirection: "row", marginBottom: 10 },
  typeBtn: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  typeBtnActive: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  typeBtnText: { color: "#555", fontWeight: "bold" },
  typeBtnTextActive: { color: "#fff" },
  imagePickerBtn: {
    backgroundColor: "#e0e0e0",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
  },
  imagePickerBtnText: { color: "#333", fontWeight: "600" },
  thumbImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  secondaryButtonText: { color: "#4CAF50", fontSize: 16, fontWeight: "bold" },
  cancelButton: { backgroundColor: "transparent", marginTop: 5 },
  cancelButtonText: { color: "#888", fontSize: 16, fontWeight: "bold" },
});
