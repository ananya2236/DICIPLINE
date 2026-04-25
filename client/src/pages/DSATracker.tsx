import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, setDoc, Timestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { readBackupJSON, writeBackupJSON } from '../backup';
import { Plus, Trash2, Loader2, X, Star, ChevronLeft, FolderOpen, Code2, Bookmark, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface DSANode {
  id: string;
  userId: string;
  parentId: string | null;
  type: 'container' | 'problem';
  name: string;
  leetcodeNumber?: string;
  topic?: string;
  dateSolved?: string; // YYYY-MM-DD format
  isFavorite: boolean;
  createdAt: Timestamp;
}

// Node Item Component - Memoized to prevent unnecessary re-renders
const NodeItem = React.memo(({ node, children, onDelete, onToggleFav, onNavigate }: any) => (
  <div className="card group hover:border-gold/50 transition-all">
    {node.type === 'container' ? (
      <div className="flex items-center justify-between">
        <button onClick={() => onNavigate(node.id)} className="flex-1 flex items-center gap-4 hover:text-gold transition-colors">
          <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center border border-gold/20 text-gold shrink-0">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="font-bold text-white text-lg">{node.name}</p>
            <p className="text-xs text-gray-500">{children.length} items</p>
          </div>
        </button>
        <button onClick={() => onDelete(node.id)} className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    ) : (
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-900/20 rounded-lg flex items-center justify-center border border-blue-500/30 text-blue-400 shrink-0">
            <Code2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {node.leetcodeNumber && <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-1 rounded">#{node.leetcodeNumber}</span>}
              <p className="font-bold text-white truncate">{node.name}</p>
            </div>
            {node.topic && <p className="text-xs text-gray-400 mt-1">{node.topic}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {node.dateSolved && <p className="text-xs text-gray-500 font-mono">{node.dateSolved}</p>}
          <button onClick={() => onToggleFav(node.id)} className={clsx("p-2 transition-colors", node.isFavorite ? "text-gold" : "text-gray-700 hover:text-gold/50")}>
            <Star className={clsx("w-5 h-5", node.isFavorite && "fill-current")} />
          </button>
          <button onClick={() => onDelete(node.id)} className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    )}
  </div>
));

// Add Form Component - Independent state to prevent parent re-renders on every keystroke
const AddNodeForm = React.memo(({ kind, onSubmit }: any) => {
  const [localFormData, setLocalFormData] = useState({ name: '', leetcodeNumber: '', topic: '', dateSolved: '' });
  
  const handleSubmit = (e: React.FormEvent) => {
    onSubmit(e, localFormData);
    setLocalFormData({ name: '', leetcodeNumber: '', topic: '', dateSolved: '' });
  };
  
  return (
    <div className="card border-gold/30 animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {kind === 'container' ? (
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Container Name</label>
            <input type="text" required placeholder="e.g. Dynamic Programming" className="input-field w-full mt-2" 
              value={localFormData.name} onChange={e => setLocalFormData({ ...localFormData, name: e.target.value })} autoFocus />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Question Name</label>
              <input type="text" required placeholder="e.g. Two Sum" className="input-field w-full mt-2" 
                value={localFormData.name} onChange={e => setLocalFormData({ ...localFormData, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">LeetCode #</label>
              <input type="text" placeholder="e.g. 1" className="input-field w-full mt-2" 
                value={localFormData.leetcodeNumber} onChange={e => setLocalFormData({ ...localFormData, leetcodeNumber: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Approach / Topic</label>
              <input type="text" placeholder="e.g. Two pointers" className="input-field w-full mt-2" 
                value={localFormData.topic} onChange={e => setLocalFormData({ ...localFormData, topic: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Date Solved</label>
              <input type="date" className="input-field w-full mt-2" 
                value={localFormData.dateSolved} onChange={e => setLocalFormData({ ...localFormData, dateSolved: e.target.value })} />
            </div>
          </div>
        )}
        <button type="submit" className="btn-gold w-full flex items-center justify-center gap-2">
          Add {kind === 'container' ? 'Container' : 'Question'}
        </button>
      </form>
    </div>
  );
});

const DSATracker = () => {
  const { user } = useAuth();
  const [allNodes, setAllNodes] = useState<DSANode[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const backupKey = user ? `dsa_nodes_backup:${user.uid}` : null;

  useEffect(() => {
    if (!user) return;

    setAllNodes(readBackupJSON(backupKey!, []));

    (async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'dsa_nodes'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const remoteNodes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DSANode));
        setAllNodes(prev => {
          const merged = remoteNodes.length > 0 ? remoteNodes : prev;
          return merged;
        });
      } catch (error: any) {
        alert(`Failed to fetch: ${error.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [backupKey, user]);

  useEffect(() => {
    if (!backupKey) return;
    if (loading && allNodes.length === 0) return;
    writeBackupJSON(backupKey, allNodes);
  }, [allNodes, backupKey, loading]);

  const currentId = currentPath[currentPath.length - 1] ?? null;
  
  // Memoize index creation - only recalculate when allNodes changes
  const { nodeIndex, childrenIndex, sortedChildren, favorites, containerName } = useMemo(() => {
    const nodeIdx: { [key: string]: DSANode } = {};
    const childrenIdx: { [key: string]: DSANode[] } = {};
    
    allNodes.forEach(node => {
      nodeIdx[node.id] = node;
      const pid = node.parentId || 'root';
      if (!childrenIdx[pid]) childrenIdx[pid] = [];
      childrenIdx[pid].push(node);
    });
    
    // Sort all children once
    Object.keys(childrenIdx).forEach(pid => {
      childrenIdx[pid].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'container' ? -1 : 1));
    });
    
    const children = childrenIdx[currentId || 'root'] || [];
    const favs = allNodes
      .filter(n => n.type === 'problem' && n.isFavorite)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    const name = currentPath.length === 0 ? 'DSA TRACKER' : nodeIdx[currentId]?.name || 'Unknown';
    
    return { nodeIndex: nodeIdx, childrenIndex: childrenIdx, sortedChildren: children, favorites: favs, containerName: name };
  }, [allNodes, currentId, currentPath.length]);

  const handleAddNode = async (e: React.FormEvent, formData: { name: string; leetcodeNumber: string; topic: string; dateSolved: string }) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;
    const kind: 'container' | 'problem' = currentId ? 'problem' : 'container';
    
    const tempId = crypto.randomUUID?.() ?? `temp_${Date.now()}`;
    const newNode = { 
      id: tempId, 
      userId: user.uid, 
      parentId: currentId, 
      type: kind, 
      name: formData.name.trim(), 
      isFavorite: false, 
      createdAt: Timestamp.now(),
      ...(kind === 'problem' && { 
        leetcodeNumber: formData.leetcodeNumber.trim(), 
        topic: formData.topic.trim(),
        dateSolved: formData.dateSolved
      })
    } as DSANode;

    // INSTANT optimistic update - close form immediately
    setAllNodes(prev => [...prev, newNode]);
    setShowAddForm(false);

    // Firebase sync happens silently in background - DON'T block UI
    // Use the optimistic id as the real document id so child problems keep the right parentId.
    setDoc(doc(db, 'dsa_nodes', tempId), {
      userId: user.uid,
      parentId: currentId,
      type: kind,
      name: newNode.name,
      isFavorite: false,
      createdAt: Timestamp.now(),
      ...(kind === 'problem' && { 
        leetcodeNumber: formData.leetcodeNumber.trim(), 
        topic: formData.topic.trim(),
        dateSolved: formData.dateSolved
      })
    }).catch(error => {
      // Rollback on error
      setAllNodes(prev => prev.filter(n => n.id !== tempId));
      console.error('Failed to add:', error.message);
    });
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!window.confirm('Delete? Containers delete all children.')) return;
    
    // Find nodes to delete
    const toDelete = [nodeId];
    const getDesc = (pid: string): string[] => {
      const children = allNodes.filter(n => n.parentId === pid).map(n => n.id);
      return [...children, ...children.flatMap(getDesc)];
    };
    if (allNodes.find(n => n.id === nodeId)?.type === 'container') toDelete.push(...getDesc(nodeId));
    
    // Backup for rollback
    const backup = allNodes;
    
    // INSTANT optimistic delete
    setAllNodes(prev => prev.filter(n => !toDelete.includes(n.id)));
    // Firebase delete happens silently in background
    const batch = writeBatch(db);
    toDelete.forEach(id => batch.delete(doc(db, 'dsa_nodes', id)));

    batch.commit()
      .catch(error => {
        // Rollback on error
        setAllNodes(backup);
        console.error('Failed to delete:', error.message);
      });
  };

  const toggleFav = async (nodeId: string) => {
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const backup = allNodes;
    
    // INSTANT optimistic toggle
    setAllNodes(prev => prev.map(n => n.id === nodeId ? { ...n, isFavorite: !n.isFavorite } : n));
    
    // Firebase update happens in background
    updateDoc(doc(db, 'dsa_nodes', nodeId), { isFavorite: !node.isFavorite })
      .catch(error => {
        // Rollback on error
        setAllNodes(backup);
        console.error('Failed to toggle favorite:', error.message);
      });
  };

  if (loading && allNodes.length === 0) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight italic">{containerName}</h1>
          <p className="text-gray-500">
            {currentPath.length === 0
              ? "Organize your DSA practice with containers"
              : `${sortedChildren.length} questions`}
          </p>
        </div>
        <div className="flex gap-2">
          {currentPath.length > 0 && <button onClick={() => setCurrentPath([])} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Root</button>}
          <button onClick={() => { setLoading(true); (async () => { try { const q = query(collection(db, 'dsa_nodes'), where('userId', '==', user!.uid)); const s = await getDocs(q); setAllNodes(s.docs.map(d => ({ id: d.id, ...d.data() } as DSANode))); } finally { setLoading(false); } })(); }} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gold flex items-center gap-1"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-gold flex items-center gap-2">{showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{currentId ? 'Add Question' : 'Add Container'}</button>
        </div>
      </div>

      {showAddForm && <AddNodeForm kind={currentId ? 'problem' : 'container'} onSubmit={handleAddNode} />}

      {currentPath.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => setCurrentPath([])} className="hover:text-gold">Root</button>
          {currentPath.map((id, idx) => <React.Fragment key={id}><span>/</span><button onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))} className="hover:text-gold">{nodeIndex[id]?.name}</button></React.Fragment>)}
        </div>
      )}

      <div className="space-y-3">
        {sortedChildren.length === 0 ? <div className="card text-center p-12 text-gray-500">No items yet.</div> : sortedChildren.map(node => <NodeItem key={node.id} node={node} children={childrenIndex[node.id] || []} onDelete={handleDeleteNode} onToggleFav={toggleFav} onNavigate={(id: string) => setCurrentPath(prev => [...prev, id])} />)}
      </div>

      {currentPath.length === 0 && favorites.length > 0 && (
        <div className="space-y-4 border-t border-gray-800 pt-8">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-gold" />
            <h2 className="text-xl font-black text-white">FAVORITES</h2>
            <span className="text-xs text-gray-500 font-bold">{favorites.length}</span>
          </div>
          <div className="space-y-3">
            {favorites.map(p => <NodeItem key={p.id} node={p} children={[]} onDelete={handleDeleteNode} onToggleFav={toggleFav} onNavigate={() => {}} />)}
          </div>
        </div>
      )}
    </div>
  );
};

export default DSATracker;
