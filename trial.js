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
			"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			// X-Requested-With header is used to prevent CORS attacks.
			// souce: https://stackoverflow.com/questions/17478731/whats-the-point-of-the-x-requested-with-header
			"X-Requested-With": "XMLHttpRequest",
		},
	});
	instance.cookieJar = cookieJar;

	// Add cookie jar support to axios.
	axiosCookieJarSupport(instance);

	instance.interceptors.request.use(function (config) {
		// Do something before request is sent
		return config;
	}, function (error) {
		// Do something with request error
		return Promise.reject(error);
	});
	

	return instance;
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

	let elements = form.find("input,select,textarea");
	elements.each(function() {
		var element = $(this);
		var tagName = element[0].tagName;
		var type = element.attr("type");
		var name = element.attr("name");
		var value = "";
		if (tagName === "input") {
			if (type === "submit") {
				console.log(element.attr());
				return;
			}
			if ((type !== "hidden") || (element.attr("id") == null)) {
				value = element.attr("value") || "";
			}
		} else if (tagName === "select") {
			// Extract select options.
			var options = element.find("option");
			var selectedOption = null;
			options.each(function() {
				var option = $(this);
				if (option.attr("selected") != null) {
					selectedOption = option;
					value = selectedOption.attr("value") || "";
				}
			});
		} else if (tagName === "textarea") {
			// do nothing	
		}

		if (name in dataObj) {
			if (dataObj[name].constructor !== Array) dataObj[name] = [dataObj[name]];
			dataObj[name].push(value);
		} else dataObj[name] = value;
	});

	// Extract inputs.
	/*var inputs = form.find("input");
	inputs.each(function() {
		var input = $(this);
		var type = input.attr("type");
		if (type === "submit") {
			console.log(input);
			return;
		}
		var name = input.attr("name");
		var value = input.attr("value") || "";
		if ((type === "hidden") && (input.attr("id") != null)) {
			value = "";
		}

		if (name in dataObj) {
			if (dataObj[name].constructor !== Array) dataObj[name] = [dataObj[name]];
			dataObj[name].push(value);
		} else dataObj[name] = value;
	});*/

	// Extract selects.
	/*var selects = form.find("select");
	selects.each(function() {
		var select = $(this);
		var name = select.attr("name");
		var value = "";

		
		
		if (name in dataObj) {
			if (dataObj[name].constructor !== Array) dataObj[name] = [dataObj[name]];
			dataObj[name].push(value);
		} else dataObj[name] = value;
	});*/

	// Extract textareas.
	/*var textareas = form.find("textarea");
	textareas.each(function() {
		var textarea = $(this);
		var name = textarea.attr("name");
		var value = "";

		if (name in dataObj) {
			if (dataObj[name].constructor !== Array) dataObj[name] = [dataObj[name]];
			dataObj[name].push(value);
		} else dataObj[name] = value;
	});*/

	return {
		form: form,
		data: dataObj,
	};
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
	let {form, data} = formToObj($, "jsecLoginForm");

	// Validate the login form.
	data = Joi.validate(data, Joi.object().keys({
		jsecLogin: Joi.string().allow("").required(),
		jsecPassword: Joi.string().allow("").required(),
		jsecRememberMe: Joi.string().allow("").required(),
		// "t:formdata": Joi.string().required(),
	}));
	data.jsecLogin = username;
	data.jsecPassword = password;
	delete data.jsecRememberMe;
	// data.jsecRememberMe = "on";

	// Validate form action.
	let formAttrs = Joi.validate(form[0].attribs, Joi.object().keys({
		action: Joi.string().required(),
		method: Joi.string().valid("post").required(),
	}));

	// Login.
	response = await axiosNajdiSi.post(formAttrs.action, querystring.stringify(data));

	console.log(response);

	// TODO: extract some info from the site and return it
	// $ = cheerio.load(response.data);
	// let t = $("div#nav1 div.pull-right").text();
}

