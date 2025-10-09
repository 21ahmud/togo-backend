// src/middleware/debug.js
// Middleware for debugging API requests

const debugRequest = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n🔍 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    
    // Log headers (excluding sensitive ones)
    const headers = { ...req.headers };
    if (headers.authorization) {
      headers.authorization = 'Bearer [HIDDEN]';
    }
    console.log('📋 Headers:', headers);
    
    // Log query parameters
    if (Object.keys(req.query).length > 0) {
      console.log('❓ Query:', req.query);
    }
    
    // Log body for POST/PUT requests (excluding sensitive data)
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const body = { ...req.body };
      if (body.password) body.password = '[HIDDEN]';
      console.log('📦 Body:', body);
    }
    
    // Log the response when it's sent
    const originalSend = res.send;
    res.send = function(data) {
      console.log(`✅ Response Status: ${res.statusCode}`);
      if (res.statusCode >= 400) {
        console.log('❌ Error Response:', data);
      }
      return originalSend.call(this, data);
    };
  }
  
  next();
};

const debugError = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('\n💥 ERROR DETAILS:');
    console.log('🔴 Error Name:', err.name);
    console.log('🔴 Error Message:', err.message);
    console.log('🔴 Stack Trace:', err.stack);
    console.log('🔴 Request URL:', req.originalUrl);
    console.log('🔴 Request Method:', req.method);
  }
  
  next(err);
};

module.exports = {
  debugRequest,
  debugError
};