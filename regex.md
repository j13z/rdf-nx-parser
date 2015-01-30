# Regular Expression Notes

*Explains the regular expressions that this parser uses for tokenization of N-Triples / N-Quads.*

These regular expression have been tested mainly with V8’s regular expression engine (but generally should work with other engines as well). Credits go to [regex101.com](https://regex101.com/#javascript), which is a great tool for testing regular expressions.


## IRI match

That’s simple: `(<[^>]+>)` or `<([^>]+)>` (with or without angle brackets)


## Tokenization regex

Matches **IRIs** (including `<`, `>`), **literals** (including suffix, if present), **blank node labels** (including the `_:` prefix) and **end of statements** (`.`):

    ((?:{{literal}}(?:@\w+(?:-\w+)?|\^\^<[^>]+>)?)|<[^>]+>|\_\:\w+|\.)

where `{{literal}}` is used as a placeholder for a literal match expression, explained below.

A token's type can then be easily determined by looking at the first character of a match.

Literal tokens include the suffix (`@…` language tag or `^^…` type), if present. This makes more sense here, as is makes reading the matches easier (since they have no type attached). Could be split by a second regex if needed.

(Language tag EBNF: `LANGTAG ::= '@' [a-zA-Z]+ ('-' [a-zA-Z0-9]+)*`)


## Literals

Literal matching is complicated a bit because the quote character (`"`) that delimit literals may occur in the literal itself, if preceded with an escape character (`\`).

Possibilities (taken from a [stackoverflow answer](http://stackoverflow.com/a/5696141), thanks, *ridgerunner*):

- `"([^"\\]|\\.)*"`, less efficient
- `"[^"\\]*(?:\\.[^"\\]*)*"`: “Implements Friedl’s: ‘unrolling-the-loop’ technique. Does not require possessive or atomic groups (i.e. this can be used in Javascript and other less-featured regex engines.)”



## “Bonus”: Matching quads

The following describes how to match a full N-Quad with these regexes. This is however **not used by this parser**, which only uses the tokenization regex and then further processes the resulting token strings.


Regex to match a token:

    ((?:"[^"\\]*(?:\\.[^"\\]*)*"(?:@\w+|\^\^<[^>]+>)?)|<[^>]+>|\_\:\w+|\.)

Quad match, restricts token per quad position, written more readable with `#` comments here:

    \s*
    (<[^>]+>|\_\:\w+)    # IRI: <…>, or blank node: _:…
    \s*
    (<[^>]+>|\_\:\w+)    # IRI or blank node
    \s*
    # Literal with optional language tag _or_ type IRI
    ((?:"[^"\\]*(?:\\.[^"\\]*)*"(?:@\w+|\^\^<[^>]+>)?)|<[^>]+>)
    \s*
    (<[^>]+>)            # Graph label IRI
    \s*
    \.                   # End of statement, literal dot
    \s*

yields:

    \s*(<[^>]+>|\_\:\w+)\s*(<[^>]+>|\_\:\w+)\s*((?:"[^"\\]*(?:\\.[^"\\]*)*"(?:@\w+|\^\^<[^>]+>)?)|<[^>]+>)\s*(<[^>]+>)\s*\.\s*

_Yay._

And here’s a **use case**: Splitting N-Quads into N-Triples and graph labels:

This only changes the parentheses for matches / makes groups non-capturing:

    (\s*(?:<[^>]+>|\_\:\w+)\s*(?:<[^>]+>|\_\:\w+)\s*(?:"[^"\\]*(?:\\.[^"\\]*)*"(?:@\w+|\^\^<[^>]+>)?|<[^>]+>))\s*(<[^>]+>)\s*\.\s*


Don't forget to set the regex engine's _global_ (`g`) modifier where needed.
