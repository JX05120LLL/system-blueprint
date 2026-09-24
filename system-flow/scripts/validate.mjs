#!/usr/bin/env node

// src/cli/common.ts
import { open, mkdir, rename, link, unlink, access } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";

// src/model/validator.generated.js
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});
var stdin_default = validate10;
var schema11 = { "$schema": "http://json-schema.org/draft-07/schema#", "$id": "https://system-blueprint.local/schema/2.0/diagram.json", "title": "DiagramDocument", "type": "object", "additionalProperties": false, "required": ["schemaVersion", "id", "title", "view", "nodes", "edges", "groups"], "properties": { "schemaVersion": { "const": "2.0", "type": "string" }, "id": { "$ref": "#/definitions/nonEmptyText" }, "title": { "$ref": "#/definitions/nonEmptyText" }, "description": { "type": "string" }, "view": { "type": "object", "additionalProperties": false, "required": ["kind", "direction", "theme"], "properties": { "kind": { "enum": ["overview", "flow", "deployment"] }, "direction": { "enum": ["RIGHT", "DOWN"] }, "theme": { "enum": ["light", "dark"] }, "collapsedGroups": { "type": "array", "uniqueItems": true, "items": { "$ref": "#/definitions/nonEmptyText" } }, "primaryPath": { "type": "array", "items": { "$ref": "#/definitions/nonEmptyText" } } } }, "nodes": { "type": "array", "minItems": 1, "maxItems": 100, "items": { "$ref": "#/definitions/node" } }, "edges": { "type": "array", "maxItems": 300, "items": { "$ref": "#/definitions/edge" } }, "groups": { "type": "array", "maxItems": 20, "items": { "$ref": "#/definitions/group" } } }, "definitions": { "nonEmptyText": { "type": "string", "minLength": 1, "pattern": "\\S" }, "details": { "type": "string", "maxLength": 8e3 }, "evidenceStatus": { "enum": ["confirmed", "assumed", "planned"] }, "source": { "type": "object", "additionalProperties": false, "required": ["path"], "properties": { "path": { "$ref": "#/definitions/nonEmptyText" }, "line": { "type": "integer", "minimum": 1 } } }, "sources": { "type": "array", "items": { "$ref": "#/definitions/source" } }, "node": { "type": "object", "additionalProperties": false, "required": ["id", "kind", "label"], "properties": { "id": { "$ref": "#/definitions/nonEmptyText" }, "kind": { "enum": ["start", "end", "process", "decision", "store", "external", "fork", "join"] }, "label": { "$ref": "#/definitions/nonEmptyText" }, "summary": { "type": "string" }, "details": { "$ref": "#/definitions/details" }, "groupId": { "$ref": "#/definitions/nonEmptyText" }, "evidenceStatus": { "$ref": "#/definitions/evidenceStatus" }, "sources": { "$ref": "#/definitions/sources" } } }, "edge": { "type": "object", "additionalProperties": false, "required": ["id", "source", "target", "kind", "directed"], "properties": { "id": { "$ref": "#/definitions/nonEmptyText" }, "source": { "$ref": "#/definitions/nonEmptyText" }, "target": { "$ref": "#/definitions/nonEmptyText" }, "kind": { "enum": ["control", "data", "dependency", "exception", "feedback"] }, "directed": { "type": "boolean" }, "label": { "type": "string" }, "details": { "$ref": "#/definitions/details" }, "evidenceStatus": { "$ref": "#/definitions/evidenceStatus" }, "sources": { "$ref": "#/definitions/sources" } } }, "group": { "type": "object", "additionalProperties": false, "required": ["id", "label"], "properties": { "id": { "$ref": "#/definitions/nonEmptyText" }, "label": { "$ref": "#/definitions/nonEmptyText" }, "parentId": { "$ref": "#/definitions/nonEmptyText" }, "details": { "$ref": "#/definitions/details" } } } } };
var func2 = require_ucs2length().default;
var func0 = require_equal().default;
var pattern0 = new RegExp("\\S", "u");
var schema16 = { "type": "object", "additionalProperties": false, "required": ["id", "kind", "label"], "properties": { "id": { "$ref": "#/definitions/nonEmptyText" }, "kind": { "enum": ["start", "end", "process", "decision", "store", "external", "fork", "join"] }, "label": { "$ref": "#/definitions/nonEmptyText" }, "summary": { "type": "string" }, "details": { "$ref": "#/definitions/details" }, "groupId": { "$ref": "#/definitions/nonEmptyText" }, "evidenceStatus": { "$ref": "#/definitions/evidenceStatus" }, "sources": { "$ref": "#/definitions/sources" } } };
var schema21 = { "enum": ["confirmed", "assumed", "planned"] };
function validate13(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.path === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "path" }, message: "must have required property 'path'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "path" || key0 === "line")) {
        const err1 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.path !== void 0) {
      let data0 = data.path;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err2 = { instancePath: instancePath + "/path", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err3 = { instancePath: instancePath + "/path", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/path", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.line !== void 0) {
      let data1 = data.line;
      if (!(typeof data1 == "number" && (!(data1 % 1) && !isNaN(data1)) && isFinite(data1))) {
        const err5 = { instancePath: instancePath + "/line", schemaPath: "#/properties/line/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 < 1 || isNaN(data1)) {
          const err6 = { instancePath: instancePath + "/line", schemaPath: "#/properties/line/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
  } else {
    const err7 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate13.errors = vErrors;
  return errors === 0;
}
function validate12(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (Array.isArray(data)) {
    const len0 = data.length;
    for (let i0 = 0; i0 < len0; i0++) {
      if (!validate13(data[i0], { instancePath: instancePath + "/" + i0, parentData: data, parentDataProperty: i0, rootData })) {
        vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err0 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "array" }, message: "must be array" };
    if (vErrors === null) {
      vErrors = [err0];
    } else {
      vErrors.push(err0);
    }
    errors++;
  }
  validate12.errors = vErrors;
  return errors === 0;
}
function validate11(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.kind === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.label === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property 'label'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "kind" || key0 === "label" || key0 === "summary" || key0 === "details" || key0 === "groupId" || key0 === "evidenceStatus" || key0 === "sources")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err5 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.kind !== void 0) {
      let data1 = data.kind;
      if (!(data1 === "start" || data1 === "end" || data1 === "process" || data1 === "decision" || data1 === "store" || data1 === "external" || data1 === "fork" || data1 === "join")) {
        const err7 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/enum", keyword: "enum", params: { allowedValues: schema16.properties.kind.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data2 = data.label;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err8 = { instancePath: instancePath + "/label", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err9 = { instancePath: instancePath + "/label", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = { instancePath: instancePath + "/label", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.summary !== void 0) {
      if (typeof data.summary !== "string") {
        const err11 = { instancePath: instancePath + "/summary", schemaPath: "#/properties/summary/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.details !== void 0) {
      let data4 = data.details;
      if (typeof data4 === "string") {
        if (func2(data4) > 8e3) {
          const err12 = { instancePath: instancePath + "/details", schemaPath: "#/definitions/details/maxLength", keyword: "maxLength", params: { limit: 8e3 }, message: "must NOT have more than 8000 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/details", schemaPath: "#/definitions/details/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.groupId !== void 0) {
      let data5 = data.groupId;
      if (typeof data5 === "string") {
        if (func2(data5) < 1) {
          const err14 = { instancePath: instancePath + "/groupId", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern0.test(data5)) {
          const err15 = { instancePath: instancePath + "/groupId", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/groupId", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.evidenceStatus !== void 0) {
      let data6 = data.evidenceStatus;
      if (!(data6 === "confirmed" || data6 === "assumed" || data6 === "planned")) {
        const err17 = { instancePath: instancePath + "/evidenceStatus", schemaPath: "#/definitions/evidenceStatus/enum", keyword: "enum", params: { allowedValues: schema21.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.sources !== void 0) {
      if (!validate12(data.sources, { instancePath: instancePath + "/sources", parentData: data, parentDataProperty: "sources", rootData })) {
        vErrors = vErrors === null ? validate12.errors : vErrors.concat(validate12.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err18 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  }
  validate11.errors = vErrors;
  return errors === 0;
}
var schema25 = { "type": "object", "additionalProperties": false, "required": ["id", "source", "target", "kind", "directed"], "properties": { "id": { "$ref": "#/definitions/nonEmptyText" }, "source": { "$ref": "#/definitions/nonEmptyText" }, "target": { "$ref": "#/definitions/nonEmptyText" }, "kind": { "enum": ["control", "data", "dependency", "exception", "feedback"] }, "directed": { "type": "boolean" }, "label": { "type": "string" }, "details": { "$ref": "#/definitions/details" }, "evidenceStatus": { "$ref": "#/definitions/evidenceStatus" }, "sources": { "$ref": "#/definitions/sources" } } };
var func12 = Object.prototype.hasOwnProperty;
function validate17(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.source === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "source" }, message: "must have required property 'source'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.target === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "target" }, message: "must have required property 'target'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.kind === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.directed === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "directed" }, message: "must have required property 'directed'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func12.call(schema25.properties, key0)) {
        const err5 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err6 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err7 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.source !== void 0) {
      let data1 = data.source;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err9 = { instancePath: instancePath + "/source", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err10 = { instancePath: instancePath + "/source", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/source", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.target !== void 0) {
      let data2 = data.target;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err12 = { instancePath: instancePath + "/target", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err13 = { instancePath: instancePath + "/target", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = { instancePath: instancePath + "/target", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.kind !== void 0) {
      let data3 = data.kind;
      if (!(data3 === "control" || data3 === "data" || data3 === "dependency" || data3 === "exception" || data3 === "feedback")) {
        const err15 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/enum", keyword: "enum", params: { allowedValues: schema25.properties.kind.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.directed !== void 0) {
      if (typeof data.directed !== "boolean") {
        const err16 = { instancePath: instancePath + "/directed", schemaPath: "#/properties/directed/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      if (typeof data.label !== "string") {
        const err17 = { instancePath: instancePath + "/label", schemaPath: "#/properties/label/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.details !== void 0) {
      let data6 = data.details;
      if (typeof data6 === "string") {
        if (func2(data6) > 8e3) {
          const err18 = { instancePath: instancePath + "/details", schemaPath: "#/definitions/details/maxLength", keyword: "maxLength", params: { limit: 8e3 }, message: "must NOT have more than 8000 characters" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/details", schemaPath: "#/definitions/details/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.evidenceStatus !== void 0) {
      let data7 = data.evidenceStatus;
      if (!(data7 === "confirmed" || data7 === "assumed" || data7 === "planned")) {
        const err20 = { instancePath: instancePath + "/evidenceStatus", schemaPath: "#/definitions/evidenceStatus/enum", keyword: "enum", params: { allowedValues: schema21.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.sources !== void 0) {
      if (!validate12(data.sources, { instancePath: instancePath + "/sources", parentData: data, parentDataProperty: "sources", rootData })) {
        vErrors = vErrors === null ? validate12.errors : vErrors.concat(validate12.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err21 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err21];
    } else {
      vErrors.push(err21);
    }
    errors++;
  }
  validate17.errors = vErrors;
  return errors === 0;
}
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property 'label'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "label" || key0 === "parentId" || key0 === "details")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err3 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (!pattern0.test(data0)) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err7 = { instancePath: instancePath + "/label", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/label", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.parentId !== void 0) {
      let data2 = data.parentId;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err9 = { instancePath: instancePath + "/parentId", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err10 = { instancePath: instancePath + "/parentId", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/parentId", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.details !== void 0) {
      let data3 = data.details;
      if (typeof data3 === "string") {
        if (func2(data3) > 8e3) {
          const err12 = { instancePath: instancePath + "/details", schemaPath: "#/definitions/details/maxLength", keyword: "maxLength", params: { limit: 8e3 }, message: "must NOT have more than 8000 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/details", schemaPath: "#/definitions/details/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
function validate10(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "schemaVersion" }, message: "must have required property 'schemaVersion'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.title === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "title" }, message: "must have required property 'title'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.view === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "view" }, message: "must have required property 'view'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.nodes === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "nodes" }, message: "must have required property 'nodes'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.edges === void 0) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "edges" }, message: "must have required property 'edges'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.groups === void 0) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "groups" }, message: "must have required property 'groups'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "schemaVersion" || key0 === "id" || key0 === "title" || key0 === "description" || key0 === "view" || key0 === "nodes" || key0 === "edges" || key0 === "groups")) {
        const err7 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      let data0 = data.schemaVersion;
      if (typeof data0 !== "string") {
        const err8 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      if ("2.0" !== data0) {
        const err9 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: "2.0" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (func2(data1) < 1) {
          const err10 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (!pattern0.test(data1)) {
          const err11 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = { instancePath: instancePath + "/id", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.title !== void 0) {
      let data2 = data.title;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err13 = { instancePath: instancePath + "/title", schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (!pattern0.test(data2)) {
          const err14 = { instancePath: instancePath + "/title", schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = { instancePath: instancePath + "/title", schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.description !== void 0) {
      if (typeof data.description !== "string") {
        const err16 = { instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.view !== void 0) {
      let data4 = data.view;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        if (data4.kind === void 0) {
          const err17 = { instancePath: instancePath + "/view", schemaPath: "#/properties/view/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (data4.direction === void 0) {
          const err18 = { instancePath: instancePath + "/view", schemaPath: "#/properties/view/required", keyword: "required", params: { missingProperty: "direction" }, message: "must have required property 'direction'" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (data4.theme === void 0) {
          const err19 = { instancePath: instancePath + "/view", schemaPath: "#/properties/view/required", keyword: "required", params: { missingProperty: "theme" }, message: "must have required property 'theme'" };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        for (const key1 in data4) {
          if (!(key1 === "kind" || key1 === "direction" || key1 === "theme" || key1 === "collapsedGroups" || key1 === "primaryPath")) {
            const err20 = { instancePath: instancePath + "/view", schemaPath: "#/properties/view/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
        if (data4.kind !== void 0) {
          let data5 = data4.kind;
          if (!(data5 === "overview" || data5 === "flow" || data5 === "deployment")) {
            const err21 = { instancePath: instancePath + "/view/kind", schemaPath: "#/properties/view/properties/kind/enum", keyword: "enum", params: { allowedValues: schema11.properties.view.properties.kind.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
        if (data4.direction !== void 0) {
          let data6 = data4.direction;
          if (!(data6 === "RIGHT" || data6 === "DOWN")) {
            const err22 = { instancePath: instancePath + "/view/direction", schemaPath: "#/properties/view/properties/direction/enum", keyword: "enum", params: { allowedValues: schema11.properties.view.properties.direction.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data4.theme !== void 0) {
          let data7 = data4.theme;
          if (!(data7 === "light" || data7 === "dark")) {
            const err23 = { instancePath: instancePath + "/view/theme", schemaPath: "#/properties/view/properties/theme/enum", keyword: "enum", params: { allowedValues: schema11.properties.view.properties.theme.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data4.collapsedGroups !== void 0) {
          let data8 = data4.collapsedGroups;
          if (Array.isArray(data8)) {
            const len0 = data8.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data9 = data8[i0];
              if (typeof data9 === "string") {
                if (func2(data9) < 1) {
                  const err24 = { instancePath: instancePath + "/view/collapsedGroups/" + i0, schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err24];
                  } else {
                    vErrors.push(err24);
                  }
                  errors++;
                }
                if (!pattern0.test(data9)) {
                  const err25 = { instancePath: instancePath + "/view/collapsedGroups/" + i0, schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
                  if (vErrors === null) {
                    vErrors = [err25];
                  } else {
                    vErrors.push(err25);
                  }
                  errors++;
                }
              } else {
                const err26 = { instancePath: instancePath + "/view/collapsedGroups/" + i0, schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err26];
                } else {
                  vErrors.push(err26);
                }
                errors++;
              }
            }
            let i1 = data8.length;
            let j0;
            if (i1 > 1) {
              outer0: for (; i1--; ) {
                for (j0 = i1; j0--; ) {
                  if (func0(data8[i1], data8[j0])) {
                    const err27 = { instancePath: instancePath + "/view/collapsedGroups", schemaPath: "#/properties/view/properties/collapsedGroups/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" };
                    if (vErrors === null) {
                      vErrors = [err27];
                    } else {
                      vErrors.push(err27);
                    }
                    errors++;
                    break outer0;
                  }
                }
              }
            }
          } else {
            const err28 = { instancePath: instancePath + "/view/collapsedGroups", schemaPath: "#/properties/view/properties/collapsedGroups/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err28];
            } else {
              vErrors.push(err28);
            }
            errors++;
          }
        }
        if (data4.primaryPath !== void 0) {
          let data10 = data4.primaryPath;
          if (Array.isArray(data10)) {
            const len1 = data10.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data11 = data10[i2];
              if (typeof data11 === "string") {
                if (func2(data11) < 1) {
                  const err29 = { instancePath: instancePath + "/view/primaryPath/" + i2, schemaPath: "#/definitions/nonEmptyText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                  if (vErrors === null) {
                    vErrors = [err29];
                  } else {
                    vErrors.push(err29);
                  }
                  errors++;
                }
                if (!pattern0.test(data11)) {
                  const err30 = { instancePath: instancePath + "/view/primaryPath/" + i2, schemaPath: "#/definitions/nonEmptyText/pattern", keyword: "pattern", params: { pattern: "\\S" }, message: 'must match pattern "\\S"' };
                  if (vErrors === null) {
                    vErrors = [err30];
                  } else {
                    vErrors.push(err30);
                  }
                  errors++;
                }
              } else {
                const err31 = { instancePath: instancePath + "/view/primaryPath/" + i2, schemaPath: "#/definitions/nonEmptyText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                  vErrors = [err31];
                } else {
                  vErrors.push(err31);
                }
                errors++;
              }
            }
          } else {
            const err32 = { instancePath: instancePath + "/view/primaryPath", schemaPath: "#/properties/view/properties/primaryPath/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
      } else {
        const err33 = { instancePath: instancePath + "/view", schemaPath: "#/properties/view/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
    if (data.nodes !== void 0) {
      let data12 = data.nodes;
      if (Array.isArray(data12)) {
        if (data12.length > 100) {
          const err34 = { instancePath: instancePath + "/nodes", schemaPath: "#/properties/nodes/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        if (data12.length < 1) {
          const err35 = { instancePath: instancePath + "/nodes", schemaPath: "#/properties/nodes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
        const len2 = data12.length;
        for (let i3 = 0; i3 < len2; i3++) {
          if (!validate11(data12[i3], { instancePath: instancePath + "/nodes/" + i3, parentData: data12, parentDataProperty: i3, rootData })) {
            vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err36 = { instancePath: instancePath + "/nodes", schemaPath: "#/properties/nodes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.edges !== void 0) {
      let data14 = data.edges;
      if (Array.isArray(data14)) {
        if (data14.length > 300) {
          const err37 = { instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/maxItems", keyword: "maxItems", params: { limit: 300 }, message: "must NOT have more than 300 items" };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        const len3 = data14.length;
        for (let i4 = 0; i4 < len3; i4++) {
          if (!validate17(data14[i4], { instancePath: instancePath + "/edges/" + i4, parentData: data14, parentDataProperty: i4, rootData })) {
            vErrors = vErrors === null ? validate17.errors : vErrors.concat(validate17.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err38 = { instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.groups !== void 0) {
      let data16 = data.groups;
      if (Array.isArray(data16)) {
        if (data16.length > 20) {
          const err39 = { instancePath: instancePath + "/groups", schemaPath: "#/properties/groups/maxItems", keyword: "maxItems", params: { limit: 20 }, message: "must NOT have more than 20 items" };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        const len4 = data16.length;
        for (let i5 = 0; i5 < len4; i5++) {
          if (!validate20(data16[i5], { instancePath: instancePath + "/groups/" + i5, parentData: data16, parentDataProperty: i5, rootData })) {
            vErrors = vErrors === null ? validate20.errors : vErrors.concat(validate20.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err40 = { instancePath: instancePath + "/groups", schemaPath: "#/properties/groups/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
  } else {
    const err41 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err41];
    } else {
      vErrors.push(err41);
    }
    errors++;
  }
  validate10.errors = vErrors;
  return errors === 0;
}

// src/model/graph-index.ts
function isFlowEdge(edge) {
  return edge.kind === "control" || edge.kind === "exception" || edge.kind === "feedback";
}
function buildGraphIndex(document) {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const edges = new Map(document.edges.map((edge) => [edge.id, edge]));
  const groups = new Map(document.groups.map((group) => [group.id, group]));
  const incoming = new Map(document.nodes.map((node) => [node.id, []]));
  const outgoing = new Map(document.nodes.map((node) => [node.id, []]));
  const groupMembers = new Map(document.groups.map((group) => [group.id, /* @__PURE__ */ new Set()]));
  const nodeAncestors = /* @__PURE__ */ new Map();
  for (const node of document.nodes) {
    const ancestors = [];
    const visited = /* @__PURE__ */ new Set();
    let groupId = node.groupId;
    while (groupId && groups.has(groupId) && !visited.has(groupId)) {
      visited.add(groupId);
      ancestors.push(groupId);
      groupMembers.get(groupId).add(node.id);
      groupId = groups.get(groupId).parentId;
    }
    nodeAncestors.set(node.id, ancestors);
  }
  for (const edge of document.edges) {
    outgoing.get(edge.source)?.push(edge);
    incoming.get(edge.target)?.push(edge);
  }
  return { document, nodes, edges, groups, incoming, outgoing, groupMembers, nodeAncestors };
}
function findRelated(index, selectedId, direction) {
  const nodeIds = /* @__PURE__ */ new Set();
  const edgeIds = /* @__PURE__ */ new Set();
  for (const id of typeof selectedId === "string" ? [selectedId] : selectedId) {
    if (index.nodes.has(id)) nodeIds.add(id);
    for (const member of index.groupMembers.get(id) ?? []) nodeIds.add(member);
  }
  const queue = [...nodeIds];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    const candidates = direction === "upstream" ? index.incoming.get(id) : index.outgoing.get(id);
    for (const edge of candidates ?? []) {
      if (!edge.directed || index.document.view.kind === "flow" && !isFlowEdge(edge)) continue;
      const adjacent = direction === "upstream" ? edge.source : edge.target;
      if (!index.nodes.has(adjacent)) continue;
      edgeIds.add(edge.id);
      if (!nodeIds.has(adjacent)) {
        nodeIds.add(adjacent);
        queue.push(adjacent);
      }
    }
  }
  return { nodeIds, edgeIds };
}

// src/model/validate.ts
var MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
var compiledValidator = stdin_default;
function pointerSegment(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function schemaDiagnostic(error) {
  let path = error.instancePath;
  if (error.keyword === "required") path += `/${pointerSegment(String(error.params.missingProperty))}`;
  if (error.keyword === "additionalProperties") path += `/${pointerSegment(String(error.params.additionalProperty))}`;
  return {
    code: `SCHEMA_${error.keyword.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`,
    path,
    ids: [],
    severity: "error",
    message: `${path || "/"}: ${error.message ?? "\u7ED3\u6784\u4E0D\u7B26\u5408 schema"}`
  };
}
function validateDocument(input) {
  const diagnostics = [];
  const add = (code, path, ids, message, severity = "error") => {
    diagnostics.push({ code, path, ids, message, severity });
  };
  try {
    const serialized = JSON.stringify(input);
    if (serialized !== void 0 && new TextEncoder().encode(serialized).byteLength > MAX_DOCUMENT_BYTES) {
      add("DOCUMENT_SIZE_LIMIT", "", [], "\u56FE\u6570\u636E\u8D85\u8FC7 2 MiB\uFF0C\u8BF7\u63D0\u70BC\u4E3A\u603B\u89C8\u4E0E\u5B50\u56FE\uFF0C\u4E0D\u8981\u653E\u5165\u5B8C\u6574\u6E90\u7801\u6216\u65E5\u5FD7\u3002");
      return { valid: false, diagnostics };
    }
  } catch (error) {
    add("DOCUMENT_NOT_JSON", "", [], `\u56FE\u6570\u636E\u65E0\u6CD5\u8868\u793A\u4E3A JSON\uFF1A${error instanceof Error ? error.message : String(error)}`);
    return { valid: false, diagnostics };
  }
  if (!compiledValidator(input)) {
    return { valid: false, diagnostics: (compiledValidator.errors ?? []).map(schemaDiagnostic) };
  }
  const document = input;
  const nodeIds = /* @__PURE__ */ new Set();
  const objectIds = /* @__PURE__ */ new Set();
  const edgeIds = /* @__PURE__ */ new Set();
  document.nodes.forEach((node, i) => {
    if (objectIds.has(node.id)) add("ID_DUPLICATE", `/nodes/${i}/id`, [node.id], "\u8282\u70B9\u548C\u7EC4 ID \u5FC5\u987B\u5728\u540C\u4E00\u547D\u540D\u7A7A\u95F4\u5185\u552F\u4E00\u3002");
    objectIds.add(node.id);
    nodeIds.add(node.id);
  });
  document.groups.forEach((group, i) => {
    if (objectIds.has(group.id)) add("ID_DUPLICATE", `/groups/${i}/id`, [group.id], "\u8282\u70B9\u548C\u7EC4 ID \u5FC5\u987B\u5728\u540C\u4E00\u547D\u540D\u7A7A\u95F4\u5185\u552F\u4E00\u3002");
    objectIds.add(group.id);
  });
  const groups = new Map(document.groups.map((group) => [group.id, group]));
  document.nodes.forEach((node, i) => {
    if (node.groupId && !groups.has(node.groupId)) add("NODE_GROUP_MISSING", `/nodes/${i}/groupId`, [node.id, node.groupId], "\u8282\u70B9\u5F15\u7528\u7684\u5206\u7EC4\u4E0D\u5B58\u5728\u3002");
  });
  document.groups.forEach((group, i) => {
    if (group.parentId && !groups.has(group.parentId)) add("GROUP_PARENT_MISSING", `/groups/${i}/parentId`, [group.id, group.parentId], "\u7236\u5206\u7EC4\u4E0D\u5B58\u5728\u3002");
    const ancestors = /* @__PURE__ */ new Set();
    let current = group;
    while (current) {
      if (ancestors.has(current.id)) {
        add("GROUP_CYCLE", `/groups/${i}/parentId`, [...ancestors], "\u5206\u7EC4\u5F52\u5C5E\u4E0D\u80FD\u5F62\u6210\u5FAA\u73AF\u3002");
        break;
      }
      ancestors.add(current.id);
      current = current.parentId ? groups.get(current.parentId) : void 0;
    }
    if (ancestors.size > 2) add("GROUP_DEPTH_LIMIT", `/groups/${i}/parentId`, [...ancestors], "\u5206\u7EC4\u6700\u591A\u652F\u6301\u4E24\u5C42\uFF1B\u8BF7\u5408\u5E76\u5C42\u7EA7\u6216\u62C6\u4E3A\u5B50\u56FE\u3002");
  });
  document.edges.forEach((edge, i) => {
    if (edgeIds.has(edge.id)) add("EDGE_ID_DUPLICATE", `/edges/${i}/id`, [edge.id], "\u8FB9 ID \u5FC5\u987B\u5728\u6587\u6863\u5185\u552F\u4E00\u3002");
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) add("EDGE_SOURCE_MISSING", `/edges/${i}/source`, [edge.id, edge.source], "\u8FB9\u7684 source \u5FC5\u987B\u5F15\u7528\u5DF2\u6709\u8282\u70B9\u3002");
    if (!nodeIds.has(edge.target)) add("EDGE_TARGET_MISSING", `/edges/${i}/target`, [edge.id, edge.target], "\u8FB9\u7684 target \u5FC5\u987B\u5F15\u7528\u5DF2\u6709\u8282\u70B9\u3002");
    if (isFlowEdge(edge) && !edge.directed) add("FLOW_EDGE_UNDIRECTED", `/edges/${i}/directed`, [edge.id], "control\u3001exception \u548C feedback \u6D41\u7A0B\u8FB9\u5FC5\u987B\u6709\u660E\u786E\u65B9\u5411\u3002");
  });
  const index = buildGraphIndex(document);
  document.groups.forEach((group, i) => {
    if (!index.groupMembers.get(group.id)?.size) add("GROUP_EMPTY", `/groups/${i}`, [group.id], "\u5206\u7EC4\u5FC5\u987B\u76F4\u63A5\u6216\u901A\u8FC7\u5B50\u7EC4\u5305\u542B\u8282\u70B9\u3002");
  });
  document.nodes.forEach((node, i) => {
    const outgoing = index.outgoing.get(node.id) ?? [];
    if (node.kind === "decision") {
      const branches = outgoing.filter(isFlowEdge);
      if (branches.length < 2) add("DECISION_BRANCH_COUNT", `/nodes/${i}/kind`, [node.id], "decision \u5728\u6D41\u7A0B\u5B50\u56FE\u4E2D\u81F3\u5C11\u9700\u8981\u4E24\u4E2A\u51FA\u53E3\uFF0Cdata/dependency \u4E0D\u8BA1\u5165\u3002");
      const conditions = /* @__PURE__ */ new Set();
      for (const edge of branches) {
        const label = edge.label?.trim();
        const edgeIndex = document.edges.indexOf(edge);
        if (!label) add("DECISION_CONDITION_MISSING", `/edges/${edgeIndex}/label`, [node.id, edge.id], "\u5224\u65AD\u51FA\u53E3\u5FC5\u987B\u6709\u975E\u7A7A\u6761\u4EF6\uFF0C\u4E0D\u80FD\u81EA\u52A8\u63A8\u65AD\u662F\u6216\u5426\u3002");
        else if (conditions.has(label)) add("DECISION_CONDITION_DUPLICATE", `/edges/${edgeIndex}/label`, [node.id, edge.id], "\u540C\u4E00\u5224\u65AD\u8282\u70B9\u7684\u51FA\u53E3\u6761\u4EF6\u5FC5\u987B\u53EF\u533A\u5206\u3002");
        if (label) conditions.add(label);
      }
    }
    if (node.kind === "fork" && outgoing.filter((edge) => edge.kind === "control").length < 2) {
      add("FORK_BRANCH_COUNT", `/nodes/${i}/kind`, [node.id], "fork \u81F3\u5C11\u9700\u8981\u4E24\u4E2A control \u51FA\u53E3\u3002");
    }
    if (node.kind === "join" && (index.incoming.get(node.id) ?? []).filter((edge) => edge.kind === "control").length < 2) {
      add("JOIN_BRANCH_COUNT", `/nodes/${i}/kind`, [node.id], "join \u81F3\u5C11\u9700\u8981\u4E24\u4E2A control \u5165\u53E3\u3002");
    }
  });
  const seenPrimary = /* @__PURE__ */ new Set();
  let previous;
  (document.view.primaryPath ?? []).forEach((id, i) => {
    const path = `/view/primaryPath/${i}`;
    const edge = index.edges.get(id);
    if (!edge) add("PRIMARY_EDGE_MISSING", path, [id], "\u4E3B\u8DEF\u5F84\u5F15\u7528\u7684\u8FB9\u4E0D\u5B58\u5728\u3002");
    if (seenPrimary.has(id)) add("PRIMARY_EDGE_DUPLICATE", path, [id], "\u4E3B\u8DEF\u5F84\u4E0D\u80FD\u91CD\u590D\u5F15\u7528\u540C\u4E00\u6761\u8FB9\u3002");
    seenPrimary.add(id);
    if (edge && !edge.directed) add("PRIMARY_EDGE_UNDIRECTED", path, [id], "\u4E3B\u8DEF\u5F84\u53EA\u80FD\u4F7F\u7528\u6709\u5411\u8FB9\u3002");
    if (previous && edge && previous.target !== edge.source) add("PRIMARY_PATH_DISCONNECTED", path, [previous.id, id], "\u4E3B\u8DEF\u5F84\u76F8\u90BB\u8FB9\u5FC5\u987B\u6309\u7167 source \u2192 target \u8FDE\u7EED\u8FDE\u63A5\u3002");
    previous = edge;
  });
  (document.view.collapsedGroups ?? []).forEach((id, i) => {
    if (!groups.has(id)) add("COLLAPSED_GROUP_MISSING", `/view/collapsedGroups/${i}`, [id], "\u521D\u59CB\u6298\u53E0\u72B6\u6001\u5F15\u7528\u7684\u7EC4\u4E0D\u5B58\u5728\u3002");
  });
  if (diagnostics.length === 0) {
    const visited = /* @__PURE__ */ new Set();
    const components = [];
    for (const node of document.nodes) {
      if (visited.has(node.id)) continue;
      const queue = [node.id];
      visited.add(node.id);
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const id = queue[cursor];
        for (const edge of [...index.incoming.get(id), ...index.outgoing.get(id)]) {
          const adjacent = edge.source === id ? edge.target : edge.source;
          if (!visited.has(adjacent)) {
            visited.add(adjacent);
            queue.push(adjacent);
          }
        }
      }
      components.push(queue);
    }
    if (components.length > 1) add("GRAPH_DISCONNECTED", "/nodes", components.slice(1).flat(), `\u56FE\u4E2D\u5305\u542B ${components.length} \u4E2A\u4E92\u4E0D\u8FDE\u901A\u7684\u5B50\u56FE\uFF1B\u8BF7\u786E\u8BA4\u8FD9\u662F\u9884\u671F\u8868\u8FBE\u3002`, "warning");
    const starts = document.nodes.filter((node) => node.kind === "start").map((node) => node.id);
    if (document.view.kind === "flow" && starts.length > 0) {
      const reached = findRelated(index, starts, "downstream").nodeIds;
      const flowNodeIds = new Set(document.edges.filter(isFlowEdge).flatMap((edge) => [edge.source, edge.target]));
      const unreachable = document.nodes.filter((node) => flowNodeIds.has(node.id) && !reached.has(node.id)).map((node) => node.id);
      if (unreachable.length > 0) add("GRAPH_UNREACHABLE", "/nodes", unreachable, "\u8FD9\u4E9B\u6D41\u7A0B\u8282\u70B9\u65E0\u6CD5\u4ECE\u4EFB\u4F55 start \u8282\u70B9\u6CBF\u6D41\u7A0B\u65B9\u5411\u5230\u8FBE\uFF0C\u8BF7\u786E\u8BA4\u5165\u53E3\u548C\u8FB9\u65B9\u5411\u3002", "warning");
    }
  }
  const valid = !diagnostics.some((diagnostic) => diagnostic.severity === "error");
  return { valid, ...valid ? { document } : {}, diagnostics };
}

// src/cli/common.ts
var InputError = class extends Error {
};
function parseArguments(argv, valueOptions, flagOptions = []) {
  const result = { values: /* @__PURE__ */ new Map(), flags: /* @__PURE__ */ new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      if (result.values.has(arg) || result.flags.has(arg)) throw new InputError(`\u91CD\u590D\u53C2\u6570\uFF1A${arg}`);
      if (flagOptions.includes(arg) || arg === "--help") result.flags.add(arg);
      else if (valueOptions.includes(arg)) {
        const value = argv[++i];
        if (value === void 0 || value.startsWith("--")) throw new InputError(`\u53C2\u6570 ${arg} \u7F3A\u5C11\u503C\u3002`);
        result.values.set(arg, value);
      } else throw new InputError(`\u672A\u77E5\u53C2\u6570\uFF1A${arg}`);
    } else if (!result.input) result.input = arg;
    else throw new InputError(`\u591A\u4F59\u7684\u8F93\u5165\u8DEF\u5F84\uFF1A${arg}`);
  }
  return result;
}
async function readInput(path, limit) {
  let file;
  try {
    file = await open(resolve(path), "r");
    const info = await file.stat();
    if (!info.isFile()) throw new InputError(`\u8F93\u5165\u4E0D\u662F\u666E\u901A\u6587\u4EF6\uFF1A${path}`);
    if (limit !== void 0 && info.size > limit) throw new InputError("DOCUMENT_SIZE_LIMIT: \u56FE\u6570\u636E\u8D85\u8FC7 2 MiB\uFF0C\u8BF7\u62C6\u4E3A\u603B\u89C8\u4E0E\u5B50\u56FE\u3002");
    const bytes = await file.readFile();
    if (limit !== void 0 && bytes.byteLength > limit) throw new InputError("DOCUMENT_SIZE_LIMIT: \u56FE\u6570\u636E\u8D85\u8FC7 2 MiB\uFF0C\u8BF7\u62C6\u4E3A\u603B\u89C8\u4E0E\u5B50\u56FE\u3002");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError(`\u65E0\u6CD5\u8BFB\u53D6 UTF-8 \u8F93\u5165 ${path}\uFF1A${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await file?.close();
  }
}
async function readDocument(path) {
  const source = await readInput(path, MAX_DOCUMENT_BYTES);
  let data;
  try {
    data = JSON.parse(source);
  } catch (error) {
    throw new InputError(`JSON_PARSE_ERROR: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = validateDocument(data);
  if (!result.valid || !result.document) throw new InputError(JSON.stringify(result.diagnostics, null, 2));
  return { document: result.document, diagnostics: result.diagnostics };
}
function runCli(main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof InputError ? 2 : 1;
  });
}

// src/cli/validate.ts
runCli(async () => {
  const args = parseArguments(process.argv.slice(2), []);
  const help = "\u7528\u6CD5\uFF1Anode validate.mjs input.diagram.json\n\u6821\u9A8C UTF-8 JSON \u7684\u7ED3\u6784\u3001\u5F15\u7528\u3001\u6761\u4EF6\u3001\u65B9\u5411\u53CA\u4E24\u5C42\u5206\u7EC4\u3002";
  if (args.flags.has("--help")) {
    console.log(help);
    return;
  }
  if (!args.input) throw new InputError(help);
  const { document, diagnostics } = await readDocument(args.input);
  console.log(JSON.stringify({ valid: true, id: document.id, diagnostics }, null, 2));
});
