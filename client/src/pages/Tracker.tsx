import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, setDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { readBackupJSON, writeBackupJSON } from '../backup';
import {
  Check, Star, Loader2,
  Dumbbell, Coffee, Utensils, Moon, TimerOff, Egg,
  Home, Footprints, Droplets, Apple, PersonStanding,
  MoonStar, Code, Laptop, BookOpen, Crown, Flame, Target
} from 'lucide-react';
import { clsx } from 'clsx';

interface TaskState {
  gym: boolean;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  noFoodAfter7: boolean;
  eggs: boolean;
  noOutsideFood: boolean;
  steps: boolean;
  water: boolean;
  fruitVeggies: boolean;
  walk: boolean;
  sleep: boolean;
  dsa: boolean;
  projects: boolean;
  coreStudy: boolean;
}

interface DailyLog {
  date: string; // YYYY-MM-DD
  tasks: TaskState;
  score: number;
  satisfaction: number;
  reflection: string;
}

const TRACKER_START_DATE = new Date(2026, 3, 24); // 24 Apr 2026
const TRACKER_END_DATE = new Date(2026, 11, 31); // 31 Dec 2026

const TASKS: { id: keyof TaskState; label: string; icon: any; sub: string }[] = [
  { id: 'gym', label: 'GYM', icon: Dumbbell, sub: '5 AM' },
  { id: 'breakfast', label: 'BRKFAST', icon: Coffee, sub: '' },
  { id: 'lunch', label: 'LUNCH', icon: Utensils, sub: '' },
  { id: 'dinner', label: 'DINNER', icon: Moon, sub: '<= 7 PM' },
  { id: 'noFoodAfter7', label: 'NO FOOD', icon: TimerOff, sub: '> 7 PM' },
  { id: 'eggs', label: '2 EGGS', icon: Egg, sub: 'DAILY' },
  { id: 'noOutsideFood', label: 'NO OUT', icon: Home, sub: 'FOOD' },
  { id: 'steps', label: '10K', icon: Footprints, sub: 'STEPS' },
  { id: 'water', label: 'WATER', icon: Droplets, sub: '(3L)' },
  { id: 'fruitVeggies', label: 'FRUIT/', icon: Apple, sub: 'VEGGIES' },
  { id: 'walk', label: 'WALK', icon: PersonStanding, sub: '10-15M' },
  { id: 'sleep', label: 'SLEEP', icon: MoonStar, sub: 'B-11' },
  { id: 'dsa', label: 'DSA', icon: Code, sub: '2-3H' },
  { id: 'projects', label: 'PROJECTS', icon: Laptop, sub: '' },
  { id: 'coreStudy', label: 'CORE', icon: BookOpen, sub: 'STUDY' },
];

const emptyTaskState = (): TaskState =>
  TASKS.reduce((acc, t) => ({ ...acc, [t.id]: false }), {} as TaskState);

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

