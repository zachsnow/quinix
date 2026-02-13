// @expect: 3
// @cycles: 5000
type Point = struct {
  x: byte;
  y: byte;
};

function point(x: byte, y: byte): Point {
  return Point { x = x, y = y };
}

function main(): byte {
  var p = point(1, 2);
  return p.x + p.y;
}
