import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, setDoc, Timestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { readBackupJSON, writeBackupJSON } from '../backup';
import { Plus, Trash2, Loader2, X, Star, ChevronLeft, FolderOpen, Code2, Bookmark } from 'lucide-react';
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

const hydrateCreatedAt = (value: any) => {
  if (value instanceof Timestamp) return value;
  if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  return Timestamp.now();
};

const normalizeNode = (node: any): DSANode => ({
  ...node,
  parentId: node.parentId ?? null,
  isFavorite: Boolean(node.isFavorite),
  createdAt: hydrateCreatedAt(node.createdAt),
});

const mergeNodesById = (primary: DSANode[], fallback: DSANode[]) => {
  const merged = new Map<string, DSANode>();

  fallback.forEach(node => merged.set(node.id, normalizeNode(node)));
  primary.forEach(node => merged.set(node.id, normalizeNode(node)));

  return Array.from(merged.values());
};

const DSA_IMPORTS = [
  { id: 'seed-2026-04-25-1290', dateSolved: '2026-04-25', leetcodeNumber: '1290', name: 'Convert Binary Number in LL', topic: 'Traversal' },
  { id: 'seed-2026-04-25-876', dateSolved: '2026-04-25', leetcodeNumber: '876', name: 'Middle of Linked List', topic: 'Slow-fast pointer' },
  { id: 'seed-2026-04-25-83', dateSolved: '2026-04-25', leetcodeNumber: '83', name: 'Remove Duplicates (sorted)', topic: 'Traversal' },
  { id: 'seed-2026-04-25-203', dateSolved: '2026-04-25', leetcodeNumber: '203', name: 'Remove Elements', topic: 'Traversal' },
  { id: 'seed-2026-04-25-237', dateSolved: '2026-04-25', leetcodeNumber: '237', name: 'Delete Node in LL', topic: 'Node given' },
  { id: 'seed-2026-04-26-206', dateSolved: '2026-04-26', leetcodeNumber: '206', name: 'Reverse Linked List', topic: '3 pointer' },
  { id: 'seed-2026-04-26-141', dateSolved: '2026-04-26', leetcodeNumber: '141', name: 'Linked List Cycle', topic: 'Slow-fast pointer' },
  { id: 'seed-2026-04-26-160', dateSolved: '2026-04-26', leetcodeNumber: '160', name: 'Intersection of Two LL', topic: '2 pointer' },
  { id: 'seed-2026-04-26-19', dateSolved: '2026-04-26', leetcodeNumber: '19', name: 'Remove Nth Node from End', topic: 'Slow fast pointer' },
  { id: 'seed-2026-04-26-21', dateSolved: '2026-04-26', leetcodeNumber: '21', name: 'Merge Two Sorted Lists', topic: 'Dummy node pattern' },
  { id: 'seed-2026-04-26-82', dateSolved: '2026-04-26', leetcodeNumber: '82', name: 'Remove Duplicates II', topic: 'Dummy node pattern' },
  { id: 'seed-2026-04-26-86', dateSolved: '2026-04-26', leetcodeNumber: '86', name: 'Partition List', topic: 'Dummy node pattern' },
] as const;

const LINKED_LIST_CONTAINER_ID = 'seed-container-linked-list';
const LINKED_LIST_CONTAINER_NAME = 'Linked List';
const SEED_ORDER_MAP: Map<string, number> = new Map(DSA_IMPORTS.map((seed, idx) => [seed.id, idx] as const));

const seedMatchKey = (node: Pick<DSANode, 'dateSolved' | 'leetcodeNumber' | 'name'>) =>
  `${node.dateSolved}|${(node.leetcodeNumber ?? '').trim()}|${node.name.trim().toLowerCase()}`;

const seededProblemLabel = (seed: typeof DSA_IMPORTS[number]) => `LC ${seed.leetcodeNumber} - ${seed.name}`;

const formatDisplayDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) return dateKey;
  return `${day}/${month}/${year}`;
};

