// src/combinators/many.ts
function many(parser) {
  return {
    parse(input, pos) {
      const values = [];
      let nextPos = pos;
      while (nextPos < input.length) {
        const result = parser.parse(input, nextPos);
        if (result.isOk) {
          values.push(result.value);
          nextPos = result.pos;
        } else {
          break;
        }
      }
      return {
        isOk: true,
        span: [pos, nextPos],
        pos: nextPos,
        value: values
      };
    }
  };
}

// src/combinators/map.ts
function map(parser, fn) {
  return {
    parse(input, pos) {
      const result = parser.parse(input, pos);
      switch (result.isOk) {
        case true: {
          const span = [pos, result.pos];
          return {
            isOk: true,
            span,
            pos: result.pos,
            value: fn(result.value, span)
          };
        }
        case false: {
          return result;
        }
      }
    }
  };
}

// src/combinators/sequence.ts
function sequence(...ps) {
  return {
    parse(input, pos) {
      const values = [];
      let nextPos = pos;
      for (const parser of ps) {
        const result = parser.parse(input, nextPos);
        switch (result.isOk) {
          case true: {
            values.push(result.value);
            nextPos = result.pos;
            break;
          }
          case false: {
            return result;
          }
        }
      }
      return {
        isOk: true,
        span: [pos, nextPos],
        pos: nextPos,
        value: values
      };
    }
  };
}

// src/combinators/choice.ts
function choice(...ps) {
  return {
    parse(input, pos) {
      const [first, ...rest] = ps;
      let nextResult = first.parse(input, pos);
      if (!nextResult.isOk) {
        for (const parser of rest) {
          const result = parser.parse(input, pos);
          switch (result.isOk) {
            case true: {
              return result;
            }
            case false: {
              if (!nextResult || nextResult.pos < result.pos) {
                nextResult = result;
              }
            }
          }
        }
      }
      return nextResult;
    }
  };
}

// src/core/run.ts
function run(parser) {
  return {
    with(input) {
      return parser.parse(input, 0);
    }
  };
}

// src/core/grammar.ts
function grammar(init) {
  const grammar2 = {};
  for (const key in init) {
    grammar2[key] = {
      // istanbul ignore next
      parse() {
        throw new Error(`internal error`);
      }
    };
  }
  for (const key in init) {
    grammar2[key].parse = init[key].apply(grammar2).parse;
  }
  return grammar2;
}

// src/parsers/string.ts
function string(match2) {
  return {
    parse(input, pos) {
      const nextPos = Math.min(pos + match2.length, input.length);
      const slice = input.substring(pos, nextPos);
      const span = [pos, nextPos];
      switch (slice === match2) {
        case true: {
          return {
            isOk: true,
            span,
            pos: nextPos,
            value: match2
          };
        }
        case false: {
          return {
            isOk: false,
            span,
            pos: nextPos,
            expected: match2
          };
        }
      }
    }
  };
}

// src/parsers/regexp.ts
function regexp(rs, expected) {
  const re = rs.global ? rs : new RegExp(rs.source, rs.flags + "g");
  return {
    parse(input, pos) {
      re.lastIndex = pos;
      const result = re.exec(input);
      if (result && result.index === pos) {
        const [match2] = result;
        const index = pos + match2.length;
        return {
          isOk: true,
          span: [pos, index],
          pos: index,
          value: match2
        };
      } else {
        return {
          isOk: false,
          // TODO: Can this be improved? Zero-length span for this parser doesn't look helpful.
          span: [pos, pos],
          pos,
          expected
        };
      }
    }
  };
}

// src/parsers/nothing.ts
function nothing() {
  return {
    parse(_, pos) {
      return {
        isOk: true,
        span: [pos, pos],
        pos,
        value: null
      };
    }
  };
}

// src/parsers/numbers.ts
var INTEGER_RE = /-?(0|[1-9][0-9]*)/g;
var FLOAT_RE = /-?[0-9]+\.[0-9]+/g;
function integer() {
  return {
    parse(input, pos) {
      const result = regexp(INTEGER_RE, "integer number").parse(input, pos);
      switch (result.isOk) {
        case true: {
          return {
            isOk: true,
            span: [pos, result.pos],
            pos: result.pos,
            value: parseInt(result.value, 10)
          };
        }
        case false: {
          return result;
        }
      }
    }
  };
}
function float() {
  return {
    parse(input, pos) {
      const result = regexp(FLOAT_RE, "float number").parse(input, pos);
      switch (result.isOk) {
        case true: {
          return {
            isOk: true,
            span: [pos, result.pos],
            pos: result.pos,
            value: parseFloat(result.value)
          };
        }
        case false: {
          return result;
        }
      }
    }
  };
}

