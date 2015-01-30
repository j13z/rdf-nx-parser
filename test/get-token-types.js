'use strict';
/* global describe, it */
/* exported should */

// var should = require('chai').should();
var expect = require('chai').expect;
var parser = require('../');


describe('getTokenTypes', function () {

	it('should return an array of token types', function () {
		var types = parser.getTokenTypes();
		expect(types).to.contain('iri');
		expect(types).to.contain('blankNode');
		expect(types).to.contain('literal');
		expect(types).to.contain('endOfStatement');
	});
});
