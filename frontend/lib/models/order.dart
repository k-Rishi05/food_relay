import 'user.dart';

class Order {
  final String id;
  final dynamic requesterId; // Can be a string ID or populated User object
  final dynamic fulfillerId;
  final String type; // 'gate' or 'restaurant'
  final double locationLat;
  final double locationLng;
  final String itemDescription;
  final String imageUrl;
  final String status;

  Order({
    required this.id,
    required this.requesterId,
    this.fulfillerId,
    required this.type,
    required this.locationLat,
    required this.locationLng,
    required this.itemDescription,
    required this.imageUrl,
    required this.status,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['_id'] ?? '',
      requesterId: typeof(json['requester_id']) == 'string' ? json['requester_id'] : (json['requester_id'] != null ? User.fromJson(json['requester_id']) : ''),
      fulfillerId: json['fulfiller_id'],
      type: json['type'] ?? 'gate',
      locationLat: (json['location_lat'] ?? 0.0).toDouble(),
      locationLng: (json['location_lng'] ?? 0.0).toDouble(),
      itemDescription: json['item_description'] ?? '',
      imageUrl: json['image_url'] ?? '',
      status: json['status'] ?? 'pending',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'requester_id': requesterId is User ? requesterId.id : requesterId,
      'fulfiller_id': fulfillerId,
      'type': type,
      'location_lat': locationLat,
      'location_lng': locationLng,
      'item_description': itemDescription,
      'image_url': imageUrl,
      'status': status,
    };
  }
}
