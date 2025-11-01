import React, { useState, useEffect } from 'react';
import { Heart, Star, X, Upload, LogOut, BarChart3, Image, Sparkles } from 'lucide-react';
import { db, auth } from './firebase'; // Import your new firebase config
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc 
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";

// Define the shape of a single rating
interface Rating {
  liked: boolean;
  rating: number;
  date: string;
  testMode: boolean;
}

// Define the shape of a single ring
interface Ring {
  id: string;
  imageUrl: string;
  originalUrl: string;
  filename: string;
  ratings: Rating[]; // Use the Rating interface here
  addedDate: string;
}

export default function App() {
  const [view, setView] = useState('login');
  const [isTestMode, setIsTestMode] = useState(false);
  const [rings, setRings] = useState<Ring[]>([]);
  const [currentRingIndex, setCurrentRingIndex] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [adminTab, setAdminTab] = useState('gallery');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 200;

  useEffect(() => {
    // Sign in the user anonymously on load
    signInAnonymously(auth).then(() => {
      console.log('Signed in anonymously');
      loadData(); // Load data *after* signing in
    }).catch((error) => {
      console.error("Anonymous sign-in failed:", error);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => { // Now it's async!
    try {
      // 1. Get the 'rings' collection from Firestore
      const querySnapshot = await getDocs(collection(db, "rings"));
      
      // 2. Map the documents to your Ring[] interface
      const ringsData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id, // Use the Firestore doc ID
      } as Ring));
      
      console.log('Loaded rings from Firestore:', ringsData);
      setRings(ringsData);
      
    } catch (error) {
      console.log('Error loading data from Firestore:', error);
    }
  };

  const handleAdminLogin = () => {
    const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    if (passwordInput === correctPassword) {
      setIsAdminAuthenticated(true);
      setView('admin');
      setPasswordInput('');
    } else {
      alert('Incorrect password');
      setPasswordInput('');
    }
  };

  
  const addRing = async (imageUrl: string, filename: string) => { // Now async
    const convertedUrl = convertGoogleDriveUrl(imageUrl);
    const newRing: Omit<Ring, 'id'> = { // Let Firestore create the ID
      imageUrl: convertedUrl,
      originalUrl: imageUrl,
      filename,
      ratings: [],
      addedDate: new Date().toISOString()
    };
    
    try {
      // Add a new document to the 'rings' collection
      const docRef = await addDoc(collection(db, "rings"), newRing);
      console.log("Ring added with ID: ", docRef.id);
      
      // Optimistically update local state
      setRings([...rings, { ...newRing, id: docRef.id }]);
    } catch (error) {
      console.error('Error adding ring:', error);
    }
  };

  const deleteRing = async (ringId: string) => { // Now async
    if (!window.confirm("Are you sure you want to delete this ring?")) return;
    
    try {
      // Delete the document from Firestore
      await deleteDoc(doc(db, "rings", ringId));
      
      // Update local state
      const updatedRings = rings.filter(r => r.id !== ringId);
      setRings(updatedRings);
      
    } catch (error) {
      console.error('Error deleting ring:', error);
    }
  };

  const handleSwipeLeft = async () => { // Now async
    const newRating: Rating = {
      liked: false,
      rating: 0,
      date: new Date().toISOString(),
      testMode: isTestMode
    };

    const ringToUpdate = rings[currentRingIndex];
    const updatedRatings = [...ringToUpdate.ratings, newRating];
    const ringRef = doc(db, "rings", ringToUpdate.id);

    try {
      await setDoc(ringRef, { ratings: updatedRatings }, { merge: true });

      const updatedRings = [...rings];
      updatedRings[currentRingIndex].ratings = updatedRatings;
      setRings(updatedRings);
      
      moveToNextRing();
    } catch (error) {
      console.error("Error submitting 'pass':", error);
    }
  };

  const handleSwipeRight = () => {
    setShowRatingModal(true);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    if (touchStart !== null) {
      const offset = e.targetTouches[0].clientX - touchStart;
      setSwipeOffset(offset);
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      handleSwipeLeft();
    } else if (isRightSwipe) {
      handleSwipeRight();
    } else {
      setSwipeOffset(0);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  const submitRating = async () => { // Now async
    const newRating: Rating = {
      liked: true,
      rating: selectedRating,
      date: new Date().toISOString(),
      testMode: isTestMode
    };

    const ringToUpdate = rings[currentRingIndex];
    const updatedRatings = [...ringToUpdate.ratings, newRating];
    
    // 1. Get a reference to the specific ring document in Firestore
    const ringRef = doc(db, "rings", ringToUpdate.id);

    try {
      // 2. Update *just* the ratings field on that document
      await setDoc(ringRef, { ratings: updatedRatings }, { merge: true });

      // 3. Update local state to match (this is optimistic)
      const updatedRings = [...rings];
      updatedRings[currentRingIndex].ratings = updatedRatings;
      setRings(updatedRings);

      // 4. Move on
      setShowRatingModal(false);
      setSelectedRating(5);
      moveToNextRing();
      
    } catch (error) {
      console.error("Error submitting rating:", error);
    }
  };

  const moveToNextRing = () => {
    setSwipeOffset(0);
    const unseenRings = rings.filter((ring, idx) => 
      idx > currentRingIndex && 
      !ring.ratings.some(r => !r.testMode)
    );
    
    if (unseenRings.length > 0) {
      const nextIndex = rings.findIndex(r => r.id === unseenRings[0].id);
      setCurrentRingIndex(nextIndex);
    } else {
      setCurrentRingIndex(-1);
    }
  };

  // Added types to parameters
  const convertGoogleDriveUrl = (url: string) => {
    // Check if it's a Google Drive URL
    if (url.includes('drive.google.com')) {
      // Extract file ID from various Google Drive URL formats
      let fileId = null;
      
      // Format: https://drive.google.com/file/d/FILE_ID/view
      const match1 = url.match(/\/file\/d\/([^\/]+)/);
      if (match1) {
        fileId = match1[1];
      }
      
      // Format: https://drive.google.com/open?id=FILE_ID
      const match2 = url.match(/[?&]id=([^&]+)/);
      if (match2) {
        fileId = match2[1];
      }
      
      if (fileId) {
        // Convert to direct image URL
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
      }
    }
    
    // Return original URL if not a Google Drive link
    return url;
  };

  const resetAllRatings = async () => {
    if (window.confirm('Are you sure you want to reset all ratings? This will clear all user ratings in the database.')) {
      console.log('Resetting all ratings...');
      try {
        // 1. Create a list of promises for all the updates
        const updatePromises = rings.map(ring => {
          const ringRef = doc(db, "rings", ring.id);
          // 2. Set the 'ratings' field to an empty array
          return setDoc(ringRef, { ratings: [] }, { merge: true });
        });
        
        // 3. Wait for all updates to complete
        await Promise.all(updatePromises);
        
        // 4. Update the local state to match
        const updatedRings = rings.map(ring => ({
          ...ring,
          ratings: []
        }));
        setRings(updatedRings);
        
        alert('All ratings have been reset in the database!');
      } catch (error) {
        console.error("Error resetting all ratings: ", error);
        alert('An error occurred. Please check the console.');
      }
    }
  };

  const clearTestRatings = async () => {
    if (window.confirm('Clear all test mode ratings from the database?')) {
      console.log('Clearing test ratings...');
      try {
        // We'll create a new local rings array at the same time
        const updatedRingsLocally = [];
        const updatePromises = [];

        // 1. Loop through each ring
        for (const ring of rings) {
          // 2. Filter out test ratings
          const realRatings = ring.ratings.filter(r => !r.testMode);
          
          // 3. If the number of ratings changed, we need to update Firestore
          if (realRatings.length !== ring.ratings.length) {
            const ringRef = doc(db, "rings", ring.id);
            // 4. Create the update promise
            updatePromises.push(
              setDoc(ringRef, { ratings: realRatings }, { merge: true })
            );
          }
          
          // 5. Update the local copy
          updatedRingsLocally.push({
            ...ring,
            ratings: realRatings
          });
        }
        
        // 6. Wait for all database updates to finish
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
        
        // 7. Update the local state
        setRings(updatedRingsLocally);
        
        alert('Test ratings cleared from the database!');
      } catch (error) {
        console.error("Error clearing test ratings: ", error);
        alert('An error occurred. Please check the console.');
      }
    }
  };

  const getRingScore = (ring: Ring) => {
    const realRatings = ring.ratings.filter(r => !r.testMode);
    if (realRatings.length === 0) return null;
    const latestRating = realRatings[realRatings.length - 1];
    return latestRating.liked ? latestRating.rating : 0;
  };

  const getRankedRings = () => {
    return rings
      .map(ring => ({
        ...ring,
        score: getRingScore(ring)
      }))
      .filter(ring => ring.score !== null)
      .sort((a, b) => (b.score as number) - (a.score as number)); // Added type assertion for sorting
  };

  // Login View
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-[8px_8px_20px_rgba(0,0,0,0.1),-8px_-8px_20px_rgba(255,255,255,0.9)] max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-300 to-purple-300 rounded-full mb-4 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.5),inset_4px_4px_8px_rgba(0,0,0,0.1)]">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              Ring Preferences
            </h1>
            <p className="text-gray-600 mt-2">Help us understand your style</p>
          </div>
          
          <button
            onClick={() => {
              setView('user');
              setIsTestMode(false);
              setShowWelcomeModal(true);
              setCurrentRingIndex(rings.findIndex(r => !r.ratings.some(rating => !rating.testMode)) || 0);
            }}
            className="w-full bg-gradient-to-r from-pink-400 to-purple-400 text-white py-4 rounded-2xl mb-4 font-semibold shadow-[4px_4px_12px_rgba(0,0,0,0.15),-2px_-2px_8px_rgba(255,255,255,0.7)] hover:shadow-[inset_4px_4px_12px_rgba(0,0,0,0.1)] transition-all active:scale-95"
          >
            <Heart className="inline mr-2" size={20} />
            Start Rating Rings
          </button>
          
          <div>
            <input
              type="password"
              placeholder="Admin Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-none shadow-[inset_4px_4px_10px_rgba(0,0,0,0.05),inset_-2px_-2px_6px_rgba(255,255,255,0.9)] focus:outline-none focus:shadow-[inset_6px_6px_12px_rgba(0,0,0,0.08)] mb-3"
            />
            <button
              onClick={handleAdminLogin}
              className="w-full bg-gradient-to-r from-blue-400 to-indigo-400 text-white py-4 rounded-2xl font-semibold shadow-[4px_4px_12px_rgba(0,0,0,0.15),-2px_-2px_8px_rgba(255,255,255,0.7)] hover:shadow-[inset_4px_4px_12px_rgba(0,0,0,0.1)] transition-all active:scale-95"
            >
              Admin Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User Swipe View
  if (view === 'user') {
    const currentRing = currentRingIndex >= 0 ? rings[currentRingIndex] : null;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex flex-col">
        <div className="p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Rate Rings
          </h2>
          <button
            onClick={() => setView('login')}
            className="p-3 bg-white rounded-2xl shadow-[4px_4px_12px_rgba(0,0,0,0.1),-2px_-2px_8px_rgba(255,255,255,0.9)] hover:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1)] transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>

        {!currentRing ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 text-center shadow-[8px_8px_20px_rgba(0,0,0,0.1),-8px_-8px_20px_rgba(255,255,255,0.9)] max-w-md">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-300 to-purple-300 rounded-full mx-auto mb-4 flex items-center justify-center shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.5),inset_4px_4px_8px_rgba(0,0,0,0.1)]">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">All Done! ✨</h3>
              <p className="text-gray-600">You've rated all available rings. Thank you!</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-sm">
            <div 
              className="bg-white rounded-3xl p-6 shadow-[12px_12px_24px_rgba(0,0,0,0.15),-8px_-8px_20px_rgba(255,255,255,0.9)]"
              style={{ 
                transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.02}deg)`,
                opacity: Math.max(0.6, 1 - Math.abs(swipeOffset) / 300),
                transition: touchStart === null ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'none'
              }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden mb-6 shadow-[inset_4px_4px_12px_rgba(0,0,0,0.1)] relative">
                <img 
                  src={currentRing.imageUrl} 
                  alt="Ring"
                  className="w-full h-full object-cover pointer-events-none"
                />
                {swipeOffset > minSwipeDistance && (
                  <div className="absolute inset-0 bg-green-500 bg-opacity-30 flex items-center justify-center pointer-events-none">
                    <Heart size={80} className="text-green-500" strokeWidth={3} />
                  </div>
                )}
                {swipeOffset < -minSwipeDistance && (
                  <div className="absolute inset-0 bg-red-500 bg-opacity-30 flex items-center justify-center pointer-events-none">
                    <X size={80} className="text-red-500" strokeWidth={3} />
                  </div>
                )}
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={handleSwipeLeft}
                  className="flex-1 bg-gradient-to-br from-red-300 to-pink-300 text-white py-4 rounded-2xl font-semibold shadow-[6px_6px_16px_rgba(0,0,0,0.15),-3px_-3px_10px_rgba(255,255,255,0.7)] hover:shadow-[inset_4px_4px_12px_rgba(0,0,0,0.15)] transition-all active:scale-95 flex items-center justify-center"
                >
                  <X size={24} className="mr-2" />
                  Pass
                </button>
                
                <button
                  onClick={handleSwipeRight}
                  className="flex-1 bg-gradient-to-br from-green-300 to-emerald-300 text-white py-4 rounded-2xl font-semibold shadow-[6px_6px_16px_rgba(0,0,0,0.15),-3px_-3px_10px_rgba(255,255,255,0.7)] hover:shadow-[inset_4px_4px_12px_rgba(0,0,0,0.15)] transition-all active:scale-95 flex items-center justify-center"
                >
                  <Heart size={24} className="mr-2" />
                  Love It!
                </button>
              </div>
            </div>
              
              <p className="text-center mt-4 text-gray-600 font-medium">
                {rings.filter((r, idx) => idx >= currentRingIndex && !r.ratings.some(rating => isTestMode ? false : !rating.testMode)).length} rings remaining
              </p>
            </div>
          </div>
        )}

        {showRatingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-[12px_12px_30px_rgba(0,0,0,0.2)]">
              <h3 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                How much do you love it?
              </h3>
              
              <div className="flex justify-center gap-2 mb-8">
                {[5, 6, 7, 8, 9, 10].map(rating => (
                  <button
                    key={rating}
                    onClick={() => setSelectedRating(rating)}
                    className={`w-12 h-12 rounded-xl font-bold transition-all ${
                      selectedRating === rating
                        ? 'bg-gradient-to-br from-yellow-300 to-orange-300 text-white shadow-[inset_-3px_-3px_8px_rgba(255,255,255,0.5),inset_3px_3px_8px_rgba(0,0,0,0.2)] scale-110'
                        : 'bg-gray-100 text-gray-600 shadow-[4px_4px_10px_rgba(0,0,0,0.1),-2px_-2px_6px_rgba(255,255,255,0.9)]'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-center mb-4">
                {Array.from({ length: selectedRating }, (_, i) => (
                  <Star
                    key={i}
                    size={24}
                    className="text-yellow-400 fill-yellow-400"
                  />
                ))}
              </div>
              
              <button
                onClick={submitRating}
                className="w-full bg-gradient-to-r from-pink-400 to-purple-400 text-white py-4 rounded-2xl font-semibold shadow-[6px_6px_16px_rgba(0,0,0,0.15),-3px_-3px_10px_rgba(255,255,255,0.7)] hover:shadow-[inset_4px_4px_12px_rgba(0,0,0,0.15)] transition-all active:scale-95"
              >
                Submit Rating
              </button>
            </div>
          </div>
        )}
        {showWelcomeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-[12px_12px_30px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto" dir="rtl">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-300 to-purple-300 rounded-full mb-4 shadow-[inset_-4px_-4px_8px_rgba(255,255,255,0.5),inset_4px_4px_8px_rgba(0,0,0,0.1)]">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">
                  Welcome! 💍
                </h3>
              </div>
              
              <div className="space-y-4 text-gray-700 leading-relaxed text-right">
                <p className="text-lg">
                  היי נעה, הכנתי לך את האפליקציה הקטנה הזו כדי שנוכל לגלות ביחד את הסגנון שאת הכי אוהבת. ✨
                </p>
                
                <p>
                  שמתי פה כל מיני טבעות - חלקן בחרתי כי ממש הרגיש לי שזה 'את' וחלקן שונות ומגוונות... פשוט כדי לראות אם נגלה כיוונים חדשים שלא חשבתי עליהם, ואם תאהבי דווקא אותן אחפש עוד מהן ואוכל להוסיף לפה. הרעיון הוא לא לבחור טבעת אחת ספציפית, אלא לעזור למקד אותי ולקבל תחושה.
                </p>
                
                <p>
                  כל הטבעות הן בזהב צהוב, גם אם בתמונה הן נראות אחרת (לפעמים לא הייתה תמונה של האופציה בזהב צהוב באתר).
                </p>
                
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-4 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.05)]">
                  <p className="text-sm font-semibold text-pink-600 mb-2 text-right">
                    ⚠️ שימי לב:
                  </p>
                  <p className="text-sm text-right">
                    כדי לשמור על קצת מסתורין (ובלי להתלבט יותר מדי), אפשר לראות כל טבעת רק פעם אחת. סמכי על האינטואיציה!
                  </p>
                </div>
                
                <p className="text-center text-lg font-semibold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                  תהני! 💕
                </p>
              </div>
              
              <button
                onClick={() => setShowWelcomeModal(false)}
                className="w-full mt-6 bg-gradient-to-r from-pink-400 to-purple-400 text-white py-4 rounded-2xl font-semibold shadow-[6px_6px_16px_rgba(0,0,0,0.15),-3px_-3px_10px_rgba(255,255,255,0.7)] hover:shadow-[inset_4px_4px_12px_rgba(0,0,0,0.15)] transition-all active:scale-95 text-lg"
              >
                בואי נתחיל! 💍
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Admin View
  if (view === 'admin') {
    if (!isAdminAuthenticated) {
      setView('login');
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl p-6 mb-6 shadow-[8px_8px_20px_rgba(0,0,0,0.1),-8px_-8px_20px_rgba(255,255,255,0.9)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                Admin Dashboard
              </h2>
              <button
                onClick={() => setView('login')}
                className="px-6 py-3 bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 rounded-2xl font-semibold shadow-[4px_4px_12px_rgba(0,0,0,0.1),-2px_-2px_8px_rgba(255,255,255,0.9)] hover:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1)] transition-all"
              >
                <LogOut className="inline mr-2" size={18} />
                Logout
              </button>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setAdminTab('gallery')}
                className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${
                  adminTab === 'gallery'
                    ? 'bg-gradient-to-r from-blue-400 to-indigo-400 text-white shadow-[inset_-3px_-3px_8px_rgba(255,255,255,0.3),inset_3px_3px_8px_rgba(0,0,0,0.2)]'
                    : 'bg-gray-100 text-gray-700 shadow-[4px_4px_12px_rgba(0,0,0,0.1),-2px_-2px_8px_rgba(255,255,255,0.9)]'
                }`}
              >
                <Image className="inline mr-2" size={18} />
                Gallery
              </button>
              
              <button
                onClick={() => setAdminTab('rankings')}
                className={`flex-1 py-3 rounded-2xl font-semibold transition-all ${
                  adminTab === 'rankings'
                    ? 'bg-gradient-to-r from-blue-400 to-indigo-400 text-white shadow-[inset_-3px_-3px_8px_rgba(255,255,255,0.3),inset_3px_3px_8px_rgba(0,0,0,0.2)]'
                    : 'bg-gray-100 text-gray-700 shadow-[4px_4px_12px_rgba(0,0,0,0.1),-2px_-2px_8px_rgba(255,255,255,0.9)]'
                }`}
              >
                <BarChart3 className="inline mr-2" size={18} />
                Rankings
              </button>

              <button
                onClick={() => {
                  setView('user');
                  setIsTestMode(true);
                  setCurrentRingIndex(0);
                }}
                className="flex-1 py-3 rounded-2xl font-semibold bg-gradient-to-r from-purple-400 to-pink-400 text-white shadow-[4px_4px_12px_rgba(0,0,0,0.15),-2px_-2px_8px_rgba(255,255,255,0.7)] hover:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1)] transition-all"
              >
                <Sparkles className="inline mr-2" size={18} />
                Test Mode
              </button>
            </div>
            <div className="flex gap-4">
              <button
                onClick={clearTestRatings}
                className="flex-1 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-orange-300 to-yellow-300 text-white shadow-[3px_3px_10px_rgba(0,0,0,0.1),-2px_-2px_6px_rgba(255,255,255,0.7)] hover:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1)] transition-all"
              >
                Clear Test Ratings
              </button>
              <button
                onClick={resetAllRatings}
                className="flex-1 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-red-400 to-pink-400 text-white shadow-[3px_3px_10px_rgba(0,0,0,0.1),-2px_-2px_6px_rgba(255,255,255,0.7)] hover:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1)] transition-all"
              >
                Reset All Ratings
              </button>
            </div>
          </div>

          {adminTab === 'gallery' && (
            <>
              <div className="bg-white rounded-3xl p-6 mb-6 shadow-[8px_8px_20px_rgba(0,0,0,0.1),-8px_-8px_20px_rgba(255,255,255,0.9)]">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Add New Ring</h3>
                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Image URL (supports Google Drive links)"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-none shadow-[inset_4px_4px_10px_rgba(0,0,0,0.05),inset_-2px_-2px_6px_rgba(255,255,255,0.9)] focus:outline-none focus:shadow-[inset_6px_6px_12px_rgba(0,0,0,0.08)]"
                    />
                    <p className="text-xs text-gray-500 mt-2 ml-2">Paste Google Drive share links directly!</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Filename/Description"
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-none shadow-[inset_4px_4px_10px_rgba(0,0,0,0.05),inset_-2px_-2px_6px_rgba(255,255,255,0.9)] focus:outline-none focus:shadow-[inset_6px_6px_12px_rgba(0,0,0,0.08)]"
                  />
                  <button
                    onClick={() => {
                      if (newImageUrl && newFilename) {
                        addRing(newImageUrl, newFilename);
                        setNewImageUrl('');
                        setNewFilename('');
                      }
                    }}
                    className="w-full bg-gradient-to-r from-green-400 to-emerald-400 text-white py-3 rounded-2xl font-semibold shadow-[4px_4px_12px_rgba(0,0,0,0.15),-2px_-2px_8px_rgba(255,255,255,0.7)] hover:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1)] transition-all active:scale-95"
                  >
                    <Upload className="inline mr-2" size={18} />
                    Add Ring
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rings.map(ring => {
                  const score = getRingScore(ring);
                  return (
                    <div key={ring.id} className="bg-white rounded-3xl p-4 shadow-[8px_8px_20px_rgba(0,0,0,0.1),-8px_-8px_20px_rgba(255,255,255,0.9)]">
                      <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.05)]">
                        <img src={ring.imageUrl} alt={ring.filename} className="w-full h-full object-cover" />
                      </div>
                      <p className="font-semibold text-gray-800 mb-2 truncate">{ring.filename}</p>
                      {score !== null && (
                        <div className="flex items-center gap-2 mb-3">
                          {score > 0 ? (
                            <>
                              <span className="text-lg font-bold text-yellow-500">{score}/10</span>
                              <div className="flex">
                                {Array.from({ length: Math.min(score, 5) }, (_, i) => (
                                  <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                                ))}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-500">Not liked</span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => deleteRing(ring.id)}
                        className="w-full bg-gradient-to-r from-red-300 to-pink-300 text-white py-2 rounded-2xl text-sm font-semibold shadow-[3px_3px_8px_rgba(0,0,0,0.1),-2px_-2px_6px_rgba(255,255,255,0.9)] hover:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1)] transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {adminTab === 'rankings' && (
            <div className="bg-white rounded-3xl p-6 shadow-[8px_8px_20px_rgba(0,0,0,0.1),-8px_-8px_20px_rgba(255,255,255,0.9)]">
              <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                Top Rated Rings
              </h3>
              <div className="space-y-4">
                {getRankedRings().map((ring, index) => {
                  const score = (ring.score ?? 0) as number;
                  return (
                    <div key={ring.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl shadow-[4px_4px_12px_rgba(0,0,0,0.08),-2px_-2px_8px_rgba(255,255,255,0.9)]">
                      <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-yellow-300 to-orange-300 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-[inset_-3px_-3px_6px_rgba(255,255,255,0.5),inset_3px_3px_6px_rgba(0,0,0,0.1)]">
                        #{index + 1}
                      </div>
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-[4px_4px_10px_rgba(0,0,0,0.1)]">
                        <img src={ring.imageUrl} alt={ring.filename} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{ring.filename}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {score > 0 ? (
                            <>
                              <span className="text-xl font-bold text-yellow-500">{score}/10</span>
                              <div className="flex">
                                {Array.from({ length: Math.min(score, 10) }, (_, i) => (
                                  <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
                                ))}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-500">Not liked</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {getRankedRings().length === 0 && (
                  <p className="text-center text-gray-500 py-8">No ratings yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}