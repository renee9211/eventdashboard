import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeK_P3N8jECNSuEq1VmXkinY54r7RJTkk",
  authDomain: "event-dashboard-a3773.firebaseapp.com",
  projectId: "event-dashboard-a3773",
  storageBucket: "event-dashboard-a3773.firebasestorage.app",
  messagingSenderId: "531470257400",
  appId: "1:531470257400:web:eb3b364cd884591f4fff0d",
  measurementId: "G-DJKJ2KC4NX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export {
  auth, db, provider,
  signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy
};