async function sendSms(axiosNajdiSi, recipientAreaCode, recipientPhoneNumber, text) {
	// Load send sms form.
	let response = await axiosNajdiSi.get("/najdi/sms");
	let $ = cheerio.load(response.data);
	let {form, data} = formToObj($, "smsForm");

	// Validate the send sms form.
	data = Joi.validate(data, Joi.object().keys({
		areaCodeRecipient: Joi.string().allow("").required(),
		phoneNumberRecipient: Joi.string().allow("").required(),
		text: Joi.string().allow("").required(),
	}));
	data.areaCodeRecipient = recipientAreaCode;
	data.phoneNumberRecipient = recipientPhoneNumber;
	data.text = text;

	data["t:submit"] = `["send","send"]`;
	data["t:zoneid"] = `smsZone`;

	// Validate form action.
	let formAttrs = Joi.validate(form[0].attribs, Joi.object().keys({
		action: Joi.string().required(),
		method: Joi.string().valid("post").required(),
	}));

	let urlData2 = querystring.stringify(data);
	// let urlData = "t%3Aac=sms&t%3Aformdata=T00M%2Bkp%2B3uSVFCZv5Nq5lzG4jD4%3D%3AH4sIAAAAAAAAADWOO27CUBBFBwRSpHR09NTPadKEBokKyUJIXsH4eWI%2F9H7MDL%2BGKpvIHihhWTRZQZwoqY6O7inu9QHj4wuYNW4b9yZdYrV7zR4tdck3xOadiSTI%2F2SEYiMMi8StwYy2I6OYSZTPr8YmJu%2FqniGnSFHFVPs6OJ1tOFkS%2BTURl%2BJn9TW93z6WQxiW8GS96%2BtVozApt3jAwmNsi0rZxXZewjN5Cn2wxkA7uMDglBVGP1f%2B8A1sBtdpyAAAAA%3D%3D&t%3Aformdata=ZN6ANCYaPfdsb8lI6IEbiTb%2Bq64%3D%3AH4sIAAAAAAAAAJ2OMU7DQBBFh4gUKB1SbhDaDRJxQ6o0qawIyeIA4%2FXE3mjtXWZmiWk4CidAXCIFHXfgALRUFBAhepLy%2F6%2Bn%2F54%2FYLjN4GqFm8pdSxNYbdLo0VITfEVs1kwkrfxNRsiTVc9JGLLAtcGItiGjGEmUHzJjA5N3pSlRyCzKnxKtLh35alKQpnhxuxu9j1%2B%2FBnCSw8iGTjn4FbakcJ5v8B6nHrt6Wii7rp73UeHs9zTndLzr4lDXGw6WRIpUtk7EhW73Us3Wn09vA4A%2Bbi%2FB%2FF9EqVe5g0cAhdN9OBzf08Nvq9OJUa8BAAA%3D&t%3Aformdata=4OrgzEOCo%2B590gDYL4VDJVO5rrI%3D%3AH4sIAAAAAAAAAKWPsU4CQRCGRxIqKo2%2BgbZLI40EIjGxIhfjxQeY3RvuluztrrNzgo2P4hMYX4LCznfwAWytLDhICK2Gdr7k%2F755%2B4buYgTDDOeFvUpVYDGNRIeGquAKYjVjolSnHVLIhCa0hIyNlrwkhkHgUmFEU5ESjJSEnwfKBCZntdKYSE10e0Qjt5ZccZ6TNPHiYdX7Ovv47cDRFHomeOHgMqxJ4GQ6xyfsO%2FRlPxe2vhwuo8DxRn7Tyu938sPbJ%2F9tv%2BNgKKW80bVNyQa%2Fei8uZz%2Bvnx2AZVxcw%2FjvQbEKnnxTa%2BJ90yO8AAicbmG2hft%2FD57frHfXxgbw3vcBAAA%3D&areaCodeRecipient=051&phoneNumberRecipient=477859&selectLru=&hidden=684908%3A684908%3A684687%3A684687%3A&t%3Aformdata=lDKp3cPStt3zrCjSRTiuFujIhtQ%3D%3AH4sIAAAAAAAAAJWPsUoDQRCGx0NDwE4rsbGw3sSgjTaCjcIRhOvSyGR3vNuwt3vO7CWxsRJ8Bt%2FBUsGXsvEJvLsgCjammuGfmX%2B%2B%2F%2BUDthYjGI5xZuypFIGjrmPlUFMRnCFWt0wkpXyPVGGNIS8M54FzhRXqglTEiiTy%2FYnSgcnZaVPLKnjyUdRld3F4zUGTSFZPSytig588Hewu9997CWyksK2DjxzcGEuKsJPOcI4Dhz4fZJGtz8%2BWVYTe6vl6wBq9JrcOcIcY%2FwI%2FZ597b6%2BPFwkkKfS1s832lbmDhy4AOSoboQ3QSS1wf%2FX85uinHS6OYfR%2FesE5Oa5FWs%2FNxqYV0kb41X4Bav43EsUBAAA%3D&t%3Aformdata=&name=&areaCodeLru=040&phoneNumberLru=954064&t%3Aformdata=&name_0=&areaCodeLru_0=051&phoneNumberLru_0=477859&text=asdf&t%3Asubmit=%5B%22send%22%2C%22send%22%5D&t%3Azoneid=smsZone";

	// Send sms.
	response = await axiosNajdiSi.post(formAttrs.action, querystring.stringify(data));

	// response = await axiosNajdiSi.post(formAttrs.action, urlData);
	// response = await axiosNajdiSi.request({
	// 	method: "post",
	// 	url: "http://www.najdi.si/najdi.shortcutplaceholder.freesmsshortcut.smsform", // formAttrs.action,
	// 	data: urlData2,
	// 	headers: {
	// 		// 'Accept':'*/*',
	// 		// 'Accept-Encoding':'gzip, deflate',
	// 		// 'Accept-Language':'en-US,en;q=0.9',
	// 		// 'Cache-Control':'no-cache',
	// 		// 'Connection':'keep-alive',
	// 		// 'Content-Length':1893,

	// 		// 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
	// 		// 'Cookie':'cc_cookie_accept_=cc_cookie_accept; MAdUTCID=a8709d87.77.234.138.182.1516724915050; najdi_poll_user_id=4b89f677550ecda99d5fe268e6bf9555; cc_cookie_action_=1; cc_cookie_advertising_=true; cc_cookie_analytics_=true; cc_cookie_social_=true; shiroSavedRequest=http://www.najdi.si/; JSESSIONID=ys81rpanne1yx5pn0g8428w8; hazelcast.sessionId=HZ17796F19E8914CE696C6B35F40136FE0',
	// 		// 'Host':'www.najdi.si',
	// 		// 'Origin':'http://www.najdi.si',
	// 		// 'Pragma':'no-cache',
	// 		// 'Referer':'http://www.najdi.si/najdi/sms',
	// 		// 'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/63.0.3239.84 Chrome/63.0.3239.84 Safari/537.36',
	// 		'X-Requested-With':'XMLHttpRequest',
	// 	},
	// });

	// response = await axiosNajdiSi.post(formAttrs.action, querystring.stringify(data));

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
