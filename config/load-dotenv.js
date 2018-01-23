"use strict";

const path = require("path");

// Load .env configuration.
require("dotenv").load({
	path: path.resolve(__dirname, "./.env"),
});

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {};
