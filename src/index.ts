import { Control } from './control';

interface Options {
  supportedLanguages?: string[]; // List of supported languages
  languageField?: RegExp; // /^name:/ // RegExp to match if a text-field is a language field
  getLanguageField?: Function; // Given a language choose the field in the vector tiles
  languageSource?: string; // Name of the source that contains the different languages.
  defaultLanguage?: string; // Name of the default language to initialize style after loading.
  excludedLayerIds?: string[]; // Name of the layers that should be excluded from translation.
}

/**
 * Create a new [Mapbox GL JS plugin](https://www.mapbox.com/blog/build-mapbox-gl-js-plugins/) that
 * modifies the layers of the map style to use the 'text-field' that matches the browser language.
 */
export class OpenMapTilesLanguage extends Control {
  private _options?: Options;
  private _isLanguageField: RegExp;
  private _getLanguageField: Function;
  private _excludedLayerIds: string[];
  private supportedLanguages: string[];

  constructor(options?: Options) {
    super();
    this._options = options;

    this._isLanguageField = options?.languageField || /^name:/;
    this._getLanguageField =
      options?.getLanguageField ||
      function nameField(language: string) {
        return language === 'mul' ? 'name' : `name:${language}`;
      };
    this._excludedLayerIds = options?.excludedLayerIds || [];
    this.supportedLanguages = options?.supportedLanguages || [
      'am',
      'ar',
      'az',
      'be',
      'bg',
      'br',
      'bs',
      'ca',
      'co',
      'cs',
      'cy',
      'da',
      'de',
      'el',
      'en',
      'eo',
      'es',
      'et',
      'eu',
      'fi',
      'fr',
      'fy',
      'ga',
      'gd',
      'he',
      'hi',
      'hr',
      'hu',
      'hy',
      'id',
      'is',
      'it',
      'ja',
      'ja_kana',
      'ja_rm',
      'ja-Latn',
      'ja-Hira',
      'ka',
      'kk',
      'kn',
      'ko',
      'ko-Latn',
      'ku',
      'la',
      'lb',
      'lt',
      'lv',
      'mk',
      'mt',
      'ml',
      'mul',
      'nl',
      'no',
      'oc',
      'pl',
      'pt',
      'rm',
      'ro',
      'ru',
      'sk',
      'sl',
      'sq',
      'sr',
      'sr-Latn',
      'sv',
      'ta',
      'te',
      'th',
      'tr',
      'uk',
      'zh',
    ];
  }

