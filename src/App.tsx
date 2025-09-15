import { useEffect, useState, useRef } from 'react'
import './App.css'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

interface PublicIpInfo {
  ip: string;
  country: string;
  region: string;
  city: string;
  isp: string;
  latitude: number;
  longitude: number;
  organization: string;
  timezone: string;
}

interface SystemMetrics {
  cpuLoad: string;
  memoryUsed: string;
  uptime: number;
}

interface NetworkMetrics {
  downloadSpeed: string;
  uploadSpeed: string;
  totalDownload: string;
  totalUpload: string;
  latency: string;
}

interface Metrics {
  timestamp: string;
  publicIpInfo: PublicIpInfo;
  systemMetrics: SystemMetrics;
  networkMetrics: NetworkMetrics;
}

interface SwapLog {
  isp: string;
  ip: string;
  timestamp: string;
  uplink: number;
}

interface ActiveISP {
  isp: string;
  ip: string;
  timestamp: string;
  is_active: number;
}

interface NetworkUsage7d {
  totalDownload7d: string;
  totalUpload7d: string;
}

interface IspDowntime7d {
  downtimeCount: number;
}

interface GatewayStatus {
  status: 'up' | 'down';
}

interface InternetUptime7d {
  upCount: number;
  totalCount: number;
}

// Helper function to format date (server sends in format: 'yyyy-MM-dd HH:mm:ss')
const formatThaiTime = (dateString: string) => {
  const [datePart, timePart] = dateString.split(' ');
  const [year, month, day] = datePart.split('-');
  const [hours, minutes, seconds] = timePart.split(':');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

// Helper function to update history arrays
const updateHistory = <T extends { time: string; value: number }>(prevHistory: T[], newValue: number, newTime: string, maxLength = 30): T[] => {
  const newHistory = [...prevHistory, { time: newTime, value: newValue } as T];
  return newHistory.length > maxLength ? newHistory.slice(newHistory.length - maxLength) : newHistory;
};

// Helper function to update the favicon
const updateFavicon = (status: 'ok' | 'warning' | 'error' | 'disconnected') => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  let color = '#9ca3af'; // Gray for disconnected
  switch (status) {
    case 'ok':
      color = '#10b981'; // Green for OK
      break;
    case 'warning':
      color = '#f59e0b'; // Yellow for warning
      break;
    case 'error':
      color = '#ef4444'; // Red for error
      break;
  }

  ctx.clearRect(0, 0, 32, 32);
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'shortcut icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = canvas.toDataURL('image/png');
};


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.color = '#f0f0f0';
ChartJS.defaults.plugins.legend.labels.color = '#f0f0f0';
ChartJS.defaults.plugins.title.color = '#f0f0f0';
ChartJS.defaults.plugins.tooltip.titleColor = '#f0f0f0';
ChartJS.defaults.plugins.tooltip.bodyColor = '#f0f0f0';

