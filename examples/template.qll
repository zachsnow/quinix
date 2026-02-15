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
  var s = std::str::itoa(n, buffer, 10);
  std::console::print(s);
}

function print_point<T>(p: T): void {
  std::console::print("(");
  printn(p.x);
  std::console::print(", ");
  printn(p.y);
  std::console::print(")\n");
}

function print_point_list(p: * point_list): void {
  print_point(*p);
}

function main(): byte {
  play();
  return 0;
}

function play(): void {
  // Vectors.
  std::console::print("Vector:\n");
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

  std::console::print("Added:\n");
  std::vector::foreach(v, print_point<point>);

  // Intrusive lists.
  std::console::print("Intrusive list:\n");
  var i: * point_list = new point_list = point_list {
    x = 10,
    y = 20,
    next = new point_list = point_list {
      x = 30,
      y = 40,
      next = null,
    },
  };
  std::ilist::foreach(i, print_point_list);
}
