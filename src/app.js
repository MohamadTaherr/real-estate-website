import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

// Main application component
const App = () => {
  // State for properties fetched from the database
  const [properties, setProperties] = useState([]);
  // State for new property form data
  const [newProperty, setNewProperty] = useState({
    address: '',
    price: '',
    bedrooms: '',
    bathrooms: '',
    imageUrl: '',
  });
  // State for UI messages (e.g., loading, success, error)
  const [message, setMessage] = useState('Loading properties...');
  // State for the user's ID
  const [userId, setUserId] = useState(null);
  // State for Firestore and Auth instances
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);

  // --- Firebase Initialization and Authentication ---
  // This useEffect hook handles initializing Firebase and signing in the user.
  // It runs only once when the component mounts.
  useEffect(() => {
    // These variables are provided by the canvas environment.
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    if (!firebaseConfig.apiKey) {
      setMessage("Firebase config not found. Please provide a valid configuration.");
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authInstance = getAuth(app);
      setDb(firestore);
      setAuth(authInstance);

      // Sign in the user with the custom token or anonymously if the token is not available
      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(authInstance, initialAuthToken);
          } else {
            await signInAnonymously(authInstance);
          }
        } catch (error) {
          console.error("Firebase Auth Error:", error);
          setMessage("Failed to authenticate. Check the console for details.");
        }
      };
      signIn();

      // Listen for authentication state changes to get the user ID
      const unsubscribeAuth = authInstance.onAuthStateChanged(user => {
        if (user) {
          setUserId(user.uid);
          setMessage('Welcome!');
        }
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error("Firebase Initialization Error:", error);
      setMessage("Failed to initialize Firebase. Check the console for details.");
    }
  }, []);

  // --- Firestore Data Fetching ---
  // This useEffect hook sets up a real-time listener to the 'properties' collection.
  // It re-runs when the 'db' or 'userId' state changes.
  useEffect(() => {
    // Only proceed if Firebase is initialized and the user is authenticated
    if (!db || !userId) return;

    setMessage('Loading properties...');

    // Get a reference to the 'properties' collection
    // We are using a public collection path to allow for future multi-user features
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const propertiesCollection = collection(db, `artifacts/${appId}/public/data/properties`);
    
    // Set up a real-time listener using onSnapshot
    const unsubscribe = onSnapshot(propertiesCollection, (querySnapshot) => {
      const propertyList = [];
      querySnapshot.forEach((doc) => {
        propertyList.push({ id: doc.id, ...doc.data() });
      });
      setProperties(propertyList);
      setMessage(null); // Clear loading message
    }, (error) => {
      console.error("Error fetching documents:", error);
      setMessage("Failed to load properties. Check the console for details.");
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [db, userId]);

  // --- Functions for user interaction ---
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProperty(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  // Handle form submission to add a new property
  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!db || !newProperty.address || !newProperty.price) {
      setMessage("Please fill in at least the address and price.");
      return;
    }
    setMessage("Adding property...");
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const propertiesCollection = collection(db, `artifacts/${appId}/public/data/properties`);
      await addDoc(propertiesCollection, {
        ...newProperty,
        price: parseFloat(newProperty.price),
        bedrooms: parseInt(newProperty.bedrooms) || 0,
        bathrooms: parseInt(newProperty.bathrooms) || 0,
        createdAt: serverTimestamp(),
      });
      setMessage("Property added successfully!");
      // Clear the form after submission
      setNewProperty({
        address: '',
        price: '',
        bedrooms: '',
        bathrooms: '',
        imageUrl: '',
      });
    } catch (error) {
      console.error("Error adding document:", error);
      setMessage("Failed to add property. Check the console for details.");
    }
  };

  // Render the main UI
  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center font-inter">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">Real Estate Listings</h1>
        <p className="text-center text-gray-600 mb-8">Browse and add properties to the list.</p>

        {/* User ID display for reference */}
        {userId && (
          <div className="mb-4 text-center text-sm text-gray-500">
            Your User ID: <span className="font-mono">{userId}</span>
          </div>
        )}

        {/* Message area */}
        {message && (
          <div className="text-center p-4 rounded-lg bg-blue-100 text-blue-700 mb-8 shadow-sm">
            {message}
          </div>
        )}

        {/* Form to add a new property */}
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Add a New Property</h2>
          <form onSubmit={handleAddProperty} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              name="address"
              value={newProperty.address}
              onChange={handleInputChange}
              placeholder="Address"
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              name="price"
              value={newProperty.price}
              onChange={handleInputChange}
              placeholder="Price ($)"
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              name="bedrooms"
              value={newProperty.bedrooms}
              onChange={handleInputChange}
              placeholder="Bedrooms"
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              name="bathrooms"
              value={newProperty.bathrooms}
              onChange={handleInputChange}
              placeholder="Bathrooms"
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              name="imageUrl"
              value={newProperty.imageUrl}
              onChange={handleInputChange}
              placeholder="Image URL (optional)"
              className="md:col-span-2 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="md:col-span-2 bg-blue-600 text-white font-bold p-3 rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200"
            >
              Add Property
            </button>
          </form>
        </div>

        {/* Property Listings section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.length > 0 ? (
            properties.map((property) => (
              <div key={property.id} className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-200">
                <img
                  src={property.imageUrl || `https://placehold.co/600x400/E5E7EB/4B5563?text=${encodeURIComponent(property.address)}`}
                  alt={`Image of ${property.address}`}
                  className="w-full h-48 object-cover"
                  onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/600x400/E5E7EB/4B5563?text=Image+Not+Found"; }}
                />
                <div className="p-4">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{property.address}</h3>
                  <p className="text-2xl font-extrabold text-blue-600 mb-2">${property.price.toLocaleString()}</p>
                  <div className="flex items-center text-gray-600 text-sm">
                    <span className="mr-4">
                      <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zM10 12a7 7 0 100-14 7 7 0 000 14zM10 18a8 8 0 110-16 8 8 0 010 16zM10 16a6 6 0 100-12 6 6 0 000 12zM10 14a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                      {property.bedrooms} Bed
                    </span>
                    <span>
                      <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zM15 8a3 3 0 100-6 3 3 0 000 6zM10 14a6 6 0 100-12 6 6 0 000 12zM10 16a8 8 0 110-16 8 8 0 010 16zM10 18a10 10 0 100-20 10 10 0 000 20z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                      {property.bathrooms} Bath
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 col-span-full">No properties found. Add one above!</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default App;
