"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const si = __importStar(require("systeminformation"));
const axios_1 = __importDefault(require("axios"));
const mssql_1 = __importDefault(require("mssql"));
// Load environment variables
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.SERVER_PORT || 3001;
// MS SQL Server Configuration
const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'master', // Connect to master first
    server: process.env.DB_SERVER || 'localhost',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        trustServerCertificate: true,
        encrypt: false,
        enableArithAbort: true,
        connectTimeout: 15000,
        requestTimeout: 15000
    }
};
// Database connection pool
let pool;
// Initialize database connection pool
async function initializePool() {
    try {
        pool = await new mssql_1.default.ConnectionPool(sqlConfig).connect();
        console.log('Database connection pool initialized');
    }
    catch (err) {
        console.error('Error initializing database pool:', err);
    }
}
// Initialize pool on startup
initializePool().catch(console.error);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API endpoint to get swap logs
app.get('/api/swap-logs', async (req, res) => {
    try {
        if (!pool) {
            throw new Error('Database connection not initialized');
        }
        const result = await pool.request().query(`
      SELECT 
        isp,
        ip,
        FORMAT(timestamp AT TIME ZONE 'SE Asia Standard Time', 'yyyy-MM-dd HH:mm:ss') as timestamp,
        uplink
      FROM dbo.swap
      ORDER BY timestamp DESC
    `);
        res.json(result.recordset);
    }
    catch (err) {
        console.error('Error fetching swap logs:', err);
        res.status(500).json({ error: 'Failed to fetch swap logs' });
    }
});
// API endpoint to get active ISPs with their last IPs
app.get('/api/active-isps', async (req, res) => {
    try {
        if (!pool) {
            throw new Error('Database connection not initialized');
        }
        const result = await pool.request().query(`
      WITH LatestSwaps AS (
        SELECT 
          isp,
          ip,
          timestamp,
          uplink,
          ROW_NUMBER() OVER (PARTITION BY isp ORDER BY timestamp DESC) as rn
        FROM dbo.swap
        WHERE isp IS NOT NULL
      )
      SELECT 
        ls.isp,
        ls.ip,
        FORMAT(ls.timestamp AT TIME ZONE 'SE Asia Standard Time', 'yyyy-MM-dd HH:mm:ss') as timestamp,
        ls.uplink as is_active
      FROM LatestSwaps ls
      WHERE ls.rn = 1
      ORDER BY ls.timestamp DESC
    `);
        res.json(result.recordset);
    }
    catch (err) {
        console.error('Error fetching active ISPs:', err);
        res.status(500).json({ error: 'Failed to fetch active ISPs' });
    }
});
// Create HTTP server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
// Create WebSocket server
const wss = new ws_1.WebSocketServer({ server });
// Initialize database and create table if it doesn't exist
async function initializeDatabase() {
    try {
        if (!pool) {
            throw new Error('Database connection not initialized');
        }
        console.log('Checking database existence...');
        // First check if we can connect
        await pool.request().query('SELECT @@VERSION AS version');
        console.log('SQL Server connection successful');
        // Create database if it doesn't exist
        await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'network_log')
      BEGIN
        CREATE DATABASE network_log;
      END
    `);
        // Close the current pool that's connected to master
        await pool.close();
        // Create a new pool connected to network_log database
        const networkLogConfig = {
            ...sqlConfig,
            database: 'network_log'
        };
        pool = await new mssql_1.default.ConnectionPool(networkLogConfig).connect();
        console.log('Connected to network_log database');
        // Create the swap table if it doesn't exist
        await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.tables WHERE name = 'swap' AND schema_id = SCHEMA_ID('dbo')
      )
      BEGIN
        CREATE TABLE dbo.swap (
          id INT IDENTITY(1,1) PRIMARY KEY,
          isp NVARCHAR(255),
          ip NVARCHAR(255),
          timestamp DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time',
          uplink TINYINT DEFAULT 1
        );
        
        CREATE INDEX idx_timestamp ON dbo.swap(timestamp);
        CREATE INDEX idx_isp ON dbo.swap(isp);
        
        PRINT 'Swap table created successfully';
      END
      ELSE
      BEGIN
        PRINT 'Swap table already exists';
      END
      
      CREATE INDEX idx_timestamp ON swap(timestamp);
      CREATE INDEX idx_isp ON swap(isp);
    `);
        console.log('Database initialized successfully');
    }
    catch (err) {
        console.error('Error initializing database:', err);
    }
}
// Function to check and log ISP changes
async function checkAndLogIspChange(newIsp, newIp) {
    try {
        if (!pool) {
            throw new Error('Database connection not initialized');
        }
        // Get the last log entry
        const lastLog = await pool.request().query(`
      SELECT TOP 1 isp, ip
      FROM swap
      ORDER BY timestamp DESC
    `);
        // If no previous entries or ISP changed, log it
        if (!lastLog.recordset.length || lastLog.recordset[0].isp !== newIsp) {
            // Mark previous ISP as inactive
            if (lastLog.recordset.length) {
                await pool.request()
                    .input('oldIsp', mssql_1.default.NVarChar, lastLog.recordset[0].isp)
                    .query(`
            UPDATE swap 
            SET uplink = 0 
            WHERE isp = @oldIsp AND uplink = 1
          `);
            }
            // Insert new ISP entry
            await pool.request()
                .input('isp', mssql_1.default.NVarChar, newIsp)
                .input('ip', mssql_1.default.NVarChar, newIp)
                .query(`
          INSERT INTO swap (isp, ip, uplink)
          VALUES (@isp, @ip, 1)
        `);
            console.log('ISP change detected and logged:', newIsp);
        }
    }
    catch (err) {
        console.error('Error checking/logging ISP change:', err);
    }
}
// Initialize database and pool
async function startServer() {
    try {
        // Initialize database
        await initializePool();
        await initializeDatabase();
        console.log('Database initialization complete');
        // Start continuous monitoring
        await startContinuousMonitoring();
        console.log('Continuous monitoring started');
        console.log('Server initialization complete');
    }
    catch (err) {
        console.error('Server initialization failed:', err);
        // Try to restart the server after 30 seconds if initialization fails
        setTimeout(startServer, 30000);
    }
}
// Error handling for unexpected errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Try to restart monitoring
    startContinuousMonitoring().catch(console.error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Try to restart monitoring
    startContinuousMonitoring().catch(console.error);
});
// Start the server
startServer();
// Keep track of last successful API call times
let lastIpApiCall = 0;
let lastFreeIpApiCall = 0;
let lastIpWhoIsCall = 0;
let lastIpifyCall = 0;
let cachedIpInfo = null;
// API Configuration
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION || '30000');
const METRICS_INTERVAL = parseInt(process.env.METRICS_INTERVAL || '5000');
let lastIspCheck = 0;
const ISP_CHECK_INTERVAL = parseInt(process.env.ISP_CHECK_INTERVAL || '30000');
const API_RATE_LIMITS = {
    ipApi: 1000, // 1 request per second for ip-api.com
    freeIpApi: 1000, // 1 request per second for freeipapi.com
    ipWhoIs: 1000, // 1 request per second for ipwho.is
    ipify: 1000 // 1 request per second for ipify.org
};
// Function to get public IP information from ip-api.com
async function getIpApiInfo() {
    const now = Date.now();
    const timeSinceLastCall = now - lastIpApiCall;
    if (timeSinceLastCall < API_RATE_LIMITS.ipApi) {
        await new Promise(resolve => setTimeout(resolve, API_RATE_LIMITS.ipApi - timeSinceLastCall));
    }
    try {
        const response = await axios_1.default.get('https://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query', {
            timeout: 5000,
            headers: {
                'User-Agent': 'UplinkMonitor/1.0'
            }
        });
        if (response.data.status === 'success') {
            lastIpApiCall = Date.now();
            return {
                ip: response.data.query,
                country: response.data.country,
                region: response.data.regionName,
                city: response.data.city,
                isp: response.data.isp,
                latitude: response.data.lat,
                longitude: response.data.lon,
                organization: response.data.org,
                timezone: response.data.timezone,
                source: 'ip-api.com'
            };
        }
        throw new Error('IP API request failed');
    }
    catch (error) {
        console.error('Error getting IP info from ip-api.com:', error.message || error);
        throw error;
    }
}
// Function to get public IP information from freeipapi.com
async function getFreeIpApiInfo() {
    const now = Date.now();
    const timeSinceLastCall = now - lastFreeIpApiCall;
    if (timeSinceLastCall < API_RATE_LIMITS.freeIpApi) {
        await new Promise(resolve => setTimeout(resolve, API_RATE_LIMITS.freeIpApi - timeSinceLastCall));
    }
    try {
        const response = await axios_1.default.get('https://freeipapi.com/api/json', {
            timeout: 5000,
            headers: {
                'User-Agent': 'UplinkMonitor/1.0'
            }
        });
        lastFreeIpApiCall = Date.now();
        return {
            ip: response.data.ipAddress,
            country: response.data.countryName,
            region: response.data.regionName,
            city: response.data.cityName,
            isp: response.data.asnOrganization || 'N/A',
            latitude: response.data.latitude,
            longitude: response.data.longitude,
            organization: response.data.asnOrganization,
            timezone: response.data.timeZones[0],
            source: 'freeipapi.com',
            countryCode: response.data.countryCode,
            capital: response.data.capital,
            continent: response.data.continent,
            continentCode: response.data.continentCode,
            asn: response.data.asn,
            isProxy: response.data.isProxy
        };
    }
    catch (error) {
        console.error('Error getting IP info from freeipapi.com:', error.message || error);
        throw error;
    }
}
// Function to get IP information from ipwho.is
async function getIpWhoIsInfo() {
    const now = Date.now();
    const timeSinceLastCall = now - lastIpWhoIsCall;
    if (timeSinceLastCall < API_RATE_LIMITS.ipWhoIs) {
        await new Promise(resolve => setTimeout(resolve, API_RATE_LIMITS.ipWhoIs - timeSinceLastCall));
    }
    try {
        const response = await axios_1.default.get('https://ipwho.is', {
            timeout: 5000,
            headers: {
                'User-Agent': 'UplinkMonitor/1.0'
            }
        });
        lastIpWhoIsCall = Date.now();
        return {
            ip: response.data.ip,
            country: response.data.country,
            region: response.data.region,
            city: response.data.city,
            isp: response.data.connection.isp,
            latitude: response.data.latitude,
            longitude: response.data.longitude,
            organization: response.data.connection.org,
            timezone: response.data.timezone.id,
            source: 'ipwho.is',
            countryCode: response.data.country_code,
            continent: response.data.continent,
            asn: response.data.connection.asn,
            isProxy: response.data.security?.proxy || false
        };
    }
    catch (error) {
        console.error('Error getting IP info from ipwho.is:', error.message || error);
        throw error;
    }
}
// Function to get IP information using ipify.org + ipapi.co combination
async function getIpifyInfo() {
    const now = Date.now();
    const timeSinceLastCall = now - lastIpifyCall;
    if (timeSinceLastCall < API_RATE_LIMITS.ipify) {
        await new Promise(resolve => setTimeout(resolve, API_RATE_LIMITS.ipify - timeSinceLastCall));
    }
    try {
        // First get IP from ipify
        const ipResponse = await axios_1.default.get('https://api.ipify.org?format=json', {
            timeout: 5000,
            headers: {
                'User-Agent': 'UplinkMonitor/1.0'
            }
        });
        // Then get details from ipapi.co
        const response = await axios_1.default.get(`https://ipapi.co/${ipResponse.data.ip}/json/`, {
            timeout: 5000,
            headers: {
                'User-Agent': 'UplinkMonitor/1.0'
            }
        });
        lastIpifyCall = Date.now();
        return {
            ip: response.data.ip,
            country: response.data.country_name,
            region: response.data.region,
            city: response.data.city,
            isp: response.data.org,
            latitude: response.data.latitude,
            longitude: response.data.longitude,
            organization: response.data.org,
            timezone: response.data.timezone,
            source: 'ipify.org + ipapi.co',
            countryCode: response.data.country_code,
            asn: response.data.asn
        };
    }
    catch (error) {
        console.error('Error getting IP info from ipify.org + ipapi.co:', error.message || error);
        throw error;
    }
}
// Main function to get public IP information with multiple fallbacks and caching
async function getPublicIpInfo() {
    const now = Date.now();
    // Return cached data if available and not expired
    if (cachedIpInfo && (now - cachedIpInfo.timestamp) < CACHE_DURATION) {
        return cachedIpInfo.data;
    }
    // List of API functions to try in order
    const apiServices = [
        { name: 'ip-api.com', fn: getIpApiInfo },
        { name: 'freeipapi.com', fn: getFreeIpApiInfo },
        { name: 'ipwho.is', fn: getIpWhoIsInfo },
        { name: 'ipify.org', fn: getIpifyInfo }
    ];
    for (const service of apiServices) {
        try {
            console.log(`Trying ${service.name}...`);
            const data = await service.fn();
            cachedIpInfo = { data, timestamp: now };
            return data;
        }
        catch (error) {
            console.error(`${service.name} failed:`, error.message || error);
            // Continue to next service
        }
    }
    // If we have cached data, use it even if expired
    if (cachedIpInfo) {
        console.log('All services failed. Using expired cache data...');
        return cachedIpInfo.data;
    }
    // Return mock data if all services fail and no cache available
    console.error('All IP API services failed and no cache available');
    return {
        ip: '000.000.000.000',
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        isp: 'Unknown',
        latitude: 0,
        longitude: 0,
        organization: 'Unknown',
        timezone: 'Unknown',
        source: 'mock'
    };
}
// Function to safely get metrics with retries
async function getMetricsWithRetry(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            if (i === retries - 1)
                throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
// Function to get network metrics
async function getNetworkMetrics() {
    try {
        const [networkStats, latency, publicIpInfo, cpuLoad, memory, uptime] = await Promise.all([
            getMetricsWithRetry(() => si.networkStats()),
            getMetricsWithRetry(() => si.inetLatency()),
            getMetricsWithRetry(() => getPublicIpInfo()),
            getMetricsWithRetry(() => si.currentLoad()),
            getMetricsWithRetry(() => si.mem()),
            getMetricsWithRetry(() => Promise.resolve(si.time()))
        ]);
        // Check and log ISP changes only every 30 seconds
        const now = Date.now();
        if (publicIpInfo && publicIpInfo.isp && publicIpInfo.ip &&
            (now - lastIspCheck >= ISP_CHECK_INTERVAL)) {
            await checkAndLogIspChange(publicIpInfo.isp, publicIpInfo.ip);
            lastIspCheck = now;
        }
        // Get current time in Thai timezone
        const result = await pool.request().query(`
      SELECT FORMAT(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time', 'yyyy-MM-dd HH:mm:ss') as timestamp
    `);
        const timestamp = result.recordset[0].timestamp;
        return {
            timestamp,
            publicIpInfo,
            systemMetrics: {
                cpuLoad: cpuLoad.currentLoad.toFixed(2),
                memoryUsed: ((memory.used / memory.total) * 100).toFixed(2),
                uptime: Math.floor(uptime.uptime / 3600), // Convert to hours
            },
            networkMetrics: {
                downloadSpeed: (networkStats[0].rx_sec / 1024 / 1024).toFixed(2),
                uploadSpeed: (networkStats[0].tx_sec / 1024 / 1024).toFixed(2),
                totalDownload: (networkStats[0].rx_bytes / 1024 / 1024 / 1024).toFixed(2),
                totalUpload: (networkStats[0].tx_bytes / 1024 / 1024 / 1024).toFixed(2),
                latency: latency ? latency.toFixed(2) : 'N/A',
            },
        };
    }
    catch (error) {
        console.error('Error getting network metrics:', error);
        return null;
    }
}
// Global metrics state
let currentMetrics = null;
// Continuous monitoring function
async function startContinuousMonitoring() {
    console.log('Starting continuous monitoring...');
    // Initial check
    currentMetrics = await getNetworkMetrics();
    // Set up continuous monitoring
    setInterval(async () => {
        try {
            currentMetrics = await getNetworkMetrics();
            // Log connection status
            if (currentMetrics && currentMetrics.publicIpInfo) {
                console.log(`Monitoring: ${currentMetrics.publicIpInfo.isp} - ${currentMetrics.publicIpInfo.ip}`);
            }
        }
        catch (error) {
            console.error('Error in continuous monitoring:', error);
        }
    }, METRICS_INTERVAL);
}
// WebSocket connection handler - only sends existing metrics
wss.on('connection', (ws) => {
    console.log('Client connected to dashboard');
    // Send current metrics immediately on connection
    if (currentMetrics) {
        ws.send(JSON.stringify(currentMetrics));
    }
    // Set up interval to send existing metrics to client
    const interval = setInterval(() => {
        if (currentMetrics && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(currentMetrics));
        }
    }, METRICS_INTERVAL);
    ws.on('close', () => {
        console.log('Client disconnected from dashboard');
        clearInterval(interval);
    });
});
exports.default = app;
