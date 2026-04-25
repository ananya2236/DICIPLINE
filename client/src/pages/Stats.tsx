import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Loader2 } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Stats = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<any>(null);
  const [dsaData, setDsaData] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Daily Logs for Line Chart
        const dailyQ = query(
          collection(db, 'daily_logs'),
          where('userId', '==', user.uid),
          orderBy('date', 'asc'),
          limit(14)
        );
        const dailySnapshot = await getDocs(dailyQ);
        const labels: string[] = [];
        const scores: number[] = [];
        dailySnapshot.forEach(doc => {
          const data = doc.data();
          labels.push(data.date.split('-').slice(1).join('/'));
          scores.push(data.score);
        });

        setDailyData({
          labels,
          datasets: [{
            label: 'Daily Score %',
            data: scores,
            borderColor: '#FFD700',
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            fill: true,
            tension: 0.4,
          }]
        });

        // DSA problems for Bar Chart
        const dsaQ = query(
          collection(db, 'dsa_problems'),
          where('userId', '==', user.uid)
        );
        const dsaSnapshot = await getDocs(dsaQ);
        const dsaLogs: any[] = dsaSnapshot.docs.map(doc => doc.data());
        
        // Group by date and count
        const groupEntries: { [key: string]: number } = {};
        dsaLogs.forEach(log => {
          const date = log.date.split('-').slice(1).join('/');
          groupEntries[date] = (groupEntries[date] || 0) + 1;
        });

        const dsaLabels = Object.keys(groupEntries).sort().slice(-7);
        const dsaCounts = dsaLabels.map(label => groupEntries[label]);

        setDsaData({
          labels: dsaLabels,
          datasets: [{
            label: 'Problems Solved',
            data: dsaCounts,
            backgroundColor: '#FFD700',
            borderRadius: 4,
          }]
        });

      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#121212',
        titleColor: '#FFD700',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 215, 0, 0.2)',
        borderWidth: 1,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 215, 0, 0.05)' },
        ticks: { color: '#666' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#666' }
      }
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-gold animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight italic">ANALYTICS</h1>
        <p className="text-gray-500">Visualizing your path to mastery.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card space-y-4">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Discipline Consistency (Last 14 Days)</h2>
          <div className="h-64">
            {dailyData && <Line data={dailyData} options={options} />}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">DSA Problems Solved (Last 7 Sessions)</h2>
          <div className="h-64">
            {dsaData && <Bar data={dsaData} options={options} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;
