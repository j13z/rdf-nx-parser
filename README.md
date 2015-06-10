# rdf-nx-parser

A non-validating tokenizer and parser for the RDF N-Triples and N-Quads serializations (or any “N-x”).

Provides parsing of N-Triples and N-Quads from strings, or tokenizing any “N-x” string.

![](https://badge.fury.io/js/rdf-nx-parser.svg) &ensp; ![](https://travis-ci.org/j13z/rdf-nx-parser.svg?branch=master)


## Why?

There are enough parsers already that are faster (see last section), but having a parser for Node.js is useful for building [smaller tools](https://github.com/j13z/nxfilter).


## Usage

`npm install --save rdf-nx-parser`

The module exports a parser object:

```javascript
var parser = require('rdf-nx-parser');
```


### Parsing

Use `parseTriple()` to parse an N-Triples statement, `parseQuads()`  for N-Quads. Both return an objects, or `null` if the input can't be parsed.

```javascript
var quad = parser.parseQuad(
    '_:foo ' + 
    '<http://example.com/bar> ' + 
    '"\\u9B3C\\u8ECA"@jp ' + 
    '<http://example.com/baz> .'
);

console.log(JSON.stringify(quad, null, 4));
```

```json
{
    "subject": {
        "type": "blankNode",
        "value": "foo"
    },
    "predicate": {
        "type": "iri",
        "value": "http://example.com/bar"
    },
    "object": {
        "type": "literal",
        "value": "鬼車",
        "language": "jp"
    },
    "graphLabel": {
        "type": "iri",
        "value": "http://example.com/baz"
    }
}
```

Literal objects can have an additional `language` or `datatypeIri` property.

The parser does not verify that the data adheres to the [grammar] [1]. It will instead happily parse anything as good as it can:

```javascript
> parser.parseQuad('<foo> <:///baz>     "bar"  <$!#]&> .');

{ subject: { type: 'iri', value: 'foo' },
  predicate: { type: 'iri', value: ':///baz' },
  object: { type: 'literal', value: 'bar' },
  graphLabel: { type: 'iri', value: '$!#]&' } }
```

You can optionally pass an options object to these methods as a second parameter, shown with the defaults here:

```javascript
parser.parseTriple(input, {
    // Set to `true` to get unparsed strings as `value`
    //properties
    asString: false,  
    
    // Include the unparsed token as `valueRaw` property
    // when returning objects
    includeRaw: false,

    // Decode unicode escapes, `\uxxxx` and `Uxxxxxxxx`
    // (but not percent encoding or punycode)
    unescapeUnicode: true
});
```

Parsing a whole file of N-Triples / N-Quads lines can easily be done e. g. with Node's `readline` module, see the [example](example/example.js).

[1]: http://www.w3.org/TR/n-triples/#n-triples-grammar


### Tokenization

An arbitrary number of “N-x” tokens can be extracted from a string into an array of token objects with the `tokenize()` method:

```javavscript
> parser.tokenize(
    '<foo> _:bar . "123"^^<http://example.com/int> ' +
    '"\u0068\u0065\u006C\u006C\u006F"@en-US . .'
);

[ { type: 'iri', value: 'foo' },
  { type: 'blankNode', value: 'bar' },
  { type: 'endOfStatement', value: '.' },
  { type: 'literal',
    value: '123',
    datatypeIri: 'http://example.com/int' },
  { type: 'literal',
    value: 'hello',
    language: 'en-US' },
  { type: 'endOfStatement', value: '.' },
  { type: 'endOfStatement', value: '.' } ]
```

Each token has at least a `type` and a `value` property. There are four token types: `iri`, `literal`, `blankNode` and `endOfStatement` (can be listed with the `getTokenTypes()` method).



## Implementation

The implementation is based on regular expressions (to split the input into tokens) – they are pretty fast on V8. This regex-based implementation is faster than a previous simple state machine (that read the input in one scan). Seems like regexes can be compiled more effectively into machine code.


## Tests

Run with: `npm test` ([mocha](http://mochajs.org/), [Chai](http://chaijs.com/), [Istanbul](https://github.com/gotwarlost/istanbul))




## Similar projects

- [Raptor library](http://librdf.org/raptor/), C
- [nxparser](https://code.google.com/p/nxparser/), Java
