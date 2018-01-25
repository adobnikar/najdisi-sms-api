# Najdi.si SMS API

## Requirements

- requires **node v7.6.0** or higher for ES2015 and async function support,
- you need to create an account on the [Najdi.si](https://www.najdi.si/) web portal.

## Installation

Run the npm install command:
```bash
npm i --save najdisi-sms-api
```

## Quick send SMS example

```javascript
const NajdisiSmsApi = require("najdisi-sms-api");

async function fn() {
	await NajdisiSmsApi.sendSmsOnce(username, password, areaCodeRecipient, phoneNumberRecipient, smsText);
}
fn();
```

## Quick status example

```javascript
const NajdisiSmsApi = require("najdisi-sms-api");

async function fn() {
	let status = await NajdisiSmsApi.getStatusOnce(username, password);
	console.log("status", status);
}
fn();

// Prints:
// {
// 		"isLoggedIn": true,
// 		"name": "Name Surname",
// 		"smsCount": 7,
// 		"maxSmsCount": 40,
// 		"isSenderSet": true,
// 		"phoneNumberSender": "010 / 123 - 456"
// }
```

## Perform more operations with single login

```javascript
const NajdisiSmsApi = require("najdisi-sms-api");

async function fn() {
	// Create an API instance.
	let api = new NajdisiSmsApi();

	// Log in.
	await api.login(username, password);

	// Check status.
	let status = await api.getStatus();

	// Send an SMS.
	await api.sendSms(areaCodeRecipient, phoneNumberRecipient, smsText);

	// Send another SMS.
	await api.sendSms(areaCodeRecipient, phoneNumberRecipient, smsText);

	// ...
}
fn();
```

## Instance methods

- **async login(username, password)**
    - @param {string} username - Najdi.si account username.
    - @param {string} password - Najdi.si account password.

- **async getStatus()**
    - @returns {object} - Status object.

	```javascript
	// Example status object:
	{
		"isLoggedIn": true,
		"name": "Name Surname",
		"smsCount": 7,
		"maxSmsCount": 40,
		"isSenderSet": true,
		"phoneNumberSender": "010 / 123 - 456"
	};
	```

- **async sendSms(areaCodeRecipient, phoneNumberRecipient, smsText)**
    - @param {string} areaCodeRecipient - Must have length of 3. Examples: "030", "070", "041", ...
    - @param {string} phoneNumberRecipient - Must have length of 6. Example: "123456", ...
	- @param {string} smsText - SMS text that you want to send. Max 160 characters.

## Static methods

- **static async getStatusOnce(username, password)**
    - @param {string} username - Najdi.si account username.
    - @param {string} password - Najdi.si account password.
	- @returns {object} - Status object.

	```javascript
	// Example status object:
	{
		"isLoggedIn": true,
		"name": "Name Surname",
		"smsCount": 7,
		"maxSmsCount": 40,
		"isSenderSet": true,
		"phoneNumberSender": "010 / 123 - 456"
	};
	```

- **static async sendSmsOnce(username, password, areaCodeRecipient, phoneNumberRecipient, smsText)**
	- @param {string} username - Najdi.si account username.
	- @param {string} password - Najdi.si account password.
    - @param {string} areaCodeRecipient - Must have length of 3. Examples: "030", "070", "041", ...
    - @param {string} phoneNumberRecipient - Must have length of 6. Example: "123456", ...
	- @param {string} smsText - SMS text that you want to send. Max 160 characters.