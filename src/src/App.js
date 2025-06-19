import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Plus, Package, Phone, Trash2, Edit, X, MessageSquare, Truck, Clock, Paperclip, CheckCircle, Mail, Pill } from 'lucide-react';

// --- Firebase Configuration ---
// This line securely loads your configuration from Netlify's environment variables.
const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Helper Functions ---
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : date.toDate();
  return d.toLocaleDateString('en-US');
};

// --- Constants for Statuses ---
const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-blue-100 text-blue-800',
  'Action Required': 'bg-red-100 text-red-800',
  Active: 'bg-green-100 text-green-800',
  Fulfilled: 'bg-gray-100 text-gray-800',
  'On Hold': 'bg-gray-100 text-gray-800',
};

const FULFILLMENT_STATUSES = {
  Scheduled: { icon: Clock, color: 'text-gray-400', label: 'Scheduled' },
  'Intake Sent': { icon: Mail, color: 'text-blue-500', label: 'Intake Sent' },
  'Awaiting RX': { icon: Paperclip, color: 'text-orange-500', label: 'Awaiting RX' },
  'RX Received': { icon: CheckCircle, color: 'text-purple-600', label: 'RX Received - Ready to Ship' },
  Shipped: { icon: Truck, color: 'text-green-600', label: 'Shipped' },
};


// --- React Components ---

const Tooltip = ({ text, children }) => (
  <div className="relative group flex items-center">
    {children}
    <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
      {text}
    </div>
  </div>
);

