"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestId = requestId;
const uuid_1 = require("uuid");
function requestId(req, res, next) {
    req.id = req.headers['x-request-id'] || (0, uuid_1.v4)();
    res.setHeader('X-Request-ID', req.id);
    next();
}
//# sourceMappingURL=requestId.js.map