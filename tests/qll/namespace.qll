// @skip: uses unqualified namespace reference syntax
using global::oops;
namespace bar {
  using bleck;
  function baz(): byte {
    return frob;
  }
}
namespace bleck {
  global frob: byte = 12;
}
namespace oops {
  global frob: byte = 15;
}
function main(): byte {
  return bar::baz() + frob;
}
