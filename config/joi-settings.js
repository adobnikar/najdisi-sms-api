"use strict";

/**
 * Exported settings.
 * @type {Object}
 */
module.exports = {
	passwordMinLength: 6,
	passwordMaxLength: 255,
	passwordRegex: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*$/,
	passwordErrorMessage: '"password" must contain an uppercase letter, lowercase letter and a number.',

	studentIdMinLength: 3,
	studentIdMaxLength: 255,
	studentIdRegex: /^\d+$/,
	studentIdError: 'Student id must only contain numbers.',
};
