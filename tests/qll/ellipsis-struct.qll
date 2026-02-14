// @expect: 66
// @libs: alloc
type Point = struct { x: byte; y: byte; };
function main(): byte {
  var ps = new Point[7] ... Point {
    x = 55,
    y = 66,
  };
  return ps[4].y;
}
