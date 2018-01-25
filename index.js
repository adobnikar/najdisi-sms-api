"use strict";

const axios = require("axios");
const axiosCookieJarSupport = require("@3846masa/axios-cookiejar-support").default;
const cheerio = require("cheerio");
const querystring = require("querystring");
const tough = require("tough-cookie");
const Joi = require("./libs/joi-ext");

/**
 * Create a new axios instance that is setup to send requests to najdi.si.
 */
function createAxios() {
	let cookieJar = new tough.CookieJar();
	let instance = axios.create({
		baseURL: "https://www.najdi.si",
		timeout: 30000,
		jar: cookieJar, // tough.CookieJar or boolean
		withCredentials: true, // If true, send cookies stored in jar
		headers: {
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/63.0.3239.84 Chrome/63.0.3239.84 Safari/537.36",
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			// X-Requested-With header is used to prevent CORS attacks.
			// souce: https://stackoverflow.com/questions/17478731/whats-the-point-of-the-x-requested-with-header
			"X-Requested-With": "XMLHttpRequest",
		},
	});
	instance.cookieJar = cookieJar;

	// Add cookie jar support to axios.
	axiosCookieJarSupport(instance);	

	return instance;
}

function pushToObj(obj, name, value) {
	if (name in obj) {
		if (obj[name].constructor !== Array) obj[name] = [obj[name]];
		obj[name].push(value);
	} else obj[name] = value;
}

/**
 * Extract data that would get submitted with the form.
 * This function is compatible with vanilla js.
 * 
 * @param {jQuery|cheerio} $ 
 * @param {string} formId 
 */
function formToObj($, formId) {
	var form = $(`form#${formId}`);
	if (form.length < 1) throw new Error(`${formId} form not found.`);
	var dataObj = {};
	var optionsObj = {};

	var elements = form.find("input,select,textarea");
	elements.each(function() {
		var element = $(this);
		var tagName = element[0].tagName;
		var type = element.attr("type");
		var name = element.attr("name");
		var value = "";

		// Handle each type of element.
		// NOTE: for textarea do nothing.
		if (tagName === "input") {
			if (type === "submit") return;
			if ((type !== "hidden") || (element.attr("id") == null)) {
				value = element.attr("value") || "";
			}
		} else if (tagName === "select") {
			// Extract select options.
			var options = element.find("option");
			var optionValues = [];
			options.each(function() {
				var option = $(this);
				var optionValue = option.attr("value") || "";
				optionValues.push(optionValue);
				if (option.attr("selected") != null) value = optionValue;
			});
			pushToObj(optionsObj, name, optionValues);
		}
		pushToObj(dataObj, name, value);
	});

	return {
		form: form,
		data: dataObj,
		options: optionsObj,
	};
}

function extractStatus($) {
	// Plan
	// - is logged in flag
	// - name and surname of the user
	// - current and max sms count
	// - is sender set

	let status = {
		isLoggedIn: false,
		name: null,
		smsCount: null,
		maxSmsCount: null,
		isSenderSet: null,
		phoneNumberSender: null,
	};

	// Find "Prijava" button.
	let loginLink = $("div#nav1 a#loginPovezava");
	if (loginLink.length > 0) {
		// Not logged in.
		return status;
	}

	// Logged in => get name and surname.
	status.isLoggedIn = true;
	let nameLink = $("div#nav1 div.pull-right ul.topnav > li > a");
	if (nameLink.length > 0) {
		status.name = nameLink.text();
	}

	// Check if SMS form exists.
	let smsForm = $("form#smsForm");
	if (smsForm.length > 0) {
		status.isSenderSet = false;

		// Get SMS count and max count.
		let smsCountLabel = smsForm.find("div#formZone ul.reciever div.smsno > strong");
		if (smsCountLabel.length > 0) {
			let smsCountText = smsCountLabel.text().trim();
			if (/^\d+\s*\/\s*\d+$/.test(smsCountText)) {
				let counts = smsCountText.split("/").map(n => parseInt(n.trim()));
				if (counts.length >= 2) {
					status.smsCount = counts[0];
					status.maxSmsCount = counts[1];
				}
			}
		}

		// Get sender info.
		let senderInfoLabel = smsForm.find("div#formZone div#firstName-container span.senderinfo");
		if (senderInfoLabel.length > 0) {
			let senderInfoText = $(senderInfoLabel[0]).text().trim();
			if (/^\d+\s*\/\s*\d+\s*\-\s*\d+$/.test(senderInfoText)) {
				status.isSenderSet = true;
				status.phoneNumberSender = senderInfoText;
			}
		}
	}

	return status;
}

