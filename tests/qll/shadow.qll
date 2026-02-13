// @expect: 44
function main(): byte {
  return foo::fn();
}

global i: byte = 44;

namespace foo {
  global i: byte = 22;

  function fn(): byte {
    return global::i;
  }
}
