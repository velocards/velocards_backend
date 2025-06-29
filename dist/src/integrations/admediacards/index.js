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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admediacardsClient = void 0;
const env_1 = require("../../config/env");
const client_1 = require("./client");
const realClient_1 = require("./realClient");
// Export the appropriate client based on the feature flag
exports.admediacardsClient = env_1.features.mockExternalApis
    ? new client_1.AdmediacardsClient({
        apiKey: 'mock_api_key',
        baseUrl: 'https://api.admediacards.com',
        isLive: false
    })
    : realClient_1.admediacardsClient;
// Re-export types
__exportStar(require("./client"), exports);
//# sourceMappingURL=index.js.map