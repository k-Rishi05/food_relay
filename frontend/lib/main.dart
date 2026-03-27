import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'services/api_service.dart';
import 'models/order.dart';

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
    required String locationUrl,
    required String description,
    required File imageFile,
  }) async {
    await _apiService.createOrder(
      type: type,
      locationUrl: locationUrl,
      description: description,
      imageFile: imageFile,
    );
    // Refresh orders
    fetchOrders();
  }

  Future<void> acceptOrder(String orderId) async {
    await _apiService.acceptOrder(orderId);
    // Refresh orders
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

class HomeScreen extends ConsumerWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Food Relay - Pending Orders'),
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
          if (orders.isEmpty) {
            return const Center(child: Text('No pending orders right now.'));
          }
          
          return ListView.builder(
            itemCount: orders.length,
            itemBuilder: (context, index) {
              final order = orders[index];
              final isGate = order.type == 'gate';
              
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isGate ? Colors.blue : Colors.red,
                    child: Icon(
                      isGate ? Icons.meeting_room : Icons.restaurant,
                      color: Colors.white,
                    ),
                  ),
                  title: Text(isGate ? 'Gate Pickup' : 'Restaurant Order'),
                  subtitle: Text(
                    order.itemDescription,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showOrderDetails(context, ref, order),
                ),
              );
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
  void _showOrderDetails(BuildContext context, WidgetRef ref, Order order) {
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
              const SizedBox(height: 15),
              // Open Location Button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.map),
                  onPressed: () async {
                    final url = Uri.parse(order.locationUrl);
                    if (await canLaunchUrl(url)) {
                      await launchUrl(url, mode: LaunchMode.externalApplication);
                    } else {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Could not launch URL')),
                        );
                      }
                    }
                  },
                  label: const Text('Open Location in Maps'),
                ),
              ),
              const SizedBox(height: 10),
              // Accept Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                  onPressed: () async {
                    try {
                      await ref.read(ordersProvider.notifier).acceptOrder(order.id);
                      if (context.mounted) {
                        Navigator.pop(context); // Close sheet
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Order accepted!')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Error accepting order: $e')),
                        );
                      }
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
  final _urlController = TextEditingController();
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
    if (_descriptionController.text.isEmpty || _urlController.text.isEmpty || _selectedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide a description, location URL, and an image.')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      await ref.read(ordersProvider.notifier).createOrder(
        type: _type,
        locationUrl: _urlController.text,
        description: _descriptionController.text,
        imageFile: _selectedImage!,
      );

      if (mounted) {
        Navigator.pop(context); // Close sheet
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Request created!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error creating request: $e')),
        );
      }
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
      child: SingleChildScrollView(
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
                DropdownMenuItem(value: 'gate', child: Text('Gate Relay (I ordered food)')),
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
              decoration: const InputDecoration(labelText: 'Description (e.g., McDonald\'s via UberEats)'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _urlController,
              decoration: const InputDecoration(
                labelText: 'Location URL (Maps Link)',
                hintText: 'https://maps.apple.com/... or https://goo.gl/maps/...',
              ),
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
                  const Expanded(child: Text('Image selected')),
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
      ),
    );
  }
}
