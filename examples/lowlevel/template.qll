type point = struct {
  x: byte;
  y: byte;
  next: * point;
};

function print_point(p: *point): void {
  var buffer: byte[16];
  std::console::print('(');
  std::string::itoa(p->x, buffer, 10);
  std::console::print(buffer);
  std::console::print(', ');
  std::string::itoa(p->y, buffer, 10);
  std::console::print(buffer);
  std::console::print(')\n');
}

function destroy_point(p: *point): void {
  delete p;
}

function main(): byte {
  var points: * point = new point = point {
    x = 10,
    y = 20,
    next = new point = point {
      x = 30,
      y = 40,
      next = null,
    },
  };

  var p3 = new point = point {
    x = 50,
    y = 60,
    next = null,
  };

  std::ilist::foreach(points, print_point);

  std::ilist::add(&points, p3);

  std::console::print('added:\n');
  std::ilist::foreach(points, print_point);

  var length = std::ilist::length(points);

  std::ilist::foreach(points, destroy_point);

  return length;
}
