'use strict';
// ECMAScript 5

/**
 * @exports parser
 */
var parser = module.exports;


/**
 * This implementation relies heavily on regular expressions because they are
 * fast in V8: A lot faster than a previous implementation with a small state
 * machine that parsed the input string in a single scan. (Seems like regexes
 * can be compiled to machine code much more efficiently.)
 *
 * However, if speed is an issue, you should use a compiled parser like e.g.
 * [Raptor] [1] or [nxparser] [2]. Having a parser for Node.js is still great
 * for building tools etc.
 *
 *
 * Objects / typing: I decided to use plain JavaScript objects with a `type`
 * property for tokens instead of creating a constructor (class) for every token
 * type.
 *
 * The N-Triples grammar can be found at:
 * http://www.w3.org/TR/n-triples/#n-triples-grammar
 *
 *
 * [1]: http://librdf.org/raptor/
 * [2]: https://code.google.com/p/nxparser/
 */



var isCommentedOut = (function () {

	// Matches a comment (`#`) only at the beginning of a line
	var regexLeadingComment = /^\s*?#/;

	return function (text) {
		return regexLeadingComment.test(text) === true;
	};
})();



/**
 * Internal function to parse a triple or a quad.
 *
 * (Parsing is trivial: Just verify the number of tokens and create an object
 * from the tokens.)
 *
 *
 * @param {String} type  `quad` or `triple`
 *
 * @param {String|Array}  A string to parse or an array of token objects
 *                        (parsed).
 *
 * @param {Object}  [options]  Same options as `#tokenize`
 *
 * @return {Object|String}
 */
var _parse = (function () {


	return function (type, input, options) {

		// Tokenize
		var tokens;
		var tokenObjectsPassed = Array.isArray(input);

		if (tokenObjectsPassed) {
			tokens = input;
		}
		else {
			if (isCommentedOut(input)) {
				return null;
			}

			tokens = parser.tokenize(input, options);
		}


		// Parse tokens

		var expectedLength = type === 'quad' ? 5 : 4;
		// includes "end of statement"

		if (tokens.length !== expectedLength) {
			return null;
		}

		var result = {
			subject:   tokens[0],
			predicate: tokens[1],
			object:    tokens[2]
		};

		if (type === 'quad') {
			result.graphLabel = tokens[3];
		}

		return result;
	};
})();



// ---- Unicode handling -------------------------------------------------------

/**
 * Removes all Unicode escaping from a string.
 *
 * @return {String}
 */
var unescapeUnicode = (function () {

	// Matches `\Uxxxxxxxx` or `\uxxxx` (including the prefix)
	var regex = new RegExp('\\\\U[0-9a-fA-F]{8}|\\\\u[0-9a-fA-F]{4}', 'g');
	// (Don't use a regex literal here, because there were issues with
	// `String.prototype.replace` and regex flags in V8.)

	return function (string) {
		return string.replace(regex, decodeUcharToken);
	};
})();



/**
 * Unescapes all occurrences of special characters (tabs, backspace, etc.,
 * `ECHAR` tokens in the grammars) in a string.
 *
 *     ECHAR ::= '\' [tbnrf"'\]
 *
 * @param {String}
 * @return {String}
 */