/**
 * Perform login preocedure to acquire cookies.
 * 
 * @param {axios} axiosInstance
 * @param {string} username
 * @param {string} password
 * @param {boolean} [rememberMe=false]
 */
async function loginHelper(axiosInstance, username, password, rememberMe = false) {
	// Load login form.
	let response = await axiosInstance.get("/prijava");
	let $ = cheerio.load(response.data);
	let {form, data} = formToObj($, "jsecLoginForm");

	// Validate the login form.
	data = Joi.validate(data, Joi.object().keys({
		jsecLogin: Joi.string().allow("").required(),
		jsecPassword: Joi.string().allow("").required(),
		jsecRememberMe: Joi.string().allow("").required(),
	}));

	// Set parameters.
	data.jsecLogin = username;
	data.jsecPassword = password;
	if (rememberMe) data.jsecRememberMe = "on";
	else delete data.jsecRememberMe;

	// Validate form action.
	let formAttrs = Joi.validate(form[0].attribs, Joi.object().keys({
		action: Joi.string().required(),
		method: Joi.string().valid("post").required(),
	}));

	// Login.
	response = await axiosInstance.post(formAttrs.action, querystring.stringify(data));

	// Extract status and return.
	let status = extractStatus(cheerio.load(response.data));
	return status;
}

async function sendSmsHelper(axiosInstance, areaCodeRecipient, phoneNumberRecipient, text) {
	// Load send sms form.
	let response = await axiosInstance.get("/najdi/sms");
	let $ = cheerio.load(response.data);

	// Check if sender is set.
	let status = extractStatus($);
	if (status.isLoggedIn !== true) throw new Error("Need to log in.");
	if (status.isSenderSet !== true) throw new Error("Sender phone number not set and verified.");
	let {form, data, options} = formToObj($, "smsForm");

	// Validate the send sms form.
	options = Joi.validate(options, Joi.object().keys({
		areaCodeRecipient: Joi.array().items(Joi.string().allow("")).required(),
	}));
	options.areaCodeRecipient = options.areaCodeRecipient.map(ac => ac.trim()).filter(ac => (ac.length > 0));
	data = Joi.validate(data, Joi.object().keys({
		areaCodeRecipient: Joi.string().allow("").required(),
		phoneNumberRecipient: Joi.string().allow("").required(),
		text: Joi.string().allow("").required(),
	}));

	// Validate & set parameters.
	let areaCodeSet = new Set(options.areaCodeRecipient);
	if (!areaCodeSet.has(areaCodeRecipient)) {
		throw new Error(`Ivalid area code. Pick one of ${options.areaCodeRecipient.join(", ")}.`)
	}

	data.areaCodeRecipient = areaCodeRecipient;
	data.phoneNumberRecipient = phoneNumberRecipient;
	data.text = text;
	data["t:submit"] = `["send","send"]`;
	data["t:zoneid"] = `smsZone`;

	// Validate form action.
	let formAttrs = Joi.validate(form[0].attribs, Joi.object().keys({
		action: Joi.string().required(),
		method: Joi.string().valid("post").required(),
	}));

	// Send sms.
	await axiosInstance.post(formAttrs.action, querystring.stringify(data));
}

