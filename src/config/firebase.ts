import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase configuration - Replace with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyApwe7JJom4sHBQ6swV6YCi8f68mlgb3yw",
  authDomain: "sarav-explore.firebaseapp.com",
  projectId: "sarav-explore",
  storageBucket: "sarav-explore.firebasestorage.app",
  messagingSenderId: "168321911416",
  appId: "1:168321911416:web:f85f41c52a9e1e18523b8d",
  measurementId: "G-EVE3Y2R3ST",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// For development - connect to Firestore emulator if needed
// Uncomment the line below if you want to use Firestore emulator for local development
// if (process.env.NODE_ENV === 'development') {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

export default app;