// src/parsers/whitespace.ts
var WHITESPACE_REQUIRED_RE = /\s+/g;
function whitespace() {
  return regexp(WHITESPACE_REQUIRED_RE, "whitespace");
}

// src/combinators/optional.ts
function optional(parser) {
  return choice(parser, nothing());
}

// src/combinators/sepBy.ts
function sepBy(parser, sep) {
  return {
    parse(input, pos) {
      const resultP = parser.parse(input, pos);
      if (resultP.isOk) {
        const resultS = many(sequence(sep, parser)).parse(input, resultP.pos);
        const values = [resultP.value];
        for (const [, value] of resultS.value) {
          values.push(value);
        }
        return {
          isOk: true,
          span: [pos, resultS.pos],
          pos: resultS.pos,
          value: values
        };
      }
      return {
        isOk: true,
        span: [pos, pos],
        pos,
        value: []
      };
    }
  };
}

// src/combinators/take.ts
var toMiddle = ([, middle]) => middle;
function takeMid(p1, p2, p3) {
  return map(sequence(p1, p2, p3), toMiddle);
}

// benchmarks/src/json/sigma-grammar.ts
var Keywords = {
  True: "true",
  False: "false",
  Null: "null"
};
var Terminals = {
  OpenBrace: "{",
  CloseBrace: "}",
  OpenSquare: "[",
  CloseSquare: "]",
  Colon: ":",
  Comma: ","
};
function toObject(values) {
  return {
    type: "object",
    values
  };
}
function toObjectProp(tuple) {
  const [{ value: name }, _, value] = tuple;
  return {
    type: "property",
    name,
    value
  };
}
function toArray(values) {
  return {
    type: "array",
    values
  };
}
function toString(text) {
  return {
    type: "string",
    value: text.slice(1, -1)
  };
}
function toNumber(value) {
  return {
    type: "number",
    value
  };
}
function toBoolean(kind) {
  switch (kind) {
    case Keywords.True: {
      return {
        type: "boolean",
        value: true
      };
    }
    case Keywords.False: {
      return {
        type: "boolean",
        value: false
      };
    }
    default: {
      return {
        type: "boolean",
        value: false
      };
    }
  }
}
function toNull() {
  return {
    type: "null",
    value: null
  };
}
var NumberLiteral = choice(float(), integer());
var Space = optional(whitespace());
var StringLiteral = regexp(/"([^"]|\\.)*"/g, "string");
var match = (s) => takeMid(Space, string(s), Space);
var Json = grammar({
  Root() {
    return choice(this.Object, this.Array);
  },
  Object() {
    return map(
      takeMid(
        match(Terminals.OpenBrace),
        sepBy(this.ObjectProp, match(Terminals.Comma)),
        match(Terminals.CloseBrace)
      ),
      toObject
    );
  },
  ObjectProp() {
    return map(sequence(this.String, match(Terminals.Colon), this.Value), toObjectProp);
  },
  Array() {
    return map(
      takeMid(
        match(Terminals.OpenSquare),
        sepBy(this.Value, match(Terminals.Comma)),
        match(Terminals.CloseSquare)
      ),
      toArray
    );
  },
  String() {
    return map(StringLiteral, toString);
  },
  Number() {
    return map(NumberLiteral, toNumber);
  },
  Boolean() {
    return map(choice(match(Keywords.True), match(Keywords.False)), toBoolean);
  },
  Null() {
    return map(match(Keywords.Null), toNull);
  },
  Value() {
    return choice(this.Object, this.Array, this.String, this.Number, this.Boolean, this.Null);
  }
});
function parse(text) {
  const result = run(Json.Root).with(text);
  switch (result.isOk) {
    case true: {
      return result.value;
    }
    case false: {
      return {
        type: "object",
        values: []
      };
    }
  }
}

export { parse };
//# sourceMappingURL=out.js.map
//# sourceMappingURL=sigma-grammar.js.map