"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.testDatabaseConnection = testDatabaseConnection;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("./env");
const logger_1 = __importDefault(require("../utils/logger"));
const supabase = (0, supabase_js_1.createClient)(env_1.database.supabaseUrl, env_1.database.supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
exports.supabase = supabase;
// Test database connection
async function testDatabaseConnection() {
    try {
        const { error } = await supabase
            .from('user_profiles')
            .select('count')
            .limit(1);
        if (error)
            throw error;
        logger_1.default.info('✅ Database connection successful');
        return true;
    }
    catch (error) {
        logger_1.default.error('❌ Database connection failed:', error);
        return false;
    }
}
exports.default = supabase;
//# sourceMappingURL=database.js.map