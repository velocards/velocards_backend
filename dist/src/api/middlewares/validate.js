"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const errors_1 = require("../../utils/errors");
function validate(schema) {
    return async (req, _res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            });
            next();
        }
        catch (error) {
            next(new errors_1.ValidationError(error.errors));
        }
    };
}
//# sourceMappingURL=validate.js.map