function App() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [swapLogs, setSwapLogs] = useState<SwapLog[]>([]);
  const [activeIsps, setActiveIsps] = useState<ActiveISP[]>([]);
  const [networkUsage7d, setNetworkUsage7d] = useState<NetworkUsage7d | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<{ time: string; value: number }[]>([]);
  const [ispDowntime7d, setIspDowntime7d] = useState<IspDowntime7d | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<'up' | 'down' | 'loading'>('loading');
  const [internetUptime7d, setInternetUptime7d] = useState<InternetUptime7d | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cpuHistory, setCpuHistory] = useState<{ time: string; value: number }[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<{ time: string; value: number }[]>([]);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const WS_URL = import.meta.env.VITE_WS_URL;

  // Function to fetch swap logs
  const fetchSwapLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/swap-logs`);
      const data = await response.json();
      setSwapLogs(data);
    } catch (error) {
      console.error('Error fetching swap logs:', error);
    }
  };

  // Function to fetch active ISPs
  const fetchActiveIsps = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/active-isps`);
      const data = await response.json();
      setActiveIsps(data);
    } catch (error) {
      console.error('Error fetching active ISPs:', error);
    }
  };

  // Function to fetch 7-day network usage
  const fetchNetworkUsage7d = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/network-usage-7d`);
      const data = await response.json();
      setNetworkUsage7d(data);
    } catch (error) {
      console.error('Error fetching 7-day network usage:', error);
    }
  };

  // Function to fetch 7-day ISP downtime
  const fetchIspDowntime7d = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/isp-downtime-7d`);
      const data = await response.json();
      setIspDowntime7d(data);
    } catch (error) {
      console.error('Error fetching 7-day ISP downtime:', error);
    }
  };

  // Function to fetch gateway status
  const fetchGatewayStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/gateway-status`);
      const data: GatewayStatus = await response.json();
      setGatewayStatus(data.status);
    } catch (error) {
      console.error('Error fetching gateway status:', error);
      setGatewayStatus('down'); // Assume down if fetch fails
    }
  };

  // Function to fetch 7-day internet uptime
  const fetchInternetUptime7d = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/internet-uptime-7d`);
      const data = await response.json();
      setInternetUptime7d(data);
    } catch (error) {
      console.error('Error fetching 7-day internet uptime:', error);
    }
  };

  // Track the last known IP for change detection
  const lastIpRef = useRef<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setMetrics(null); // Clear metrics on disconnect
    };

    ws.onmessage = (event) => {
      // Ensure we are marked as connected on first message
      if (!isConnected) setIsConnected(true);
      const data: Metrics = JSON.parse(event.data);
      setMetrics(data);

      // Update latency history
      const newLatency = parseFloat(data.networkMetrics.latency);
      if (!isNaN(newLatency)) {
        const newTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLatencyHistory(prev => updateHistory(prev, newLatency, newTime));
      }

      // Update CPU history
      const newCpuLoad = parseFloat(data.systemMetrics.cpuLoad);
      if (!isNaN(newCpuLoad)) {
        const newTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setCpuHistory(prev => updateHistory(prev, newCpuLoad, newTime));
      }

      // Update Memory history
      const newMemoryUsed = parseFloat(data.systemMetrics.memoryUsed);
      if (!isNaN(newMemoryUsed)) {
        const newTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setMemoryHistory(prev => updateHistory(prev, newMemoryUsed, newTime));
      }

      // Check if IP changed
      if (data.publicIpInfo?.ip && data.publicIpInfo.ip !== lastIpRef.current) {
        console.log('IP changed, refreshing data...');
        lastIpRef.current = data.publicIpInfo.ip;
        // Immediate refresh of logs and active ISPs
        fetchSwapLogs();
        fetchActiveIsps();
      }
    };

    // Fetch initial data
    fetchSwapLogs();
    fetchActiveIsps();
    fetchNetworkUsage7d();
    fetchIspDowntime7d();
    fetchInternetUptime7d();
    fetchGatewayStatus();

    // Set up interval for periodic refresh as backup
    const longInterval = setInterval(() => {
      fetchSwapLogs();
      fetchActiveIsps();
      fetchInternetUptime7d();
      fetchNetworkUsage7d();
      fetchIspDowntime7d();
    }, 30000);

    // Set up a more frequent interval for gateway status
    const shortInterval = setInterval(() => {
      fetchGatewayStatus();
    }, 5000); // Check every 5 seconds

    return () => {
      ws.close();
      clearInterval(longInterval);
      clearInterval(shortInterval);
    };
  }, []);

  // Effect to update document title and favicon
  useEffect(() => {
    if (!isConnected || !metrics) {
      document.title = 'Uplink Monitor - Disconnected';
      updateFavicon('disconnected');
      return;
    }

    const latency = parseFloat(metrics.networkMetrics.latency);
    document.title = `${metrics.publicIpInfo.isp} - ${latency}ms`;

    if (gatewayStatus === 'down') {
      updateFavicon('error');
    } else if (isNaN(latency)) {
      updateFavicon('disconnected');
    } else if (latency > 200) {
      updateFavicon('error');
    } else if (latency > 100) {
      updateFavicon('warning');
    } else {
      updateFavicon('ok');
    }
  }, [metrics, gatewayStatus, isConnected]);

  if (!metrics) {
    return <div className="loading">Loading network metrics...</div>;
  }

  // Calculate latency stats
  const highestLatency = latencyHistory.length > 0 ? Math.max(...latencyHistory.map(h => h.value)).toFixed(2) : 'N/A';
  const lowestLatency = latencyHistory.length > 0 ? Math.min(...latencyHistory.map(h => h.value)).toFixed(2) : 'N/A';
  
  // Calculate uptime percentage
  const uptimePercentage = internetUptime7d && internetUptime7d.totalCount > 0
    ? ((internetUptime7d.upCount / internetUptime7d.totalCount) * 100).toFixed(2)
    : null;


  const latencyChartData = {
    labels: latencyHistory.map(h => h.time),
    datasets: [
      {
        label: 'Latency (ms)',
        data: latencyHistory.map(h => h.value),
        fill: true,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgba(99, 102, 241, 1)',
        tension: 0.4,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(99, 102, 241, 1)',
      },
    ],
  };

  const latencyChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        titleColor: 'var(--text-primary)',
        bodyColor: 'var(--text-primary)',
        borderColor: 'var(--border-color)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { color: '#333' },
        ticks: { color: '#f0f0f0' },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(240, 240, 240, 0.1)' },
        ticks: { color: '#f0f0f0', callback: (value) => `${value}ms` },
      },
    },
  };

  const cpuChartData = {
    labels: cpuHistory.map(h => h.time),
    datasets: [
      {
        label: 'CPU Load (%)',
        data: cpuHistory.map(h => h.value),
        fill: true,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgba(239, 68, 68, 1)',
        tension: 0.4,
        pointBackgroundColor: 'rgba(239, 68, 68, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(239, 68, 68, 1)',
      },
    ],
  };

  const memoryChartData = {
    labels: memoryHistory.map(h => h.time),
    datasets: [
      {
        label: 'Memory Usage (%)',
        data: memoryHistory.map(h => h.value),
        fill: true,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 1)',
        tension: 0.4,
        pointBackgroundColor: 'rgba(245, 158, 11, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(245, 158, 11, 1)',
      },
    ],
  };

  const systemChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        titleColor: '#f0f0f0',
        bodyColor: '#f0f0f0',
        borderColor: '#555',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { color: '#333' },
        ticks: { color: '#f0f0f0' },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(240, 240, 240, 0.1)' },
        ticks: { color: '#f0f0f0', callback: (value) => `${value}%` },
      },
    },
  };

  return (
    <div className="dashboard">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <img src="/Logo-small-small.png" alt="" style={{ width: '64px' }} />
          <div>
            <h1>Uplink Monitor</h1>
            <span style={{ opacity: 0.4 }}>Maida Chemical Co., Ltd.</span>
          </div>
        </div>
        <div className={`swap-log-status ${isConnected ? 'active' : 'inactive'}`}>
          {isConnected ? 'Websocket Connected' : 'Websocket Disconnected'}
        </div>
        <div className="timestamp">
          Last Updated: {formatThaiTime(metrics.timestamp)}
        </div>
      </header>

      <div className="grid-container">
        {/* Network Latency Graph */}
        <div className="card network-latency">
          <h2>Network Latency</h2>
          <div className="latency-chart-container">
            <Line options={latencyChartOptions} data={latencyChartData} />
          </div>
        </div>

        <div className="card data-transfer">
          <h2>Overview</h2>
          <div className="transfer-metrics">
            <div className="metric">
              <span className="label">Uptime (7d)</span>
              <span className="value">{uptimePercentage ? `${uptimePercentage}%` : '...'}
              </span>
            </div>
            <div className="metric">
              <span className="label">ISP Downtime (7d)</span>
              <span className="value">{ispDowntime7d ? `${ispDowntime7d.downtimeCount} times` : '...'}</span>
            </div>
            <div className="metric">
              <span className="label">Highest Latency</span>
              <span className="value">{highestLatency} ms</span>
            </div>
            <div className="metric">
              <span className="label">Lowest Latency</span>
              <span className="value">{lowestLatency} ms</span>
            </div>
            <div className="metric">
              <span className="label">Firewall</span>
              <div className={`isp-status ${gatewayStatus === 'up' ? 'active' : 'inactive'}`}>
                <span className={`status-indicator ${gatewayStatus === 'up' ? 'active' : 'inactive'}`}></span>
                {gatewayStatus === 'loading' ? 'Checking...' : gatewayStatus === 'up' ? 'Up' : 'Down'}
              </div>
            </div>
            <div className="metric">
              <span className="label">Monitor Uptime</span>
              <span className="value">{metrics.systemMetrics.uptime} hours</span>
            </div>
          </div>
        </div>

        {/* Data Transfer */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ minHeight: '360px', overflow: 'hidden', borderRadius: '1.2rem' }}>
            <div style={{ width: '100%', height: 0, paddingBottom: '50%', position: 'relative' }}>
              <iframe style={{ border: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', minHeight: '360px', overflow: 'hidden !important' }} src="//openspeedtest.com/speedtest"></iframe>
            </div>
          </div>
          Provided by <a href="https://openspeedtest.com">OpenSpeedtest.com</a>
        </div>

        {/* Active ISPs Table */}
        <div className="card active-isps">
          <h2>Active ISPs</h2>
          <div className="active-isps-table">
            <table>
              <thead>
                <tr>
                  <th>ISP Name</th>
                  <th>Current IP</th>
                  <th>Last Update</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeIsps.map((isp, index) => (
                  <tr key={index} className="active-isp-row">
                    <td className="isp-name">{isp.isp}</td>
                    <td className="isp-ip">{isp.ip}</td>
                    <td className="isp-time">
                      {formatThaiTime(isp.timestamp)}
                    </td>
                    <td>
                      <div className={`isp-status ${isp.is_active ? 'active' : 'inactive'}`}>
                        <span className={`status-indicator ${isp.is_active ? 'active' : 'inactive'}`}></span>
                        {isp.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Public IP Information */}
        <div className="card ip-info">
          <h2>Public IP Information</h2>
          <div className="ip-details" style={{ margin: 'auto' }}>
            <div className="ip-address" style={{ fontSize: '3.2rem' }}>{metrics.publicIpInfo.ip}</div>
            <div className="location">
              <p>{metrics.publicIpInfo.city}, {metrics.publicIpInfo.region}</p>
              <p>{metrics.publicIpInfo.country}</p>
              <p className="timezone">{metrics.publicIpInfo.timezone}</p>
            </div>
            <div className="connection-info" style={{ marginTop: '2.4rem' }}>
              <div className="isp">
                <strong>ISP:</strong> {metrics.publicIpInfo.isp}
              </div>
              <div className="org">
                <strong>Organization:</strong> {metrics.publicIpInfo.organization}
              </div>
            </div>
          </div>
        </div>

        {/* Swap Logs */}
        <div className="card swap-logs">
          <h2>ISP Swap History</h2>
          <div className="swap-log-list">
            {swapLogs.map((log, index) => (
              <div key={index} className="swap-log-item">
                <div className="swap-log-isp">{log.isp}</div>
                <div className="swap-log-ip">{log.ip}</div>
                <div className="swap-log-time">
                  {formatThaiTime(log.timestamp)}
                </div>
                <div className={`swap-log-status ${log.uplink ? 'active' : 'inactive'}`}>
                  {log.uplink ? 'Active' : 'Inactive'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Performance */}
        <div className="card system-performance-large">
          <h2>System Performance</h2>
          <div className="dual-chart-container">
            <div className="chart-wrapper">
              <h3>CPU Load</h3>
              <div className="chart-inner">
                <Line options={systemChartOptions} data={cpuChartData} />
              </div>
            </div>
            <div className="chart-wrapper">
              <h3>Memory Usage</h3>
              <div className="chart-inner">
                <Line options={systemChartOptions} data={memoryChartData} />
              </div>
            </div>
          </div>
        </div>
        {/* <div className="card data-transfer">
          <h2>Total Data Transfer</h2>
          <div className="transfer-metrics">
            <div className="metric">
              <span className="label">Total Downloaded</span>
              <span className="value">{metrics.networkMetrics.totalDownload} GB</span>
            </div>
            <div className="metric">
              <span className="label">Total Uploaded</span>
              <span className="value">{metrics.networkMetrics.totalUpload} GB</span>
            </div>
            <div className="metric">
              <span className="label">Uptime</span>
              <span className="value">{metrics.systemMetrics.uptime} hours</span>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  )
}

export default App;
