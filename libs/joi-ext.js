"use strict";

const Joi = require("joi");

const extend = require("lodash/extend");

const settings = require("../config/joi-settings");

// Set a default error handler.
Joi.originalValidateFn = Joi.validate;
Joi.validate = (data, schema, options) => {
	let baseOptions = {
		allowUnknown: true,
	};

	options = extend(baseOptions, options);
	let {
		error,
		value,
	} = Joi.originalValidateFn(data, schema, options);

	if (error != null) {
		throw error;
	}

	return value;
};

Joi.password = () => {
	return Joi.string().min(settings.passwordMinLength).max(settings.passwordMaxLength)
    .regex(settings.passwordRegex, settings.passwordErrorMessage);
};

Joi.studentId = () => {
	return Joi.string().min(settings.studentIdMinLength).max(settings.studentIdMaxLength)
    .regex(settings.studentIdRegex, settings.studentIdError);
};

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = Joi;
