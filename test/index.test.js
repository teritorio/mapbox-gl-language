var test = require('tape');
var OpenMapTilesLanguage = require('../index');

function setLanguage(language, property, lang) {
  return language.adaptPropertyLanguageWithLegacySupport(/^name:/, property, language._getLanguageField(lang), []);
}

test('OpenMapTilesLanguage', (t) => {

  test('legacy format string', (t) => {
    var language = new OpenMapTilesLanguage();
    var layers = '{name:latin}{name:nonlatin}\n{ele} m';

    var esLayer = setLanguage(language, layers, 'es');
    console.log('esLayer: ', esLayer);
    t.deepEqual(esLayer, [
      'coalesce', ['concat', ['coalesce', ['get', 'name:es'],
        ['get', 'name:latin']
      ], '\n', ['get', 'ele'], ' m'],
      ['concat', ['get', 'name:latin'],
        ['get', 'name:nonlatin'], '\n', ['get', 'ele'], ' m'
      ],
      '{name:latin}{name:nonlatin}\n{ele} m'
    ], 'wrap legacy format string in coalesce');

    var mulLayer = setLanguage(language, esLayer, 'mul');
    console.log('mulLayer: ', mulLayer);
    t.deepEqual(mulLayer, '{name:latin}{name:nonlatin}\n{ele} m', 'unwrap egacy format string');
    t.end();
  });

  test('unwrapped get expression styles', (t) => {
    var language = new OpenMapTilesLanguage();
    var layers = ['get', 'name'];

    var esLayer = setLanguage(language, layers, 'es');
    console.log('esLayer: ', esLayer);
    t.deepEqual(esLayer, [
      'coalesce', ['get', 'name:es'],
      ['get', 'name']
    ], 'wrap unwrapped get expression in coalesce');
    t.end();
  });

  test('setLanguage for different text fields', (t) => {
    var language = new OpenMapTilesLanguage();
    var layers = [
      'coalesce', ['get', 'name:en'],
      ['get', 'name']
    ];

    var esLayer = setLanguage(language, layers, 'es');
    t.deepEqual(esLayer, [
      'coalesce', ['get', 'name:es'],
      ['get', 'name']
    ], 'switch style to spanish name field');

    var arLayer = setLanguage(language, layers, 'ar');
    t.deepEqual(arLayer, [
      'coalesce', ['get', 'name:ar'],
      ['get', 'name']
    ], 'switch style to arabic name field');

    var mulLayer = setLanguage(language, layers, 'mul');
    t.deepEqual(mulLayer, [
      'coalesce', ['get', 'name'],
      ['get', 'name']
    ], 'switch style to multilingual name field');

    t.end();
  });

  t.end();
});