const Tracker = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<{ [key: string]: DailyLog }>({});
  const [loading, setLoading] = useState(true);
  const backupKey = user ? `daily_logs_backup:${user.uid}` : null;

  useEffect(() => {
    if (!user) return;
    setLogs(readBackupJSON(backupKey!, {}));
  }, [backupKey, user]);

  useEffect(() => {
    if (!backupKey) return;
    if (loading && Object.keys(logs).length === 0) return;
    writeBackupJSON(backupKey, logs);
  }, [backupKey, loading, logs]);

  const scheduleMonths = useMemo(() => {
    const months: { key: string; label: string; days: string[] }[] = [];
    let cursor = startOfMonth(TRACKER_START_DATE);

    while (cursor <= TRACKER_END_DATE) {
      const monthStart = cursor < TRACKER_START_DATE ? TRACKER_START_DATE : new Date(cursor);
      const monthEnd = endOfMonth(cursor) > TRACKER_END_DATE ? TRACKER_END_DATE : endOfMonth(cursor);
      const days: string[] = [];

      let dayCursor = new Date(monthStart);
      while (dayCursor <= monthEnd) {
        days.push(toDateKey(dayCursor));
        dayCursor = addDays(dayCursor, 1);
      }

      months.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        label: cursor.toLocaleString('default', { month: 'long', year: 'numeric' }),
        days,
      });

      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return months;
  }, []);

  const dateRange = useMemo(() => ({
    start: toDateKey(TRACKER_START_DATE),
    end: toDateKey(TRACKER_END_DATE),
  }), []);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const q = query(
          collection(db, 'daily_logs'),
          where('userId', '==', user.uid),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end)
        );

        const querySnapshot = await getDocs(q);
        const fetchedLogs: { [key: string]: DailyLog } = {};

        querySnapshot.forEach((snapshotDoc) => {
          const data = snapshotDoc.data();
          fetchedLogs[data.date] = data as DailyLog;
        });

        setLogs(prev => ({ ...prev, ...fetchedLogs }));
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, dateRange.end, dateRange.start]);

  const buildCurrentLog = (date: string) => ({
    date,
    tasks: emptyTaskState(),
    score: 0,
    satisfaction: 0,
    reflection: '',
  });

  const toggleTask = async (date: string, taskId: keyof TaskState) => {
    const currentLog = logs[date] || buildCurrentLog(date);
    const newTasks = { ...currentLog.tasks, [taskId]: !currentLog.tasks[taskId] };
    const completedCount = Object.values(newTasks).filter(Boolean).length;
    const newScore = Math.round((completedCount / TASKS.length) * 100);
    const updatedLog = { ...currentLog, tasks: newTasks, score: newScore };

    const backup = logs;
    setLogs(prev => ({ ...prev, [date]: updatedLog }));

    try {
      await setDoc(doc(db, 'daily_logs', `${user?.uid}_${date}`), {
        ...updatedLog,
        userId: user?.uid,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      setLogs(backup);
      console.error('Error saving log:', error);
    }
  };

  const setSatisfaction = async (date: string, rating: number) => {
    const currentLog = logs[date] || buildCurrentLog(date);
    const updatedLog = { ...currentLog, satisfaction: rating };
    const backup = logs;

    setLogs(prev => ({ ...prev, [date]: updatedLog }));

    try {
      await setDoc(doc(db, 'daily_logs', `${user?.uid}_${date}`), {
        ...updatedLog,
        userId: user?.uid,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      setLogs(backup);
      console.error('Error saving satisfaction:', error);
    }
  };

  const todayKey = toDateKey(new Date());
  const todayLog = logs[todayKey];
  const totalDays = scheduleMonths.reduce((count, month) => count + month.days.length, 0);

  if (loading && Object.keys(logs).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-black min-h-screen p-4 md:p-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center items-center gap-2">
          <div className="h-px bg-gold/30 flex-1"></div>
          <p className="text-xs font-black text-gold uppercase tracking-[0.3em]">
            No excuses. Only results.
          </p>
          <div className="h-px bg-gold/30 flex-1"></div>
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic">
          DAILY SCHEDULE
        </h1>
        <h2 className="text-4xl md:text-6xl font-black text-gold tracking-tighter italic">
          APR 24, 2026 ONWARD
        </h2>

        <div className="flex justify-center items-center gap-4 text-gray-500 font-bold uppercase tracking-widest text-sm">
          <span>{dateRange.start} to {dateRange.end}</span>
          <span>|</span>
          <span>{totalDays} days</span>
        </div>
      </div>

      <div className="space-y-8">
        {scheduleMonths.map((monthBlock) => (
          <section key={monthBlock.key} className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-white italic tracking-tight">
                  {monthBlock.label}
                </h3>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.25em]">
                  {monthBlock.days.length} scheduled days
                </p>
              </div>
              <div className="text-right text-[10px] uppercase tracking-[0.25em] text-gray-500">
                <p>Daily habit grid</p>
                <p>15 tasks + satisfaction</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gold/20 bg-black shadow-2xl">
              <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
                <thead>
                  <tr className="bg-gold/5 border-b border-gold/20">
                    <th className="p-4 w-24 text-[10px] font-black text-gold uppercase text-center border-r border-gold/20">Day</th>
                    {TASKS.map((task) => (
                      <th key={task.id} className="p-2 border-r border-gold/10 text-center group">
                        <div className="flex flex-col items-center gap-1">
                          <task.icon className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
                          <span className="text-[8px] font-black text-white">{task.label}</span>
                          <span className="text-[7px] text-gray-500">{task.sub}</span>
                        </div>
                      </th>
                    ))}
                    <th className="p-4 w-24 text-[10px] font-black text-gold uppercase text-center">Sat.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold/10">
                  {monthBlock.days.map((date) => {
                    const log = logs[date];
                    const isToday = date === todayKey;
                    const dayNum = date.split('-')[2];

                    return (
                      <tr
                        key={date}
                        className={clsx(
                          'hover:bg-gold/5 transition-colors',
                          isToday && 'bg-gold/10'
                        )}
                      >
                        <td className="p-2 text-center border-r border-gold/20 font-black text-sm">
                          {dayNum}
                        </td>

                        {TASKS.map((task) => (
                          <td key={task.id} className="p-2 border-r border-gold/10 text-center">
                            <button
                              onClick={() => toggleTask(date, task.id)}
                              className={clsx(
                                'w-6 h-6 mx-auto rounded border flex items-center justify-center transition-all',
                                log?.tasks[task.id]
                                  ? 'bg-gold border-gold text-black shadow-[0_0_10px_rgba(255,215,0,0.3)]'
                                  : 'border-gold/30 text-transparent hover:border-gold/60'
                              )}
                            >
                              <Check className="w-4 h-4 stroke-[4]" />
                            </button>
                          </td>
                        ))}

                        <td className="p-2 text-center">
                          <button
                            onClick={() => setSatisfaction(date, log?.satisfaction === 5 ? 0 : 5)}
                            className={clsx(
                              'transition-all hover:scale-125',
                              log?.satisfaction === 5 ? 'text-gold' : 'text-gray-800'
                            )}
                          >
                            <Star className={clsx('w-5 h-5', log?.satisfaction === 5 && 'fill-current')} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-gold/20">
        <div className="space-y-4">
          <h3 className="text-xs font-black text-gold uppercase tracking-widest">How to use</h3>
          <ul className="text-[10px] text-gray-400 space-y-2 font-medium">
            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-gold rounded-full"></div> Tick when you complete the habit.</li>
            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-gold rounded-full"></div> Be honest with yourself.</li>
            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-gold rounded-full"></div> Aim for progress, not perfection.</li>
            <li className="flex items-center gap-2"><div className="w-1 h-1 bg-gold rounded-full"></div> Don't break the chain!</li>
          </ul>
        </div>

        <div className="text-center space-y-4">
          <div className="inline-block p-4 border border-gold/30 rounded-2xl bg-gold/5">
            <p className="text-sm font-black text-white italic">
              "DISCIPLINE IS DOING WHAT NEEDS TO BE DONE, EVEN WHEN YOU DON'T FEEL LIKE DOING IT."
            </p>
          </div>
          <div className="flex justify-center gap-8 text-[10px] font-black text-gold uppercase">
            <div className="flex flex-col items-center gap-1"><Target className="w-4 h-4" /> FOCUS</div>
            <div className="flex flex-col items-center gap-1"><Dumbbell className="w-4 h-4" /> DISCIPLINE</div>
            <div className="flex flex-col items-center gap-1"><Flame className="w-4 h-4" /> SUCCESS</div>
          </div>
        </div>

        <div className="space-y-4 bg-gold/5 p-6 rounded-2xl border border-gold/20">
          <h3 className="text-xs font-black text-gold uppercase tracking-widest flex items-center gap-2">
            <Crown className="w-4 h-4" /> Progress Tracker
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Today's Score</span>
              <span className="text-lg font-black text-white">
                {todayLog?.tasks
                  ? Object.values(todayLog.tasks).filter(Boolean).length
                  : 0} / 15
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold shadow-[0_0_10px_rgba(255,215,0,0.5)] transition-all duration-1000"
                style={{ width: `${todayLog?.score || 0}%` }}
              ></div>
            </div>
            <p className="text-[8px] text-gray-500 italic text-center">
              "THE PAIN YOU FEEL TODAY WILL BE THE STRENGTH YOU FEEL TOMORROW."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tracker;
