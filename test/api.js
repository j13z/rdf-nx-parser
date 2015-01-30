'use strict';
/* global describe, it */
/* exported should */

/**
 * Tests for the module API.
 *
 * Ensures options etc. work as expected.
 */


var should = require('chai').should();
var expect = require('chai').expect;
var parser = require('../');


describe('API', function () {

	// Just check that all methods are present and then only test the high-level
	// parse methods, which rely on the low-level function APIs

	var expectedMethods = [
		'parseToken',
		'tokenize',
		'getTokenTypes',
		'parseQuad',
		'parseTriple'
	];

	expectedMethods.forEach(function (method) {
		it('should have a method `' + method + '`', function () {
			expect(parser).to.have.property(method);
		});
	});


	// --- `parseTriple` and `parseQuad` (have the same API) -------------------

	/**
	 * 🍺
	 * BEER MUG
	 * Unicode: U+1F37A (U+D83C U+DF7A), UTF-8: F0 9F 8D BA
	 */

	parseApiTest('parseTriple', '_:a <b> "\\U0001F37A" .');
	parseApiTest('parseQuad',   '_:a <b> "\\U0001F37A" <d>.');
});




function parseApiTest(methodName, input) {

	describe(methodName, function () {
		var isQuad = methodName === 'parseQuad';
		var parse = parser[methodName];

		// Default options
		describe('default options', function () {
			var result = parse(input);

			it('should parse objects by default', function () {
				expect(result.subject   ).to.be.an('object');
				expect(result.predicate ).to.be.an('object');
				expect(result.object    ).to.be.an('object');

				if (isQuad) {
					expect(result.graphLabel).to.be.an('object');
				}
			});

			it('should not include raw strings by default', function () {
				expect(result.subject   ).not.to.have.property('valueRaw');
				expect(result.predicate ).not.to.have.property('valueRaw');
				expect(result.object    ).not.to.have.property('valueRaw');

				if (isQuad) {
					expect(result.graphLabel).not.to.have.property('valueRaw');
				}
			});

			it('should unescape Unicode in literals by default', function () {
				result.object.value.should.equal('\uD83C\uDF7A');
			});
		});


		describe('options', function () {

			it('should allow getting parsed tokens as strings', function () {
				var result = parse(input, {
					asStrings: true
				});

				expect(result.subject).to.be.a('string');
				expect(result.object).to.be.a('string');
			});

			it('should allow to also get raw token strings', function () {
				var result = parse(input, {
					includeRaw: true
				});

				result.subject.valueRaw.should.equal('_:a');
				result.predicate.valueRaw.should.equal('<b>');
				result.object.valueRaw.should.equal('"\\U0001F37A"');

				if (isQuad) {
					result.graphLabel.valueRaw.should.equal('<d>');
				}
			});

			it('should allow to disable literal unescaping', function () {
				var result = parse(input, {
					unescapeUnicode: false
				});

				// Literal quotes stripped, but still a Unicode escape sequence
				result.object.value.should.equal('\\U0001F37A');
			});
		});
	});
}
