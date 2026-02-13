// @expect: 101
type Point = struct {
  x: byte;
  y: byte;
};

function main(): byte {
  var p: Point;
  p.x = 101;
  p.y = 102;
  return fn(p);
}

function fn(p: Point): byte {
  return p.x;
}
