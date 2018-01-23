"use strict";

// Load config.
require("./config/load-dotenv");

//const fs = require("fs");
//const path = require("path");
const chalk = require("chalk");
const cheerio = require("cheerio");
const querystring = require("querystring");
const axios = require("axios");
const axiosCookieJarSupport = require("@3846masa/axios-cookiejar-support").default;
const tough = require("tough-cookie");
const Joi = require("./libs/joi-ext");

const isArray = require("lodash/isArray");

// Logging functions.
const log = console.log;
const logSuccess = (text) => console.log(chalk.green(text));
const logError = (text) => console.error(chalk.red(text));
const logWarn = (text) => console.warn(chalk.yellow(text));

function createAxios() {
	let cookieJar = new tough.CookieJar();
	let instance = axios.create({
		baseURL: "https://www.najdi.si",
		timeout: 30000,
		jar: cookieJar, // tough.CookieJar or boolean
		withCredentials: true, // If true, send cookie stored in jar
		headers: {
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/63.0.3239.84 Chrome/63.0.3239.84 Safari/537.36",
		},
	});
	instance.cookieJar = cookieJar;

	// Add cookie jar support to axios.
	axiosCookieJarSupport(instance);

	return instance;
}

function formToObj(form) {
	let inputs = form.find("input");
	inputs = Array.from(inputs);

	let dataObj = {};
	for (let input of inputs) {
		let type = input.attribs.type;
		if (type === "submit") {
			console.log(input.attribs);
			continue;
		}
		let name = input.attribs.name;
		let value = input.attribs.value || "";
		if (dataObj.hasOwnProperty(name)) {
			if (!isArray(dataObj[name])) dataObj[name] = [dataObj[name]];
			dataObj[name].push(value);
		} else dataObj[name] = value;
	}

	let selects = form.find("select");
	selects = Array.from(selects);
	for (let select of selects) {
		let name = select.attribs.name;
		let value = "";
		let options = Array.from(cheerio(select).find("option"));
		let selectedOption = options.filter(o => ("selected" in o.attribs));
		if (selectedOption.length > 0) value = selectedOption[0].attribs.value;

		if (dataObj.hasOwnProperty(name)) {
			if (!isArray(dataObj[name])) dataObj[name] = [dataObj[name]];
			dataObj[name].push(value);
		} else dataObj[name] = value;
	}

	let textareas = form.find("textarea");
	textareas = Array.from(textareas);
	for (let textarea of textareas) {
		let name = textarea.attribs.name;
		let value = "";

		if (dataObj.hasOwnProperty(name)) {
			if (!isArray(dataObj[name])) dataObj[name] = [dataObj[name]];
			dataObj[name].push(value);
		} else dataObj[name] = value;
	}

	return dataObj;
}

/**
 * Perform login preocedure to acquire cookies.
 * @param {axios} axiosNajdiSi 
 * @param {string} username 
 * @param {string} password 
 */
async function login(axiosNajdiSi, username, password) {
	// Load login form.
	let response = await axiosNajdiSi.get("/prijava");
	let $ = cheerio.load(response.data);
	let form = $("form#jsecLoginForm");
	if (form.length < 1) throw new Error("Login form not found.");
	let formData = formToObj(form);

	// Validate the login form.
	formData = Joi.validate(formData, Joi.object().keys({
		jsecLogin: Joi.string().allow("").required(),
		jsecPassword: Joi.string().allow("").required(),
		jsecRememberMe: Joi.string().allow("").required(),
		// "t:formdata": Joi.string().required(),
	}));
	formData.jsecLogin = username;
	formData.jsecPassword = password;
	formData.jsecRememberMe = "on";

	// Validate form action.
	let formAttrs = Joi.validate(form[0].attribs, Joi.object().keys({
		action: Joi.string().required(),
		method: Joi.string().valid("post").required(),
	}));

	// Login.
	response = await axiosNajdiSi.post(formAttrs.action, querystring.stringify(formData));

	// TODO: extract some info from the site and return it
	// $ = cheerio.load(response.data);
	// let t = $("div#nav1 div.pull-right").text();
}

async function sendSms(axiosNajdiSi, recipientAreaCode, recipientPhoneNumber, text) {
	// Load send sms form.
	let response = await axiosNajdiSi.get("/najdi/sms");
	let $ = cheerio.load(response.data);
	let form = $("form#smsForm");
	if (form.length < 1) throw new Error("SMS form not found.");
	let formData = formToObj(form);

	// Validate the send sms form.
	formData = Joi.validate(formData, Joi.object().keys({
		areaCodeRecipient: Joi.string().allow("").required(),
		phoneNumberRecipient: Joi.string().allow("").required(),
		text: Joi.string().allow("").required(),
	}));
	formData.areaCodeRecipient = recipientAreaCode;
	formData.phoneNumberRecipient = recipientPhoneNumber;
	formData.text = text;

	formData["t:submit"] = `["send","send"]`;
	formData["t:zoneid"] = `smsZone`;

	// Validate form action.
	let formAttrs = Joi.validate(form[0].attribs, Joi.object().keys({
		action: Joi.string().required(),
		method: Joi.string().valid("post").required(),
	}));

	// Send sms.
	response = await axiosNajdiSi.post(formAttrs.action, querystring.stringify(formData));

	console.log(response);
}

async function asyncWrapper() {
	// Validate settings.
	Joi.validate(process.env, Joi.object().keys({
		NAJDISI_USER: Joi.string().required(),
		NAJDISI_PASSWORD: Joi.string().required(),
		RECIPIENT_AREA_CODE: Joi.string().required(),
		RECIPIENT_PHONE_NUMBER: Joi.string().required(),
		SMS_TEXT: Joi.string().required(),
	}));

	let axiosNajdiSi = createAxios();
	await login(axiosNajdiSi, process.env.NAJDISI_USER, process.env.NAJDISI_PASSWORD);
	await sendSms(axiosNajdiSi, process.env.RECIPIENT_AREA_CODE, process.env.RECIPIENT_PHONE_NUMBER, process.env.SMS_TEXT);
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
