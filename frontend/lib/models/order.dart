import 'user.dart';

class Order {
  final String id;
  final dynamic requesterId; // Can be a string ID or populated User object
  final dynamic fulfillerId;
  final String type; // 'gate' or 'restaurant'
  final String locationUrl;
  final String itemDescription;
  final String imageUrl;
  final String status;

  Order({
    required this.id,
    required this.requesterId,
    this.fulfillerId,
    required this.type,
    required this.locationUrl,
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
      locationUrl: json['location_url'] ?? '',
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
      'location_url': locationUrl,
      'item_description': itemDescription,
      'image_url': imageUrl,
      'status': status,
    };
  }
}