const createLinkedListContainer = (userId: string): DSANode => normalizeNode({
  id: LINKED_LIST_CONTAINER_ID,
  userId,
  parentId: null,
  type: 'container',
  name: LINKED_LIST_CONTAINER_NAME,
  isFavorite: false,
  createdAt: Timestamp.now(),
});

const createSeedProblem = (userId: string, seed: typeof DSA_IMPORTS[number], parentId: string) => normalizeNode({
  id: seed.id,
  userId,
  parentId,
  type: 'problem',
  name: seededProblemLabel(seed),
  leetcodeNumber: seed.leetcodeNumber,
  topic: seed.topic,
  dateSolved: seed.dateSolved,
  isFavorite: false,
  createdAt: Timestamp.now(),
});

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

    const backupNodes = readBackupJSON(backupKey!, []).map(normalizeNode);
    const seedContainer = createLinkedListContainer(user.uid);
    const seedNodes = DSA_IMPORTS.map(seed => createSeedProblem(user.uid, seed, LINKED_LIST_CONTAINER_ID));
    setAllNodes(mergeNodesById([seedContainer, ...seedNodes], backupNodes));

    (async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'dsa_nodes'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const remoteNodes = snapshot.docs.map(doc => normalizeNode({ id: doc.id, ...doc.data() }));
        const seedIdSet: Set<string> = new Set(DSA_IMPORTS.map(seed => seed.id));
        const remoteNodesAdjusted = remoteNodes.map(node => seedIdSet.has(node.id) ? { ...node, parentId: LINKED_LIST_CONTAINER_ID } : node);
        const backupNodesAdjusted = backupNodes.map(node => seedIdSet.has(node.id) ? { ...node, parentId: LINKED_LIST_CONTAINER_ID } : node);
        const allCurrentNodes = mergeNodesById([seedContainer, ...seedNodes], [...backupNodesAdjusted, ...remoteNodesAdjusted]);
        const remoteIds = new Set(remoteNodes.map(node => node.id));
        const missingBackupNodes = backupNodes.filter(node => !remoteIds.has(node.id));

        if (missingBackupNodes.length > 0) {
          await Promise.all(
            missingBackupNodes.map(node =>
              setDoc(doc(db, 'dsa_nodes', node.id), {
                userId: node.userId,
                parentId: seedIdSet.has(node.id) ? LINKED_LIST_CONTAINER_ID : node.parentId,
                type: node.type,
                name: node.name,
                leetcodeNumber: node.leetcodeNumber ?? '',
                topic: node.topic ?? '',
                dateSolved: node.dateSolved ?? '',
                isFavorite: node.isFavorite,
                createdAt: node.createdAt,
              })
            )
          );
        }

        const remoteContainer = remoteNodes.find(node => node.id === LINKED_LIST_CONTAINER_ID);
        if (!remoteContainer) {
          await setDoc(doc(db, 'dsa_nodes', LINKED_LIST_CONTAINER_ID), {
            userId: user.uid,
            parentId: null,
            type: 'container',
            name: LINKED_LIST_CONTAINER_NAME,
            isFavorite: false,
            createdAt: seedContainer.createdAt,
          });
        }

        const existingKeys = new Set([...remoteNodesAdjusted, ...backupNodesAdjusted].map(seedMatchKey));
        const missingSeedDefs = DSA_IMPORTS.filter(seed => !existingKeys.has(seedMatchKey(seed)));
        const rootSeedNodes = remoteNodes.filter(node =>
          node.type === 'problem' &&
          DSA_IMPORTS.some(seed => seedMatchKey(seed) === seedMatchKey(node)) &&
          node.parentId !== LINKED_LIST_CONTAINER_ID
        );

        if (rootSeedNodes.length > 0) {
          await Promise.all(
            rootSeedNodes.map(node =>
              setDoc(doc(db, 'dsa_nodes', node.id), {
                userId: node.userId,
                parentId: LINKED_LIST_CONTAINER_ID,
                type: node.type,
                name: node.name,
                leetcodeNumber: node.leetcodeNumber ?? '',
                topic: node.topic ?? '',
                dateSolved: node.dateSolved ?? '',
                isFavorite: node.isFavorite,
                createdAt: node.createdAt,
              })
            )
          );
        }

        if (missingSeedDefs.length > 0) {
          const seededNodes = missingSeedDefs.map(seed => createSeedProblem(user.uid, seed, LINKED_LIST_CONTAINER_ID));

          await Promise.all(
            seededNodes.map(node =>
              setDoc(doc(db, 'dsa_nodes', node.id), {
                userId: node.userId,
                parentId: LINKED_LIST_CONTAINER_ID,
                type: node.type,
                name: node.name,
                leetcodeNumber: node.leetcodeNumber ?? '',
                topic: node.topic ?? '',
                dateSolved: node.dateSolved ?? '',
                isFavorite: node.isFavorite,
                createdAt: node.createdAt,
              })
            )
          );

          setAllNodes(prev => mergeNodesById([...allCurrentNodes, ...seededNodes], prev));
        } else {
          setAllNodes(prev => mergeNodesById(allCurrentNodes, prev));
        }
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
  const { nodeIndex, childrenIndex, sortedChildren, groupedDateSections, favorites, containerName } = useMemo(() => {
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
    const groupedSections = children.length > 0 && children.every(n => n.type === 'problem')
      ? Array.from(
          children.reduce((acc, node) => {
            if (!node.dateSolved) return acc;
            const list = acc.get(node.dateSolved) ?? [];
            list.push(node);
            acc.set(node.dateSolved, list);
            return acc;
          }, new Map<string, DSANode[]>())
        )
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, items]) => ({
            date,
            label: formatDisplayDate(date),
            items: items.sort((a, b) => {
              const orderA = SEED_ORDER_MAP.get(a.id) ?? Number.MAX_SAFE_INTEGER;
              const orderB = SEED_ORDER_MAP.get(b.id) ?? Number.MAX_SAFE_INTEGER;
              return orderA - orderB || a.name.localeCompare(b.name);
            }),
          }))
      : [];
    const favs = allNodes
      .filter(n => n.type === 'problem' && n.isFavorite)
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    const name = currentPath.length === 0 ? 'DSA TRACKER' : nodeIdx[currentId]?.name || 'Unknown';
    
    return { nodeIndex: nodeIdx, childrenIndex: childrenIdx, sortedChildren: children, groupedDateSections: groupedSections, favorites: favs, containerName: name };
  }, [allNodes, currentId, currentPath.length]);

  const handleAddNode = async (e: React.FormEvent, formData: { name: string; leetcodeNumber: string; topic: string; dateSolved: string }) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;
    const kind: 'container' | 'problem' = currentId ? 'problem' : 'container';
    
    const tempId = crypto.randomUUID?.() ?? `temp_${Date.now()}`;
    const createdAt = Timestamp.now();
    const newNode = { 
      id: tempId, 
      userId: user.uid, 
      parentId: currentId, 
      type: kind, 
      name: formData.name.trim(), 
      isFavorite: false, 
      createdAt,
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
      createdAt,
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

      <div className="space-y-4">
        {groupedDateSections.length > 0 ? (
          groupedDateSections.map(section => (
            <div key={section.date} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-gold">{section.label}</span>
                <div className="h-px flex-1 bg-gray-800"></div>
              </div>
              <div className="space-y-3">
                {section.items.map(node => (
                  <NodeItem
                    key={node.id}
                    node={node}
                    children={[]}
                    onDelete={handleDeleteNode}
                    onToggleFav={toggleFav}
                    onNavigate={(id: string) => setCurrentPath(prev => [...prev, id])}
                  />
                ))}
              </div>
            </div>
          ))
        ) : sortedChildren.length === 0 ? (
          <div className="card text-center p-12 text-gray-500">No items yet.</div>
        ) : (
          sortedChildren.map(node => (
            <NodeItem
              key={node.id}
              node={node}
              children={childrenIndex[node.id] || []}
              onDelete={handleDeleteNode}
              onToggleFav={toggleFav}
              onNavigate={(id: string) => setCurrentPath(prev => [...prev, id])}
            />
          ))
        )}
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
