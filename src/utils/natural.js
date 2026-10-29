// Import only the parts of `natural` we use. The package root also loads a sentiment module
// that depends on an ES-module-only package, which breaks under Jest and older Node versions.
const { WordTokenizer } = require('natural/lib/natural/tokenizers/regexp_tokenizer');
const PorterStemmer = require('natural/lib/natural/stemmers/porter_stemmer');
const NounInflector = require('natural/lib/natural/inflectors/noun_inflector');
const { words: stopwords } = require('natural/lib/natural/util/stopwords');

module.exports = { WordTokenizer, PorterStemmer, NounInflector, stopwords };
