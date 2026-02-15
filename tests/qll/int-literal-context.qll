// @expect: 3
// Numeric literal contextual typing: negative literals, left-side peer context.
function main(): byte {
  var a: int = -3;       // negative literal, annotation context
  var b: int = 0 - a;    // literal on left, peer context from a
  if (a < 0) {           // literal on right, peer context from a
    return <unsafe byte>b;
  }
  return 0;
}
