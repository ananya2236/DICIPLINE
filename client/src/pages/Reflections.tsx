import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, setDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { MessageSquare, Save, Loader2, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

const Reflections = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [reflection, setReflection] = useState({
    win: '',
    fail: '',
    improve: ''
  });
  const [history, setHistory] = useState<any[]>([]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchReflections = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'daily_logs'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        const logs: any[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          logs.push(data);
          if (data.date === today) {
            setTodayLog(data);
            const ref = data.reflection || '';
            const [win, fail, improve] = ref.split('|||');
            setReflection({
              win: win || '',
              fail: fail || '',
              improve: improve || ''
            });
          }
        });
        setHistory(logs.filter(l => l.reflection));
      } catch (error) {
        console.error("Error fetching reflections:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReflections();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const combinedReflection = `${reflection.win}|||${reflection.fail}|||${reflection.improve}`;
    
    const currentLog = todayLog || {
      date: today,
      tasks: { dsa: false, core: false, project: false, fitness: false, diet: false, sleep: false },
      score: 0,
      satisfaction: 0,
    };

    // Optimistic update - instant UI feedback
    const updatedLog = { ...currentLog, reflection: combinedReflection };
    setTodayLog(updatedLog);
    setSaving(true);

    try {
      await setDoc(doc(db, 'daily_logs', `${user.uid}_${today}`), {
        ...currentLog,
        reflection: combinedReflection,
        userId: user.uid,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      // Rollback on error
      setTodayLog(todayLog);
      console.error("Error saving reflection:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-gold animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight italic">REFLECTIONS</h1>
        <p className="text-gray-500">Analyze your execution and iterate for tomorrow.</p>
      </div>

      <div className="card space-y-6 border-gold/30">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gold" />
            Daily Debrief - {today}
          </h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gold flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Reflection
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-green-500 uppercase tracking-widest">What went well today?</label>
            <textarea
              className="input-field w-full h-24 resize-none"
              placeholder="List your victories..."
              value={reflection.win}
              onChange={e => setReflection({ ...reflection, win: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-red-500 uppercase tracking-widest">What failed today?</label>
            <textarea
              className="input-field w-full h-24 resize-none"
              placeholder="Be honest about your excuses..."
              value={reflection.fail}
              onChange={e => setReflection({ ...reflection, fail: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gold uppercase tracking-widest">What will I improve tomorrow?</label>
            <textarea
              className="input-field w-full h-24 resize-none"
              placeholder="Set the target for the next 24 hours..."
              value={reflection.improve}
              onChange={e => setReflection({ ...reflection, improve: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">Reflection History</h3>
        <div className="grid grid-cols-1 gap-4">
          {history.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No past reflections found.</p>
          ) : (
            history.map((log, i) => {
              const [win, fail, improve] = (log.reflection || '').split('|||');
              return (
                <div key={i} className="card bg-black-soft/50 p-4 border-gold/5">
                  <div className="flex items-center gap-2 text-gold mb-3">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">{log.date}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-green-500 uppercase mb-1">Wins</p>
                      <p className="text-xs text-gray-400 line-clamp-3">{win || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-red-500 uppercase mb-1">Fails</p>
                      <p className="text-xs text-gray-400 line-clamp-3">{fail || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gold uppercase mb-1">Improvement</p>
                      <p className="text-xs text-gray-400 line-clamp-3">{improve || '-'}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Reflections;
