type Point = struct {
    x: byte;
    y: byte;
};

function main(): byte {
    var p1 = Point { x=0x1, y=0x2 };
    var p2 = Point { x=0x10, y=0x20 };
    var p3 = Point { x=0x100, y=0x200 };
    return add(p1, 0x5, p2, 0x55, p3);
}

function add(p1: Point, b1: byte, p2: Point, b2: byte, p3: Point): byte {
    p1;
    p2;
    p3;
    return p1.x + p2.x + p3.x;
}
