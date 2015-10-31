'use strict';
/* global describe, it */
/* exported should */

var should = require('chai').should();
var expect = require('chai').expect;
var parser = require('../');



describe('tokenize', function () {

	it('should work with minimal whitespace, parsed as objects', function () {

		var tokens = parser.tokenize('_:s<https://example/p>"o"@en-US.');

		tokens.length.should.equal(4);
		tokens[0].should.be.an('object');

		tokens[0].type.should.equal('blankNode');
		tokens[0].value.should.equal('s');

		tokens[1].type.should.equal('iri');
		tokens[1].value.should.equal('https://example/p');

		tokens[2].type.should.equal('literal');
		tokens[2].value.should.equal('o');
		tokens[2].language.should.equal('en-US');

		tokens[3].type.should.equal('endOfStatement');
		tokens[3].value.should.equal('.');
	});


	it('should work with minimal whitespace, parsed as strings', function () {

		var tokens = parser.tokenize('_:s<https://example/p>"o"@en-US.', {
			asStrings: true
		});

		tokens.length.should.equal(4);
		tokens[0].should.equal('_:s');
		tokens[1].should.equal('<https://example/p>');
		tokens[2].should.equal('"o"@en-US');
		tokens[3].should.equal('.');
	});


	it('should allow to skip unescaping', function () {

		var input = '"\\U0000221E" <http://example.com/\u0068\u0065\u006C\u006C\u006F>';

		var tokens = parser.tokenize(input, {
			unescapeUnicode: false
		});

		tokens.length.should.equal(2);

		tokens[0].type.should.equal('literal');
		tokens[0].value.should.equal('\\U0000221E');

		tokens[1].type.should.equal('iri');
		tokens[1].value.should.equal('http://example.com/hello');
	});


	it('should allow to get tokens as strings', function () {

		var tokens = parser.tokenize('_:s <http://example.com/p> "o" . "x" ', {
			asStrings: true
		});

		tokens.length.should.equal(5);

		tokens.forEach(function (token) {
			token.should.be.a('string');
		});
	});


	it('should return `null` for empty input', function () {

		var result = parser.tokenize('');
		expect(result).to.equal(null);
	});
});



// --- Processing of single tokens from strings --------------------------------


