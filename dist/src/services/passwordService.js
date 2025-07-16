"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("../config/env");
const errors_1 = require("../utils/errors");
class PasswordService {
    static async hash(password) {
        this.validatePassword(password);
        return bcryptjs_1.default.hash(password, env_1.security.bcryptRounds);
    }
    static async verify(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    static validatePassword(password) {
        if (password.length < 8) {
            throw new errors_1.ValidationError('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            throw new errors_1.ValidationError('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            throw new errors_1.ValidationError('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            throw new errors_1.ValidationError('Password must contain at least one number');
        }
        if (!/[!@#$%^&*]/.test(password)) {
            throw new errors_1.ValidationError('Password must contain at least one special character (!@#$%^&*)');
        }
    }
    static generateRandomPassword() {
        // Generate a secure random password for OAuth users
        const length = 32;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let password = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            password += charset[randomIndex];
        }
        return password;
    }
}
exports.PasswordService = PasswordService;
//# sourceMappingURL=passwordService.js.map