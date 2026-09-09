import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAw8tzRbxHT5qxaVILwd9ZJPVLCxYxm0pE",
  authDomain: "giro-app-1bc42.firebaseapp.com",
  projectId: "giro-app-1bc42",
  storageBucket: "giro-app-1bc42.firebasestorage.app",
  messagingSenderId: "721351379511",
  appId: "1:721351379511:web:05a79a0f26285be92bcdb2",
  measurementId: "G-GYWKE35X1L"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços de Autenticação e Banco de Dados (Firestore)
export const auth = getAuth(app);

// ignoreUndefinedProperties: evita que o Firestore rejeite a escrita quando
// um campo (ex: image) vier como "undefined" em vez de omitido ou null
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

export const googleProvider = new GoogleAuthProvider();
