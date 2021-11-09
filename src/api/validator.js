var Validator = require('jsonschema').Validator;
var v = new Validator();


module.exports = {
    validate: ({ data, schema }) => {
        return v.validate(data, schema)
    }
}