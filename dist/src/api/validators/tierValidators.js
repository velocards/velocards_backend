"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFeesSchema = void 0;
const zod_1 = require("zod");
exports.calculateFeesSchema = zod_1.z.object({
    body: zod_1.z.object({
        action: zod_1.z.enum(['card_creation', 'deposit', 'withdrawal']),
        amount: zod_1.z.number().positive().optional()
    })
});
//# sourceMappingURL=tierValidators.js.map