const Modal = ({ children, isOpen, onClose, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};


const SubscriptionForm = ({ onSave, onCancel, subscription }) => {
  const [formData, setFormData] = useState({
    patientName: subscription?.patientName || `Patient-${Math.floor(1000 + Math.random() * 9000)}`,
    drugName: subscription?.drugName || 'Lisinopril 10mg',
    newRxCall: subscription?.newRxCall || false,
    duration: subscription?.duration || 1,
    status: subscription?.status || 'Pending',
    physicianStatus: subscription?.physicianStatus || 'Pending',
    startDate: subscription ? formatDate(subscription.startDate) : new Date().toLocaleDateString('en-US'),
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    let submissionData = {
        ...formData,
        duration: parseInt(formData.duration, 10),
    };

    if (subscription) { 
        submissionData.id = subscription.id;
        submissionData.fulfillments = subscription.fulfillments;
        submissionData.startDate = subscription.startDate;
        submissionData.communicationLog = subscription.communicationLog;
    } else { 
        const startDate = new Date();
        const fulfillments = [];
        for (let i = 0; i < submissionData.duration; i++) {
            fulfillments.push({
                fulfillmentDate: addMonths(startDate, i),
                status: i === 0 ? 'RX Received' : 'Scheduled', // First one is ready, others are scheduled
                tracking: null,
                rxId: i === 0 ? `RX-INITIAL-${Date.now()}` : null,
            });
        }
        submissionData.startDate = startDate;
        submissionData.fulfillments = fulfillments;
        submissionData.communicationLog = [{
            date: new Date(),
            message: 'Subscription created.',
            actor: 'System'
        }];
    }
    
    onSave(submissionData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div>
            <label htmlFor="patientName" className="block text-sm font-medium text-gray-700">Patient Name</label>
            <input type="text" name="patientName" id="patientName" value={formData.patientName} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
         </div>
         <div>
            <label htmlFor="drugName" className="block text-sm font-medium text-gray-700">Drug Name</label>
            <input type="text" name="drugName" id="drugName" value={formData.drugName} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required />
         </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700">Subscription Duration</label>
          <select name="duration" id="duration" value={formData.duration} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" disabled={!!subscription}>
            <option value={1}>1 Month</option>
            <option value={3}>3 Months</option>
            <option value={6}>6 Months</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">Overall Status</label>
          <select name="status" id="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option>Pending</option>
            <option>Approved</option>
            <option>Active</option>
            <option>Fulfilled</option>
            <option>On Hold</option>
          </select>
        </div>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="physicianStatus" className="block text-sm font-medium text-gray-700">Physician Approval Status</label>
          <select name="physicianStatus" id="physicianStatus" value={formData.physicianStatus} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option>Pending</option>
            <option>Approved</option>
          </select>
        </div>
        <div className="flex items-end">
            <div className="flex items-center h-full">
              <input id="newRxCall" name="newRxCall" type="checkbox" checked={formData.newRxCall} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
              <label htmlFor="newRxCall" className="ml-2 block text-sm text-gray-900 font-medium">New RX - Call Patient</label>
            </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancel</button>
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          {subscription ? 'Update' : 'Create'} Subscription
        </button>
      </div>
    </form>
  );
};

const LogModal = ({ subscription, onAddLog, onClose }) => {
    const [newMessage, setNewMessage] = useState('');

    const handleAddLog = () => {
        if (newMessage.trim()) {
            onAddLog(subscription.id, newMessage, 'Pharmacy Staff');
            setNewMessage('');
        }
    };

    return (
        <Modal isOpen={!!subscription} onClose={onClose} title={`Log: ${subscription?.patientName} (${subscription?.drugName})`}>
            <div className="space-y-4">
                <div className="max-h-64 overflow-y-auto border rounded-md p-3 space-y-3 bg-gray-50">
                    {[...(subscription?.communicationLog || [])]?.sort((a,b) => b.date - a.date).map((log, index) => (
                        <div key={index} className="p-2 border-b">
                            <p className="text-sm text-gray-800">{log.message}</p>
                            <p className="text-xs text-gray-500 text-right">{log.actor} - {formatDate(log.date)}</p>
                        </div>
                    ))}
                </div>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Add new log entry..."
                        className="flex-grow px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <button onClick={handleAddLog} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Add</button>
                </div>
            </div>
        </Modal>
    );
};

const FulfillmentActionModal = ({ fulfillment, subscription, onClose, onUpdateFulfillment, onMarkAsShipped }) => {
    const [trackingNumber, setTrackingNumber] = useState(fulfillment?.tracking || '');
    
    if(!fulfillment || !subscription) return null;

    const handleShip = () => {
        onMarkAsShipped(subscription.id, fulfillment, trackingNumber);
    };
    
    const StatusIcon = FULFILLMENT_STATUSES[fulfillment.status].icon;

    return (
        <Modal isOpen={!!fulfillment} onClose={onClose} title={`Fulfillment: ${subscription.patientName} (${subscription.drugName})`}>
            <div className="space-y-6">
                <div className="flex items-center space-x-3 p-3 bg-gray-100 rounded-lg">
                    <StatusIcon size={24} className={FULFILLMENT_STATUSES[fulfillment.status].color} />
                    <div>
                      <p className="font-semibold text-gray-800">Current Status: {fulfillment.status}</p>
                      {fulfillment.status === 'Shipped' && <p className="text-sm text-gray-600">Tracking: {fulfillment.tracking || 'N/A'}</p>}
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="font-semibold text-gray-700">Simulate API / System Events:</h4>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => onUpdateFulfillment(subscription.id, fulfillment, 'Intake Sent')} className="text-sm bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md">Simulate: Intake Sent</button>
                        <button onClick={() => onUpdateFulfillment(subscription.id, fulfillment, 'Awaiting RX')} className="text-sm bg-orange-500 hover:bg-orange-600 text-white py-1 px-3 rounded-md">Simulate: Patient Responded</button>
                        <button onClick={() => onUpdateFulfillment(subscription.id, fulfillment, 'RX Received')} className="text-sm bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded-md">Simulate: RX Received (API)</button>
                    </div>
                </div>

                {fulfillment.status === 'RX Received' && (
                    <div className="pt-4 border-t">
                        <h4 className="font-semibold text-gray-700 mb-2">Ship Package</h4>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                placeholder="Enter tracking number..."
                                className="flex-grow px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                            <button onClick={handleShip} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2"><Truck size={16}/><span>Mark as Shipped</span></button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};


export default function App() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [logModalSubscription, setLogModalSubscription] = useState(null);
  const [actionModalData, setActionModalData] = useState({ subscription: null, fulfillment: null });
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState(null);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
      } else {
        const signIn = async () => {
          try {
            await signInAnonymously(auth);
          } catch (authError) {
            console.error("Authentication Error:", authError);
            setError("Could not authenticate user.");
          }
        };
        signIn();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    setIsLoading(true);
    const collectionPath = `subscriptions`; // Simplified Path
    const q = query(collection(db, collectionPath));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const subs = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id,
              ...data,
              startDate: data.startDate?.toDate(),
              fulfillments: data.fulfillments?.map(f => ({ ...f, fulfillmentDate: f.fulfillmentDate?.toDate() })) || [],
              communicationLog: data.communicationLog?.map(l => ({ ...l, date: l.date?.toDate() })) || []
          };
      });

      const updatedSubs = subs.map(sub => {
          const allFulfilled = sub.fulfillments.every(f => f.status === 'Shipped');
          const requiresAction = sub.fulfillments.some(f => f.status === 'RX Received');

          let overallStatus = sub.status;
          if (overallStatus !== 'On Hold') {
             if (allFulfilled) overallStatus = 'Fulfilled';
             else if (requiresAction) overallStatus = 'Action Required';
             else overallStatus = 'Active';
          }
          return { ...sub, status: overallStatus };
      });

      setSubscriptions(updatedSubs);
      setIsLoading(false);
    }, (err) => {
      console.error("Firestore Error: ", err);
      setError("Failed to load subscription data.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  const addLog = async (subId, message, actor) => {
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return;

    const newLog = { date: new Date(), message, actor };
    
    try {
        const collectionPath = `subscriptions`; // Simplified Path
        const docRef = doc(db, collectionPath, subId);
        await updateDoc(docRef, {
            communicationLog: [...(sub.communicationLog || []), newLog]
        });
    } catch(e) {
        console.error("Error adding log: ", e);
        setError("Failed to add log entry.");
    }
  };

  const handleSaveSubscription = async (subData) => {
    setIsModalOpen(false);
    setEditingSubscription(null);
    const collectionPath = `subscriptions`; // Simplified Path

    if (subData.id) {
      const { id, ...dataToUpdate } = subData;
      const docRef = doc(db, collectionPath, id);
      try { await updateDoc(docRef, dataToUpdate); } catch (e) { setError("Could not update the subscription."); }
    } else {
      try { await addDoc(collection(db, collectionPath), subData); } catch (e) { setError("Could not create the subscription."); }
    }
  };

  const handleDelete = async (id) => {
      if (window.confirm('Are you sure? This is permanent.')) {
          try {
              await deleteDoc(doc(db, `subscriptions`, id)); // Simplified Path
          } catch(e) { setError("Could not delete the subscription."); }
      }
  };

  const updateFulfillment = async (subId, fulfillmentToUpdate, newStatus, tracking = null) => {
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return;

    const newFulfillments = sub.fulfillments.map(f => {
        if (f.fulfillmentDate.getTime() === fulfillmentToUpdate.fulfillmentDate.getTime()) {
            return { ...f, status: newStatus, tracking: tracking !== null ? tracking : f.tracking };
        }
        return f;
    });

    const logMessage = newStatus === 'Shipped'
      ? `Marked fulfillment for ${formatDate(fulfillmentToUpdate.fulfillmentDate)} as Shipped. Tracking: ${tracking}`
      : `Updated fulfillment for ${formatDate(fulfillmentToUpdate.fulfillmentDate)} to status: ${newStatus}.`;
    
    await addLog(subId, logMessage, newStatus === 'Shipped' ? 'Pharmacy Staff' : 'System');

    try {
        await updateDoc(doc(db, `subscriptions`, subId), { fulfillments: newFulfillments }); // Simplified Path
        setActionModalData({ subscription: null, fulfillment: null });
    } catch(e) { setError("Failed to update fulfillment status."); }
  }


  const getNextActionableDate = (sub) => {
    const nextActionable = sub.fulfillments.find(f => f.status !== 'Shipped');
    return nextActionable ? nextActionable.fulfillmentDate : null;
  };

  const sortedSubscriptions = [...subscriptions].sort((a, b) => {
    // Prioritize 'Action Required'
    if (a.status === 'Action Required' && b.status !== 'Action Required') return -1;
    if (b.status === 'Action Required' && a.status !== 'Action Required') return 1;

    const dateA = getNextActionableDate(a);
    const dateB = getNextActionableDate(b);
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-gray-200 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Prescription Fulfillment Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">
              Event-driven tracking for multi-month patient subscriptions.
              {userId && <span className="ml-2 bg-gray-200 text-gray-700 text-xs font-mono py-0.5 px-1.5 rounded">User: {userId}</span>}
            </p>
          </div>
          <button
            onClick={() => { setEditingSubscription(null); setIsModalOpen(true); }}
            className="mt-4 sm:mt-0 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105"
          >
            <Plus size={20} className="mr-2" /> New Subscription
          </button>
        </header>

        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert"><p>{error}</p></div>}
        
        {isLoading ? <div className="text-center py-10"><p>Loading subscriptions...</p></div> : (
          <div className="bg-white shadow-xl rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient / Drug</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Action Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fulfillment Pipeline</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedSubscriptions.map((sub) => {
                  const nextDate = getNextActionableDate(sub);
                  const isPastDue = nextDate && new Date(nextDate) < new Date();
                  
                  return (
                    <tr key={sub.id} className={`${sub.status === 'Action Required' ? 'bg-purple-50' : ''} hover:bg-gray-50`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{sub.patientName}</div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Pill size={14} className="mr-1.5 text-gray-400"/>
                            {sub.drugName}
                            {sub.newRxCall && <Tooltip text="New RX: Call Patient"><Phone size={16} className="ml-2 text-red-500 animate-pulse" /></Tooltip>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[sub.status]}`}>{sub.status}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${isPastDue ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                          {nextDate ? formatDate(nextDate) : 'Completed'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {sub.fulfillments.map((f, index) => {
                              const StatusIcon = FULFILLMENT_STATUSES[f.status].icon;
                              const statusInfo = FULFILLMENT_STATUSES[f.status];
                              return (
                                <Tooltip key={index} text={`${statusInfo.label} (Due: ${formatDate(f.fulfillmentDate)})`}>
                                    <button onClick={() => setActionModalData({ subscription: sub, fulfillment: f })} className="flex items-center justify-center p-1 rounded-full hover:bg-gray-200">
                                        <StatusIcon size={20} className={`${statusInfo.color} ${f.status === 'RX Received' ? 'animate-pulse' : ''}`} />
                                    </button>
                                </Tooltip>
                              )
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center items-center space-x-2">
                           <Tooltip text="Communication Log"><button onClick={() => setLogModalSubscription(sub)} className="text-gray-400 hover:text-indigo-600"><MessageSquare size={18}/></button></Tooltip>
                           <Tooltip text="Edit Subscription"><button onClick={() => { setEditingSubscription(sub); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600"><Edit size={18}/></button></Tooltip>
                           <Tooltip text="Delete Subscription"><button onClick={() => handleDelete(sub.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18}/></button></Tooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sortedSubscriptions.length === 0 && (
                <div className="text-center py-12 px-6"><Package size={48} className="mx-auto text-gray-300"/><h3 className="mt-2 text-sm font-medium text-gray-900">No subscriptions found</h3><p className="mt-1 text-sm text-gray-500">Get started by creating a new subscription.</p></div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingSubscription(null); }} title={editingSubscription ? `Edit: ${editingSubscription.patientName}` : "Create New Subscription"}>
        <SubscriptionForm onSave={handleSaveSubscription} onCancel={() => { setIsModalOpen(false); setEditingSubscription(null); }} subscription={editingSubscription}/>
      </Modal>

      {logModalSubscription && (<LogModal subscription={logModalSubscription} onClose={() => setLogModalSubscription(null)} onAddLog={addLog}/>)}

      {actionModalData.subscription && actionModalData.fulfillment && (
          <FulfillmentActionModal
              {...actionModalData}
              onClose={() => setActionModalData({ subscription: null, fulfillment: null })}
              onUpdateFulfillment={updateFulfillment}
              onMarkAsShipped={(subId, fulfillment, tracking) => updateFulfillment(subId, fulfillment, 'Shipped', tracking)}
          />
      )}

    </div>
  );
}
