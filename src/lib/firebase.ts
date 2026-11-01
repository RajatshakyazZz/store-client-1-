import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';

function getResolvedFirebaseConfig() {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('vaultzet_firebase_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.apiKey && parsed.projectId) {
          return {
            apiKey: parsed.apiKey,
            authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
            projectId: parsed.projectId,
            storageBucket: parsed.storageBucket || `${parsed.projectId}.firebasestorage.app`,
            messagingSenderId: parsed.messagingSenderId || '1029384756',
            appId: parsed.appId || '1:1029384756:web:vaultzet',
          };
        }
      }
    } catch {}
  }
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDemoAdminPortalKey_Vaultzet_2026',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'vaultzet-5873e.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vaultzet-5873e',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vaultzet-5873e.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1029384756',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1029384756:web:8a9b0c1d2e3f4a5b',
  };
}

const firebaseConfig = getResolvedFirebaseConfig();

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.warn('Firebase initialized in fallback mode:', error);
}

export { app, db, auth };
export const getFirebaseDb = () => db;

export interface StoreOrder {
  id?: string;
  orderNumber: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
  };
  items: Array<{
    id: string;
    title: string;
    price: number;
    license: 'personal' | 'reseller';
    googleDriveLink?: string;
  }>;
  orderBump?: {
    id: string;
    title: string;
    price: number;
  } | null;
  totalAmount: number;
  paymentMethod: string;
  status: 'completed' | 'processing' | 'pending';
  createdAt?: any;
}

// 1. Create Order in Firestore
export async function createOrderInFirestore(order: Omit<StoreOrder, 'id' | 'createdAt'>): Promise<string> {
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
  const orderPayload = {
    ...order,
    orderNumber,
    createdAt: serverTimestamp(),
    timestampIso: new Date().toISOString(),
  };

  if (db) {
    try {
      const docRef = await addDoc(collection(db, 'orders'), orderPayload);
      return docRef.id;
    } catch (err) {
      console.error('Failed to create order in Firestore, using local fallback:', err);
    }
  }

  // Local fallback persistence
  const localOrders = JSON.parse(localStorage.getItem('vaultzet_orders') || '[]');
  const fallbackOrder = { id: `local-${Date.now()}`, ...orderPayload };
  localOrders.unshift(fallbackOrder);
  localStorage.setItem('vaultzet_orders', JSON.stringify(localOrders));
  return fallbackOrder.id;
}

// 2. Fetch Orders by Customer Email (for /my-order portal)
export async function getCustomerOrders(email: string): Promise<StoreOrder[]> {
  const cleanEmail = email.trim().toLowerCase();
  if (db) {
    try {
      const q = query(
        collection(db, 'orders'),
        where('customer.email', '==', cleanEmail),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreOrder));
      }
    } catch (err) {
      console.warn('Firestore query failed, checking fallback:', err);
    }
  }

  // Fallback to local storage
  const localOrders: StoreOrder[] = JSON.parse(localStorage.getItem('vaultzet_orders') || '[]');
  return localOrders.filter((o) => o.customer.email.toLowerCase() === cleanEmail);
}

// 3. Fetch Single Order by ID (for /order-success page)
export async function getOrderById(orderId: string): Promise<StoreOrder | null> {
  if (db && !orderId.startsWith('local-')) {
    try {
      const docRef = doc(db, 'orders', orderId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as StoreOrder;
      }
    } catch (err) {
      console.warn('Error fetching order by ID:', err);
    }
  }

  // Fallback to local storage
  const localOrders: StoreOrder[] = JSON.parse(localStorage.getItem('vaultzet_orders') || '[]');
  return localOrders.find((o) => o.id === orderId || o.orderNumber === orderId) || null;
}
