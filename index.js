/**
 * Create a new [Mapbox GL JS plugin](https://www.mapbox.com/blog/build-mapbox-gl-js-plugins/) that
 * modifies the layers of the map style to use the 'text-field' that matches the browser language.
 * @constructor
 * @param {object} options - Options to configure the plugin.
 * @param {string[]} [options.supportedLanguages] - List of supported languages
 * @param {RegExp} [options.languageField=/^name:/] - RegExp to match if a text-field is a language field
 * @param {Function} [options.getLanguageField] - Given a language choose the field in the vector tiles
 * @param {string} [options.languageSource] - Name of the source that contains the different languages.
 * @param {string} [options.defaultLanguage] - Name of the default language to initialize style after loading.
 * @param {string[]} [options.excludedLayerIds] - Name of the layers that should be excluded from translation.
 */
function OpenMapTilesLanguage(options) {
  options = Object.assign({}, options);
  if (!(this instanceof OpenMapTilesLanguage)) {
    throw new Error('OpenMapTilesLanguage needs to be called with the new keyword');
  }

  this.setLanguage = this.setLanguage.bind(this);
  this._initialStyleUpdate = this._initialStyleUpdate.bind(this);

  this._defaultLanguage = options.defaultLanguage;
  this._isLanguageField = options.languageField || /^name:/;
  this._getLanguageField = options.getLanguageField || function nameField(language) {
    return language === 'mul' ? 'name' : `name:${language}`;
  };
  this._languageSource = options.languageSource || null;
  this._excludedLayerIds = options.excludedLayerIds || [];
  this.supportedLanguages = options.supportedLanguages || ['am', 'ar', 'az', 'be', 'bg', 'br', 'bs', 'ca', 'co', 'cs', 'cy', 'da', 'de', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fi', 'fr', 'fy', 'ga', 'gd', 'he', 'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'ja_kana', 'ja_rm', 'ja-Latn', 'ja-Hira', 'ka', 'kk', 'kn', 'ko', 'ko-Latn', 'ku', 'la', 'lb', 'lt', 'lv', 'mk', 'mt', 'ml', 'mul', 'nl', 'no', 'oc', 'pl', 'pt', 'rm', 'ro', 'ru', 'sk', 'sl', 'sq', 'sr', 'sr-Latn', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'zh'];
}

var isTokenField = /^\{name/;

function isFlatExpressionField(isLangField, property) {
  var isGetExpression = Array.isArray(property) && property[0] === 'get';
  if (isGetExpression && isTokenField.test(property[1])) {
    console.warn('This plugin no longer supports the use of token syntax (e.g. {name}). Please use a get expression. See https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/ for more details.');
  }

  return isGetExpression && isLangField.test(property[1]);
}

function adaptNestedExpressionField(isLangField, property, languageFieldName) {
  if (Array.isArray(property)) {
    for (let i = 1; i < property.length; i++) {
      if (Array.isArray(property[i])) {
        if (isFlatExpressionField(isLangField, property[i])) {
          property[i][1] = languageFieldName;
        }
        adaptNestedExpressionField(isLangField, property[i], languageFieldName);
      }
    }
  }
}

function adaptPropertyLanguage(isLangField, property, languageFieldName) {
  if (isFlatExpressionField(isLangField, property)) {
    property[1] = languageFieldName;
  }

  adaptNestedExpressionField(isLangField, property, languageFieldName);

  // handle special case of bare ['get', 'name'] expression by wrapping it in a coalesce statement
  if (property[0] === 'get' && property[1] === 'name') {
    var defaultProp = property.slice();
    var adaptedProp = ['get', languageFieldName];
    property = ['coalesce', adaptedProp, defaultProp];
  }

  return property;
}

function splitLegacityFormat(s) {
  const ret = ['concat'];
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

OpenMapTilesLanguage.prototype.adaptLegacyExpression = function(expression, languageFieldName) {
  // Kepp only first get name express
  var isName = false;
  var ret = [];
  for (var i = 0; i < expression.length; i++) {
    // ['get', 'name:.*']
    if (Array.isArray(expression[i]) && this._isLanguageField.test(expression[i][1])) {
      if (!isName) {
        isName = true;
        ret.push(['coalesce', ['get', languageFieldName], expression[i]]);
      }
    } else {
      ret.push(expression[i]);
    }
  }

  return ret;
};

function adaptPropertyLanguageWithLegacySupport(isLangField, property, languageFieldName) {
  if (property.length === 4 && property[0] === 'coalesce' && isTokenField.test(property[3])) {
    // Back to original format string for legacy
    property = property[3];
  }

  if (typeof property === 'string') {
    // Only support legacy format string at top level
    if (languageFieldName !== 'name' && isTokenField.test(property)) {
      // The last is not used, it is the original value to be restaured
      return ['coalesce', ['get', languageFieldName], splitLegacityFormat(property), property];
    } else {
      return property;
    }
  } else {
    return adaptPropertyLanguage(isLangField, property, languageFieldName);
  }
}

function changeLayerTextProperty(isLangField, layer, languageFieldName, excludedLayerIds) {
  if (layer.layout && layer.layout['text-field'] && excludedLayerIds.indexOf(layer.id) === -1) {
    return Object.assign({}, layer, {
      layout: Object.assign({}, layer.layout, {
        'text-field': adaptPropertyLanguageWithLegacySupport(isLangField, layer.layout['text-field'], languageFieldName)
      })
    });
  }
  return layer;
}

/**
 * Explicitly change the language for a style.
 * @param {object} style - Mapbox GL style to modify
 * @param {string} language - The language iso code
 * @returns {object} the modified style
 */
OpenMapTilesLanguage.prototype.setLanguage = function(style, language) {
  if (this.supportedLanguages.indexOf(language) < 0) throw new Error('Language ' + language + ' is not supported');

  var field = this._getLanguageField(language);
  var isLangField = this._isLanguageField;
  var excludedLayerIds = this._excludedLayerIds;
  var changedLayers = style.layers.map(function(layer) {
    return changeLayerTextProperty(isLangField, layer, field, excludedLayerIds);
  });

  var languageStyle = Object.assign({}, style, {
    layers: changedLayers
  });

  return languageStyle;
};

OpenMapTilesLanguage.prototype._initialStyleUpdate = function() {
  var style = this._map.getStyle();
  var language = this._defaultLanguage || browserLanguage(this.supportedLanguages);

  // We only update the style once
  this._map.off('styledata', this._initialStyleUpdate);
  this._map.setStyle(this.setLanguage(style, language));
};

function browserLanguage(supportedLanguages) {
  var language = navigator.languages ? navigator.languages[0] : (navigator.language || navigator.userLanguage);
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

OpenMapTilesLanguage.prototype.onAdd = function(map) {
  this._map = map;
  this._map.on('styledata', this._initialStyleUpdate);
  this._container = document.createElement('div');
  return this._container;
};

OpenMapTilesLanguage.prototype.onRemove = function() {
  this._map.off('styledata', this._initialStyleUpdate);
  this._map = undefined;
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = OpenMapTilesLanguage;
} else {
  window.OpenMapTilesLanguage = OpenMapTilesLanguage;
}