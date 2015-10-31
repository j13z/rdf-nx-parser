'use strict';
/* global describe, it */
/* exported should */

var should = require('chai').should();
var expect = require('chai').expect;
var parser = require('../');



function testCommon(type) {

	var isQuad = type === 'quad';
	var methodName = 'parse' + type[0].toUpperCase() + type.slice(1);
	var parse = parser[methodName];
	var graphLabel = isQuad ? '<http://example.com/p>' : '';


	it('should parse a valid ' + type + ' string', function () {

		var result = parse(
			' _:s  <http://example.com/p>    "o"@en	' + graphLabel + '	.    '
		);

		result.subject.type.should.equal('blankNode');
		result.subject.value.should.equal('s');

		result.predicate.type.should.equal('iri');
		result.predicate.value.should.equal('http://example.com/p');

		result.object.type.should.equal('literal');
		result.object.value.should.equal('o');
		result.object.language.should.equal('en');

		if (isQuad) {
			result.graphLabel.type.should.equal('iri');
			result.graphLabel.value.should.equal('http://example.com/p');
		}
	});


	it('should parse a valid ' + type + ' token array', function () {

		var input = ' _:s  <http://example.com/p>    "o"@en	' + graphLabel + '	.    ';
		var tokens = parser.tokenize(input);
		var result = parse(tokens);

		result.subject.type.should.equal('blankNode');
		result.subject.value.should.equal('s');

		result.predicate.type.should.equal('iri');
		result.predicate.value.should.equal('http://example.com/p');

		result.object.type.should.equal('literal');
		result.object.value.should.equal('o');
		result.object.language.should.equal('en');

		if (isQuad) {
			result.graphLabel.type.should.equal('iri');
			result.graphLabel.value.should.equal('http://example.com/p');
		}
	});


	it('should not parse commented lines', function () {
		var result = parse(
			'# <s> <p> <o> ' + graphLabel + ' .'
		);

		expect(result).to.equal(null);
	});


	it('should ignore trailing comments', function () {

		var result = parse(
			'<http://example.com/s> <http://example.com/p> "o"^^<http://example.com/dt> ' + graphLabel + ' . # comment'
		);

		result.subject.type.should.equal('iri');
		result.subject.value.should.equal('http://example.com/s');

		result.predicate.type.should.equal('iri');
		result.predicate.value.should.equal('http://example.com/p');

		result.object.type.should.equal('literal');
		result.object.value.should.equal('o');
		result.object.datatypeIri.should.equal('http://example.com/dt');

		if (isQuad) {
			result.graphLabel.type.should.equal('iri');
			result.graphLabel.value.should.equal('http://example.com/p');
		}
	});
}


describe('parseTriple', function () {

	testCommon('triple');

	it('should not parse invalid triples', function () {

		var result = parser.parseTriple(
			'<http://example.com/s> <http://example.com/p> .'
		);
		expect(result).to.equal(null);

		result = parser.parseTriple(
			'<http://example.com/s> <http://example.com/p> <http://example.com/o> <http://example.com/x> .'
		);
		expect(result).to.equal(null);
	});
});



describe('parseQuad', function () {

	testCommon('quad');


	it('should not parse invalid quads', function () {

		var result = parser.parseQuad(
			'<http://example.com/s> <http://example.com/p> <http://example.com/o> .'
		);
		expect(result).to.equal(null);

		result = parser.parseQuad(
			'<http://example.com/s> <http://example.com/p> <http://example.com/o> <http://example.com/g> <http://example.com/x> .'
		);
		expect(result).to.equal(null);
	});
});
