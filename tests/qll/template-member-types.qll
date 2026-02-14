// @skip: requires dependent types (T.x return type syntax)
type point2d = struct {
  x: byte;
  y: byte;
};

type point3d = struct {
  x: byte;
  y: byte;
  z: byte;
};

namespace point {
  function x<T>(p: T): T.x {
    return p.x;
  }
}

function main(): byte {
  var p1 = point2d {
    x = 10,
    y = 20,
  };
  var p2 = point3d {
    x = 11,
    y = 22,
    z = 33,
  };

  return point::x(p1) + point::x(p2);
}