var unescapeSpecialCharacters = (function() {

	var regex = /\\([tbnrf"'\\])/g;

	return function (literalString) {
		return literalString.replace(regex, '$1');
	};
})();



/**
 * Decodes a single Unicode escape sequence (a UCHAR token in the N-Triples
 * grammar).
 *
 *     UCHAR ::= '\u' HEX HEX HEX HEX | '\U' HEX HEX HEX HEX HEX HEX HEX HEX
 *
 * @param  {String} escapeString    Escaped Unicode string, including the escape
 *                                  sequence (`\U` or `\u`).
 */
function decodeUcharToken(escapeString) {

	// This assumes ECMAScript 5, which can't handle Unicode codepoints outside
	// the Basic Multilingual Plane (BMP) well.
	//
	// Workaround: Split "8-digit codepoints" (U+xxxxxxxx) into surrogate pairs.
	//
	// Still has some issues, like resulting in a "wrong" string length. See
	// `https://mathiasbynens.be/notes/javascript-unicode`
	//
	// This will be fixed in ECMAScript 6.


	if (escapeString[1] === 'u') {
		// `\u`

		// (Works with BMP codepoints only, U+0000 - U+FFFF.)
		return String.fromCharCode(Number('0x' + escapeString.slice(2)));
	}
	else {
		// `\U`

		// Workaround: Split codepoint into surrogate pair, then use
		// `String.fromCharCode`.
		var codepoint = parseInt(escapeString.slice(2), 16);

		if (codepoint <= 0x0000ffff) {
			// Is only padded, return codepoint from lower half.
			return String.fromCharCode(
				Number('0x' + escapeString.slice(6, 10))
			);
		}

		// Convert codepoint to a surrogate pair
		var h = Math.floor((codepoint - 0x10000) / 0x400) + 0xD800;
		var l = (codepoint - 0x10000) % 0x400 + 0xDC00;

		// Now get two characters from BLP codepoints
		return String.fromCharCode(h, l);
	}
	// (Other cases filtered by regex in `unescapeUnicode`.)
}




// -----------------------------------------------------------------------------
//      Exports
// -----------------------------------------------------------------------------


/**
 * Tokenizes a string.
 *
 * @param {String}  string   The String to tokenize.
 *
 * @param {Boolean} parsed   Set to `true` to return a parsed (plain JavaScript)
 *                           object.
 *
 * @return {Array}   Array of tokens, either strings or token objects, if
 *                   `parsed` is set to `true`.
 *
 * @param {Object}  [options]
 * @param {Boolean} [options.asStrings=false]
 * @param {Boolean} [options.includeRaw=false]  (If `asStrings` is `false`.)
 * @param {Boolean} [options.unescapeUnicode=true]
 *
 * @see #parseToken
 */
parser.tokenize = (function () {

	// This thing does most of this module's work. See `regex.md` for details.
	var splitTokensRegex = /((?:"[^"\\]*(?:\\.[^"\\]*)*"(?:@\w+(?:-\w+)?|\^\^<[^>]+>)?)|<[^>]+>|\_\:\w+|\.)/g;

	return function (string, options) {

		var tokens = string.match(splitTokensRegex);

		if (!tokens) {
			return null;
		}

		if (!(options && options.asStrings === true)) {
			// tokens = tokens.map(parser.parseToken);
			for (var i = 0; i < tokens.length; i++) {
				tokens[i] = parser.parseToken(tokens[i], options);
			}
		}

		return tokens;
	};

})();



/**
 * Transforms a raw "N-x element" string (part of a triple, quad, …) into a
 * token object (plain JavaScript object).
 *
 * Properties:
 *
 * - `type`: `iri`, `literal`, `blankNode` or `endOfStatement`
 * - `value` (without syntactic elements like brackets, quotes or `_:` prefixes)
 *
 * Optional additional properties for literals:
 *
 * - `language`:    The language tag (`…@language`)
 * - `datatypeIri`: The data type IRI (`…^^<IRI>`)
 *
 *
 * @param {String}  tokenString   Token string to parse.
 *
 * @param {Object}  [options]
 *
 * @param {Boolean} [options.includeRaw=false]
 *                  Keep the string input as property `valueRaw`
 *
 * @param {Boolean} [options.unescapeUnicode=true]
 *                  Decode escaped Unicode in literals.
 */
parser.parseToken = (function() {

	// Regex used to test for a literal suffix
	var regexLiteralSuffix = /\"(.*?)\"((?:@.*)|(?:\^\^<.*>))/;


	return function (tokenString, options) {
		var result = {};

		// Remove leading whitespace, if needed
		if (tokenString[0] === ' ') {
			tokenString = tokenString.trim();
		}

		if (options && options.includeRaw) {
			// Also keep the unprocessed string
			result.valueRaw = tokenString;
		}

		var skipUnicodeUnescaping = options &&
		                            options.unescapeUnicode === false;


		// Determine type (can be decided by looking at the first character) and
		// extract value
		switch (tokenString[0]) {
			case '<':
				result.type = 'iri';

				result.value = tokenString.slice(1, tokenString.length - 1);

				// Unescape: Only Unicode escapes (UCHAR) are allowed in IRIREF
				//           tokens, not special character escapes (ECHAR)

				if (!skipUnicodeUnescaping) {
					result.value = unescapeUnicode(result.value);
				}

				break;


			case '"':
				result.type = 'literal';

				// Check if literal has a suffix: Language tag or data type IRI

				var matches = tokenString.match(regexLiteralSuffix);
				if (matches) {
					result.value  = matches[1];

					var suffix = matches[2];
					if (suffix[0] === '@') {
						result.language = suffix.slice(1);
					} else {
						// slice: ^^<…>
						result.datatypeIri = suffix.slice(3, suffix.length - 1);
					}
				} else {
					result.value = tokenString.slice(1, tokenString.length - 1);
				}

				// Unescape

				result.value = unescapeSpecialCharacters(result.value);

				if (!skipUnicodeUnescaping) {
					result.value = unescapeUnicode(result.value);
				}

				break;


			case '_':
				result.type = 'blankNode';

				result.value = tokenString.slice(2);  // Remove `_:`
				break;


			case '.':
				result.type = 'endOfStatement';

				result.value = tokenString;
				break;
		}

		return result;
	};
})();



/**
 * @return {Array}   The set of token types as a string array.
 */
parser.getTokenTypes = (function () {

	var tokenTypes = [ 'iri', 'literal', 'blankNode', 'endOfStatement' ];
	Object.freeze(tokenTypes);

	return function () {
		return tokenTypes;
	};
})();



/**
 * Parses a triple from a string.
 *
 * @param {String}  input
 *
 * @param {Object}  [options]
 * @param {Boolean} [options.asStrings=false]
 * @param {Boolean} [options.includeRaw=false]  (Ignored if `parsed` is `false`)
 * @param {Boolean} [options.unescapeUnicode=true]
 *
 * @return {Object|null}
 */
parser.parseTriple = function (input, options) {

	return _parse('triple', input, options);
};



/**
 * Parses a quad from a string.
 *
 * @param {String}  input
 *
 * @param {Object}  [options]
 * @param {Boolean} [options.asStrings=false]
 * @param {Boolean} [options.includeRaw=false]  (Ignored if `parsed` is `false`)
 * @param {Boolean} [options.unescapeUnicode=true]
 *
 * @return {Object|null}
 */
parser.parseQuad = function (input, options) {

	return _parse('quad', input, options);
};
