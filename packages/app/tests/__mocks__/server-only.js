/**
 * Mock for 'server-only' module used in tests
 * 
 * The real 'server-only' module throws an error when imported in client code.
 * In tests, we just export an empty object.
 */

module.exports = {};

