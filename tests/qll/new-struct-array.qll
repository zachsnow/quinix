// @expect: 0x55
// @libs: alloc
type Point = struct { x: byte; y: byte; };
function main(): byte {
  var ps = new Point[3] [
    Point {
      x = 0x55,
      y = 0x66,
    },
    Point {
      x = 0x77,
      y = 0x88,
    },
    Point {
      x = 0x99,
      y = 0xaa,
    },
  ];
  return ps[0].x;
}
