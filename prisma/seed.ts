import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Transporto seed...\n');

  // ==================== USERS ====================
  const passwordAdmin = await bcrypt.hash('admin123', 10);
  const passwordDriver = await bcrypt.hash('driver123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@transporto.in' },
    update: {},
    create: {
      name: 'Nilesh Admin',
      email: 'admin@transporto.in',
      phone: '9876500001',
      password: passwordAdmin,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'priya@transporto.in' },
    update: {},
    create: {
      name: 'Priya Sharma',
      email: 'priya@transporto.in',
      phone: '9876500002',
      password: passwordAdmin,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const coldOpsUser = await prisma.user.upsert({
    where: { email: 'ravi@transporto.in' },
    update: {},
    create: {
      name: 'Ravi Cold Ops',
      email: 'ravi@transporto.in',
      phone: '9876500008',
      password: passwordAdmin,
      role: 'COLD_STORAGE_OPERATOR',
      isActive: true,
    },
  });

  const driverUsers = [];
  const driverData = [
    { name: 'Rajesh Kumar', email: 'rajesh@transporto.in', phone: '9876500003' },
    { name: 'Suresh Singh', email: 'suresh@transporto.in', phone: '9876500004' },
    { name: 'Amit Sharma', email: 'amit@transporto.in', phone: '9876500005' },
    { name: 'Vikram Yadav', email: 'vikram@transporto.in', phone: '9876500006' },
    { name: 'Manoj Verma', email: 'manoj@transporto.in', phone: '9876500007' },
  ];

  for (const d of driverData) {
    const u = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: { ...d, password: passwordDriver, role: 'DRIVER', isActive: true },
    });
    driverUsers.push(u);
  }

  console.log(`✅ Users created: ${2 + 1 + driverData.length} users`);

  // ==================== VEHICLES ====================
  const vehiclesData = [
    {
      regNumber: 'DL01AB1234',
      type: 'TRUCK' as const,
      make: 'Tata',
      model: 'Prima 4928.S',
      year: 2021,
      fuelType: 'DIESEL' as const,
      status: 'ACTIVE' as const,
      currentKm: 85420,
      chassisNumber: 'MAT456123YYYY001',
      engineNumber: 'ENG001TATA2021',
      color: 'White',
      loadCapacityKg: 49000,
      numTires: 10,
      tankCapacityL: 400,
      purchaseDate: new Date('2021-03-15'),
      purchasePrice: 3500000,
    },
    {
      regNumber: 'DL01CD5678',
      type: 'REEFER_TRUCK' as const,
      make: 'Ashok Leyland',
      model: 'Captain 4820',
      year: 2022,
      fuelType: 'DIESEL' as const,
      status: 'ACTIVE' as const,
      currentKm: 62100,
      chassisNumber: 'MAT456123YYYY002',
      engineNumber: 'ENG002AL2022',
      color: 'Blue',
      loadCapacityKg: 20000,
      numTires: 6,
      tankCapacityL: 300,
      purchaseDate: new Date('2022-01-20'),
      purchasePrice: 2800000,
    },
    {
      regNumber: 'HR55EF9012',
      type: 'PICKUP' as const,
      make: 'Mahindra',
      model: 'Bolero Maxi Truck',
      year: 2020,
      fuelType: 'DIESEL' as const,
      status: 'IDLE' as const,
      currentKm: 42300,
      chassisNumber: 'MAT456123YYYY003',
      engineNumber: 'ENG003MH2020',
      color: 'Silver',
      loadCapacityKg: 1500,
      numTires: 4,
      tankCapacityL: 60,
      purchaseDate: new Date('2020-07-10'),
      purchasePrice: 900000,
    },
    {
      regNumber: 'UP32GH3456',
      type: 'TRAILER' as const,
      make: 'BharatBenz',
      model: '4228R',
      year: 2023,
      fuelType: 'DIESEL' as const,
      status: 'ACTIVE' as const,
      currentKm: 28500,
      chassisNumber: 'MAT456123YYYY004',
      engineNumber: 'ENG004BB2023',
      color: 'Red',
      loadCapacityKg: 40000,
      numTires: 18,
      tankCapacityL: 500,
      purchaseDate: new Date('2023-02-28'),
      purchasePrice: 4200000,
    },
    {
      regNumber: 'DL01IJ7890',
      type: 'TANKER' as const,
      make: 'Tata',
      model: 'Signa 4823.S',
      year: 2021,
      fuelType: 'DIESEL' as const,
      status: 'IN_MAINTENANCE' as const,
      currentKm: 71800,
      chassisNumber: 'MAT456123YYYY005',
      engineNumber: 'ENG005TATA2021',
      color: 'Yellow',
      loadCapacityKg: 30000,
      numTires: 10,
      tankCapacityL: 350,
      purchaseDate: new Date('2021-11-05'),
      purchasePrice: 3200000,
    },
  ];

  const vehicles = [];
  for (const v of vehiclesData) {
    const vehicle = await prisma.vehicle.upsert({
      where: { regNumber: v.regNumber },
      update: {},
      create: v,
    });
    vehicles.push(vehicle);
  }

  console.log(`✅ Vehicles created: ${vehicles.length} vehicles`);

  // ==================== DRIVERS ====================
  const driversData = [
    {
      userId: driverUsers[0].id,
      name: 'Rajesh Kumar',
      phone: '9876501001',
      licenseNumber: 'DL0120190012345',
      licenseType: 'HMV',
      licenseExpiry: new Date('2028-06-30'),
      dateOfBirth: new Date('1985-04-12'),
      bloodGroup: 'B+',
      experience: 15,
      status: 'ON_TRIP' as const,
      address: '45 Laxmi Nagar, Delhi',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110092',
      emergencyContact: '9876509001',
      emergencyName: 'Sunita Kumar',
      salary: 28000,
      rating: 4.8,
    },
    {
      userId: driverUsers[1].id,
      name: 'Suresh Singh',
      phone: '9876501002',
      licenseNumber: 'HR0520180056789',
      licenseType: 'HMV',
      licenseExpiry: new Date('2027-09-15'),
      dateOfBirth: new Date('1988-08-22'),
      bloodGroup: 'O+',
      experience: 12,
      status: 'AVAILABLE' as const,
      address: '12 Sector 14, Gurgaon',
      city: 'Gurgaon',
      state: 'Haryana',
      pincode: '122001',
      emergencyContact: '9876509002',
      emergencyName: 'Kavita Singh',
      salary: 25000,
      rating: 4.5,
    },
    {
      userId: driverUsers[2].id,
      name: 'Amit Sharma',
      phone: '9876501003',
      licenseNumber: 'UP1420170034567',
      licenseType: 'HMV',
      licenseExpiry: new Date('2026-12-31'),
      dateOfBirth: new Date('1990-01-15'),
      bloodGroup: 'A+',
      experience: 8,
      status: 'AVAILABLE' as const,
      address: '78 Sector 62, Noida',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pincode: '201309',
      emergencyContact: '9876509003',
      emergencyName: 'Reena Sharma',
      salary: 22000,
      rating: 4.3,
    },
    {
      userId: driverUsers[3].id,
      name: 'Vikram Yadav',
      phone: '9876501004',
      licenseNumber: 'HR1020200078901',
      licenseType: 'HPMV',
      licenseExpiry: new Date('2029-03-20'),
      dateOfBirth: new Date('1987-11-30'),
      bloodGroup: 'AB+',
      experience: 10,
      status: 'ON_TRIP' as const,
      address: '23 NIT, Faridabad',
      city: 'Faridabad',
      state: 'Haryana',
      pincode: '121001',
      emergencyContact: '9876509004',
      emergencyName: 'Meena Yadav',
      salary: 30000,
      rating: 4.7,
    },
    {
      userId: driverUsers[4].id,
      name: 'Manoj Verma',
      phone: '9876501005',
      licenseNumber: 'UP1620160023456',
      licenseType: 'HMV',
      licenseExpiry: new Date('2027-05-10'),
      dateOfBirth: new Date('1983-07-08'),
      bloodGroup: 'O-',
      experience: 18,
      status: 'ON_LEAVE' as const,
      address: '56 Rajnagar, Ghaziabad',
      city: 'Ghaziabad',
      state: 'Uttar Pradesh',
      pincode: '201001',
      emergencyContact: '9876509005',
      emergencyName: 'Anita Verma',
      salary: 18000,
      rating: 4.1,
    },
  ];

  const drivers = [];
  for (const d of driversData) {
    const driver = await prisma.driver.upsert({
      where: { licenseNumber: d.licenseNumber },
      update: {},
      create: d,
    });
    drivers.push(driver);
  }

  console.log(`✅ Drivers created: ${drivers.length} drivers`);

  // ==================== DRIVER VEHICLE ASSIGNMENTS ====================
  await prisma.driverVehicleAssignment.createMany({
    data: [
      { driverId: drivers[0].id, vehicleId: vehicles[0].id, isCurrent: true },
      { driverId: drivers[3].id, vehicleId: vehicles[3].id, isCurrent: true },
    ],
    skipDuplicates: true,
  });

  // ==================== TRIPS ====================
  const today = new Date();
  const tripsData = [
    {
      tripNumber: `TRP-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-001`,
      vehicleId: vehicles[0].id,
      driverId: drivers[0].id,
      date: today,
      startKm: 85000,
      startLocation: 'Delhi (Mundka Depot)',
      endLocation: 'Jaipur (Sitapura Industrial Area)',
      status: 'IN_PROGRESS' as const,
      loadStatus: 'LOADED' as const,
      cargoType: 'FMCG Goods',
      cargoWeight: 20000,
      cargoUnit: 'kg',
      clientName: 'Reliance Retail',
      lrNumber: 'LR20260220001',
      billAmount: 45000,
      tollAmount: 1200,
      startTime: new Date(today.setHours(6, 0, 0, 0)),
    },
    {
      tripNumber: 'TRP-20260218-001',
      vehicleId: vehicles[1].id,
      driverId: drivers[3].id,
      date: new Date('2026-02-18'),
      startKm: 61500,
      endKm: 62100,
      distanceKm: 600,
      startLocation: 'Delhi (Azadpur Mandi)',
      endLocation: 'Lucknow (Aishbagh)',
      status: 'COMPLETED' as const,
      loadStatus: 'LOADED' as const,
      cargoType: 'Frozen Food',
      cargoWeight: 18000,
      cargoUnit: 'kg',
      clientName: 'BigBasket',
      lrNumber: 'LR20260218001',
      billAmount: 52000,
      tollAmount: 1800,
      otherExpenses: 500,
      startTime: new Date('2026-02-18T05:30:00'),
      endTime: new Date('2026-02-18T22:00:00'),
    },
    {
      tripNumber: 'TRP-20260215-001',
      vehicleId: vehicles[3].id,
      driverId: drivers[3].id,
      date: new Date('2026-02-15'),
      startKm: 27800,
      endKm: 28500,
      distanceKm: 700,
      startLocation: 'Mumbai (Bhiwandi)',
      endLocation: 'Delhi (Kundli)',
      status: 'COMPLETED' as const,
      loadStatus: 'LOADED' as const,
      cargoType: 'Auto Parts',
      cargoWeight: 35000,
      cargoUnit: 'kg',
      clientName: 'Maruti Suzuki',
      lrNumber: 'LR20260215001',
      billAmount: 85000,
      tollAmount: 3200,
      otherExpenses: 1500,
      startTime: new Date('2026-02-15T08:00:00'),
      endTime: new Date('2026-02-17T14:00:00'),
    },
    {
      tripNumber: 'TRP-20260210-001',
      vehicleId: vehicles[1].id,
      driverId: drivers[1].id,
      date: new Date('2026-02-10'),
      startKm: 60800,
      endKm: 61500,
      distanceKm: 700,
      startLocation: 'Delhi (Connaught Place)',
      endLocation: 'Chandigarh (Industrial Area)',
      status: 'COMPLETED' as const,
      loadStatus: 'LOADED' as const,
      cargoType: 'Dairy Products',
      cargoWeight: 15000,
      cargoUnit: 'kg',
      clientName: 'Amul Dairy',
      lrNumber: 'LR20260210001',
      billAmount: 28000,
      tollAmount: 800,
      startTime: new Date('2026-02-10T04:00:00'),
      endTime: new Date('2026-02-10T14:30:00'),
    },
  ];

  const trips = [];
  for (const t of tripsData) {
    const trip = await prisma.trip.upsert({
      where: { tripNumber: t.tripNumber },
      update: {},
      create: t,
    });
    trips.push(trip);
  }

  console.log(`✅ Trips created: ${trips.length} trips`);

  // ==================== FUEL ENTRIES ====================
  const fuelData = [
    {
      entryNumber: 'FUEL-20260220-001',
      vehicleId: vehicles[0].id,
      driverId: drivers[0].id,
      date: today,
      fuelType: 'DIESEL' as const,
      liters: 80,
      ratePerLiter: 90.5,
      totalCost: 7240,
      odometer: 85000,
      fuelStation: 'HP Petrol Pump, NH48',
      location: 'Manesar, Haryana',
      paymentMode: 'UPI' as const,
    },
    {
      entryNumber: 'FUEL-20260218-001',
      vehicleId: vehicles[1].id,
      driverId: drivers[3].id,
      date: new Date('2026-02-18'),
      fuelType: 'DIESEL' as const,
      liters: 100,
      ratePerLiter: 91.0,
      totalCost: 9100,
      odometer: 61500,
      fuelStation: 'Indian Oil, GT Road',
      location: 'Panipat, Haryana',
      paymentMode: 'CASH' as const,
    },
    {
      entryNumber: 'FUEL-20260215-001',
      vehicleId: vehicles[3].id,
      driverId: drivers[3].id,
      date: new Date('2026-02-15'),
      fuelType: 'DIESEL' as const,
      liters: 95,
      ratePerLiter: 89.5,
      totalCost: 8502.5,
      odometer: 27800,
      fuelStation: 'BPCL Fuel Station, NH8',
      location: 'Surat, Gujarat',
      paymentMode: 'COMPANY_ACCOUNT' as const,
    },
    {
      entryNumber: 'FUEL-20260210-001',
      vehicleId: vehicles[1].id,
      driverId: drivers[1].id,
      date: new Date('2026-02-10'),
      fuelType: 'DIESEL' as const,
      liters: 70,
      ratePerLiter: 90.0,
      totalCost: 6300,
      odometer: 60800,
      fuelStation: 'Shell Fuel Station',
      location: 'Delhi, NH1',
      paymentMode: 'CARD' as const,
    },
    {
      entryNumber: 'FUEL-20260205-001',
      vehicleId: vehicles[2].id,
      driverId: drivers[2].id,
      date: new Date('2026-02-05'),
      fuelType: 'DIESEL' as const,
      liters: 60,
      ratePerLiter: 90.5,
      totalCost: 5430,
      odometer: 42200,
      fuelStation: 'Indian Oil, Noida',
      location: 'Noida, UP',
      paymentMode: 'UPI' as const,
    },
  ];

  for (const f of fuelData) {
    await prisma.fuelEntry.upsert({
      where: { entryNumber: f.entryNumber },
      update: {},
      create: f,
    });
  }

  console.log(`✅ Fuel entries created: ${fuelData.length} entries`);

  // ==================== MAINTENANCE ====================
  await prisma.maintenance.createMany({
    data: [
      {
        vehicleId: vehicles[4].id,
        type: 'ENGINE_REPAIR',
        description: 'Engine overheating issue, requires full service',
        cost: 45000,
        laborCost: 15000,
        partsCost: 30000,
        date: new Date('2026-02-18'),
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        garage: 'Tata Authorized Service Center',
        garagePhone: '9876543210',
        mechanicName: 'Ramesh Auto',
        odometerAtService: 71800,
      },
      {
        vehicleId: vehicles[0].id,
        type: 'OIL_CHANGE',
        description: 'Regular oil change and filter replacement',
        cost: 3500,
        laborCost: 500,
        partsCost: 3000,
        date: new Date('2026-02-01'),
        completedDate: new Date('2026-02-01T14:00:00'),
        status: 'COMPLETED',
        priority: 'MEDIUM',
        garage: 'Quick Service Center, Delhi',
        garagePhone: '9876543211',
        odometerAtService: 84000,
        nextDueDate: new Date('2026-08-01'),
        nextDueKm: 94000,
      },
      {
        vehicleId: vehicles[2].id,
        type: 'TIRE_REPLACEMENT',
        description: 'Front two tires worn out, replaced with new MRF tyres',
        cost: 18000,
        laborCost: 1000,
        partsCost: 17000,
        date: new Date('2026-01-25'),
        completedDate: new Date('2026-01-25T12:00:00'),
        status: 'COMPLETED',
        priority: 'HIGH',
        garage: 'MRF Tire Dealer, Gurgaon',
        garagePhone: '9876543212',
        odometerAtService: 42100,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Maintenance records created: 3 records');

  // ==================== EMERGENCIES ====================
  await prisma.emergency.createMany({
    data: [
      {
        vehicleId: vehicles[0].id,
        driverId: drivers[0].id,
        type: 'PUNCTURE',
        description: 'Rear right tire punctured on highway. Vehicle safely parked on road shoulder.',
        location: 'NH48, Manesar, Haryana',
        latitude: 28.3541,
        longitude: 76.9366,
        date: new Date('2026-02-10'),
        time: '14:30',
        status: 'RESOLVED',
        priority: 'MEDIUM',
        actualCost: 2500,
        resolvedAt: new Date('2026-02-10T16:00:00'),
        resolvedBy: 'Roadside Assistance Team',
        resolution: 'Tire replaced with spare. Vehicle resumed trip.',
      },
      {
        vehicleId: vehicles[4].id,
        driverId: drivers[4].id,
        type: 'BREAKDOWN',
        description: 'Engine overheating and sudden breakdown. Smoke from engine hood.',
        location: 'GT Road, Panipat, Haryana',
        latitude: 29.3909,
        longitude: 76.9635,
        date: new Date('2026-02-18'),
        time: '09:15',
        status: 'RESOLVED',
        priority: 'CRITICAL',
        estimatedCost: 50000,
        actualCost: 45000,
        resolvedAt: new Date('2026-02-20T10:00:00'),
        resolvedBy: 'Tata Service Team',
        resolution: 'Vehicle towed to service center. Engine repair in progress.',
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Emergencies created: 2 records');

  // ==================== INSURANCE ====================
  const insuranceData = [
    {
      vehicleId: vehicles[0].id,
      provider: 'ICICI Lombard',
      policyNumber: 'ICL-DL01AB1234-2025',
      type: 'COMPREHENSIVE' as const,
      coverAmount: 3500000,
      premium: 85000,
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      status: 'ACTIVE' as const,
      agentName: 'Sunil Arora',
      agentPhone: '9876540001',
    },
    {
      vehicleId: vehicles[1].id,
      provider: 'HDFC ERGO',
      policyNumber: 'HE-DL01CD5678-2025',
      type: 'ZERO_DEP' as const,
      coverAmount: 2800000,
      premium: 72000,
      startDate: new Date('2025-03-01'),
      endDate: new Date('2026-02-28'),
      status: 'EXPIRING_SOON' as const,
      agentName: 'Meena Kapoor',
      agentPhone: '9876540002',
    },
    {
      vehicleId: vehicles[2].id,
      provider: 'Bajaj Allianz',
      policyNumber: 'BA-HR55EF9012-2024',
      type: 'THIRD_PARTY' as const,
      premium: 15000,
      startDate: new Date('2024-07-01'),
      endDate: new Date('2025-06-30'),
      status: 'EXPIRED' as const,
      agentName: 'Rakesh Gupta',
      agentPhone: '9876540003',
    },
    {
      vehicleId: vehicles[3].id,
      provider: 'New India Assurance',
      policyNumber: 'NIA-UP32GH3456-2025',
      type: 'COMPREHENSIVE' as const,
      coverAmount: 4200000,
      premium: 98000,
      startDate: new Date('2025-03-01'),
      endDate: new Date('2026-02-28'),
      status: 'EXPIRING_SOON' as const,
      agentName: 'Anita Jain',
      agentPhone: '9876540004',
    },
    {
      vehicleId: vehicles[4].id,
      provider: 'TATA AIG',
      policyNumber: 'TAIG-DL01IJ7890-2025',
      type: 'COMPREHENSIVE' as const,
      coverAmount: 3200000,
      premium: 79000,
      startDate: new Date('2025-11-01'),
      endDate: new Date('2026-10-31'),
      status: 'ACTIVE' as const,
      agentName: 'Vijay Mehta',
      agentPhone: '9876540005',
    },
  ];

  for (const ins of insuranceData) {
    await prisma.insurance.upsert({
      where: { policyNumber: ins.policyNumber },
      update: {},
      create: ins,
    });
  }

  console.log(`✅ Insurance policies created: ${insuranceData.length} policies`);

  // ==================== COLD STORAGE UNITS ====================
  const coldUnits = [
    {
      name: 'Main Cold Room A',
      type: 'COLD_ROOM' as const,
      targetTemp: -20,
      minTemp: -22,
      maxTemp: -18,
      capacityTotal: 500,
      capacityUnit: 'Tons',
      location: 'Warehouse Block A, Delhi',
      status: 'NORMAL' as const,
      sensorId: 'SENSOR-CRA-001',
      isActive: true,
    },
    {
      name: 'Chiller Zone B',
      type: 'CHILLER' as const,
      targetTemp: 4,
      minTemp: 2,
      maxTemp: 6,
      capacityTotal: 200,
      capacityUnit: 'Tons',
      location: 'Warehouse Block B, Delhi',
      status: 'NORMAL' as const,
      sensorId: 'SENSOR-CZB-002',
      isActive: true,
    },
    {
      name: 'Deep Freeze Unit C',
      type: 'DEEP_FREEZER' as const,
      targetTemp: -30,
      minTemp: -32,
      maxTemp: -28,
      capacityTotal: 300,
      capacityUnit: 'Tons',
      location: 'Warehouse Block C, Delhi',
      status: 'WARNING' as const,
      sensorId: 'SENSOR-DFC-003',
      isActive: true,
    },
    {
      name: 'Blast Freezer D',
      type: 'BLAST_FREEZER' as const,
      targetTemp: -40,
      minTemp: -42,
      maxTemp: -38,
      capacityTotal: 100,
      capacityUnit: 'Tons',
      location: 'Warehouse Block D, Delhi',
      status: 'NORMAL' as const,
      sensorId: 'SENSOR-BFD-004',
      isActive: true,
    },
  ];

  const coldUnitsCreated = [];
  for (const cu of coldUnits) {
    const unit = await prisma.coldStorageUnit.create({ data: cu });
    coldUnitsCreated.push(unit);
  }

  // Generate 24 hourly temperature logs per unit
  const now = new Date();
  for (const unit of coldUnitsCreated) {
    const logs = [];
    for (let h = 23; h >= 0; h--) {
      const recordedAt = new Date(now);
      recordedAt.setHours(now.getHours() - h);
      const variation = (Math.random() - 0.5) * 4;
      const temp = unit.targetTemp + variation;
      logs.push({
        unitId: unit.id,
        temperature: Math.round(temp * 10) / 10,
        humidity: Math.round((55 + Math.random() * 20) * 10) / 10,
        doorStatus: 'CLOSED',
        powerStatus: 'ON',
        recordedBy: 'AUTO_SENSOR',
        recordedAt,
      });
    }
    await prisma.temperatureLog.createMany({ data: logs });
  }

  // Storage Clients
  await prisma.storageClient.createMany({
    data: [
      { unitId: coldUnitsCreated[0].id, clientName: 'FreshMart Pvt Ltd', clientPhone: '9876550001', productType: 'Frozen Vegetables', spaceUsed: 80, ratePerUnit: 5000, startDate: new Date('2026-01-01'), isActive: true },
      { unitId: coldUnitsCreated[0].id, clientName: 'IceCream Co', clientPhone: '9876550002', productType: 'Ice Cream & Desserts', spaceUsed: 120, ratePerUnit: 5500, startDate: new Date('2025-12-01'), isActive: true },
      { unitId: coldUnitsCreated[1].id, clientName: 'DairyFresh India', clientPhone: '9876550003', productType: 'Dairy Products', spaceUsed: 60, ratePerUnit: 3000, startDate: new Date('2026-01-15'), isActive: true },
      { unitId: coldUnitsCreated[1].id, clientName: 'VegWorld Exports', clientPhone: '9876550004', productType: 'Fresh Vegetables', spaceUsed: 50, ratePerUnit: 2500, startDate: new Date('2026-02-01'), isActive: true },
      { unitId: coldUnitsCreated[2].id, clientName: 'SeaFood Express', clientPhone: '9876550005', productType: 'Seafood & Fish', spaceUsed: 100, ratePerUnit: 8000, startDate: new Date('2025-11-01'), isActive: true },
      { unitId: coldUnitsCreated[2].id, clientName: 'MeatHub Processing', clientPhone: '9876550006', productType: 'Processed Meat', spaceUsed: 90, ratePerUnit: 7500, startDate: new Date('2026-01-01'), isActive: true },
      { unitId: coldUnitsCreated[3].id, clientName: 'QuickFreeze Logistics', clientPhone: '9876550007', productType: 'Pharmaceuticals', spaceUsed: 40, ratePerUnit: 12000, startDate: new Date('2026-02-10'), isActive: true },
    ],
  });

  // Cold Storage Alert for unit 3 (WARNING status)
  await prisma.coldStorageAlert.create({
    data: {
      unitId: coldUnitsCreated[2].id,
      alertType: 'TEMP_HIGH',
      message: 'Temperature deviation detected: -26.5°C (target: -30°C). Deviation: +3.5°C',
      temperature: -26.5,
      severity: 'HIGH',
      isResolved: false,
    },
  });

  console.log(`✅ Cold storage created: ${coldUnitsCreated.length} units with 96 temp logs`);

  // ==================== SHIFTS ====================
  await prisma.shift.createMany({
    data: [
      { driverId: drivers[0].id, vehicleId: vehicles[0].id, date: today, startTime: new Date(new Date().setHours(6, 0, 0, 0)), status: 'ACTIVE', notes: 'Delhi-Jaipur run' },
      { driverId: drivers[1].id, vehicleId: vehicles[1].id, date: today, startTime: new Date(new Date().setHours(7, 0, 0, 0)), status: 'SCHEDULED', notes: 'Local delivery' },
      { driverId: drivers[3].id, vehicleId: vehicles[3].id, date: new Date('2026-02-18'), startTime: new Date('2026-02-18T05:30:00'), endTime: new Date('2026-02-18T22:00:00'), status: 'COMPLETED', hoursWorked: 16.5, overtime: 6.5 },
      { driverId: drivers[2].id, vehicleId: vehicles[2].id, date: new Date('2026-02-19'), startTime: new Date('2026-02-19T08:00:00'), endTime: new Date('2026-02-19T17:00:00'), status: 'COMPLETED', hoursWorked: 9, overtime: 0 },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Shifts created: 4 shifts');

  // ==================== WHATSAPP MESSAGES ====================
  await prisma.whatsAppMessage.createMany({
    data: [
      {
        driverId: drivers[0].id,
        fromPhone: '919876501001',
        toPhone: '919876500001',
        direction: 'INBOUND',
        message: 'diesel bharwaya 80 litre 7240 rupaye manesar HP pump pe. odometer 85000.',
        parsedType: 'fuel',
        parsedData: { liters: 80, totalCost: 7240, odometer: 85000, station: 'HP pump Manesar' },
        confidence: 0.92,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
      {
        driverId: drivers[1].id,
        fromPhone: '919876501002',
        toPhone: '919876500001',
        direction: 'INBOUND',
        message: 'puncture ho gaya NH58 pe. spare lagwa diya. 30 min mein chal denge.',
        parsedType: 'emergency',
        parsedData: { type: 'PUNCTURE', location: 'NH58' },
        confidence: 0.88,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
      {
        driverId: drivers[3].id,
        fromPhone: '919876501004',
        toPhone: '919876500001',
        direction: 'INBOUND',
        message: 'trip completed. lucknow pahunch gaya. odometer 62100.',
        parsedType: 'trip',
        parsedData: { status: 'completed', location: 'Lucknow', endKm: 62100 },
        confidence: 0.85,
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ WhatsApp messages created: 3 messages');

  // ==================== NOTIFICATIONS ====================
  await prisma.notification.createMany({
    data: [
      { type: 'INSURANCE_EXPIRY', title: 'Insurance Expiring Soon', message: 'Vehicle DL01CD5678 insurance (HDFC ERGO) expires on 28 Feb 2026.', entity: 'Vehicle', priority: 'HIGH', forRole: 'MANAGER' },
      { type: 'INSURANCE_EXPIRY', title: 'Insurance Expiring Soon', message: 'Vehicle UP32GH3456 insurance (New India) expires on 28 Feb 2026.', entity: 'Vehicle', priority: 'HIGH', forRole: 'MANAGER' },
      { type: 'EMERGENCY_REPORTED', title: 'Emergency: Vehicle Breakdown', message: 'Vehicle DL01IJ7890 breakdown reported on GT Road Panipat. Priority: CRITICAL', entity: 'Emergency', priority: 'CRITICAL', forRole: 'ADMIN' },
      { type: 'COLD_STORAGE_ALERT', title: 'Cold Storage Temperature Alert', message: 'Deep Freeze Unit C temperature deviation detected: -26.5°C (target: -30°C)', entity: 'ColdStorage', priority: 'HIGH', forRole: 'COLD_STORAGE_OPERATOR' },
      { type: 'MAINTENANCE_DUE', title: 'Maintenance In Progress', message: 'Vehicle DL01IJ7890 engine repair in progress at Tata Service Center.', entity: 'Maintenance', priority: 'MEDIUM', forRole: 'MANAGER' },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Notifications created: 5 notifications');

  // ==================== SETTINGS ====================
  await prisma.setting.createMany({
    data: [
      { key: 'company_name', value: 'Transporto Fleet Solutions', group: 'company', label: 'Company Name' },
      { key: 'company_address', value: '456 Transport Nagar, Delhi - 110001', group: 'company', label: 'Company Address' },
      { key: 'company_phone', value: '+91-98765-00001', group: 'company', label: 'Company Phone' },
      { key: 'company_email', value: 'admin@transporto.in', group: 'company', label: 'Company Email' },
      { key: 'company_gst', value: '07AABCT1234C1Z5', group: 'company', label: 'GST Number' },
      { key: 'currency', value: 'INR', group: 'finance', label: 'Currency' },
      { key: 'fuel_alert_threshold', value: '20', group: 'alerts', label: 'Fuel Alert Threshold (%)' },
      { key: 'temp_deviation_warning', value: '3', group: 'cold_storage', label: 'Temperature Deviation Warning (°C)' },
      { key: 'temp_deviation_critical', value: '5', group: 'cold_storage', label: 'Temperature Deviation Critical (°C)' },
      { key: 'insurance_expiry_days', value: '30', group: 'alerts', label: 'Insurance Expiry Alert Days' },
      { key: 'license_expiry_days', value: '60', group: 'alerts', label: 'Driver License Expiry Alert Days' },
      { key: 'maintenance_reminder_km', value: '5000', group: 'maintenance', label: 'Maintenance Reminder (km before due)' },
      { key: 'overtime_threshold_hours', value: '10', group: 'shifts', label: 'Overtime Threshold (hours)' },
      { key: 'whatsapp_number', value: '+91-98765-00001', group: 'whatsapp', label: 'WhatsApp Business Number' },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Settings created: 14 settings\n');

  // ==================== SUMMARY ====================
  console.log('━'.repeat(60));
  console.log('🚛 TRANSPORTO SEED COMPLETE — Summary');
  console.log('━'.repeat(60));
  console.log(`👥 Users:         ${2 + 1 + driverData.length} (1 Super Admin, 1 Manager, 1 Cold Ops, 5 Drivers)`);
  console.log(`🚚 Vehicles:      ${vehicles.length}`);
  console.log(`👨‍✈️ Drivers:        ${drivers.length}`);
  console.log(`📦 Trips:         ${trips.length}`);
  console.log(`⛽ Fuel Entries:  ${fuelData.length}`);
  console.log(`🔧 Maintenance:   3`);
  console.log(`🚨 Emergencies:   2`);
  console.log(`🛡️  Insurance:     ${insuranceData.length}`);
  console.log(`❄️  Cold Units:    ${coldUnitsCreated.length} (96 temp logs)`);
  console.log(`⏰ Shifts:        4`);
  console.log(`📱 WhatsApp:      3 messages`);
  console.log(`🔔 Notifications: 5`);
  console.log(`⚙️  Settings:      14`);
  console.log('━'.repeat(60));
  console.log('🔑 Login Credentials:');
  console.log('   Super Admin : admin@transporto.in  / admin123');
  console.log('   Manager     : priya@transporto.in  / admin123');
  console.log('   Cold Ops    : ravi@transporto.in   / admin123');
  console.log('   Driver 1    : rajesh@transporto.in / driver123');
  console.log('   Driver 2    : suresh@transporto.in / driver123');
  console.log('━'.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
