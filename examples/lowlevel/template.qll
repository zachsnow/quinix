type point_list = struct {
  x: byte;
  y: byte;
  next: * point_list;
};

type point = struct {
  x: byte;
  y: byte;
};

function printn(n: byte): void {
  var buffer: byte[16];
  std::string::itoa(n, buffer, 10);
  std::console::print(buffer);
}

function print_point<T>(p: T): void {
  var buffer: byte[16];
  std::console::print('(');
  printn(p.x);
  std::console::print(', ');
  printn(p.y);
  std::console::print(')\n');
}

function main(): byte {
  // Vectors.
  std::console::print('Vector:\n');
  var v: point[] = new point[] = [
    point {
      x = 110,
      y = 120,
    },
    point {
      x = 130,
      y = 140,
    }
  ];

  std::vector::foreach(v, print_point<point>);
  std::vector::add(&v, point {
    x = 150,
    y = 160,
  });

  std::console::print('Added:\n');
  std::vector::foreach(v, print_point<point>);
  return capacity v;
}
