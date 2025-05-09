function getVisitorIP(req) {
    let ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "unknown";
    if (!ip || ip === "::1" || ip === "127.0.0.1") ip = "localtest";
    return ip;
  }
  
  module.exports = {
    getVisitorIP
  };