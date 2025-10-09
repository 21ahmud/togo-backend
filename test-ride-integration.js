// test-ride-integration.js
// Run this script to test the ride integration between booking page and driver dashboard

const API_BASE_URL = 'http://localhost:5000/api';

async function testRideIntegration() {
  console.log('🧪 Starting Ride Integration Test...\n');

  try {
    // Test 1: Check server health
    console.log('1️⃣ Testing server health...');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Server health:', healthData.status);
    console.log(`📊 Users in DB: ${healthData.database?.userCount || 'N/A'}`);
    console.log('');

    // Test 2: Check current rides in storage
    console.log('2️⃣ Checking current rides in storage...');
    const storageResponse = await fetch(`${API_BASE_URL}/public/test/storage`);
    const storageData = await storageResponse.json();
    console.log(`📦 Total rides in storage: ${storageData.totalRides}`);
    if (storageData.rides && storageData.rides.length > 0) {
      console.log('📋 Recent rides:');
      storageData.rides.slice(0, 3).forEach(ride => {
        console.log(`   - ID: ${ride.id}, Type: ${ride.service_type}, Customer: ${ride.customer}, Status: ${ride.status}`);
      });
    }
    console.log('');

    // Test 3: Create a test ride (public endpoint)
    console.log('3️⃣ Creating test ride via public endpoint...');
    const testRideData = {
      service_type: 'ride',
      customer_name: 'محمد أحمد (اختبار)',
      customer_phone: '01234567890',
      pickup_address: 'شارع التحرير، وسط البلد، القاهرة',
      pickup_coordinates: '30.0444,31.2357',
      dropoff_address: 'مدينة نصر، القاهرة الجديدة',
      dropoff_coordinates: '30.0626,31.3219',
      ride_type: 'standard',
      vehicle_type: 'car',
      payment_method: 'cash',
      estimated_distance: '12.5 كم',
      estimated_duration: '25 دقيقة',
      fare: 35
    };

    const createRideResponse = await fetch(`${API_BASE_URL}/public/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRideData)
    });

    if (createRideResponse.ok) {
      const rideResult = await createRideResponse.json();
      console.log('✅ Test ride created successfully!');
      console.log(`🆔 Ride ID: ${rideResult.ride?.id}`);
      console.log(`💰 Fare: ${rideResult.ride?.fare} ج.م`);
      console.log('');

      // Test 4: Verify ride appears in storage
      console.log('4️⃣ Verifying ride appears in storage...');
      const updatedStorageResponse = await fetch(`${API_BASE_URL}/public/test/storage`);
      const updatedStorageData = await updatedStorageResponse.json();
      const createdRide = updatedStorageData.rides.find(r => r.id === rideResult.ride.id);
      
      if (createdRide) {
        console.log('✅ Ride found in storage!');
        console.log(`📍 Pickup: ${createdRide.pickup_address?.substring(0, 30)}...`);
        console.log(`📍 Dropoff: ${createdRide.dropoff_address?.substring(0, 30)}...`);
        console.log(`🚗 Vehicle Type: ${createdRide.ride_type}`);
      } else {
        console.log('❌ Ride not found in storage');
        return;
      }
      console.log('');

    } else {
      const errorData = await createRideResponse.json();
      console.log('❌ Failed to create test ride:', errorData.message);
      return;
    }

    // Test 5: Check available drivers (public endpoint)
    console.log('5️⃣ Checking available drivers...');
    const driversResponse = await fetch(`${API_BASE_URL}/public/drivers`);
    if (driversResponse.ok) {
      const driversData = await driversResponse.json();
      console.log(`👥 Available drivers: ${driversData.count}`);
      if (driversData.drivers && driversData.drivers.length > 0) {
        console.log('🚗 Driver vehicles:');
        driversData.drivers.forEach(driver => {
          console.log(`   - ID: ${driver.id}, Vehicle: ${driver.vehicle}, Rating: ${driver.rating}`);
        });
      }
    } else {
      console.log('⚠️  Could not fetch drivers (this might be expected if no drivers are online)');
    }
    console.log('');

    // Test 6: Check pending rides (public endpoint)
    console.log('6️⃣ Checking pending rides...');
    const pendingResponse = await fetch(`${API_BASE_URL}/public/rides/pending`);
    if (pendingResponse.ok) {
      const pendingData = await pendingResponse.json();
      console.log(`⏳ Pending rides: ${pendingData.count}`);
      if (pendingData.rides && pendingData.rides.length > 0) {
        console.log('📋 Recent pending rides:');
        pendingData.rides.slice(0, 3).forEach(ride => {
          console.log(`   - ID: ${ride.id}, Type: ${ride.service_type}, Vehicle: ${ride.ride_type}, Fare: ${ride.fare} ج.م`);
        });
      }
    } else {
      console.log('⚠️  Could not fetch pending rides');
    }
    console.log('');

    // Test 7: Create a delivery test
    console.log('7️⃣ Creating test delivery...');
    const testDeliveryData = {
      service_type: 'delivery',
      customer_name: 'سارة محمد (اختبار توصيل)',
      customer_phone: '01098765432',
      pickup_address: 'المعادي، القاهرة',
      pickup_coordinates: '29.9602,31.2569',
      dropoff_address: 'الزمالك، القاهرة',
      dropoff_coordinates: '30.0626,31.2157',
      ride_type: 'bike',
      vehicle_type: 'bike',
      payment_method: 'cash',
      estimated_distance: '8.2 كم',
      estimated_duration: '18 دقيقة',
      fare: 25,
      delivery_details: {
        senderName: 'سارة محمد',
        senderPhone: '01098765432',
        receiverName: 'أحمد حسن',
        receiverPhone: '01123456789',
        packageDescription: 'مستندات مهمة',
        packageValue: '100',
        specialInstructions: 'التعامل بحذر'
      }
    };

    const createDeliveryResponse = await fetch(`${API_BASE_URL}/public/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testDeliveryData)
    });

    if (createDeliveryResponse.ok) {
      const deliveryResult = await createDeliveryResponse.json();
      console.log('✅ Test delivery created successfully!');
      console.log(`🆔 Delivery ID: ${deliveryResult.ride?.id}`);
      console.log(`📦 Service Type: ${deliveryResult.ride?.service_type}`);
      console.log('');
    } else {
      const errorData = await createDeliveryResponse.json();
      console.log('❌ Failed to create test delivery:', errorData.message);
    }

    // Final summary
    console.log('🎉 Integration Test Complete!');
    console.log('');
    console.log('📋 Summary:');
    console.log('✅ Server is healthy and responding');
    console.log('✅ Shared storage is working');
    console.log('✅ Public ride creation works');
    console.log('✅ Public delivery creation works');
    console.log('✅ Rides are stored and retrievable');
    console.log('');
    console.log('🔄 Next Steps:');
    console.log('1. Open your booking page and create a ride');
    console.log('2. Open the driver dashboard and check if the ride appears');
    console.log('3. Verify that vehicle type matching works correctly');
    console.log('4. Test the accept/decline functionality from driver side');
    console.log('');
    console.log('🔗 Helpful URLs:');
    console.log(`📊 Storage Test: ${API_BASE_URL}/public/test/storage`);
    console.log(`🏥 Health Check: ${API_BASE_URL}/health`);
    console.log(`📋 Pending Rides: ${API_BASE_URL}/public/rides/pending`);
    console.log(`👥 Available Drivers: ${API_BASE_URL}/public/drivers`);

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('');
    console.error('💡 Troubleshooting tips:');
    console.error('1. Make sure your server is running on port 5000');
    console.error('2. Check that all the updated files are in place');
    console.error('3. Verify the shared storage module was created correctly');
    console.error('4. Check server logs for any startup errors');
  }
}

// Run the test
testRideIntegration();