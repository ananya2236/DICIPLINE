import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { readBackupJSON } from '../backup';
import { Flame, Target, Award, Calendar, ChevronRight, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, subValue, icon: Icon, color }: any) => (
  <div className="card relative overflow-hidden group">
    <div className={clsx("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-150 duration-500", color)}></div>
    <div className="relative z-10">
      <div className="flex justify-between items-start">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</p>
        <Icon className={clsx("w-5 h-5", color.replace('bg-', 'text-'))} />
      </div>
      <h3 className="text-4xl font-black text-white mt-4">{value}</h3>
      <p className="text-sm text-gray-500 mt-1">{subValue}</p>
    </div>
  </div>
);

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const isLoggedDay = (score: number | undefined) => (score ?? 0) >= 80;

const normalizeDailyLogs = (raw: any) => {
  const logs = Array.isArray(raw) ? raw : Object.values(raw || {});
  return logs
    .filter(Boolean)
    .map((log: any) => ({ ...log, score: Number(log.score) || 0 }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    streak: 0,
    weeklyConsistency: 0,
    monthlyConsistency: 0,
    totalProblems: 0,
    missedDays: 0
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const backupDailyKey = `daily_logs_backup:${user.uid}`;
    const backupDsaKey = `dsa_nodes_backup:${user.uid}`;
    const backupLogs = normalizeDailyLogs(readBackupJSON(backupDailyKey, {}));
    const backupDsaNodes = readBackupJSON(backupDsaKey, []);

    const dailyQ = query(collection(db, 'daily_logs'), where('userId', '==', user.uid));
    const dsaQ = query(collection(db, 'dsa_nodes'), where('userId', '==', user.uid), where('type', '==', 'problem'));

    const unsubscribeDaily = onSnapshot(dailyQ, (snapshot) => {
      const firestoreLogs = snapshot.docs.map(doc => doc.data());
      const logs = normalizeDailyLogs([...backupLogs, ...firestoreLogs]);
      const todayKey = toDateKey(new Date());

      const normalizedScores = new Map<string, number>();
      logs.forEach(log => normalizedScores.set(log.date, Number(log.score) || 0));

      let currentStreak = 0;
      const latestKey = logs.length > 0 ? logs[logs.length - 1].date : null;
      const latestDate = latestKey ? new Date(`${latestKey}T00:00:00`) : null;
      const todayDate = new Date(`${todayKey}T00:00:00`);

      let cursor = latestDate;
      if (cursor) {
        const diffDays = Math.floor((todayDate.getTime() - cursor.getTime()) / 86400000);
        if (diffDays === 0 || diffDays === 1) {
          while (cursor) {
            const key = toDateKey(cursor);
            if (!isLoggedDay(normalizedScores.get(key))) break;
            currentStreak++;
            cursor = addDays(cursor, -1);
          }
        }
      }

      const last7Dates: string[] = [];
      const last30Dates: string[] = [];
      for (let i = 0; i < 7; i++) last7Dates.push(toDateKey(addDays(todayDate, -i)));
      for (let i = 0; i < 30; i++) last30Dates.push(toDateKey(addDays(todayDate, -i)));

      const weeklyAverage = last7Dates.reduce((acc, date) => acc + (normalizedScores.get(date) ?? 0), 0) / 7;
      const monthlyAverage = last30Dates.reduce((acc, date) => acc + (normalizedScores.get(date) ?? 0), 0) / 30;

      setStats(prev => ({
        ...prev,
        streak: currentStreak,
        weeklyConsistency: Math.round(weeklyAverage),
        monthlyConsistency: Math.round(monthlyAverage),
        missedDays: 30 - logs.length
      }));
      setRecentLogs(logs.slice(-5).reverse());
    });

    const unsubscribeDsa = onSnapshot(dsaQ, (snapshot) => {
      const firestoreCount = snapshot.size;
      setStats(prev => ({
        ...prev,
        totalProblems: Math.max(firestoreCount, backupDsaNodes.filter((node: any) => node?.type === 'problem').length)
      }));
    });

    return () => {
      unsubscribeDaily();
      unsubscribeDsa();
    };
  }, [user]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic">COMMAND CENTER</h1>
          <p className="text-gray-500 mt-1">Welcome back, Commander. Here is your execution report.</p>
        </div>
        <div className="flex items-center gap-4 bg-gold/10 border border-gold/20 px-6 py-3 rounded-2xl">
          <div className="text-right">
            <p className="text-[10px] font-black text-gold uppercase tracking-widest">Current Status</p>
            <p className="text-sm font-bold text-white">ACTIVE OPS</p>
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Current Streak" 
          value={`${stats.streak} Days`} 
          subValue="Keep the fire burning" 
          icon={Flame} 
          color="bg-orange-500" 
        />
        <StatCard 
          title="Weekly Consistency" 
          value={`${stats.weeklyConsistency}%`} 
          subValue="Last 7 days average" 
          icon={Target} 
          color="bg-gold" 
        />
        <StatCard 
          title="Monthly consistency" 
          value={`${stats.monthlyConsistency}%`} 
          subValue="Last 30 days average" 
          icon={TrendingUp} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Problems Solved" 
          value={stats.totalProblems} 
          subValue="Total DSA problems" 
          icon={Award} 
          color="bg-purple-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gold" />
              Recent Activity
            </h2>
            <button className="text-xs font-bold text-gold uppercase hover:underline">View All</button>
          </div>
          
          <div className="space-y-4">
            {recentLogs.length === 0 ? (
              <div className="card text-center p-8 text-gray-500">No recent activity. Time to start.</div>
            ) : (
              recentLogs.map((log, i) => (
                <div key={i} className="card py-4 flex items-center justify-between hover:bg-gold/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      "w-2 h-10 rounded-full",
                      log.score >= 80 ? "bg-green-500" : log.score >= 50 ? "bg-gold" : "bg-red-500"
                    )}></div>
                    <div>
                      <p className="text-sm font-bold text-white">{new Date(log.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                      <p className="text-xs text-gray-500">{log.score}% Completion</p>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {Object.entries(log.tasks).map(([task, done]: any) => (
                      done && (
                        <div key={task} className="w-6 h-6 rounded-full bg-black border border-gold/30 flex items-center justify-center text-[8px] font-black text-gold uppercase">
                          {task[0]}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-gold" />
            Quick Actions
          </h2>
          <div className="space-y-4">
            <button 
              onClick={() => navigate('/tracker')}
              className="w-full card p-4 flex items-center justify-between hover:border-gold/50 group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center group-hover:bg-gold transition-colors">
                  <Calendar className="w-5 h-5 text-gold group-hover:text-black" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Log Today</p>
                  <p className="text-[10px] text-gray-500">Update daily discipline</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
            <button 
              onClick={() => navigate('/dsa')}
              className="w-full card p-4 flex items-center justify-between hover:border-gold/50 group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center group-hover:bg-gold transition-colors">
                  <Award className="w-5 h-5 text-gold group-hover:text-black" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Log DSA</p>
                  <p className="text-[10px] text-gray-500">Add practice session</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          
          <div className="card bg-gradient-to-br from-gold/20 to-transparent border-gold/30 p-6">
            <h3 className="text-lg font-black text-gold italic">DISCIPLINE QUOTE</h3>
            <p className="text-gray-300 mt-4 text-sm leading-relaxed italic">
              "We must all suffer from one of two pains: the pain of discipline or the pain of regret. The difference is discipline weighs ounces while regret weighs tons."
            </p>
            <p className="text-gold text-xs font-bold mt-4">— Jim Rohn</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
