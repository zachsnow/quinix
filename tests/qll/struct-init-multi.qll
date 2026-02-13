// @expect: 30
// @cycles: 5000
type Point = struct {
  x: byte;
  y: byte;
};

function main(): byte {
  var points: Point[3] = [
    Point { x = 10, y = 20 },
    Point { x = 30, y = 40 },
    Point { x = 50, y = 60 },
  ];
  return points[1].x;
}
