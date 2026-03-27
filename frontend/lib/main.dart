import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'services/api_service.dart';
import 'models/order.dart';
import 'dart:io';
import 'package:image_picker/image_picker.dart';

// Provides the ApiService instance
final apiServiceProvider = Provider<ApiService>((ref) => ApiService());

// StateNotifier to fetch and store pending orders
class OrdersNotifier extends StateNotifier<AsyncValue<List<Order>>> {
  final ApiService _apiService;
  
  OrdersNotifier(this._apiService) : super(const AsyncValue.loading()) {
    fetchOrders();
  }

  Future<void> fetchOrders() async {
    try {
      state = const AsyncValue.loading();
      final orders = await _apiService.fetchPendingOrders();
      state = AsyncValue.data(orders);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> createOrder({
    required String type,
    required double lat,
    required double lng,
    required String description,
    required File imageFile,
  }) async {
    await _apiService.createOrder(
      type: type,
      lat: lat,
      lng: lng,
      description: description,
      imageFile: imageFile,
    );
    // Refresh orders
    fetchOrders();
  }

  Future<void> acceptOrder(String orderId) async {
    await _apiService.acceptOrder(orderId);
    // Refresh orders as one is no longer pending
    fetchOrders();
  }
}

// Provider for orders state
final ordersProvider = StateNotifierProvider<OrdersNotifier, AsyncValue<List<Order>>>((ref) {
  return OrdersNotifier(ref.watch(apiServiceProvider));
});

void main() {
  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Food Relay',
      theme: ThemeData(
        primarySwatch: Colors.green,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  GoogleMapController? _mapController;
  Position? _currentPosition;

  @override
  void initState() {
    super.initState();
    _determinePosition();
  }

  Future<void> _determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return; // In prod handle gracefully

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return;
    }
    
    if (permission == LocationPermission.deniedForever) return;

    final position = await Geolocator.getCurrentPosition();
    setState(() {
      _currentPosition = position;
    });

    _mapController?.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(
          target: LatLng(position.latitude, position.longitude),
          zoom: 15.0,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Food Relay'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onRefresh: () => ref.read(ordersProvider.notifier).fetchOrders(),
          )
        ],
      ),
      body: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
        data: (orders) {
          final markers = orders.map((order) {
            return Marker(
              markerId: MarkerId(order.id),
              position: LatLng(order.locationLat, order.locationLng),
              infoWindow: InfoWindow(
                title: order.type == 'gate' ? 'Gate Pickup' : 'Restaurant Order',
                snippet: 'Tap to view details',
                onTap: () => _showOrderDetails(context, order),
              ),
              icon: BitmapDescriptor.defaultMarkerWithHue(
                order.type == 'gate' ? BitmapDescriptor.hueBlue : BitmapDescriptor.hueRed,
              ),
            );
          }).toSet();

          return GoogleMap(
            initialCameraPosition: const CameraPosition(
              target: LatLng(0, 0), // Will update when location loads
              zoom: 2,
            ),
            markers: markers,
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            onMapCreated: (controller) {
              _mapController = controller;
              if (_currentPosition != null) {
                _mapController!.animateCamera(
                  CameraUpdate.newCameraPosition(
                    CameraPosition(
                      target: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
                      zoom: 15.0,
                    ),
                  ),
                );
              }
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.add),
        onPressed: () => _showCreateRequestSheet(context),
      ),
    );
  }

  // --- Order Details Bottom Sheet ---
  void _showOrderDetails(BuildContext context, Order order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Request Details',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 10),
              Text('Description: ${order.itemDescription}'),
              const SizedBox(height: 10),
              if (order.imageUrl.isNotEmpty)
                Center(
                  child: Image.network(
                    order.imageUrl,
                    height: 200,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        const Text('Failed to load image'),
                  ),
                ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                  onPressed: () async {
                    // Accept logic
                    try {
                      await ref.read(ordersProvider.notifier).acceptOrder(order.id);
                      Navigator.pop(context); // Close sheet
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Order accepted!')),
                      );
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Error accepting order: $e')),
                      );
                    }
                  },
                  child: const Text('Accept Request', style: TextStyle(color: Colors.white)),
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  // --- Create Request Bottom Sheet ---
  void _showCreateRequestSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return const CreateRequestWidget();
      },
    );
  }
}

class CreateRequestWidget extends ConsumerStatefulWidget {
  const CreateRequestWidget({Key? key}) : super(key: key);

  @override
  ConsumerState<CreateRequestWidget> createState() => _CreateRequestWidgetState();
}

class _CreateRequestWidgetState extends ConsumerState<CreateRequestWidget> {
  final _descriptionController = TextEditingController();
  String _type = 'gate';
  File? _selectedImage;
  bool _isSubmitting = false;

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      setState(() {
        _selectedImage = File(pickedFile.path);
      });
    }
  }

  Future<void> _submitRequest() async {
    if (_descriptionController.text.isEmpty || _selectedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide a description and an image.')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final position = await Geolocator.getCurrentPosition();
      
      await ref.read(ordersProvider.notifier).createOrder(
        type: _type,
        lat: position.latitude,
        lng: position.longitude,
        description: _descriptionController.text,
        imageFile: _selectedImage!,
      );

      Navigator.pop(context); // Close sheet
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request created!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error creating request: $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'New Relay Request',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: _type,
            items: const [
              DropdownMenuItem(value: 'gate', child: Text('Gate Relay (I ordered food to the gate)')),
              DropdownMenuItem(value: 'restaurant', child: Text('Restaurant Relay (Get me this)')),
            ],
            onChanged: (val) {
              if (val != null) setState(() => _type = val);
            },
            decoration: const InputDecoration(labelText: 'Request Type'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _descriptionController,
            decoration: const InputDecoration(labelText: 'Description (e.g., McDonald\'s bag with Order #123)'),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              ElevatedButton.icon(
                icon: const Icon(Icons.image),
                label: const Text('Pick Image'),
                onPressed: _pickImage,
              ),
              const SizedBox(width: 10),
              if (_selectedImage != null)
                const Expanded(child: Text('Image selected (ready to upload)')),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submitRequest,
              child: _isSubmitting ? const CircularProgressIndicator() : const Text('Submit Request'),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