  private isTokenField: RegExp = /^\{name/;

  protected isFlatExpressionField(isLangField: RegExp, property: MapboxExpr) {
    var isGetExpression = property.length >= 2 && property[0] === 'get';
    if (isGetExpression && typeof property[1] === 'string' && this.isTokenField.test(property[1])) {
      console.warn(
        'This plugin no longer supports the use of token syntax (e.g. {name}). Please use a get expression. See https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/ for more details.',
      );
    }

    return isGetExpression && typeof property[1] === 'string' && isLangField.test(property[1]);
  }

  protected adaptNestedExpressionField(
    isLangField: RegExp,
    properties: MapboxExpr,
    languageFieldName: string,
  ) {
    properties.forEach(property => {
      if (Array.isArray(property)) {
        if (this.isFlatExpressionField(isLangField, property)) {
          property[1] = languageFieldName;
        }
        this.adaptNestedExpressionField(isLangField, property, languageFieldName);
      }
    });
  }

  protected adaptPropertyLanguage(
    isLangField: RegExp,
    property: MapboxExpr,
    languageFieldName: string,
  ) {
    if (this.isFlatExpressionField(isLangField, property)) {
      property[1] = languageFieldName;
    }

    this.adaptNestedExpressionField(isLangField, property, languageFieldName);

    // handle special case of bare ['get', 'name'] expression by wrapping it in a coalesce statement
    if (property[0] === 'get' && property[1] === 'name') {
      var defaultProp = property.slice();
      var adaptedProp = ['get', languageFieldName];
      property = ['coalesce', adaptedProp, defaultProp];
    }

    return property;
  }

  protected splitLegacityFormat(s: string) {
    const ret: MapboxExpr = ['concat'];
    var sub = '';
    for (var i = 0; i < s.length; i++) {
      if (s[i] === '{') {
        if (sub) {
          ret.push(sub);
        }
        sub = '';
      } else if (s[i] === '}') {
        if (sub) {
          ret.push(['get', sub]);
        }
        sub = '';
      } else {
        sub += s[i];
      }
    }

    if (sub) {
      ret.push(sub);
    }

    return ret;
  }

  adaptLegacyExpression(expressions: MapboxExpr, languageFieldName: string) {
    // Kepp only first get name express
    var isName = false;
    var ret: MapboxValues[] = [];
    expressions.forEach(expression => {
      // ['get', 'name:.*']
      if (
        Array.isArray(expression) &&
        expression.length >= 2 &&
        typeof expression[1] === 'string' &&
        this._isLanguageField.test(expression[1])
      ) {
        if (!isName) {
          isName = true;
          ret.push(['coalesce', ['get', languageFieldName], expression]);
        }
      } else {
        ret.push(expression);
      }
    });

    return ret;
  }

  adaptPropertyLanguageWithLegacySupport(
    isLangField: RegExp,
    property: MapboxExpr | string,
    languageFieldName: string,
  ) {
    if (
      property.length === 4 &&
      property[0] === 'coalesce' &&
      typeof property[3] === 'string' &&
      this.isTokenField.test(property[3])
    ) {
      // Back to original format string for legacy
      property = property[3];
    }

    if (typeof property === 'string') {
      // Only support legacy format string at top level
      if (languageFieldName !== 'name' && this.isTokenField.test(property)) {
        const splitLegacity = this.splitLegacityFormat(property);
        // The last is not used, it is the original value to be restore
        return [
          'coalesce',
          this.adaptLegacyExpression(splitLegacity, languageFieldName),
          splitLegacity,
          property,
        ];
      } else {
        return property;
      }
    } else {
      return this.adaptPropertyLanguage(isLangField, property, languageFieldName);
    }
  }

  changeLayerTextProperty(
    isLangField: RegExp,
    layer: mapboxgl.SymbolLayer,
    languageFieldName: string,
    excludedLayerIds: string[],
  ) {
    if (
      this._map &&
      layer.layout &&
      layer.layout['text-field'] &&
      excludedLayerIds.indexOf(layer.id) === -1
    ) {
      this._map.setLayoutProperty(
        layer.id,
        'text-field',
        this.adaptPropertyLanguageWithLegacySupport(
          isLangField,
          layer.layout['text-field'] as string | MapboxExpr,
          languageFieldName,
        ),
      );
    }
  }

  /**
   * Explicitly change the language for a style.
   */
  setLanguage(language: string) {
    if (this.supportedLanguages.indexOf(language) < 0)
      throw new Error('Language ' + language + ' is not supported');

    var field = this._getLanguageField(language);
    var isLangField = this._isLanguageField;
    var excludedLayerIds = this._excludedLayerIds;
    var self = this;
    this._map
      ?.getStyle()
      ?.layers?.filter(layer => layer.type === 'symbol')
      .forEach(function(layer) {
        self.changeLayerTextProperty(
          isLangField,
          layer as mapboxgl.SymbolLayer,
          field,
          excludedLayerIds,
        );
      });
  }

  _initialUpdate() {
    super._initialUpdate();

    var language = this._options?.defaultLanguage || this.browserLanguage(this.supportedLanguages);

    // We only update the style once
    this._map?.off('styledata', this._initialUpdate);
    this.setLanguage(language);
  }

  browserLanguage(supportedLanguages: string[]) {
    // @ts-ignore
    var userLanguage = navigator.userLanguage;
    var language = navigator.languages
      ? navigator.languages[0]
      : navigator.language || userLanguage;
    var parts = language.split('-');
    var languageCode = language;
    if (parts.length > 1) {
      languageCode = parts[0];
    }
    if (supportedLanguages.indexOf(languageCode) > -1) {
      return languageCode;
    }
    return null;
  }
}