class NajdisiSmsApi {
	constructor() {
		this.isLoggedIn = false;
		this.axiosInstance = createAxios();
	}

	/**
	 * Log in.
	 * 
	 * @param {string} username Najdi.si account username.
	 * @param {string} password Najdi.si account password.
	 */
	async login(username, password) {
		// Validate parameters.
		let p = Joi.validate({username, password}, Joi.object().keys({
			username: Joi.string().allow("").required(),
			password: Joi.string().allow("").required(),
		}));

		this.isLoggedIn = false;
		let status = await loginHelper(this.axiosInstance, p.username, p.password);
		if (!status.isLoggedIn) throw new Error("Login failed.");
		this.isLoggedIn = true;
	}

	/**
	 * Get status.
	 */
	async getStatus() {
		// Load send sms form.
		let response = await this.axiosInstance.get("/najdi/sms");

		// Extract status and return.
		let status = extractStatus(cheerio.load(response.data));
		return status;
	}

	/**
	 * Send sms.
	 * 
	 * @param {string} areaCodeRecipient Must have length of 3. Examples: "030", "070", "041", ...
	 * @param {string} phoneNumberRecipient Must have length of 6. Example: "123456", ...
	 * @param {string} smsText SMS text that you want to send. Max 160 characters.
	 */
	async sendSms(areaCodeRecipient, phoneNumberRecipient, smsText) {
		// Validate parameters.
		let p = Joi.validate({areaCodeRecipient, phoneNumberRecipient, smsText}, Joi.object().keys({
			areaCodeRecipient: Joi.phoneNumber(3).required(),
			phoneNumberRecipient: Joi.phoneNumber(6).required(),
			smsText: Joi.string().max(160).allow("").required(),
		}));
		if (!this.isLoggedIn) throw new Error("Need to log in first.");
		
		await sendSmsHelper(this.axiosInstance, p.areaCodeRecipient, p.phoneNumberRecipient, p.smsText);
	}

	/**
	 * Get status without creating an API instance.
	 * 
	 * @param {string} username Najdi.si account username.
	 * @param {string} password Najdi.si account password.
	 */
	static async getStatusOnce(username, password) {
		// Validate parameters.
		let p = Joi.validate({username, password}, Joi.object().keys({
			username: Joi.string().allow("").required(),
			password: Joi.string().allow("").required(),
		}));

		let api = new NajdisiSmsApi();
		await api.login(p.username, p.password);
		let status = await api.getStatus();
		return status;
	}

	/**
	 * Send SMS without creating an API instance.
	 * 
	 * @param {string} username Najdi.si account username.
	 * @param {string} password Najdi.si account password.
	 * @param {string} areaCodeRecipient Must have length of 3. Examples: "030", "070", "041", ...
	 * @param {string} phoneNumberRecipient Must have length of 6. Example: "123456", ...
	 * @param {string} smsText SMS text that you want to send. Max 160 characters.
	 */
	static async sendSmsOnce(username, password, areaCodeRecipient, phoneNumberRecipient, smsText) {
		// Validate parameters.
		let p = Joi.validate({username, password, areaCodeRecipient, phoneNumberRecipient, smsText}, Joi.object().keys({
			username: Joi.string().allow("").required(),
			password: Joi.string().allow("").required(),
			areaCodeRecipient: Joi.phoneNumber(3).required(),
			phoneNumberRecipient: Joi.phoneNumber(6).required(),
			smsText: Joi.string().max(160).allow("").required(),
		}));

		let api = new NajdisiSmsApi();
		await api.login(p.username, p.password);
		let status = await api.sendSms(p.areaCodeRecipient, p.phoneNumberRecipient, p.smsText);
		return status;
	}
}

/**
 * Exported NajdisiSmsApi class.
 * @type {class}
 */
module.exports = NajdisiSmsApi;