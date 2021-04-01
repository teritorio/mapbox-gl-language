var test = require('tape');
var OpenMapTilesLanguage = require('../index');

function makeStyle(layers, source = 'openmaptiles') {
  const style = {
    sources: {},
    layers
  };
  style.sources[source] = {
    openmaptiles: {
      type: 'vector',
      url: 'https://raw.githubusercontent.com/openmaptiles/osm-bright-gl-style/gh-pages/style-local.json'
    }
  };
  return style;
}

test('OpenMapTilesLanguage', (t) => {

  test('non-openmaptiles-based styles', (t) => {
    var language = new OpenMapTilesLanguage();
    var layers = [{
      'id': 'state-label-sm',
      'source': 'composite',
      'source-layer': 'state_label',
      'layout': {
        'text-letter-spacing': 0.15,
        'text-field': [
          'coalesce', ['get', 'name:en'],
          ['get', 'name']
        ]
      }
    }];
    var style = makeStyle(layers, 'composite');
    var err = new Error('If using OpenMapTilesLanguage with a Mapbox style, the style must be based on OpenMapTiles vector tile.');
    t.throws(() => {
      language.setLanguage(style, 'es');
    }, err.toString());
    t.end();
  });

  test('unwrapped get expression styles', (t) => {
    var language = new OpenMapTilesLanguage();
    var layers = [{
      'id': 'state-label-sm',
      'source': 'openmaptiles',
      'source-layer': 'state_label',
      'layout': {
        'text-letter-spacing': 0.15,
        'text-field': ['get', 'name']
      }
    }];
    var style = makeStyle(layers);

    var esStyle = language.setLanguage(style, 'es');
    console.log('esStyle: ', esStyle);
    t.deepEqual(esStyle.layers[0].layout, {
      'text-letter-spacing': 0.15,
      'text-field': [
        'coalesce', ['get', 'name:es'],
        ['get', 'name']
      ]
    }, 'wrap unwrapped get expression in coalesce');
    t.end();
  });

  test('setLanguage for different text fields', (t) => {
    var language = new OpenMapTilesLanguage();
    var layers = [{
      'id': 'state-label-sm',
      'source': 'openmaptiles',
      'source-layer': 'state_label',
      'layout': {
        'text-letter-spacing': 0.15,
        'text-field': [
          'coalesce', ['get', 'name:en'],
          ['get', 'name']
        ]
      }
    }];
    var style = makeStyle(layers);

    var esStyle = language.setLanguage(style, 'es');
    t.deepEqual(esStyle.layers[0].layout, {
      'text-letter-spacing': 0.15,
      'text-field': [
        'coalesce', ['get', 'name:es'],
        ['get', 'name']
      ]
    }, 'switch style to spanish name field');

    var arStyle = language.setLanguage(style, 'ar');
    t.deepEqual(arStyle.layers[0].layout, {
      'text-letter-spacing': 0,
      'text-field': [
        'coalesce', ['get', 'name:ar'],
        ['get', 'name']
      ]
    }, 'switch style to arabic name field');

    var mulStyle = language.setLanguage(style, 'mul');
    t.deepEqual(mulStyle.layers[0].layout, {
      'text-letter-spacing': 0.15,
      'text-field': [
        'coalesce', ['get', '{name:latin} {name:nonlatin}'],
        ['get', 'name']
      ]
    }, 'switch style to multilingual name field');

    t.end();
  });

  test('setLanguage with excluded layers', (t) => {
    var language = new OpenMapTilesLanguage({ excludedLayerIds: ['state-label-lg'] });
    var layers = [{
      'id': 'state-label-sm',
      'source': 'openmaptiles',
      'source-layer': 'state_label',
      'layout': {
        'text-letter-spacing': 0.15,
        'text-field': [
          'coalesce', ['get', 'name:en'],
          ['get', 'name']
        ]
      }
    }, {
      'id': 'state-label-lg',
      'source': 'openmaptiles',
      'source-layer': 'state_label',
      'layout': {
        'text-letter-spacing': 0.15,
        'text-field': [
          'coalesce', ['get', 'name:en'],
          ['get', 'name']
        ]
      }
    }];

    var style = makeStyle(layers);

    var esStyle = language.setLanguage(style, 'es');
    t.deepEqual(esStyle.layers[0].layout, {
      'text-letter-spacing': 0.15,
      'text-field': [
        'coalesce', ['get', 'name:es'],
        ['get', 'name']
      ]
    }, 'switch style on regular field');

    t.deepEqual(esStyle.layers[1].layout, {
      'text-letter-spacing': 0.15,
      'text-field': [
        'coalesce', ['get', 'name:en'],
        ['get', 'name']
      ]
    }, 'do not switch style on excluded field');
    t.end();
  });

  t.end();
});