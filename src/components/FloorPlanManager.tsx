import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { FloorPlan, FloorPlanPin } from '../types';
import { Map, Upload, Plus, X, MapPin, Image as ImageIcon, Trash2, List } from 'lucide-react';
import { cn } from '../lib/utils';

export default function FloorPlanManager({ warrantyId, onClose, projectName }: { warrantyId: string, onClose: () => void, projectName: string }) {
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pins, setPins] = useState<FloorPlanPin[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Add Plan Modal
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanFile, setNewPlanFile] = useState<File | null>(null);

  // Add/Edit Pin Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTempPos, setPinTempPos] = useState<{ x: number, y: number } | null>(null);
  const [pinTitle, setPinTitle] = useState('');
  const [pinDesc, setPinDesc] = useState('');
  const [pinFile, setPinFile] = useState<File | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);

  // View Pin Detail
  const [viewingPin, setViewingPin] = useState<FloorPlanPin | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'floorPlans'), where('warrantyId', '==', warrantyId));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FloorPlan));
      setPlans(data);
      if (data.length > 0 && !selectedPlanId) {
        setSelectedPlanId(data[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching plans:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [warrantyId]);

  useEffect(() => {
    if (!selectedPlanId && viewMode === 'map') return;
    
    let q;
    if (viewMode === 'map') {
      q = query(collection(db, 'floorPlanPins'), where('planId', '==', selectedPlanId));
    } else {
      q = query(collection(db, 'floorPlanPins'), where('warrantyId', '==', warrantyId));
    }
    
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FloorPlanPin));
      setPins(data);
    }, (err) => {
      console.error('Error fetching pins:', err);
    });
    return () => unsub();
  }, [selectedPlanId, warrantyId, viewMode]);

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName || !newPlanFile) return;
    setUploadingPlan(true);
    try {
      const fileRef = ref(storage, `floorPlans/${warrantyId}/${Date.now()}_${newPlanFile.name}`);
      await uploadBytes(fileRef, newPlanFile);
      const url = await getDownloadURL(fileRef);
      
      await addDoc(collection(db, 'floorPlans'), {
        warrantyId,
        name: newPlanName,
        imageUrl: url,
        createdAt: serverTimestamp()
      });
      
      setShowAddPlan(false);
      setNewPlanName('');
      setNewPlanFile(null);
    } catch (err) {
      console.error(err);
      alert('上傳失敗');
    } finally {
      setUploadingPlan(false);
    }
  };

  const handleDeletePlan = async (plan: FloorPlan) => {
    if (!confirm(`確定要刪除「${plan.name}」嗎？這會同時刪除該圖面上的所有標記。`)) return;
    try {
      const pinsToDelete = pins.filter(p => p.planId === plan.id);
      for (const p of pinsToDelete) {
        await deleteDoc(doc(db, 'floorPlanPins', p.id));
      }
      await deleteDoc(doc(db, 'floorPlans', plan.id));
      if (selectedPlanId === plan.id) {
        setSelectedPlanId(plans.filter(p => p.id !== plan.id)[0]?.id || null);
      }
    } catch (err) {
      console.error(err);
      alert('刪除失敗');
    }
  };

  const handleDoubleClickMap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedPlanId) return;
    if (imageContainerRef.current) {
      const rect = imageContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPinTempPos({ x, y });
      setPinTitle('');
      setPinDesc('');
      setPinFile(null);
      setShowPinModal(true);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinTempPos || !selectedPlanId || !pinTitle) return;
    setIsSavingPin(true);
    
    try {
      let photoUrl = '';
      if (pinFile) {
        const fileRef = ref(storage, `floorPlanPins/${warrantyId}/${Date.now()}_${pinFile.name}`);
        await uploadBytes(fileRef, pinFile);
        photoUrl = await getDownloadURL(fileRef);
      }

      await addDoc(collection(db, 'floorPlanPins'), {
        planId: selectedPlanId,
        warrantyId,
        x: pinTempPos.x,
        y: pinTempPos.y,
        title: pinTitle,
        description: pinDesc,
        photoUrl,
        createdAt: serverTimestamp()
      });

      setShowPinModal(false);
    } catch (err) {
      console.error(err);
      alert('儲存標記失敗');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleDeletePin = async (pinId: string) => {
    if (!confirm('確定刪除此標記？')) return;
    try {
      await deleteDoc(doc(db, 'floorPlanPins', pinId));
      setViewingPin(null);
    } catch(err) {
      console.error(err);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full h-[95vh] max-w-7xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Map className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg leading-tight">{projectName}</h2>
              <div className="text-sm text-slate-500">保固範圍平面圖</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200 p-1 rounded-lg mr-4">
              <button
                onClick={() => setViewMode('map')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                  viewMode === 'map' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Map className="w-4 h-4" /> 圖面模式
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                  viewMode === 'list' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <List className="w-4 h-4" /> 總表模式
              </button>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">載入中...</div>
          ) : viewMode === 'map' ? (
            <>
              {/* Sidebar */}
              <div className="w-64 bg-slate-50 border-r border-slate-100 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-700">圖面清單</h3>
                  <button 
                    onClick={() => setShowAddPlan(true)}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="新增平面圖"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {plans.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">尚無平面圖</div>
                  ) : (
                    plans.map(plan => (
                      <div 
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={cn(
                          "group flex justify-between items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                          selectedPlanId === plan.id 
                            ? "bg-indigo-50 text-indigo-700 font-medium" 
                            : "hover:bg-slate-100 text-slate-600"
                        )}
                      >
                        <span className="truncate">{plan.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Main Viewer */}
              <div className="flex-1 bg-slate-200 overflow-auto relative p-4 flex items-center justify-center">
                {!selectedPlan ? (
                  <div className="text-slate-400 flex flex-col items-center gap-2">
                    <ImageIcon className="w-12 h-12 opacity-20" />
                    <span>請選擇或新增平面圖</span>
                  </div>
                ) : (
                  <div className="relative shadow-md bg-white rounded flex items-center justify-center overflow-hidden group">
                    {/* Double Click Area */}
                    <div 
                      ref={imageContainerRef}
                      className="relative cursor-crosshair"
                      onDoubleClick={handleDoubleClickMap}
                    >
                      <img 
                        src={selectedPlan.imageUrl} 
                        alt={selectedPlan.name}
                        className="max-w-full max-h-[85vh] object-contain pointer-events-none"
                      />
                      
                      {/* Render Pins */}
                      {pins.map(pin => (
                        <div 
                          key={pin.id}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group/pin"
                          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                          onClick={(e) => { e.stopPropagation(); setViewingPin(pin); }}
                        >
                          <div className="relative flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-red-500 drop-shadow-md" />
                            {/* Tooltip */}
                            <div className="absolute top-full mt-1 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/pin:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                              {pin.title}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      雙擊圖面新增標記
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* List Mode */
            <div className="flex-1 overflow-auto bg-slate-50 p-6">
              <div className="max-w-4xl mx-auto space-y-8">
                {plans.length === 0 ? (
                  <div className="text-center p-12 text-slate-400">目前沒有建立任何平面圖</div>
                ) : (
                  plans.map(plan => {
                    const planPins = pins.filter(p => p.planId === plan.id);
                    return (
                      <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-indigo-50 border-b border-indigo-100 p-4">
                          <h3 className="font-bold text-indigo-900 text-lg">{plan.name}</h3>
                        </div>
                        <div className="p-0">
                          {planPins.length === 0 ? (
                            <div className="p-4 text-slate-400 text-sm">此區域尚無標記項目</div>
                          ) : (
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                  <th className="px-4 py-3 font-medium">項目名稱</th>
                                  <th className="px-4 py-3 font-medium">說明註記</th>
                                  <th className="px-4 py-3 font-medium w-24">照片</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {planPins.map(pin => (
                                  <tr key={pin.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-800">{pin.title}</td>
                                    <td className="px-4 py-3 text-slate-600 whitespace-pre-wrap">{pin.description || '-'}</td>
                                    <td className="px-4 py-3">
                                      {pin.photoUrl ? (
                                        <a href={pin.photoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">查看</a>
                                      ) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Plan Modal */}
      {showAddPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50" onClick={() => !uploadingPlan && setShowAddPlan(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">新增平面圖</h3>
            <form onSubmit={handleAddPlan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">圖面名稱 (如: A棟2F)</label>
                <input
                  type="text"
                  required
                  value={newPlanName}
                  onChange={e => setNewPlanName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="請輸入圖面名稱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">上傳圖檔</label>
                <input
                  type="file"
                  required
                  accept="image/*"
                  onChange={e => setNewPlanFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddPlan(false)}
                  disabled={uploadingPlan}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={uploadingPlan || !newPlanName || !newPlanFile}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {uploadingPlan ? '上傳中...' : '儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Pin Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50" onClick={() => !isSavingPin && setShowPinModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">新增保固項目</h3>
            <form onSubmit={handleSavePin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">項目名稱 / 地點</label>
                <input
                  type="text"
                  required
                  value={pinTitle}
                  onChange={e => setPinTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="例如: 12(03-05)房間 窗台"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">備註說明</label>
                <textarea
                  value={pinDesc}
                  onChange={e => setPinDesc(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
                  placeholder="例如: 窗台下滲水..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">現場照片 (選填)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setPinFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  disabled={isSavingPin}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || !pinTitle}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingPin ? '儲存中...' : '儲存標記'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Pin Detail */}
      {viewingPin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50" onClick={() => setViewingPin(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-slate-800">{viewingPin.title}</h3>
              <button onClick={() => setViewingPin(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {viewingPin.description && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">說明</div>
                  <div className="text-slate-700 whitespace-pre-wrap">{viewingPin.description}</div>
                </div>
              )}
              {viewingPin.photoUrl && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">照片</div>
                  <a href={viewingPin.photoUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400 transition-colors">
                    <img src={viewingPin.photoUrl} alt={viewingPin.title} className="w-full h-auto object-cover max-h-48" />
                  </a>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
              <button 
                onClick={() => handleDeletePin(viewingPin.id)}
                className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> 刪除標記
              </button>
              <button
                onClick={() => setViewingPin(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
