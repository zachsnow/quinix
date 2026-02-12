// @skip: references std::fmt which does not exist
type Point = struct {
  x: byte;
  y: byte;
};

function point(x: byte, y: byte): Point {
  return Point { x = x, y = y };
}

function main(): byte {
  var p = point(1, 2);

  std::fmt::print([
    std::fmt::fi(p.x),
    std::fmt::fs(", "),
    std::fmt::fi(p.y),
    std::fmt::fs("\n"),
  ]);

  return p.x + p.y;
}