function testTokenParsing(parseFunction) {

	// Describe for all types: IRIs, blank nodes, literals, end of statements

	describe('IRIs', function () {

		it('should parse valid IRIs', function () {

			var token = parseFunction('<https://example.com>');

			token.type.should.equal('iri');
			token.value.should.be.a('string');
			token.value.should.equal('https://example.com');
		});


		it('should unescape Unicode in IRIs', function () {
			// STRING_LITERAL_QUOTE and IRIREF tokens of the grammar may
			// include UCHAR Unicode escape sequences.
			//
			// IRIREF tokens may however not contain other special character
			// escapes (ECHAR):
			//
			// IRIREF ::= '<' ([^#x00-#x20<>"{}|^`\] | UCHAR)* '>'

			var token = parseFunction('<http://example.com/\\u0073>');
			token.type.should.equal('iri');
			token.value.should.be.a('string');
			token.value.should.equal('http://example.com/s');

			// The beer mug emoji, once again
			token = parseFunction('<http://example.com/\\U0001F37A>');
			token.type.should.equal('iri');
			token.value.should.be.a('string');
			token.value.should.equal('http://example.com/\uD83C\uDF7A');
		});
	});


	describe('blank nodes', function () {

		it('should parse blank nodes', function () {

			var token = parseFunction('_:bnode1');

			token.type.should.equal('blankNode');
			token.value.should.be.a('string');
			token.value.should.equal('bnode1');
		});
	});


	describe('literals', function () {

		// Important here: An escaped quote inside a JavaScript string literal
		//                 will be 'foo \\" bar' and not 'foo \" bar'.

		it('should handle escaped quotes inside of literals', function () {

			var token = parseFunction('"foo \\"bar\\" baz"');

			token.type.should.equal('literal');
			token.value.should.equal('foo "bar" baz');
		});


		it('should handle empty literals', function () {

			var token = parseFunction('""');

			token.type.should.equal('literal');
			token.value.should.equal('');
		});


		it('should parse language tags', function () {

			var token = parseFunction('"Cheers"@en-UK');

			token.value.should.equal('Cheers');
			token.type.should.equal('literal');
			token.language.should.equal('en-UK');
		});


		it('should parse language tags and Unicode escapes', function () {

			var token = parseFunction('"\u0068\u0065\u006C\u006C\u006F"@en-US');

			token.value.should.equal('hello');
			token.type.should.equal('literal');
			token.language.should.equal('en-US');
		});


		it('should parse datatype IRIs', function () {

			var token = parseFunction('"123"^^<http://www.w3.org/2001/XMLSchema#integer>');

			token.value.should.be.a('string');
			token.value.should.equal('123');
			token.type.should.equal('literal');
			token.datatypeIri.should.equal('http://www.w3.org/2001/XMLSchema#integer');
		});


		it('should unescape 4-digit Unicode codepoints', function () {
			/**
			 * ∞
			 * INFINITY
			 * Unicode: U+221E, UTF-8: E2 88 9E
			 */
			var token = parseFunction('"\\u221E \\u221E"');

			token.type.should.equal('literal');
			token.value.should.equal('\u221E \u221E');  // `∞ ∞`
		});


		it('should unescape 8-digit Unicode codepoints as a surrogate pair', function () {
			/**
			 * 🍺
			 * BEER MUG
			 * Unicode: U+1F37A (U+D83C U+DF7A), UTF-8: F0 9F 8D BA
			 */
			var token = parseFunction(
				'"A \\U0001F37A, and another \\U0001F37A"'
			);

			token.type.should.equal('literal');
			token.value.should.equal(
				'A \uD83C\uDF7A, and another \uD83C\uDF7A'    // surrogate pairs
			);
		});


		it('should handle escaped unprintable characters', function () {

			// From the W3C test suite: literal_all_controls.nt:
			var token = parseFunction(
				'"\\u0000\\u0001\\u0002\\u0003\\u0004\\u0005\\u0006\\u0007\\u0008\\t\\u000B\\u000C\\u000E\\u000F\\u0010\\u0011\\u0012\\u0013\\u0014\\u0015\\u0016\\u0017\\u0018\\u0019\\u001A\\u001B\\u001C\\u001D\\u001E\\u001F"'
			);

			token.value.length.should.equal(30);
		});


		it('should not be tripped up by @ characters', function () {

			var token = parseFunction('"johnnydoe@example.com"');

			token.value.should.equal('johnnydoe@example.com');
		});


		it('should not be tripped up by ^ characters', function () {

			var token = parseFunction('"Hello ^^"^^<http://example.com/some-type>');

			token.type.should.equal('literal');
			token.value.should.equal('Hello ^^');
			token.datatypeIri.should.equal('http://example.com/some-type');
		});


		it('should not be tripped up by <> brackets and escaped quotes', function () {

			var token = parseFunction('"This >>> is <not> a \\"IRI\\"."');

			token.type.should.equal('literal');
			token.value.should.equal('This >>> is <not> a "IRI".');
		});


		it('should not be tripped up by token delimiters', function () {

			// Should not interpret `<` as start of a IRI, amongst other things
			var token = parseFunction('"_: I \\"<3\\" kittens ^^@"');

			token.type.should.equal('literal');
			token.value.should.equal('_: I "<3" kittens ^^@');
		});


		it('should not be tripped up by punctuation characters', function () {

			// From W3C test suite: literal_all_punctuation.nt:
			var token = parseFunction('" !\\"#$%&():;<=>?@[]^_`{|}~"');

			token.type.should.equal('literal');
			token.value.should.equal(' !"#$%&():;<=>?@[]^_`{|}~');
		});


		it('should allow escaped quotes', function () {

			var token = parseFunction('"a \\"quote inside a \\"quote\\" …\\""');

			token.type.should.equal('literal');
			token.value.should.equal('a "quote inside a "quote" …"');
		});


		it('should not be affected by codepoint padding', function () {

			var value1 = parseFunction('"\\u9B3C"').value;
			var value2 = parseFunction('"\\U00009B3C"').value;

			value1.should.equal(value2);
		});
	});


	describe('end of statements', function () {

		it('should parse dots as end of statement, ignoring whitespace', function () {
			var token = parseFunction('    . ');

			token.type.should.equal('endOfStatement');
			token.value.should.be.a('string');
			token.value.should.equal('.');
		});
	});
}



describe('parseToken', function () {
	testTokenParsing(parser.parseToken);
});


// Make sure that `tokenize(…)[0]` gives the same result als `parseToken(…)`
//
// Difference between both: `tokenize` splits a string into tokens, `parseToken`
// only processes a token string that has already been split up (using a regex).
//
describe('tokenize, single token', function () {
	testTokenParsing(function (string) {
		return parser.tokenize(string)[0];
	});
});
