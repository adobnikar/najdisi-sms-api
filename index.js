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
		},
	});
	instance.cookieJar = cookieJar;

	// Add cookie jar support to axios.
	axiosCookieJarSupport(instance);

	return instance;
}

function inputsToObj(inputs) {
	inputs = Array.from(inputs);
	let dataObj = {};
	for (let input of inputs) {
		let type = input.attribs.type;
		if (type === "submit") continue;
		let name = input.attribs.name;
		let value = input.attribs.value || "";
		dataObj[name] = value;
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
	let inputs = form.find("input");
	let loginData = inputsToObj(inputs);

	// Validate the login form.
	loginData = Joi.validate(loginData, Joi.object().keys({
		jsecLogin: Joi.string().allow("").required(),
		jsecPassword: Joi.string().allow("").required(),
		jsecRememberMe: Joi.string().allow("").required(),
		"t:formdata": Joi.string().required(),
	}));
	loginData.jsecLogin = username;
	loginData.jsecPassword = password;
	loginData.jsecRememberMe = "on";

	// Validate form action.
	let formAttrs = Joi.validate(form[0].attribs, Joi.object().keys({
		action: Joi.string().required(),
		method: Joi.string().valid("post").required(),
	}));

	// Login.
	response = await axiosNajdiSi.post(formAttrs.action, querystring.stringify(loginData));

	// TODO: extract some info from the site and return it
	// $ = cheerio.load(response.data);
	// let t = $("div#nav1 div.pull-right").text();
}

async function sendSms(axiosNajdiSi, recipientPhoneNumber, text) {

}

async function asyncWrapper() {
	let axiosNajdiSi = createAxios();
	await login(axiosNajdiSi, process.env.NAJDISI_USER, process.env.NAJDISI_PASSWORD);
	

	// Load send sms form.
	let response = await axiosNajdiSi.get("/najdi/sms");
	let $ = cheerio.load(response.data);
	let loginForm = $("form#jsecLoginForm");
	http://www.najdi.si/najdi/sms


	// TODO: check if login succeded.
	// Exmaple get the username or check if cookie was set
	//


	
	
	console.log(response);
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
