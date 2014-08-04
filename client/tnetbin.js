var tnetbin = (function() {

  var COLON   = 58;
  var ZERO    = 48;
  var NULL    = 126;
  var BOOLEAN = 33;
  var INTEGER = 35;
  var FLOAT   = 94;
  var STRING  = 44;
  var LIST    = 93;
  var DICT    = 125;

  function Encoder(options) {
    this.options = options || {};
  }

  Encoder.prototype = {
    encode: function(obj) {
      if (this.options.arraybuffer)
        return this._encodeToArrayBuffer(obj);

      return this._encodeToString(obj);
    },

    _encodeToArrayBuffer: function(obj) {
      switch (obj) {
      case null:
        return new Uint8Array([48, 58, 126]); // '0:~'
      case true:
        return new Uint8Array([52, 58, 116, 114, 117, 101, 33]); // '4:true!'
      case false:
         // '5:false!'
        return new Uint8Array([53, 58, 102, 97, 108, 115, 101, 33]);
      }

      var type = typeof obj, s, tag;

      switch (type) {
      case 'string':
        s   = toArrayBuffer(obj);
        tag = new Uint8Array([STRING]);
        break;
      case 'number':
        s = toArrayBuffer(obj.toString());
        // Integer
        if (obj % 1 === 0)
          tag = new Uint8Array([INTEGER]); // '#'
        // Float
        else
          tag = new Uint8Array([FLOAT]); // '^'
        break;
      case 'object':
        if (obj instanceof ArrayBuffer) { // ArrayBuffer
          s = new Uint8Array(obj);
          tag = new Uint8Array([STRING]);
        } else if (obj instanceof Int8Array    || // ArrayBufferView
                   obj instanceof Uint8Array   ||
                   obj instanceof Uint16Array  ||
                   obj instanceof Int32Array   ||
                   obj instanceof Uint32Array  ||
                   obj instanceof Float32Array ||
                   obj instanceof Float64Array) {
          s = new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength);
          tag = new Uint8Array([STRING]);
        }else if (obj instanceof Array) { // List
          s = obj.map(this._encodeToArrayBuffer.bind(this));
          s = concatArrayBuffers(s);
          tag = new Uint8Array([LIST]);
        } else { // Object
          var attrs = [];
          for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) {
              attrs.push(this._encodeToArrayBuffer(attr),
                         this._encodeToArrayBuffer(obj[attr]));
            }
          }
          s = concatArrayBuffers(attrs);
          tag = new Uint8Array([DICT]);
        }
      }

      var size = toArrayBuffer(s.byteLength.toString());
      return concatArrayBuffers([size, COLON, s, tag])
    },

    _encodeToString: function(obj) {
      switch (obj) {
      case null:
        return '0:~';
      case true:
        return '4:true!';
      case false:
        return '5:false!';
      }

      var type = typeof obj, s, tag;

      switch (type) {
      case 'string':
        s   = obj;
        tag = ',';
        break;
      case 'number':
        s = obj.toString();
        // Integer
        if (obj % 1 === 0)
          tag = '#';
        // Float
        else
          tag = '^';
        break;
      case 'object':
        if (obj instanceof ArrayBuffer) { // ArrayBuffer
          s = largeArrayToString(obj);
          tag = ',';
        } else if (obj instanceof Int8Array    || // ArrayBufferView
                   obj instanceof Uint8Array   ||
                   obj instanceof Uint16Array  ||
                   obj instanceof Int32Array   ||
                   obj instanceof Uint32Array  ||
                   obj instanceof Float32Array ||
                   obj instanceof Float64Array) {
          s = new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength);
          s = largeArrayToString(s);
          tag = ',';
        } else if (obj instanceof Array) { // List
          s = obj.map(this.encode.bind(this)).join('');
          tag = ']';
        } else { // Object
          var attrs = [];
          for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) {
              attrs.push(this.encode(attr),
                         this.encode(obj[attr]));
            }
          }
          s = attrs.join('');
          tag = '}';
        }
      }

      return s.length + ':' + s + tag;
    }
  };

  function Decoder(options) {
    this.options = options || {};
  }

  Decoder.prototype = {
    decode: function(data) {
      var result;
      data = toArrayBuffer(data);
      result = this._decode(data, 0);

      return {value: result.value, remain: this.remain(data, result.cursor)};
    },

    _decode: function(data, cursor) {
      var result = this._decodeSize(data, cursor);
      return this._decodePayload(data, result.cursor, result.value);
    },

    _decodeSize: function(data, cursor, callback) {
      for (var size=0; data[cursor] !== COLON; cursor++) {
        size = size*10 + (data[cursor] - ZERO);
      }

      return {value: size, cursor: cursor + 1};
    },

    _decodePayload: function(data, cursor, size) {
      var tag = data[cursor + size];
      switch (tag) {
      case NULL:
        return this._decodeNull(data, cursor, size);
      case BOOLEAN:
        return this._decodeBoolean(data, cursor, size);
      case INTEGER:
        return this._decodeInteger(data, cursor, size);
      case FLOAT:
        return this._decodeFloat(data, cursor, size);
      case STRING:
        return this._decodeString(data, cursor, size);
      case LIST:
        return this._decodeList(data, cursor, size);
      case DICT:
        return this._decodeDict(data, cursor, size);
      default:
        return {value: undefined, cursor: cursor + size + 1};
      }
    },

    remain: function(data, cursor) {
      var d = data.subarray(cursor);
      return (this.options.arraybuffer ? d : largeArrayToString(d));
    },

    _decodeNull: function(data, cursor) {
      return {value: null, cursor: cursor + 1};
    },

    _decodeBoolean: function(data, cursor, size) {
      return {value: (size === 4) ? true : false, cursor: cursor + size + 1};
    },

    _decodeInteger: function(data, cursor, size) {
      var end = cursor + size;
      for (var value = 0; cursor < end; cursor++)
        value = value*10 + (data[cursor] - ZERO);

      return {value: value, cursor: cursor + 1};
    },

    _decodeFloat: function(data, cursor, size) {
      var value, exp, decimal;
      var end = cursor + size;

      for(value = 0; data[cursor] !== 46; cursor++)
        value = value*10 + (data[cursor] - ZERO);

      cursor++;
      for (decimal = 0, exp=1; cursor < end; cursor++, exp*=10) {
        decimal = decimal*10 + (data[cursor] - ZERO);
      }

      return {value: value + (decimal/exp), cursor: cursor + 1};
    },

    _decodeString: function(data, cursor, size) {
      var s;
      data = data.subarray(cursor, cursor + size);

      if (this.options.arraybuffer)
        return {value: data, cursor: cursor + size + 1};
      else
        return {value: largeArrayToString(data), cursor: cursor + size + 1};
    },

    _decodeList: function(data, cursor, size) {
      if (size === 0)
        return {value: [], cursor: cursor + 1};

      var list = [];
      var end  = cursor + size;
      var result;

      do {
        result = this._decode(data, cursor);
        list.push(result.value);
        cursor = result.cursor;
      } while (cursor < end);

      return {value: list, cursor: result.cursor + 1};
    },

    _decodeDict: function(data, cursor, size) {
      if (size === 0)
        return {value: {}, cursor: cursor + 1};

      var dict = {};

      var result = this._decodeList(data, cursor, size);
      var items  = result.value;
      var len    = items.length;
      var key;

      for (var i = 0; i < len; i+=2) {
        key = items[i];
        key = this.options.arraybuffer ? largeArrayToString(key) : key;
        dict[key] = items[i + 1];
      }

      return {value: dict, cursor: result.cursor};
    }
  };

  function isAString(data) {
    if (data.byteLength % 2 !== 0)
      return false;

    data = new Uint16Array(data.buffer);
    for (var i=0; i < data.byteLength; i++)
      if (0x000 <= data[i] && data[i] <= 0x00)
        return false
    return true;
  }

  function toArrayBuffer(data) {
    if (data instanceof ArrayBuffer) // ArrayBuffer
      return new Uint8Array(data);
    if (data instanceof Int8Array    || // ArrayBufferView
        data instanceof Uint8Array   ||
        data instanceof Uint16Array  ||
        data instanceof Int32Array   ||
        data instanceof Uint32Array  ||
        data instanceof Float32Array ||
        data instanceof Float64Array)
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    var len  = data.length;
    var view = new Uint8Array(len);
    // Transform the string to an array buffer
    for (var cursor = 0; cursor < len; cursor++)
      view[cursor] = data.charCodeAt(cursor);

    return view;
  }

  function splitArrayBuffer(data) {
    var len = data.byteLength;
    var arrays = [];
    for (var i = 0; (i*2048) < len; i++)
      arrays.push(data.subarray((i * 2048), (i * 2048) + 2048));
    return arrays;
  }

  function largeArrayToString(data) {
    var s = '';
    splitArrayBuffer(new Uint8Array(data)).forEach(function (array) {
      s += String.fromCharCode.apply(null, array);
    });
    return s;
  }

  function concatArrayBuffers(arrays) {
    var byteLength = arrays.reduce(function(acc, b) {
      return (typeof b === 'number') ? acc + 1 : acc + b.byteLength;
    }, 0);
    var result = new Uint8Array(byteLength);
    var offset = 0;

    arrays.forEach(function(array) {
      array = (typeof array === 'number') ? new Uint8Array([array]) : array;
      result.set(array, offset);
      offset += array.byteLength;
    });

    return result;
  }

  return {
    Encoder: Encoder,
    Decoder: Decoder,
    isAString: isAString,
    toArrayBuffer: toArrayBuffer,
    concatArrayBuffers: concatArrayBuffers
  }
}());

