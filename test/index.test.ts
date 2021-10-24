import { OpenMapTilesLanguage } from '../src';

function setLanguage(language: OpenMapTilesLanguage, property: MapboxExpr | string, lang: string) {
  // @ts-ignore
  const languages = language._getLanguageField(lang);
  return language.adaptPropertyLanguageWithLegacySupport(/^name:/, property, languages);
}

describe('OpenMapTilesLanguage', () => {
  test('is exported', () => {
    expect(OpenMapTilesLanguage).toBeTruthy();
  });

  test('legacy format string', () => {
    var language = new OpenMapTilesLanguage();
    var layers = '{name:latin}{name:nonlatin}\n{ele} m';

    var esLayer = setLanguage(language, layers, 'es');
    // wrap legacy format string in coalesce'
    expect(esLayer).toStrictEqual([
      'coalesce',
      [
        'concat',
        ['coalesce', ['get', 'name:es'], ['get', 'name:latin']],
        '\n',
        ['get', 'ele'],
        ' m',
      ],
      ['concat', ['get', 'name:latin'], ['get', 'name:nonlatin'], '\n', ['get', 'ele'], ' m'],
      '{name:latin}{name:nonlatin}\n{ele} m',
    ]);

    var mulLayer = setLanguage(language, esLayer, 'mul');
    // unwrap egacy format string
    expect(mulLayer).toStrictEqual('{name:latin}{name:nonlatin}\n{ele} m');
  });

  test('unwrapped get expression styles', () => {
    var language = new OpenMapTilesLanguage();
    var layers = ['get', 'name'];

    var esLayer = setLanguage(language, layers, 'es');
    // wrap unwrapped get expression in coalesce
    expect(esLayer).toStrictEqual(['coalesce', ['get', 'name:es'], ['get', 'name']]);
  });

  test('setLanguage for different text fields', () => {
    var language = new OpenMapTilesLanguage();
    var layers = ['coalesce', ['get', 'name:en'], ['get', 'name']];

    var esLayer = setLanguage(language, layers, 'es');
    // switch style to spanish name field
    expect(esLayer).toStrictEqual(['coalesce', ['get', 'name:es'], ['get', 'name']]);

    var arLayer = setLanguage(language, layers, 'ar');
    // switch style to arabic name field
    expect(arLayer).toStrictEqual(['coalesce', ['get', 'name:ar'], ['get', 'name']]);

    var mulLayer = setLanguage(language, layers, 'mul');
    // switch style to multilingual name field
    expect(mulLayer).toStrictEqual(['coalesce', ['get', 'name'], ['get', 'name']]);
  });
});
