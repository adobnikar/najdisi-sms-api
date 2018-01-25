"use strict";

// Load config.
require("./config/load-dotenv");

const chalk = require("chalk");
const NajdisiSmsApi = require("./index");
const Joi = require("./libs/joi-ext");

// Logging functions.
const log = console.log;
const logSuccess = (text) => console.log(chalk.green(text));
const logError = (text) => console.error(chalk.red(text));
const logWarn = (text) => console.warn(chalk.yellow(text));

async function asyncWrapper() {
	// Validate settings.
	Joi.validate(process.env, Joi.object().keys({
		NAJDISI_USER: Joi.string().required(),
		NAJDISI_PASSWORD: Joi.string().required(),
		RECIPIENT_AREA_CODE: Joi.phoneNumber(3).required(),
		RECIPIENT_PHONE_NUMBER: Joi.phoneNumber(6).required(),
		SMS_TEXT: Joi.string().required(),
	}));

	let username = process.env.NAJDISI_USER;
	let password = process.env.NAJDISI_PASSWORD;
	let areaCodeRecipient = process.env.RECIPIENT_AREA_CODE;
	let phoneNumberRecipient = process.env.RECIPIENT_PHONE_NUMBER;
	let smsText = process.env.SMS_TEXT;


	let status = await NajdisiSmsApi.getStatusOnce(username, password);
	log("status", status);

	// Send sms.
	await NajdisiSmsApi.sendSmsOnce(username, password, areaCodeRecipient, phoneNumberRecipient, smsText);

	status = await NajdisiSmsApi.getStatusOnce(username, password);
	log("status", status);
}

asyncWrapper().then(error => {
	logSuccess("Done.");
	process.exit(0);
}).catch(error => {
	logError(error);
	logError(error.stack);
	logError("Exit.");
	process.exit(1);
});
