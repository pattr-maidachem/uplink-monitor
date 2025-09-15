import { useEffect, useState, useRef } from 'react'
import './App.css'

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

// Helper function to format date (server sends in format: 'yyyy-MM-dd HH:mm:ss')
const formatThaiTime = (dateString: string) => {
  const [datePart, timePart] = dateString.split(' ');
  const [year, month, day] = datePart.split('-');
  const [hours, minutes, seconds] = timePart.split(':');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

function App() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [swapLogs, setSwapLogs] = useState<SwapLog[]>([]);
  const [activeIsps, setActiveIsps] = useState<ActiveISP[]>([]);

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

  // Track the last known IP for change detection
  const lastIpRef = useRef<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetrics(data);

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

    // Set up interval for periodic refresh as backup
    const interval = setInterval(() => {
      fetchSwapLogs();
      fetchActiveIsps();
    }, 30000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  if (!metrics) {
    return <div className="loading">Loading network metrics...</div>;
  }

  return (
    <div className="dashboard">
      <header className="header">
        <h1>Network Dashboard</h1>
        <div className="timestamp">
          Last Updated: {formatThaiTime(metrics.timestamp)}
        </div>
      </header>

      <div className="grid-container">
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
          <div className="ip-details">
            <div className="ip-address">{metrics.publicIpInfo.ip}</div>
            <div className="location">
              <p>{metrics.publicIpInfo.city}, {metrics.publicIpInfo.region}</p>
              <p>{metrics.publicIpInfo.country}</p>
              <p className="timezone">{metrics.publicIpInfo.timezone}</p>
            </div>
            <div className="connection-info">
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

        {/* Network Speed */}
        <div className="card network-speed">
          <h2>Network Speed</h2>
          <div className="speed-metrics">
            {/* <div className="metric">
              <span className="label">Download</span>
              <span className="value">{metrics.networkMetrics.downloadSpeed} MB/s</span>
            </div>
            <div className="metric">
              <span className="label">Upload</span>
              <span className="value">{metrics.networkMetrics.uploadSpeed} MB/s</span>
            </div> */}
            <div className="metric">
              <span className="label">Latency</span>
              <span className="value">{metrics.networkMetrics.latency} ms</span>
            </div>
          </div>
        </div>

        {/* System Performance */}
        <div className="card system-metrics">
          <h2>System Performance</h2>
          <div className="performance-metrics">
            <div className="metric">
              <span className="label">CPU Load</span>
              <div className="progress-bar">
                <div className="progress" style={{ width: `${metrics.systemMetrics.cpuLoad}%` }}></div>
              </div>
              <span className="value">{metrics.systemMetrics.cpuLoad}%</span>
            </div>
            <div className="metric">
              <span className="label">Memory Usage</span>
              <div className="progress-bar">
                <div className="progress" style={{ width: `${metrics.systemMetrics.memoryUsed}%` }}></div>
              </div>
              <span className="value">{metrics.systemMetrics.memoryUsed}%</span>
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

export default App
