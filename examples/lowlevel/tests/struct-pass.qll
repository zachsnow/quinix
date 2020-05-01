type Point = struct {
    x: byte;
    y: byte;
};

function main(): byte {
    var p: Point;
    p.x = 1;
    p.y = 2;
    add(p);
    return p.x;
}

function add(p: Point): byte {
    p.x = 2;
    return p.x + p.y;
}
