"use strict";

const Joi = require("joi");

// Password and phone number settings.
const settings = {
	passwordMinLength: 6,
	passwordMaxLength: 255,
	passwordRegex: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*$/,
	passwordErrorMessage: '"password" must contain an uppercase letter, lowercase letter and a number.',

	phoneNumberMinLength: 6,
	phoneNumberMaxLength: 6,
	phoneNumberRegex: /^\d+$/,
	phoneNumberError: 'Phone number must only contain numbers.',
};

// Set a default error handler.
Joi.originalValidateFn = Joi.validate;
Joi.validate = (data, schema, options) => {
	let baseOptions = {
		allowUnknown: true,
	};

	options = Object.assign(baseOptions, options);
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

Joi.phoneNumber = (length) => {
	return Joi.string().min(length || settings.phoneNumberMinLength).max(length || settings.phoneNumberMaxLength)
    	.regex(settings.phoneNumberRegex, settings.phoneNumberError);
};

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = Joi;
