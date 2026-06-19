import AnalyticsBucket from '../models/AnalyticsBucket.js';

/**
 * Normalizes dynamic request paths to group endpoints correctly (e.g. /api/users/60c72b2f9b1d8e236c84b123 -> /api/users/:id)
 */
function normalizePath(path = '') {
  return path
    .replace(/\/[0-9a-fA-F]{24}(\/|$)/g, '/:id$1') // Mongoose ObjectIDs
    .replace(/\/\d+(\/|$)/g, '/:id$1')            // Numbers
    .trim();
}

export async function recordAnalyticsMetric({ method, path, status, duration, ip, io }) {
  try {
    const now = new Date();
    
    // Round to current minute
    const minuteTime = new Date(now);
    minuteTime.setSeconds(0, 0);
    
    // Round to current hour
    const hourTime = new Date(now);
    hourTime.setMinutes(0, 0, 0);
    
    const isError = status >= 500;
    const statusField = status >= 500 ? 'status5xx' :
                        status >= 400 ? 'status4xx' :
                        status >= 300 ? 'status3xx' : 'status2xx';
    
    const cleanPath = normalizePath(path);
    const endpointKey = `${method} ${cleanPath}`;
    
    // In MongoDB, map keys cannot contain dots. Let's sanitize.
    const safeEndpointKey = endpointKey.replace(/\./g, '_');
    
    const update = {
      $inc: {
        requestCount: 1,
        errorCount: isError ? 1 : 0,
        responseTimeSum: duration,
        [statusField]: 1,
        [`endpoints.${safeEndpointKey}`]: 1
      }
    };
    
    // Run DB updates in the background (non-blocking)
    Promise.all([
      AnalyticsBucket.updateOne(
        { timestamp: minuteTime, interval: 'minute' },
        update,
        { upsert: true }
      ),
      AnalyticsBucket.updateOne(
        { timestamp: hourTime, interval: 'hour' },
        update,
        { upsert: true }
      )
    ]).catch((err) => {
      console.warn('Analytics DB update warning:', err.message);
    });

    // Stream real-time request live feeds to the admin room if Socket.io is connected
    if (io) {
      // Check if any clients are listening in the admin room to avoid unnecessary emissions
      const adminSockets = io.sockets.adapter.rooms.get('admin');
      if (adminSockets && adminSockets.size > 0) {
        io.to('admin').emit('admin:traffic', {
          timestamp: now,
          method,
          path: cleanPath,
          status,
          duration,
          ip
        });
      }
    }
  } catch (err) {
    console.warn('Failed to record analytics metric:', err.message);
  }
}
