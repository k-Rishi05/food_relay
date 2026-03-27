import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/order.dart';
import '../models/user.dart';

class ApiService {
  // Use 10.0.2.2 for Android Emulator, or localhost for iOS simulator
  static const String baseUrl = 'http://10.0.2.2:3000/api';
  
  // Example hardcoded user for the hackathon
  static const String currentUserId = '65fa1a2b3c4d5e6f7a8b9c0d'; // Replace with an actual ID from DB later or create one on fly

  Future<List<Order>> fetchPendingOrders() async {
    final response = await http.get(Uri.parse('$baseUrl/orders/pending'));
    
    if (response.statusCode == 200) {
      final List<dynamic> ordersJson = json.decode(response.body);
      return ordersJson.map((json) => Order.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load pending orders');
    }
  }

  Future<Order> acceptOrder(String orderId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/orders/$orderId/accept'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'fulfiller_id': currentUserId}),
    );

    if (response.statusCode == 200) {
      return Order.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to accept order');
    }
  }

  Future<String> _uploadImageToR2(File imageFile) async {
    // 1. Get pre-signed URL
    final mimeType = 'image/jpeg'; // naive detection for hackathon
    final urlResponse = await http.get(Uri.parse('$baseUrl/upload-url?contentType=$mimeType'));
    
    if (urlResponse.statusCode != 200) {
      throw Exception('Failed to get upload URL');
    }
    
    final urlData = json.decode(urlResponse.body);
    final uploadUrl = urlData['uploadUrl'];
    final publicUrl = urlData['publicUrl'];

    // 2. Upload to R2 directly
    final imageBytes = await imageFile.readAsBytes();
    final uploadResponse = await http.put(
      Uri.parse(uploadUrl),
      headers: {
        'Content-Type': mimeType,
      },
      body: imageBytes,
    );

    if (uploadResponse.statusCode == 200 || uploadResponse.statusCode == 201) {
      return publicUrl;
    } else {
      throw Exception('Failed to upload image to R2');
    }
  }

  Future<Order> createOrder({
    required String type,
    required String locationUrl,
    required String description,
    required File imageFile,
  }) async {
    // 1. Upload image and get public URL
    final imageUrl = await _uploadImageToR2(imageFile);

    // 2. Create the order
    final response = await http.post(
      Uri.parse('$baseUrl/orders'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'requester_id': currentUserId,
        'type': type,
        'location_url': locationUrl,
        'item_description': description,
        'image_url': imageUrl,
      }),
    );

    if (response.statusCode == 201) {
      return Order.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to create order');
    }
  }
}
