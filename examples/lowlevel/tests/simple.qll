type Point = struct {
  x: byte;
  y: byte;
};

function main(): byte {
  var p: Point[] = [
    Point {
      x = 10,
      y = 20,
    },
    Point {
      x = 30,
      y = 40,
    },
  ];
  return p[0].x + p[1].y;
}
